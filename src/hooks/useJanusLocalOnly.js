// src/hooks/useJanusLocalOnly.js
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useJanusLocalOnly (ref-minimized, stable final)
 * - UI 단일 진실: localMedia
 * - 주요 안정화:
 *   1) leaveRoom ref화(항상 최신 finalize)
 *   2) boot timeout(조인 멈춤 1회 복구)
 *   3) display fallback 강화(remote 매칭 깨짐 방지)
 *   4) wantVideo 필터 시 videoLost 강제 해제(“끊김 오판” 방지)
 *
 * ✅ 실무 표준 오토플레이/정책 대응:
 *   - 입장 기본: 마이크 OFF (wantAudio=false)
 *   - 비디오는 가능하면 ON (wantVideo=true)
 *   - 오디오는 "사용자 버튼"으로 toggleAudio 했을 때만 송출 시작
 */
export function useJanusLocalOnly(
    serverUrl = "https://janus.jsflux.co.kr/janus",
    options = {}
) {
    // =========================================================
    // 0) callbacks refs (항상 최신 콜백)
    // =========================================================
    const callbacksRef = useRef({
        onRemoteParticipantsChanged: null,
        onLocalStream: null,
    });

    useEffect(() => {
        callbacksRef.current.onRemoteParticipantsChanged =
            options?.onRemoteParticipantsChanged || null;
    }, [options?.onRemoteParticipantsChanged]);

    useEffect(() => {
        callbacksRef.current.onLocalStream = options?.onLocalStream || null;
    }, [options?.onLocalStream]);

    // mounted guard
    const mountedRef = useRef(false);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const safeSet = useCallback((fn) => {
        if (!mountedRef.current) return;
        fn();
    }, []);

    // =========================================================
    // 1) State (UI용)
    // =========================================================
    const [isSupported, setIsSupported] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);

    // ✅ 실무 기본값: 입장 마이크 OFF / 비디오 ON
    const DEFAULT_WANT_AUDIO = false;
    const DEFAULT_WANT_VIDEO = true;

    // 호환/디버그용 (UI는 localMedia만 보게 설계)
    const [audioEnabled, setAudioEnabled] = useState(DEFAULT_WANT_AUDIO);
    const [videoEnabled, setVideoEnabled] = useState(DEFAULT_WANT_VIDEO);
    const [isVideoDeviceLost, setIsVideoDeviceLost] = useState(false);
    const [noMediaDevices, setNoMediaDevices] = useState(false);

    // ✅ UI 단일 진실(localMedia)
    const [localMedia, setLocalMedia] = useState({
        audio: DEFAULT_WANT_AUDIO,
        video: DEFAULT_WANT_VIDEO,
        videoDeviceLost: false,
        noMediaDevices: false,
        liveAudio: false,
        liveVideo: false,
    });

    // =========================================================
    // 2) Refs (최소 덩어리)
    // =========================================================
    // ✅ 세션 세대(이전 async 이벤트 무효화)
    const genRef = useRef(0); // join/leave마다 증가
    const closingRef = useRef(false); // leave 시작~finalize까지 true

    // ✅ leave 완료를 기다릴 수 있게 Promise 제공
    const leaveWaitRef = useRef({
        promise: null,
        resolve: null,
    });

    const resetLeaveWait = useCallback(() => {
        leaveWaitRef.current.promise = new Promise((res) => {
            leaveWaitRef.current.resolve = res;
        });
    }, []);

    useEffect(() => {
        if (!leaveWaitRef.current.promise) resetLeaveWait();
    }, [resetLeaveWait]);

    const bumpGen = useCallback(() => {
        genRef.current += 1;
        return genRef.current;
    }, []);

    const isStale = useCallback((myGen) => {
        return closingRef.current || myGen !== genRef.current;
    }, []);

    const janusRef = useRef({
        janus: null,
        pub: null,
        privateId: null,
        remote: {}, // feedId -> { handle, feedId, display, stream }
        remotePending: {},
        localStream: null,
    });

    const connRef = useRef({
        isConnected: false,
        isConnecting: false,
    });

    useEffect(() => {
        connRef.current.isConnected = isConnected;
    }, [isConnected]);

    useEffect(() => {
        connRef.current.isConnecting = isConnecting;
    }, [isConnecting]);

    const sessionRef = useRef({
        inited: false,
        destroying: false,
        joined: false,
        lastJoin: null, // {roomNumber, displayName}
        bootRetryCount: 0,
    });

    const timersRef = useRef({
        notify: null,
        deviceDebounce: null,
        deviceCooldown: 0,
        boot: null, // ✅ boot timeout
    });

    // “사용자 의도”의 단일 진실
    const mediaRef = useRef({
        // ✅ 기본: 오디오 OFF / 비디오 ON
        wantAudio: DEFAULT_WANT_AUDIO,
        wantVideo: DEFAULT_WANT_VIDEO,

        noDevices: false,
        hasAudioDevice: true,
        hasVideoDevice: true,

        videoLost: false, // “영상 현재 불가”로 판단되는 상태
        permissionDeniedVideo: false,
    });

    const negotiationRef = useRef({
        locked: false,
        pending: null, // { audio: intentAudio, video: intentVideo }
    });

    const publishedRef = useRef(false);
    const lastConfiguredRef = useRef({ audio: null, video: null });
    // ✅ “수동 재연결 로직”을 훅 내부에서 재사용하기 위한 ref
    const hardReconnectRef = useRef(null);

    // ✅ track dead 이후, devicechange가 안 와도 1회 재시도 트리거용
    const deadRetryTimerRef = useRef(null);
    // =========================================================
    // 3) Utils
    // =========================================================
    const hasAnyTrack = useCallback((stream, kind) => {
        if (!stream) return false;
        const tracks =
            kind === "video"
                ? stream.getVideoTracks?.() || []
                : stream.getAudioTracks?.() || [];
        return tracks.length > 0;
    }, []);

    const hasLiveTrack = useCallback((stream, kind) => {
        if (!stream) return false;
        const tracks =
            kind === "video"
                ? stream.getVideoTracks?.()
                : stream.getAudioTracks?.();
        return (
            Array.isArray(tracks) && tracks.some((t) => t.readyState === "live")
        );
    }, []);

    const clearTimer = useCallback((key) => {
        const t = timersRef.current[key];
        if (t) {
            window.clearTimeout(t);
            timersRef.current[key] = null;
        }
    }, []);

    // =========================================================
    // 4) Device availability
    // =========================================================
    const refreshDeviceAvailability = useCallback(async () => {
        const md = navigator.mediaDevices;
        if (!md?.enumerateDevices) {
            mediaRef.current.noDevices = true;
            mediaRef.current.hasAudioDevice = false;
            mediaRef.current.hasVideoDevice = false;

            safeSet(() => setNoMediaDevices(true));
            return { hasAudio: false, hasVideo: false, noMediaDevices: true };
        }

        const devices = await md.enumerateDevices().catch(() => null);
        if (!devices) return null;

        const hasAudio = devices.some((d) => d.kind === "audioinput");
        const hasVideo = devices.some((d) => d.kind === "videoinput");
        const none = !hasAudio && !hasVideo;

        mediaRef.current.noDevices = none;
        mediaRef.current.hasAudioDevice = hasAudio;
        mediaRef.current.hasVideoDevice = hasVideo;

        safeSet(() => setNoMediaDevices(none));
        return { hasAudio, hasVideo, noMediaDevices: none };
    }, [safeSet]);

    useEffect(() => {
        refreshDeviceAvailability();
    }, [refreshDeviceAvailability]);

    // =========================================================
    // 5) Local media snapshot (UI 단일 진실 갱신)
    // =========================================================
    const emitLocalMediaState = useCallback(() => {
        const s = janusRef.current.localStream;
        const liveAudio = hasLiveTrack(s, "audio");
        const liveVideo = hasLiveTrack(s, "video");

        const wantAudio = !!mediaRef.current.wantAudio;
        const wantVideo = !!mediaRef.current.wantVideo;

        const videoDeviceLost =
            !!mediaRef.current.videoLost ||
            (!!wantVideo &&
                !liveVideo &&
                !!mediaRef.current.hasVideoDevice &&
                !mediaRef.current.noDevices);

        const next = {
            audio: wantAudio,
            video: wantVideo,
            videoDeviceLost: !!videoDeviceLost,
            noMediaDevices: !!mediaRef.current.noDevices,
            liveAudio: !!liveAudio,
            liveVideo: !!liveVideo,
        };

        safeSet(() => {
            setLocalMedia((prev) => {
                const same =
                    prev.audio === next.audio &&
                    prev.video === next.video &&
                    prev.videoDeviceLost === next.videoDeviceLost &&
                    prev.noMediaDevices === next.noMediaDevices &&
                    prev.liveAudio === next.liveAudio &&
                    prev.liveVideo === next.liveVideo;
                return same ? prev : next;
            });

            // 호환 state도 정렬
            setAudioEnabled(wantAudio);
            setVideoEnabled(wantVideo);
            setIsVideoDeviceLost(!!videoDeviceLost);
            setNoMediaDevices(!!mediaRef.current.noDevices);
        });
    }, [hasLiveTrack, safeSet]);

    // =========================================================
    // 6) Remote participants notify (debounce)
    // =========================================================
    const flushRemoteParticipants = useCallback(() => {
        timersRef.current.notify = null;

        const fn = callbacksRef.current.onRemoteParticipantsChanged;
        if (typeof fn !== "function") return;

        const list = Object.values(janusRef.current.remote || {}).map(
            (info) => {
                const stream = info.stream || null;

                const audioTracks = stream?.getAudioTracks?.() || [];
                const videoTracks = stream?.getVideoTracks?.() || [];

                const hasAnyTrack =
                    audioTracks.length > 0 || videoTracks.length > 0;

                // (선택) 기존 호환 정보 유지용
                const hasLiveVideo = hasLiveTrack(stream, "video");
                const hasLiveAudio = hasLiveTrack(stream, "audio");

                return {
                    feedId: info.feedId,
                    id: info.feedId,

                    // display 원문
                    display: info.display,
                    stream,

                    // ✅ display JSON 파싱해서 userId/name/role 같이 내려주기
                    ...(typeof info.display === "string"
                        ? (() => {
                              try {
                                  const parsed = JSON.parse(info.display);
                                  return {
                                      userId: parsed?.userId ?? null,
                                      name: parsed?.name ?? null,
                                      role: parsed?.role ?? null,
                                  };
                              } catch {
                                  return {
                                      userId: null,
                                      name: null,
                                      role: null,
                                  };
                              }
                          })()
                        : { userId: null, name: null, role: null }),

                    hasLiveVideo: stream
                        ? hasLiveTrack(stream, "video")
                        : false,
                    hasLiveAudio: stream
                        ? hasLiveTrack(stream, "audio")
                        : false,

                    // ✅ stream이 없으면 “dead로 확정”하지 말고 false 처리(= 아직 연결중일 수 있음)
                    dead: stream
                        ? !(audioTracks.length > 0 || videoTracks.length > 0)
                        : false,

                    // ✅ stream이 없으면 true 주지 말기 (여기가 지금 네 UI를 ‘꺼짐 고정’시키는 원인)
                    videoDead: stream ? videoTracks.length === 0 : false,
                };
            }
        );

        try {
            fn(list);
        } catch (e) {
            console.error(
                "[useJanusLocalOnly] onRemoteParticipantsChanged error",
                e
            );
        }
    }, [hasLiveTrack]);

    const notifyRemoteParticipantsChanged = useCallback(() => {
        if (timersRef.current.notify) return;
        timersRef.current.notify = window.setTimeout(
            flushRemoteParticipants,
            80
        );
    }, [flushRemoteParticipants]);

    // =========================================================
    // 7) Local stream setter (track dead 감지)
    // =========================================================
    const localGenRef = useRef(0);

    const setLocalStream = useCallback(
        (stream) => {
            janusRef.current.localStream = stream || null;

            const fn = callbacksRef.current.onLocalStream;
            if (typeof fn === "function") {
                try {
                    fn(stream || null);
                } catch (e) {
                    console.error("[useJanusLocalOnly] onLocalStream error", e);
                }
            }

            localGenRef.current += 1;
            const myGen = localGenRef.current;

            if (!stream) {
                emitLocalMediaState();
                return;
            }

            stream.getVideoTracks?.().forEach((track) => {
                const onDead = () => {
                    if (deadRetryTimerRef.current)
                        window.clearTimeout(deadRetryTimerRef.current);
                    deadRetryTimerRef.current = window.setTimeout(() => {
                        deadRetryTimerRef.current = null;

                        // ✅ leave/closing 중이면 절대 reconnect 금지
                        if (closingRef.current || sessionRef.current.destroying)
                            return;

                        if (!connRef.current.isConnected) return;
                        if (mediaRef.current.permissionDeniedVideo) return;
                        if (negotiationRef.current.locked) return;
                        reinjectIfPossible();
                    }, 600);
                };

                track.onended = onDead;
                if (track.oninactive == null) track.oninactive = onDead;
            });

            emitLocalMediaState();
        },
        [emitLocalMediaState, hasLiveTrack, safeSet]
    );

    // =========================================================
    // 8) Negotiation helpers
    // =========================================================
    const publishLocalStreamRef = useRef(null);

    const lockNegotiation = useCallback(() => {
        if (negotiationRef.current.locked) return false;
        negotiationRef.current.locked = true;
        return true;
    }, []);

    const unlockNegotiation = useCallback(() => {
        negotiationRef.current.locked = false;

        const pending = negotiationRef.current.pending;
        if (!pending) return;
        if (mediaRef.current.permissionDeniedVideo) {
            negotiationRef.current.pending = null;
            return;
        }
        negotiationRef.current.pending = null;
        publishLocalStreamRef.current?.(pending.audio, pending.video, {
            republish: true,
        });
    }, []);

    // =========================================================
    // 9) publish / republish (의도값 -> 실제값)
    // =========================================================
    const publishLocalStream = useCallback(
        async (intentAudio = true, intentVideo = true, opts = {}) => {
            const Janus = window.Janus;
            const handle = janusRef.current.pub;
            if (!Janus || !handle) return;
            const intentVideoSafe = mediaRef.current.permissionDeniedVideo
                ? false
                : !!intentVideo;
            // ✅ “사용자 의도” 업데이트
            mediaRef.current.wantAudio = !!intentAudio;
            mediaRef.current.wantVideo = !!intentVideo;

            safeSet(() => {
                setAudioEnabled(!!intentAudio);
                setVideoEnabled(!!intentVideo);
            });

            // 최신 디바이스 스냅샷
            await refreshDeviceAvailability().catch(() => null);

            const noDev = !!mediaRef.current.noDevices;
            const hasA = !!mediaRef.current.hasAudioDevice;
            const hasV = !!mediaRef.current.hasVideoDevice;

            // ✅ 실제로 Janus에 보낼 값(디바이스 기반 필터)
            const wantAudio = !!intentAudio && !noDev && hasA;
            const wantVideo = !!intentVideoSafe && !noDev && hasV;

            // ✅ (핵심) 필터 결과로 wantVideo가 false면 lost는 무조건 false
            if (!wantVideo) {
                mediaRef.current.videoLost = false;
                safeSet(() => setIsVideoDeviceLost(false));
            }

            emitLocalMediaState();

            // 미디어 없이 참가
            if (!wantAudio && !wantVideo) {
                try {
                    handle.send({
                        message: {
                            request: "configure",
                            audio: false,
                            video: false,
                        },
                    });
                    publishedRef.current = true;
                    safeSet(() => setIsConnecting(false));
                    emitLocalMediaState();
                } catch {
                    safeSet(() =>
                        setError(
                            "미디어 없이 참가 처리 중 오류가 발생했습니다."
                        )
                    );
                    safeSet(() => setIsConnecting(false));
                }
                return;
            }

            // 협상 락
            if (!lockNegotiation()) {
                negotiationRef.current.pending = {
                    audio: !!intentAudio,
                    video: !!intentVideo,
                };
                return;
            }

            const prev = lastConfiguredRef.current;
            const republish = !!opts.republish || publishedRef.current;

            const replaceAudio = republish ? prev.audio !== !!wantAudio : true;
            const replaceVideo = republish ? prev.video !== !!wantVideo : true;

            handle.createOffer({
                media: {
                    audioRecv: false,
                    videoRecv: false,
                    audioSend: !!wantAudio,
                    videoSend: !!wantVideo,
                    replaceAudio,
                    replaceVideo,
                },
                success: (jsep) => {
                    try {
                        handle.send({
                            message: {
                                request: "configure",
                                audio: !!wantAudio,
                                video: !!wantVideo,
                            },
                            jsep,
                        });

                        publishedRef.current = true;
                        lastConfiguredRef.current = {
                            audio: !!wantAudio,
                            video: !!wantVideo,
                        };

                        // 성공이면 videoLost 해제
                        if (wantVideo) {
                            mediaRef.current.videoLost = false;
                            mediaRef.current.permissionDeniedVideo = false;
                            safeSet(() => setIsVideoDeviceLost(false));
                        }

                        const latest =
                            handle?.webrtcStuff?.myStream ||
                            handle?.webrtcStuff?.stream ||
                            null;
                        if (latest) setLocalStream(latest);

                        safeSet(() => setIsConnecting(false));
                        emitLocalMediaState();
                    } finally {
                        unlockNegotiation();
                    }
                },
                error: async (err) => {
                    console.error(
                        "[useJanusLocalOnly] createOffer error:",
                        err
                    );

                    const name = err?.name || "";
                    const msg = String(err?.message || "").toLowerCase();

                    const isPermissionDenied =
                        name === "NotAllowedError" ||
                        name === "PermissionDeniedError" ||
                        msg.includes("permission") ||
                        msg.includes("denied");

                    const isDeviceNotFound =
                        name === "NotFoundError" ||
                        name === "DevicesNotFoundError" ||
                        msg.includes("notfound") ||
                        msg.includes("device not found") ||
                        msg.includes("no capture device");

                    negotiationRef.current.pending = null;
                    unlockNegotiation();
                    // 1) 권한 거부: video 의도를 내려 루프 차단

                    const pc = janusRef.current.pub?.webrtcStuff?.pc;
                    const pcDead =
                        !pc ||
                        pc.connectionState === "closed" ||
                        pc.iceConnectionState === "closed";

                    if (pcDead) {
                        safeSet(() => setIsConnecting(false));
                        hardReconnectRef.current?.("createOffer.pc-dead");
                        return;
                    }

                    if (isPermissionDenied) {
                        // ✅ 의도는 ON 유지 (무조건 카메라 ON 정책)
                        // mediaRef.current.wantVideo = false; // ❌ 제거
                        negotiationRef.current.pending = null;
                        negotiationRef.current.locked = false;

                        mediaRef.current.videoLost = true;
                        mediaRef.current.permissionDeniedVideo = true;
                        try {
                            setLocalStream(null);
                        } catch {}
                        safeSet(() => {
                            // 의도는 ON으로 두되, 실제 송출은 실패했으니 lost만 올린다
                            setVideoEnabled(true); // ✅ 사용자 의도 ON
                            setIsVideoDeviceLost(true); // ✅ 현재 불가 상태 표시
                            setIsConnecting(false);
                            setError(
                                "카메라 권한이 거부되어 영상 송출을 시작할 수 없습니다. 브라우저 권한을 허용한 뒤 다시 시도해 주세요."
                            );
                        });
                        try {
                            const a =
                                !!mediaRef.current.wantAudio &&
                                !mediaRef.current.noDevices &&
                                !!mediaRef.current.hasAudioDevice;
                            handle.send({
                                message: {
                                    request: "configure",
                                    audio: a,
                                    video: false,
                                },
                            });
                            publishedRef.current = true;
                            lastConfiguredRef.current = {
                                audio: a,
                                video: false,
                            };
                        } catch {}
                        emitLocalMediaState();
                        return;
                    }

                    // 2) 장치 없음: “원래 없음” 처리 + audio-only 폴백
                    if (isDeviceNotFound) {
                        await refreshDeviceAvailability().catch(() => null);

                        mediaRef.current.videoLost = false;
                        safeSet(() => setIsVideoDeviceLost(false));
                        safeSet(() => setIsConnecting(false));
                        emitLocalMediaState();

                        if (mediaRef.current.noDevices) {
                            return publishLocalStreamRef.current?.(
                                false,
                                false,
                                { republish: true }
                            );
                        }
                        if (mediaRef.current.hasAudioDevice) {
                            return publishLocalStreamRef.current?.(
                                true,
                                false,
                                { republish: true }
                            );
                        }
                        return publishLocalStreamRef.current?.(false, false, {
                            republish: true,
                        });
                    }

                    // 3) 기타 에러: video 실패면 videoLost 올리고 audio-only 폴백
                    if (wantVideo) {
                        mediaRef.current.videoLost = true;
                        safeSet(() => setIsVideoDeviceLost(true));
                        emitLocalMediaState();
                        safeSet(() => setIsConnecting(false));
                        return publishLocalStreamRef.current?.(
                            !!intentAudio,
                            false,
                            {
                                republish: true,
                            }
                        );
                    }

                    safeSet(() => setIsConnecting(false));
                },
            });
        },
        [
            emitLocalMediaState,
            lockNegotiation,
            refreshDeviceAvailability,
            safeSet,
            setLocalStream,
            unlockNegotiation,
        ]
    );

    useEffect(() => {
        publishLocalStreamRef.current = publishLocalStream;
    }, [publishLocalStream]);

    // =========================================================
    // 10) Remote feed attach/detach/reset
    // =========================================================
    const detachRemoteFeed = useCallback(
        (feedId, { skipHandleCleanup = false } = {}) => {
            const info = janusRef.current.remote?.[feedId];
            // ✅ pending도 같이 제거
            delete janusRef.current.remotePending?.[feedId];

            if (!info) return;

            if (!skipHandleCleanup) {
                try {
                    info.handle?.hangup?.();
                    info.handle?.detach?.();
                } catch {}
            }
            delete janusRef.current.remote[feedId];
        },
        []
    );

    const resetRemoteFeeds = useCallback(() => {
        try {
            Object.values(janusRef.current.remote || {}).forEach((info) => {
                try {
                    info.handle?.hangup?.();
                    info.handle?.detach?.();
                } catch {}
            });
        } catch {}
        janusRef.current.remote = {};
        janusRef.current.remotePending = {}; // ✅ 추가
        notifyRemoteParticipantsChanged();
    }, [notifyRemoteParticipantsChanged]);

    const newRemoteFeed = useCallback(
        (feedId, display, roomNumber) => {
            const myGen = genRef.current;
            const Janus = window.Janus;
            if (!Janus || !janusRef.current.janus) return;

            const existing = janusRef.current.remote[feedId];
            if (existing) {
                const pcAlive = !!existing.handle?.webrtcStuff?.pc;
                const hasStream = !!existing.stream;

                if (pcAlive && hasStream) return; // 정상일 때만 중복 차단

                // ✅ 죽었으면 정리 후 재attach 허용
                detachRemoteFeed(feedId);
            }
            if (janusRef.current.remotePending?.[feedId]) return;

            janusRef.current.remotePending[feedId] = true; // ✅ in-flight 마킹

            const safeDisplay =
                display ??
                JSON.stringify({
                    name: `User${feedId}`,
                    role: "PARTICIPANT",
                    userId: null,
                });

            janusRef.current.janus.attach({
                plugin: "janus.plugin.videoroom",

                success: (handle) => {
                    if (isStale(myGen)) {
                        delete janusRef.current.remotePending[feedId]; // ✅ 정리
                        try {
                            handle?.detach?.();
                        } catch {}
                        return;
                    }

                    // ✅ 이제 remote에 등록 + pending 해제
                    delete janusRef.current.remotePending[feedId];
                    janusRef.current.remote[feedId] = {
                        handle,
                        feedId,
                        display: safeDisplay,
                        stream: null,
                    };

                    const subscribe = {
                        request: "join",
                        room: Number(roomNumber),
                        ptype: "subscriber",
                        feed: feedId,
                    };
                    if (janusRef.current.privateId)
                        subscribe.private_id = janusRef.current.privateId;

                    handle.send({ message: subscribe });
                    notifyRemoteParticipantsChanged();
                },

                error: (err) => {
                    delete janusRef.current.remotePending[feedId]; // ✅ 정리
                    if (isStale(myGen)) return;
                    console.error("[subscriber] attach error:", err);
                },

                onmessage: (msg, jsep) => {
                    if (isStale(myGen)) return;
                    if (!jsep) return;

                    const info = janusRef.current.remote[feedId];
                    const handle = info?.handle;
                    if (!handle) return;

                    // offer만 처리
                    const jtype = jsep?.type;
                    if (jtype && jtype !== "offer") return;

                    // ✅ "이 offer를 처리하는 동안 cleanup/destroy 되면" success 콜백에서 막기 위해 토큰 발급
                    info.answerToken = (info.answerToken || 0) + 1;
                    const token = info.answerToken;

                    handle.createAnswer({
                        jsep,
                        media: {
                            audioSend: false,
                            videoSend: false,
                            audioRecv: true,
                            videoRecv: true,
                        },
                        success: (jsepAnswer) => {
                            // ✅ 1) stale이면 중단
                            if (isStale(myGen)) return;

                            // ✅ 2) feed 정보가 없어졌거나 handle이 바뀌었으면 중단
                            const cur = janusRef.current.remote?.[feedId];
                            if (!cur) return;
                            if (cur.handle !== handle) return;

                            // ✅ 3) 최신 토큰이 아니면(더 최신 offer 처리 중이면) 중단
                            if (cur.answerToken !== token) return;

                            // ✅ 4) Janus가 이미 WebRTC stuff 정리했으면 중단 (pc가 죽은 상태)
                            const pc = handle?.webrtcStuff?.pc;
                            if (!pc) return;

                            handle.send({
                                message: {
                                    request: "start",
                                    room: Number(roomNumber),
                                },
                                jsep: jsepAnswer,
                            });
                        },
                        error: (err) => {
                            if (isStale(myGen)) return;
                            console.error(
                                "[subscriber] createAnswer error:",
                                err
                            );
                        },
                    });
                },

                onremotestream: (stream) => {
                    if (isStale(myGen)) return;

                    const prev = janusRef.current.remote[feedId];
                    if (!prev) return;
                    janusRef.current.remote[feedId] = { ...prev, stream };
                    notifyRemoteParticipantsChanged();
                },

                oncleanup: () => {
                    if (isStale(myGen)) return;

                    // ✅ 1순위 실험: cleanup에서 feed를 삭제하지 않는다.
                    // 이유: 새 참여자 합류 타이밍에는 stream이 아직 붙기 전이라
                    // 300ms 체크로 삭제하면 "꺼짐"으로 고정될 수 있음.
                    // leaving/unpublished 이벤트에서만 detachRemoteFeed 하도록 한다.

                    const cur = janusRef.current.remote?.[feedId];
                    if (!cur) return;
                    const pc = cur.handle?.webrtcStuff?.pc;
                    if (!pc) {
                        detachRemoteFeed(feedId, { skipHandleCleanup: true });
                        notifyRemoteParticipantsChanged();

                        // (선택) resync 한번 더 당겨도 좋음
                        // janusRef.current.pub?.send({ message: { request:"listparticipants", room:Number(roomNumber) } ... });

                        return;
                    }
                    janusRef.current.remote[feedId] = { ...cur, stream: null };
                    notifyRemoteParticipantsChanged();

                    console.log("[subscriber] oncleanup (no detach)", {
                        feedId,
                        display: cur.display,
                    });
                },
            });
        },
        [detachRemoteFeed, notifyRemoteParticipantsChanged, isStale]
    );

    // =========================================================
    // 11) finalize / cleanup (연결만 정리)
    // =========================================================
    const finalize = useCallback(
        (reason = "finalize") => {
            sessionRef.current.joined = false;
            sessionRef.current.destroying = false;
            sessionRef.current.bootRetryCount = 0;

            clearTimer("notify");
            clearTimer("deviceDebounce");
            clearTimer("boot");

            resetRemoteFeeds();

            // local stream stop
            try {
                const s = janusRef.current.localStream;
                s?.getTracks?.().forEach((t) => {
                    try {
                        t.onended = null;
                        t.oninactive = null;
                        t.stop();
                    } catch {}
                });
            } catch {}
            janusRef.current.localStream = null;
            setLocalStream(null);

            // plugin/janus
            try {
                janusRef.current.pub?.hangup?.();
            } catch {}
            janusRef.current.pub = null;
            janusRef.current.privateId = null;
            janusRef.current.janus = null;

            // negotiation
            negotiationRef.current.locked = false;
            negotiationRef.current.pending = null;

            // publish state
            publishedRef.current = false;
            lastConfiguredRef.current = { audio: null, video: null };

            // ✅ 기본값으로 “의도”도 복구해두는 게 실무에서 안정적
            mediaRef.current.wantAudio = DEFAULT_WANT_AUDIO;
            mediaRef.current.wantVideo = DEFAULT_WANT_VIDEO;
            mediaRef.current.videoLost = false;

            safeSet(() => {
                setIsConnecting(false);
                setIsConnected(false);
                setError(null);

                setAudioEnabled(DEFAULT_WANT_AUDIO);
                setVideoEnabled(DEFAULT_WANT_VIDEO);
                setIsVideoDeviceLost(false);
            });
            if (deadRetryTimerRef.current) {
                window.clearTimeout(deadRetryTimerRef.current);
                deadRetryTimerRef.current = null;
            }

            connRef.current.isConnected = false;
            connRef.current.isConnecting = false;

            emitLocalMediaState();
            closingRef.current = false;
            leaveWaitRef.current.resolve?.();
            resetLeaveWait();
        },
        [
            clearTimer,
            emitLocalMediaState,
            resetRemoteFeeds,
            safeSet,
            setLocalStream,
        ]
    );

    const finalizeRef = useRef(finalize);
    useEffect(() => {
        finalizeRef.current = finalize;
    }, [finalize]);

    // =========================================================
    // 12) leaveRoom (ref-safe)
    // =========================================================
    const leaveRoomRef = useRef(null);

    const leaveRoomImpl = useCallback(
        (reason = "leaveRoom") => {
            if (sessionRef.current.destroying)
                return leaveWaitRef.current.promise;

            sessionRef.current.destroying = true;

            // ✅ 이전 세션 이벤트 무효화
            closingRef.current = true;
            bumpGen();

            clearTimer("boot");

            const janus = janusRef.current.janus;
            const pub = janusRef.current.pub;

            try {
                pub?.send?.({ message: { request: "leave" } });
            } catch {}

            // ✅ destroy가 async로 destroyed 콜백 타고 finalize될 수 있으니,
            //    finalize에서 resolve되게 한다.
            if (janus) {
                try {
                    janus.destroy();
                    return leaveWaitRef.current.promise;
                } catch {}
            }

            finalizeRef.current?.(`${reason}.noJanus`);
            return leaveWaitRef.current.promise;
        },
        [clearTimer]
    );

    useEffect(() => {
        leaveRoomRef.current = leaveRoomImpl;
    }, [leaveRoomImpl]);

    const leaveRoom = useCallback((reason) => {
        return leaveRoomRef.current?.(reason); // ✅ Promise 반환
    }, []);

    // =========================================================
    // 13) Create session & publisher attach (+ boot timeout mark)
    // =========================================================

    const createSessionAndAttach = useCallback(
        ({ roomNumber, displayName }) => {
            const myGen = genRef.current;
            const Janus = window.Janus;
            if (!Janus) return;

            sessionRef.current.joined = false;
            publishedRef.current = false;

            const janus = new Janus({
                server: serverUrl,
                success: () => {
                    if (isStale(myGen)) {
                        try {
                            janus.destroy();
                        } catch {}
                        return;
                    }
                    if (!mountedRef.current) {
                        try {
                            janus.destroy();
                        } catch {}
                        return;
                    }

                    janusRef.current.janus = janus;

                    janus.attach({
                        plugin: "janus.plugin.videoroom",
                        success: (handle) => {
                            if (isStale(myGen)) {
                                try {
                                    handle?.detach?.();
                                } catch {}
                                return;
                            }
                            janusRef.current.pub = handle;

                            handle.send({
                                message: {
                                    request: "join",
                                    room: Number(roomNumber),
                                    ptype: "publisher",
                                    display: displayName || "User",
                                },
                            });
                        },
                        error: (err) => {
                            if (isStale(myGen)) return;
                            console.error("[publisher] attach error:", err);
                            safeSet(() => {
                                setError(
                                    "videoroom attach 중 에러가 발생했습니다."
                                );
                                setIsConnecting(false);
                            });
                            connRef.current.isConnecting = false;
                            clearTimer("boot");
                        },
                        onmessage: (msg, jsep) => {
                            if (isStale(myGen)) return;
                            const data = msg?.plugindata?.data || msg || {};
                            const event = data.videoroom;
                            const errorCode = data.error_code;

                            // room not found -> create then join
                            if (event === "event" && errorCode === 426) {
                                const createBody = {
                                    request: "create",
                                    room: Number(roomNumber),
                                    publishers: 10,
                                    bitrate: 512000,
                                };

                                janusRef.current.pub?.send({
                                    message: createBody,
                                    success: (result) => {
                                        const d =
                                            result?.plugindata?.data ||
                                            result ||
                                            {};
                                        if (d.videoroom === "created") {
                                            janusRef.current.pub?.send({
                                                message: {
                                                    request: "join",
                                                    room: d.room,
                                                    ptype: "publisher",
                                                    display:
                                                        displayName || "User",
                                                },
                                            });
                                        }
                                    },
                                    error: (err) => {
                                        console.error(
                                            "[publisher] room create error:",
                                            err
                                        );
                                        safeSet(() => {
                                            setError(
                                                "회의 방 생성 중 오류가 발생했습니다."
                                            );
                                            setIsConnecting(false);
                                        });
                                        connRef.current.isConnecting = false;
                                        clearTimer("boot");
                                    },
                                });
                                return;
                            }

                            if (event === "joined") {
                                sessionRef.current.joined = true;
                                sessionRef.current.bootRetryCount = 0;

                                clearTimer("boot");

                                janusRef.current.privateId = data.private_id;

                                safeSet(() => {
                                    setIsConnected(true);
                                    setIsConnecting(false);
                                });

                                connRef.current.isConnected = true;
                                connRef.current.isConnecting = false;

                                // ✅ 입장 직후 publish: "마이크 OFF" 기본값으로 시작
                                publishLocalStreamRef.current?.(
                                    mediaRef.current.wantAudio, // false
                                    mediaRef.current.wantVideo, // true
                                    { republish: true }
                                );

                                const list = data.publishers || [];
                                if (list.length > 0) {
                                    list.slice()
                                        .sort((a, b) => a.id - b.id)
                                        .forEach((p) =>
                                            newRemoteFeed(
                                                p.id,
                                                p.display,
                                                roomNumber
                                            )
                                        );
                                    notifyRemoteParticipantsChanged();
                                }

                                const resync = () => {
                                    const h = janusRef.current.pub;
                                    if (!h) return;

                                    h.send({
                                        message: {
                                            request: "listparticipants",
                                            room: Number(roomNumber),
                                        },
                                        success: (result) => {
                                            const d =
                                                result?.plugindata?.data ||
                                                result ||
                                                {};
                                            const parts = d.participants || [];

                                            parts.forEach((p) => {
                                                if (!p?.id) return;
                                                if (
                                                    janusRef.current.remote[
                                                        p.id
                                                    ]
                                                )
                                                    return;
                                                newRemoteFeed(
                                                    p.id,
                                                    p.display,
                                                    roomNumber
                                                );
                                            });

                                            notifyRemoteParticipantsChanged();
                                        },
                                        error: () => {},
                                    });
                                };

                                resync();
                                window.setTimeout(resync, 1000);
                            }

                            if (event === "event") {
                                let changed = false;

                                const list = data.publishers || [];
                                if (list.length > 0) {
                                    list.forEach((p) =>
                                        newRemoteFeed(
                                            p.id,
                                            p.display,
                                            roomNumber
                                        )
                                    );
                                    changed = true;
                                }

                                const leaving = data.leaving;
                                if (leaving) {
                                    detachRemoteFeed(leaving);
                                    changed = true;
                                }

                                const unpublished = data.unpublished;
                                if (unpublished && unpublished !== "ok") {
                                    detachRemoteFeed(unpublished);
                                    changed = true;
                                }

                                if (changed) notifyRemoteParticipantsChanged();

                                if (data.error === "Room not found") {
                                    safeSet(() =>
                                        setError("회의 방이 종료되었습니다.")
                                    );
                                    try {
                                        janusRef.current.janus?.destroy();
                                    } catch {}
                                    return;
                                }
                            }

                            if (jsep && janusRef.current.pub) {
                                janusRef.current.pub.handleRemoteJsep({ jsep });
                            }
                        },
                        onlocalstream: (stream) => {
                            setLocalStream(stream);
                        },
                        oncleanup: () => {},
                    });
                },
                error: (err) => {
                    console.error("[useJanusLocalOnly] Janus error:", err);
                    safeSet(() => {
                        setError("Janus 세션 생성 중 에러가 발생했습니다.");
                        setIsConnecting(false);
                    });
                    connRef.current.isConnecting = false;
                    clearTimer("boot");
                },
                destroyed: () => {
                    finalizeRef.current?.("janus.destroyed");
                },
            });
        },
        [
            serverUrl,
            detachRemoteFeed,
            newRemoteFeed,
            notifyRemoteParticipantsChanged,
            safeSet,
            setLocalStream,
            clearTimer,
        ]
    );

    // =========================================================
    // 14) joinRoom (+ boot timeout / 1회 재시도)
    // =========================================================
    const joinRoomRef = useRef(null);

    const joinRoomImpl = useCallback(
        async ({ roomNumber, displayName }) => {
            const Janus = window.Janus;

            if (!Janus) {
                safeSet(() =>
                    setError("Janus 라이브러리가 아직 로드되지 않았습니다.")
                );
                return;
            }

            if (!Janus.isWebrtcSupported()) {
                safeSet(() => {
                    setIsSupported(false);
                    setError("이 브라우저는 WebRTC를 지원하지 않습니다.");
                });
                return;
            }
            if (sessionRef.current.destroying || closingRef.current) {
                await (leaveWaitRef.current.promise || Promise.resolve());
            }
            if (connRef.current.isConnecting || connRef.current.isConnected)
                return;

            sessionRef.current.destroying = false;
            sessionRef.current.joined = false;
            sessionRef.current.lastJoin = { roomNumber, displayName };
            sessionRef.current.bootRetryCount = 0;

            resetRemoteFeeds();

            safeSet(() => {
                setError(null);
                setIsConnecting(true);
            });
            connRef.current.isConnecting = true;

            await refreshDeviceAvailability().catch(() => null);

            if (
                mediaRef.current.noDevices ||
                !mediaRef.current.hasVideoDevice
            ) {
                mediaRef.current.videoLost = false;
                safeSet(() => setIsVideoDeviceLost(false));
            }
            emitLocalMediaState();

            const run = () => {
                createSessionAndAttach({ roomNumber, displayName });

                clearTimer("boot");
                timersRef.current.boot = window.setTimeout(() => {
                    timersRef.current.boot = null;

                    if (!mountedRef.current) return;
                    if (sessionRef.current.destroying) return;
                    if (sessionRef.current.joined) return;

                    if (sessionRef.current.bootRetryCount >= 1) {
                        safeSet(() => {
                            setIsConnecting(false);
                            setError(
                                "회의 연결이 지연되고 있습니다. 재접속을 시도해 주세요."
                            );
                        });
                        connRef.current.isConnecting = false;
                        return;
                    }

                    sessionRef.current.bootRetryCount += 1;

                    leaveRoomRef.current?.("boot-timeout");
                    window.setTimeout(() => {
                        const last = sessionRef.current.lastJoin;
                        if (last) joinRoomRef.current?.(last);
                    }, 600);
                }, 3500);
            };

            if (!sessionRef.current.inited) {
                Janus.init({
                    debug: "all",
                    callback: () => {
                        sessionRef.current.inited = true;
                        run();
                    },
                });
            } else {
                run();
            }
        },
        [
            createSessionAndAttach,
            emitLocalMediaState,
            refreshDeviceAvailability,
            resetRemoteFeeds,
            safeSet,
            clearTimer,
        ]
    );

    useEffect(() => {
        joinRoomRef.current = joinRoomImpl;
    }, [joinRoomImpl]);

    const joinRoom = useCallback((params) => {
        joinRoomRef.current?.(params);
    }, []);

    // =========================================================
    // 15) toggleAudio / toggleVideo
    // =========================================================
    const toggleAudio = useCallback(() => {
        const next = !mediaRef.current.wantAudio;
        mediaRef.current.wantAudio = next;

        safeSet(() => setAudioEnabled(next));
        emitLocalMediaState();

        if (!connRef.current.isConnected || !janusRef.current.pub) return;

        // ✅ 오디오 토글은 실무에서 “명확한 republish 트리거”
        publishLocalStreamRef.current?.(next, mediaRef.current.wantVideo, {
            republish: true,
        });
    }, [emitLocalMediaState, safeSet]);

    const toggleVideo = useCallback(() => {
        const next = !mediaRef.current.wantVideo;
        mediaRef.current.wantVideo = next;

        if (!mediaRef.current.permissionDeniedVideo) {
            mediaRef.current.videoLost = false;
        }

        safeSet(() => {
            setVideoEnabled(next);
            if (!mediaRef.current.permissionDeniedVideo)
                setIsVideoDeviceLost(false);
        });

        emitLocalMediaState();

        if (!connRef.current.isConnected || !janusRef.current.pub) return;
        publishLocalStreamRef.current?.(mediaRef.current.wantAudio, next, {
            republish: true,
        });
    }, [emitLocalMediaState, safeSet]);

    // =========================================================
    // 16) devicechange  (force hardReconnect)
    // =========================================================
    useEffect(() => {
        const md = navigator.mediaDevices;
        if (!md?.addEventListener || !md?.enumerateDevices) return;

        const onDeviceChange = () => {
            clearTimer("deviceDebounce");

            timersRef.current.deviceDebounce = window.setTimeout(async () => {
                timersRef.current.deviceDebounce = null;

                // 연결 중에만 의미 있음 (원하면 연결 전에도 lastJoin 있으면 시도 가능)
                if (!connRef.current.isConnected) return;

                // 과도한 연속 트리거 방지
                const now = Date.now();
                if (now - (timersRef.current.deviceCooldown || 0) < 1200)
                    return;
                timersRef.current.deviceCooldown = now;

                // 스냅샷 갱신(UI 정렬용)
                const snap = await refreshDeviceAvailability().catch(
                    () => null
                );
                if (!snap) return;

                // 디바이스 자체가 없거나 비디오가 없으면 -> lost 해제 후 종료
                if (snap.noMediaDevices || !snap.hasVideo) {
                    mediaRef.current.videoLost = false;
                    safeSet(() => setIsVideoDeviceLost(false));
                    emitLocalMediaState();
                    return;
                }
                if (mediaRef.current.permissionDeniedVideo) return;
                // ✅ 핵심: 디바이스가 “있다” => 바로 세션 재생성(하드 리커넥트)
                hardReconnectRef.current?.("devicechange");
            }, 250);
        };

        md.addEventListener("devicechange", onDeviceChange);
        return () => {
            md.removeEventListener("devicechange", onDeviceChange);
            clearTimer("deviceDebounce");
        };
    }, [clearTimer, emitLocalMediaState, refreshDeviceAvailability, safeSet]);

    // =========================================================
    // 17) Unmount cleanup
    // =========================================================
    useEffect(() => {
        return () => {
            leaveRoomRef.current?.("unmount");
        };
    }, []);

    const reinjectIfPossible = useCallback(() => {
        // 연결 안돼있으면 의미 없음
        if (!connRef.current.isConnected) return;
        if (!janusRef.current.pub) return;
        if (mediaRef.current.permissionDeniedVideo) return;
        if (negotiationRef.current.locked) return;
        // "의도" 기준으로 다시 publish
        publishLocalStreamRef.current?.(
            mediaRef.current.wantAudio,
            mediaRef.current.wantVideo,
            { republish: true }
        );
    }, []);

    useEffect(() => {
        emitLocalMediaState();
    }, [emitLocalMediaState]);

    // =========================================================
    // 18) Exports
    // =========================================================

    const hardReconnect = useCallback(async (reason = "hardReconnect") => {
        const last = sessionRef.current.lastJoin;
        if (!last) return;

        // 이미 종료 중이면 기다렸다가
        if (sessionRef.current.destroying || closingRef.current) {
            await (leaveWaitRef.current.promise || Promise.resolve());
        }

        // 연결돼있으면 깨끗이 leave 후 join
        try {
            await leaveRoomRef.current?.(reason);
        } catch {}

        // join 재시도
        joinRoomRef.current?.(last);
    }, []);

    useEffect(() => {
        hardReconnectRef.current = hardReconnect;
    }, [hardReconnect]);
    const retryVideoPermission = useCallback(() => {
        // ✅ 사용자가 브라우저 권한 허용한 후 누르는 버튼용
        mediaRef.current.permissionDeniedVideo = false;
        mediaRef.current.videoLost = false;
        safeSet(() => setIsVideoDeviceLost(false));
        setError(null);
        setIsConnecting(true);
        emitLocalMediaState();
        // 다시 publish 시도 (실패하면 또 permissionDenied로 돌아올 것)
        reinjectIfPossible();
    }, [emitLocalMediaState, reinjectIfPossible, safeSet]);
    return {
        isSupported,
        isConnecting,
        isConnected,
        error,

        audioEnabled,
        videoEnabled,
        isVideoDeviceLost,
        noMediaDevices,

        localMedia,

        toggleAudio,
        toggleVideo,
        joinRoom,
        leaveRoom,
        reinjectIfPossible,
        hardReconnect,
        retryVideoPermission,
    };
}
