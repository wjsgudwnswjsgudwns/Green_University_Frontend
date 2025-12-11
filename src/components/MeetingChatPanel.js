// src/components/MeetingChatPanel.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import api from "../api/axiosConfig";

const PAGE_SIZE = 30; // 한 번에 가져올 메시지 개수

export default function MeetingChatPanel({ meetingId, joinInfo, terminated }) {
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [chatConnected, setChatConnected] = useState(false);

    const [loadingInitial, setLoadingInitial] = useState(false);

    const [loadingOlder, setLoadingOlder] = useState(false);
    const loadingOlderRef = useRef(false);

    const [hasMoreBefore, setHasMoreBefore] = useState(true);

    // 🔥 새로 추가된 '새 메시지 알림' 상태
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [pendingMessages, setPendingMessages] = useState([]);

    const isAtBottomRef = useRef(true); // 구독 콜백에서 사용

    const stompClientRef = useRef(null);
    const chatAreaRef = useRef(null);

    const updateIsAtBottom = useCallback((v) => {
        isAtBottomRef.current = v;
        setIsAtBottom(v);
    }, []);

    // ====== 초기 DB 히스토리 로딩 (최근 N개) ======
    useEffect(() => {
        if (!meetingId) return;

        let cancelled = false;

        const fetchInitialMessages = async () => {
            setLoadingInitial(true);
            try {
                // 세션 스토리지 사용 없이, 항상 서버 기준 최신 PAGE_SIZE개만 불러옴
                const res = await api.get(
                    `/api/meetings/${meetingId}/chat/messages`,
                    { params: { size: PAGE_SIZE } }
                );
                if (cancelled) return;

                const serverMessages = res.data || [];
                setChatMessages(serverMessages);

                // 과거 기록 더 있는지 대략 추정
                setHasMoreBefore(serverMessages.length === PAGE_SIZE);

                // 초기 진입 시 맨 아래로 스크롤
                setTimeout(() => {
                    const el = chatAreaRef.current;
                    if (!el) return;
                    el.scrollTop = el.scrollHeight;
                    updateIsAtBottom(true);
                    setPendingMessages([]);
                }, 0);
            } catch (e) {
                console.error(
                    "[MeetingChatPanel] 초기 메시지 불러오기 실패",
                    e
                );
            } finally {
                if (!cancelled) {
                    setLoadingInitial(false);
                }
            }
        };

        fetchInitialMessages();

        return () => {
            cancelled = true;
        };
    }, [meetingId, updateIsAtBottom]);

    // ====== 위로 스크롤 시 과거 메시지 추가 로딩 ======
    const loadOlderMessages = useCallback(async () => {
        // ✅ state 말고 ref로 먼저 막기 (동시 호출 방지)
        if (loadingOlderRef.current) return;
        if (!hasMoreBefore) return;
        if (!meetingId) return;
        if (chatMessages.length === 0) return;

        const firstId = chatMessages[0].messageId;
        if (!firstId) return;

        loadingOlderRef.current = true;
        setLoadingOlder(true);

        const el = chatAreaRef.current;
        const prevScrollHeight = el ? el.scrollHeight : 0;

        try {
            const res = await api.get(
                `/api/meetings/${meetingId}/chat/messages`,
                {
                    params: {
                        beforeId: firstId,
                        size: PAGE_SIZE,
                    },
                }
            );
            const older = res.data || [];

            if (older.length === 0) {
                setHasMoreBefore(false);
                return;
            }

            // ✅ 이미 있는 messageId는 걸러내기 (서버 중복 응답/동시 호출 대비)
            setChatMessages((prev) => {
                const existingIds = new Set(
                    prev.map((m) => m.messageId).filter((id) => id != null)
                );

                const filteredOlder = older.filter(
                    (m) => m.messageId == null || !existingIds.has(m.messageId)
                );

                return [...filteredOlder, ...prev];
            });

            // 스크롤 위치 유지 (위에 붙였으니 높이 차이만큼 내려줌)
            setTimeout(() => {
                if (!el) return;
                const newScrollHeight = el.scrollHeight;
                el.scrollTop = newScrollHeight - prevScrollHeight;
            }, 0);

            if (older.length < PAGE_SIZE) {
                setHasMoreBefore(false);
            }
        } catch (e) {
            console.error("[MeetingChatPanel] 과거 메시지 로딩 실패", e);
        } finally {
            loadingOlderRef.current = false; // 🔥 ref 해제
            setLoadingOlder(false);
        }
    }, [chatMessages, hasMoreBefore, meetingId]);

    // 스크롤 이벤트 감지
    useEffect(() => {
        const el = chatAreaRef.current;
        if (!el) return;

        const handleScroll = () => {
            // 위 근처면 과거 로딩
            if (el.scrollTop < 40) {
                loadOlderMessages();
            }

            // 아래 근처인지 체크
            const distanceToBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight;

            if (distanceToBottom < 40) {
                // 거의 맨 아래 도착 → 새 메시지 알림 초기화
                if (!isAtBottomRef.current) {
                    updateIsAtBottom(true);
                    setPendingMessages([]);
                }
            } else {
                if (isAtBottomRef.current) {
                    updateIsAtBottom(false);
                }
            }
        };

        el.addEventListener("scroll", handleScroll);
        return () => {
            el.removeEventListener("scroll", handleScroll);
        };
    }, [loadOlderMessages, updateIsAtBottom]);

    // ====== WebSocket/STOMP 연결 ======
    useEffect(() => {
        if (!meetingId) return;
        if (terminated) return;

        if (stompClientRef.current) {
            console.log(
                "[MeetingChatPanel] client already exists, skip connect"
            );
            return;
        }

        const client = Stomp.over(
            () => new SockJS("http://localhost:8881/ws-chat")
        );

        client.connect(
            {},
            () => {
                console.log("[MeetingChatPanel] Chat STOMP connected");
                setChatConnected(true);

                client.subscribe(`/sub/meetings/${meetingId}/chat`, (frame) => {
                    console.log("[Chat] incoming:", frame.body);
                    try {
                        const body = JSON.parse(frame.body);

                        // 공통: 전체 메시지에는 추가
                        setChatMessages((prev) => [...prev, body]);

                        // 내가 아래에 "없을 때"만 새 메시지 미리보기로 쌓기
                        if (!isAtBottomRef.current) {
                            setPendingMessages((prev) => [...prev, body]);
                        }
                    } catch (e) {
                        console.error("채팅 메시지 파싱 실패", e);
                    }
                });
            },
            (error) => {
                console.error("[MeetingChatPanel] Chat STOMP error", error);
                setChatConnected(false);
            }
        );

        stompClientRef.current = client;

        return () => {
            if (stompClientRef.current) {
                console.log("[MeetingChatPanel] Chat STOMP disconnect");
                try {
                    stompClientRef.current.deactivate();
                } catch (e) {
                    console.error("STOMP deactivate 실패", e);
                }
            }
            stompClientRef.current = null;
        };
    }, [meetingId, terminated]);

    // 새 메시지 들어올 때마다, 내가 맨 아래에 있을 때만 자동 스크롤
    useEffect(() => {
        if (!chatAreaRef.current) return;
        if (!isAtBottom) return;

        const el = chatAreaRef.current;
        el.scrollTop = el.scrollHeight;
    }, [chatMessages, isAtBottom]);

    const handleSendChat = useCallback(() => {
        const client = stompClientRef.current;
        if (!client || !client.connected) return;

        const text = chatInput.trim();
        if (!text) return;

        const displayName =
            joinInfo?.displayName ||
            joinInfo?.userName ||
            joinInfo?.nickname ||
            "User";

        const payload = {
            meetingId: Number(meetingId),
            userId: joinInfo?.userId,
            displayName,
            type: "CHAT",
            message: text,
        };

        client.publish({
            destination: `/pub/meetings/${meetingId}/chat`,
            body: JSON.stringify(payload),
        });

        setChatInput("");
    }, [chatInput, meetingId, joinInfo]);

    const handleClickNewMessagesBar = useCallback(() => {
        const el = chatAreaRef.current;
        if (!el) return;

        el.scrollTop = el.scrollHeight;
        setPendingMessages([]);
        updateIsAtBottom(true);
    }, [updateIsAtBottom]);

    return (
        <div className="meeting-side">
            <div className="meeting-side__tabs">
                <div className="meeting-side__tab meeting-side__tab--active">
                    채팅
                </div>
                <div className="meeting-side__tab">참가자</div>
            </div>

            <div
                id="chat-area"
                className="meeting-side__chat"
                ref={chatAreaRef}
            >
                {loadingInitial && chatMessages.length === 0 ? (
                    <div className="meeting-side__chat-empty">
                        채팅 기록을 불러오는 중입니다...
                    </div>
                ) : chatMessages.length === 0 ? (
                    <div className="meeting-side__chat-empty">
                        아직 채팅이 없습니다. 메시지를 입력해보세요.
                    </div>
                ) : (
                    <>
                        {loadingOlder && (
                            <div className="meeting-side__chat-loading-top">
                                이전 채팅 불러오는 중...
                            </div>
                        )}
                        {chatMessages.map((m, idx) => (
                            <div
                                key={m.messageId ?? idx}
                                className="meeting-side__chat-message"
                            >
                                <div className="meeting-side__chat-meta">
                                    <span className="meeting-side__chat-name">
                                        {m.displayName || "참가자"}
                                    </span>
                                    {m.sentAt && (
                                        <span className="meeting-side__chat-time">
                                            {new Date(
                                                m.sentAt
                                            ).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    )}
                                </div>
                                <div className="meeting-side__chat-text">
                                    {m.message}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {!isAtBottom && pendingMessages.length > 0 && (
                <div
                    className="meeting-side__new-messages"
                    onClick={handleClickNewMessagesBar}
                >
                    <div className="meeting-side__new-messages-count">
                        새 메시지 {pendingMessages.length}개
                    </div>
                    <div className="meeting-side__new-messages-preview">
                        {pendingMessages[pendingMessages.length - 1].displayName
                            ? `${
                                  pendingMessages[pendingMessages.length - 1]
                                      .displayName
                              }: `
                            : ""}
                        {pendingMessages[pendingMessages.length - 1].message}
                    </div>
                    <div className="meeting-side__new-messages-hint">
                        클릭해서 최신 위치로 이동
                    </div>
                </div>
            )}

            <div className="meeting-side__input-row">
                <input
                    id="chat-input"
                    placeholder="메시지 입력..."
                    className="meeting-side__input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleSendChat();
                        }
                    }}
                    disabled={!chatConnected || terminated}
                />
                <button
                    id="chat-send"
                    className="meeting-side__send-button"
                    onClick={handleSendChat}
                    disabled={!chatConnected || terminated}
                >
                    전송
                </button>
            </div>
        </div>
    );
}
