// src/components/MeetingChatPanel.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import api from "../api/axiosConfig";

const PAGE_SIZE = 30;

// ✅ 환경에 맞게 바꿔도 됨(일단 너 코드 기준 localhost)
const WS_URL = "http://localhost:8881/ws-chat";

export default function MeetingChatPanel({ meetingId, joinInfo, terminated }) {
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [chatConnected, setChatConnected] = useState(false);

    const [loadingInitial, setLoadingInitial] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const loadingOlderRef = useRef(false);

    const [hasMoreBefore, setHasMoreBefore] = useState(true);

    // 새 메시지 알림
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [pendingMessages, setPendingMessages] = useState([]);
    const isAtBottomRef = useRef(true);

    const stompClientRef = useRef(null);
    const chatAreaRef = useRef(null);

    const myUserId = joinInfo?.userId ?? null;

    const updateIsAtBottom = useCallback((v) => {
        isAtBottomRef.current = v;
        setIsAtBottom(v);
    }, []);

    function formatTime(ts) {
        if (!ts) return "";
        return new Date(ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    // ====== 초기 DB 히스토리 로딩(최근 PAGE_SIZE개) ======
    useEffect(() => {
        if (!meetingId) return;

        let cancelled = false;

        const fetchInitialMessages = async () => {
            setLoadingInitial(true);
            try {
                const res = await api.get(
                    `/api/meetings/${meetingId}/chat/messages`,
                    {
                        params: { size: PAGE_SIZE },
                    }
                );
                if (cancelled) return;

                const serverMessages = res.data || [];
                setChatMessages(serverMessages);
                setHasMoreBefore(serverMessages.length === PAGE_SIZE);

                // 초기 진입: 맨 아래로
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
                if (!cancelled) setLoadingInitial(false);
            }
        };

        fetchInitialMessages();
        return () => {
            cancelled = true;
        };
    }, [meetingId, updateIsAtBottom]);

    // ====== 위로 스크롤 시 과거 메시지 추가 로딩 ======
    const loadOlderMessages = useCallback(async () => {
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
                    params: { beforeId: firstId, size: PAGE_SIZE },
                }
            );

            const older = res.data || [];
            if (older.length === 0) {
                setHasMoreBefore(false);
                return;
            }

            setChatMessages((prev) => {
                const existingIds = new Set(
                    prev.map((m) => m.messageId).filter((id) => id != null)
                );
                const filteredOlder = older.filter(
                    (m) => m.messageId == null || !existingIds.has(m.messageId)
                );
                return [...filteredOlder, ...prev];
            });

            // 스크롤 위치 유지
            setTimeout(() => {
                if (!el) return;
                const newScrollHeight = el.scrollHeight;
                el.scrollTop = newScrollHeight - prevScrollHeight;
            }, 0);

            if (older.length < PAGE_SIZE) setHasMoreBefore(false);
        } catch (e) {
            console.error("[MeetingChatPanel] 과거 메시지 로딩 실패", e);
        } finally {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    }, [chatMessages, hasMoreBefore, meetingId]);

    // ====== 스크롤 이벤트 감지 ======
    useEffect(() => {
        const el = chatAreaRef.current;
        if (!el) return;

        const handleScroll = () => {
            if (el.scrollTop < 40) loadOlderMessages();

            const distanceToBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight;
            if (distanceToBottom < 40) {
                if (!isAtBottomRef.current) {
                    updateIsAtBottom(true);
                    setPendingMessages([]);
                }
            } else {
                if (isAtBottomRef.current) updateIsAtBottom(false);
            }
        };

        el.addEventListener("scroll", handleScroll);
        return () => el.removeEventListener("scroll", handleScroll);
    }, [loadOlderMessages, updateIsAtBottom]);

    // ====== WebSocket/STOMP 연결 ======
    useEffect(() => {
        if (!meetingId) return;
        if (terminated) return;

        if (stompClientRef.current) return;

        const client = Stomp.over(() => new SockJS(WS_URL));
        client.debug = () => {}; // 콘솔 지저분하면 끄기

        // ✅ 토큰이 WS에서 필요하면 여기 주석 해제
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        client.connect(
            headers,
            () => {
                setChatConnected(true);

                client.subscribe(`/sub/meetings/${meetingId}/chat`, (frame) => {
                    try {
                        const raw = JSON.parse(frame.body);

                        // 서버가 type 안 주면 CHAT으로
                        const msg = { type: raw.type || "CHAT", ...raw };

                        setChatMessages((prev) => [...prev, msg]);

                        if (!isAtBottomRef.current) {
                            setPendingMessages((prev) => [...prev, msg]);
                        }
                    } catch (e) {
                        console.error(
                            "[MeetingChatPanel] 채팅 메시지 파싱 실패",
                            e
                        );
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
            setChatConnected(false);
            try {
                stompClientRef.current?.deactivate();
            } catch (e) {
                console.error("[MeetingChatPanel] STOMP deactivate 실패", e);
            }
            stompClientRef.current = null;
        };
    }, [meetingId, terminated]);

    // ====== 새 메시지 들어올 때, 맨 아래면 자동 스크롤 ======
    useEffect(() => {
        if (!chatAreaRef.current) return;
        if (!isAtBottom) return;
        const el = chatAreaRef.current;
        el.scrollTop = el.scrollHeight;
    }, [chatMessages, isAtBottom]);

    // ====== 전송 ======
    const handleSendChat = useCallback(() => {
        const client = stompClientRef.current;
        if (!client || !client.connected) return;
        if (terminated) return;

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
            message: text,
        };

        client.publish({
            destination: `/pub/meetings/${meetingId}/chat`,
            body: JSON.stringify(payload),
        });

        setChatInput("");
    }, [chatInput, meetingId, joinInfo, terminated]);

    const handleClickNewMessagesBar = useCallback(() => {
        const el = chatAreaRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        setPendingMessages([]);
        updateIsAtBottom(true);
    }, [updateIsAtBottom]);

    return (
        <div className="meeting-side">
            <div className="meeting-side__header">채팅</div>

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

                        {chatMessages.map((m, idx) => {
                            const key = m.messageId ?? idx;

                            const isSystem = m.type === "SYSTEM";
                            const isMine =
                                !isSystem &&
                                myUserId != null &&
                                m.userId != null &&
                                Number(m.userId) === Number(myUserId);

                            if (isSystem) {
                                return (
                                    <div
                                        key={key}
                                        className="chat-msg chat-msg--system"
                                    >
                                        <span className="chat-msg__system-text">
                                            {m.message}
                                        </span>
                                    </div>
                                );
                            }

                            if (isMine) {
                                return (
                                    <div
                                        key={key}
                                        className="chat-msg chat-msg--mine"
                                    >
                                        <div className="chat-msg__bubble chat-msg__bubble--mine">
                                            {m.message}
                                        </div>
                                        <div className="chat-msg__time chat-msg__time--mine">
                                            {formatTime(m.sentAt)}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={key}
                                    className="chat-msg chat-msg--other"
                                >
                                    <div className="chat-msg__meta">
                                        <span className="chat-msg__name">
                                            {m.displayName || "참가자"}
                                        </span>
                                        <span className="chat-msg__time">
                                            {formatTime(m.sentAt)}
                                        </span>
                                    </div>
                                    <div className="chat-msg__bubble chat-msg__bubble--other">
                                        {m.message}
                                    </div>
                                </div>
                            );
                        })}
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
