// src/pages/MeetingJoinPage.js
import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosConfig";

function MeetingJoinPage() {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // MeetingDetailPage 에서 넘긴 state (info)
    const stateJoinInfo = location.state?.info;

    const [joinInfo, setJoinInfo] = useState(stateJoinInfo);
    const [error, setError] = useState("");
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const janusInstanceRef = useRef(null);

    const loadScript = (src) =>
        new Promise((resolve, reject) => {
            // 이미 로드된 경우 중복 로드 방지
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = () => {
                console.log("[MeetingJoinPage] script loaded:", src);
                resolve();
            };
            script.onerror = (e) => {
                console.error("[MeetingJoinPage] script load error:", src, e);
                reject(e);
            };
            document.body.appendChild(script);
        });

    // 0) janus.js, videoroomtest.js 로드
    useEffect(() => {
        const loadJanusScripts = async () => {
            try {
                // 경로는 실제 위치에 맞게 수정
                await loadScript("/janus/janus.js");
                await loadScript("/janus/videoroomtest.js");
                setScriptsLoaded(true);
            } catch (e) {
                setError("화상 회의 모듈을 불러오는 데 실패했습니다.");
            }
        };
        loadJanusScripts();
    }, []);

    // 1) join-info 없으면 백엔드에서 다시 가져오기
    useEffect(() => {
        const fetchIfNeeded = async () => {
            if (joinInfo) return;
            try {
                const res = await api.get(
                    `/api/meetings/${meetingId}/join-info`
                );
                setJoinInfo(res.data);
            } catch (err) {
                console.error(err);
                setError("회의 입장 정보를 불러오는 데 실패했습니다.");
            }
        };
        fetchIfNeeded();
    }, [joinInfo, meetingId]);

    // 2) joinInfo + scriptsLoaded 기반으로 Janus 시작
    useEffect(() => {
        if (!joinInfo) return;
        if (!scriptsLoaded) {
            console.log("[MeetingJoinPage] scripts 아직 로드 안 됨, 대기");
            return;
        }

        if (typeof window.startJanusFromReact !== "function") {
            console.error(
                "[MeetingJoinPage] window.startJanusFromReact 가 없습니다. videoroomtest.js 내용/경로를 다시 확인하세요."
            );
            return;
        }

        console.log("[MeetingJoinPage] startJanusFromReact 호출", joinInfo);

        const instance = window.startJanusFromReact({
            roomNumber: joinInfo.roomNumber,
            displayName: joinInfo.displayName,
            userId: joinInfo.userId,
        });

        janusInstanceRef.current = instance;

        return () => {
            if (janusInstanceRef.current?.destroy)
                janusInstanceRef.current.destroy();
        };
    }, [joinInfo, scriptsLoaded]);

    const handleLeave = () => {
        // 나중에 Janus 쪽에 leaveRoom 메시지 보내는 로직 추가 가능
        navigate("/meetings");
    };

    if (error) {
        return (
            <div
                style={{
                    maxWidth: 1000,
                    margin: "40px auto",
                    padding: "0 16px",
                }}
            >
                <p style={{ color: "red" }}>{error}</p>
                <button onClick={() => navigate("/meetings")}>
                    목록으로 돌아가기
                </button>
            </div>
        );
    }

    if (!joinInfo) {
        return (
            <div
                style={{
                    maxWidth: 1000,
                    margin: "40px auto",
                    padding: "0 16px",
                }}
            >
                <p>회의 입장 정보를 불러오는 중입니다...</p>
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                padding: "24px",
                background: "#f3f4f6", // 연한 회색 배경
                boxSizing: "border-box",
            }}
        >
            {/* 상단 헤더 */}
            <div
                style={{
                    maxWidth: 1200,
                    margin: "0 auto 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                        GREEN LMS · 화상 회의
                    </div>
                    <h2
                        style={{
                            margin: "4px 0 2px",
                            fontSize: 20,
                            color: "#111827",
                        }}
                    >
                        {joinInfo.title}
                    </h2>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                        방 번호 {joinInfo.roomNumber} · {joinInfo.displayName} (
                        {joinInfo.userRole})
                    </div>
                </div>
                <button
                    onClick={handleLeave}
                    style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        color: "#b91c1c",
                        cursor: "pointer",
                        fontSize: 13,
                    }}
                >
                    회의 나가기
                </button>
            </div>

            {/* 메인 레이아웃: 좌측 비디오 / 우측 패널 */}
            <div
                style={{
                    maxWidth: 1200,
                    margin: "0 auto",
                    display: "grid",
                    gridTemplateColumns:
                        "minmax(0, 3.5fr) minmax(260px, 1.4fr)",
                    gap: 16,
                }}
            >
                {/* 🔹 비디오 영역 컨테이너 (id="videos" 는 Janus용) */}
                <div
                    id="videos"
                    style={{
                        background: "#ffffff",
                        borderRadius: 16,
                        padding: 16,
                        boxShadow:
                            "0 10px 20px rgba(15,23,42,0.05), 0 0 0 1px #e5e7eb",
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 520,
                    }}
                >
                    {/* 메인 비디오 영역 */}
                    <div
                        style={{
                            flex: 1,
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: 12,
                            alignItems: "stretch",
                            justifyItems: "stretch",
                        }}
                    >
                        {/* 내 영상: 혼자 있을 땐 이 슬롯 하나만 꽉 채워짐 */}
                        <div
                            id="videolocal"
                            style={{
                                borderRadius: 16,
                                overflow: "hidden",
                                background: "#0f172a",
                                position: "relative",
                                minHeight: 260,
                            }}
                        >
                            {/* 로컬 이름 라벨 */}
                            <div
                                style={{
                                    position: "absolute",
                                    left: 8,
                                    bottom: 8,
                                    padding: "4px 8px",
                                    borderRadius: 999,
                                    background: "rgba(15,23,42,0.75)",
                                    fontSize: 11,
                                    color: "#e5e7eb",
                                }}
                            >
                                나
                            </div>
                        </div>

                        {/* 다자간용 슬롯
                            - 2명일 땐 videolocal + videoremote1 → 2개가 横으로 배치
                            - 3명 이상이면 자동으로 2x2, 3x2처럼 그리드로 늘어남
                         */}
                        <div id="videoremote1" style={remoteSlotStyle} />
                        <div id="videoremote2" style={remoteSlotStyle} />
                        <div id="videoremote3" style={remoteSlotStyle} />
                        <div id="videoremote4" style={remoteSlotStyle} />
                        <div id="videoremote5" style={remoteSlotStyle} />
                        <div id="videoremote6" style={remoteSlotStyle} />
                    </div>

                    {/* 하단 컨트롤 바 */}
                    <div
                        style={{
                            marginTop: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 12,
                        }}
                    >
                        <button id="btn-toggle-mic" style={controlButtonStyle}>
                            🎙
                        </button>
                        <button
                            id="btn-toggle-camera"
                            style={controlButtonStyle}
                        >
                            🎥
                        </button>
                        <button
                            id="btn-screen-share"
                            style={controlButtonStyle}
                        >
                            🖥
                        </button>
                        <button
                            id="btn-end-call"
                            style={{
                                ...controlButtonStyle,
                                background: "#ef4444",
                                color: "white",
                            }}
                            onClick={handleLeave}
                        >
                            ⏹
                        </button>
                    </div>
                </div>

                {/* 🔹 오른쪽 패널 (채팅/참가자) */}
                <div
                    style={{
                        background: "#ffffff",
                        borderRadius: 16,
                        padding: 16,
                        boxShadow:
                            "0 10px 20px rgba(15,23,42,0.05), 0 0 0 1px #e5e7eb",
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 520,
                    }}
                >
                    {/* 탭 헤더 (UI만, 실제 탭 전환은 나중에) */}
                    <div
                        style={{
                            display: "flex",
                            marginBottom: 12,
                            borderRadius: 999,
                            background: "#f3f4f6",
                            padding: 4,
                        }}
                    >
                        <div
                            style={{
                                flex: 1,
                                textAlign: "center",
                                padding: "6px 0",
                                borderRadius: 999,
                                background: "white",
                                fontSize: 13,
                                border: "1px solid #e5e7eb",
                                boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                            }}
                        >
                            채팅
                        </div>
                        <div
                            style={{
                                flex: 1,
                                textAlign: "center",
                                padding: "6px 0",
                                borderRadius: 999,
                                fontSize: 13,
                                color: "#6b7280",
                            }}
                        >
                            참가자
                        </div>
                    </div>

                    {/* 채팅 영역 (일단 더미) */}
                    <div
                        id="chat-area"
                        style={{
                            flex: 1,
                            borderRadius: 12,
                            background: "#f9fafb",
                            padding: 12,
                            overflowY: "auto",
                            fontSize: 13,
                            border: "1px solid #e5e7eb",
                        }}
                    >
                        {/* 나중에 WebSocket 채팅 붙일 자리 */}
                        <div style={{ color: "#9ca3af" }}>
                            아직 채팅이 없습니다. 메시지를 입력해보세요.
                        </div>
                    </div>

                    {/* 입력창 */}
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        <input
                            id="chat-input"
                            placeholder="메시지 입력..."
                            style={{
                                flex: 1,
                                borderRadius: 999,
                                border: "1px solid #d1d5db",
                                padding: "8px 12px",
                                fontSize: 13,
                                background: "#ffffff",
                                color: "#111827",
                                outline: "none",
                            }}
                        />
                        <button
                            id="chat-send"
                            style={{
                                padding: "8px 14px",
                                borderRadius: 999,
                                border: "none",
                                background: "#2563eb",
                                color: "white",
                                fontSize: 13,
                                cursor: "pointer",
                            }}
                        >
                            전송
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const controlButtonStyle = {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    fontSize: 18,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
};

const remoteSlotStyle = {
    borderRadius: 16,
    overflow: "hidden",
    background: "#e5e7eb",
    minHeight: 180,
};

export default MeetingJoinPage;
