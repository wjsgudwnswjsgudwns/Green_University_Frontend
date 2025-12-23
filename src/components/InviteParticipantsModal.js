// src/components/InviteParticipantsModal.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import api from "../api/axiosConfig";
import "../styles/inviteParticipantsModal.css";

/**
 * InviteParticipantsModal
 *
 * props:
 *  - open: boolean
 *  - onClose: () => void
 *  - meetingId: number|string
 *  - onInvited?: () => void   // 초대 성공 후 콜백(리스트 새로고침 등)
 *  - inviteEndpoint?: string // 기본값: /api/meetings/{meetingId}/participants/invite
 */
export default function InviteParticipantsModal({
    open,
    onClose,
    meetingId,
    onInvited,
    inviteEndpoint,
}) {
    // =========================================================
    // 0) stable debug id
    // =========================================================
    const debugIdRef = useRef(
        `IPM-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    const debugId = debugIdRef.current;

    // =========================================================
    // 1) UI State
    // =========================================================
    const [inviteRole, setInviteRole] = useState("student");
    const [q, setQ] = useState("");
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [invited, setInvited] = useState([]); // [{userId,name,role,email}]

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // =========================================================
    // 2) Open init reset
    // =========================================================
    useEffect(() => {
        if (!open) return;
        setError("");
        setInviteRole("student");
        setQ("");
        setResults([]);
        setInvited([]);
        setSearching(false);
    }, [open]);

    // =========================================================
    // 3) ESC close
    // =========================================================
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    // =========================================================
    // 4) toggle invite
    // =========================================================
    const toggleInvite = (u) => {
        if (!u?.userId) return;
        if (u?.alreadyInMeeting) return; // ✅ 이미 등록된 사람은 선택 불가
        setInvited((prev) => {
            const exists = prev.some(
                (x) => String(x.userId) === String(u.userId)
            );
            return exists
                ? prev.filter((x) => String(x.userId) !== String(u.userId))
                : [...prev, u];
        });
    };

    const isInvited = (userId) =>
        invited.some((x) => String(x.userId) === String(userId));

    const removeInvite = (userId) => {
        setInvited((prev) =>
            prev.filter((x) => String(x.userId) !== String(userId))
        );
    };

    // =========================================================
    // 5) Search
    // =========================================================
    const lastSearchKeyRef = useRef("");
    const searchAbortRef = useRef(null);
    const searchSeqRef = useRef(0);
    const searchCacheRef = useRef(new Map()); // key -> results[]

    useEffect(() => {
        if (!open) return;

        const keyword = (q || "").trim();

        // ✅ 2글자 미만: API 호출 X / 기존 results 유지
        if (keyword.length < 2) {
            if (searchAbortRef.current) searchAbortRef.current.abort();
            setSearching(false);
            return;
        }

        // ✅ meetingId까지 포함해야 캐시가 안전함
        const searchKey = `${meetingId || "none"}:${inviteRole}:${keyword}`;

        // ✅ cache hit
        const cached = searchCacheRef.current.get(searchKey);
        if (cached) {
            setResults(cached);
            setSearching(false);
            lastSearchKeyRef.current = searchKey;
            return;
        }

        // ✅ same key dedup
        if (lastSearchKeyRef.current === searchKey) return;
        lastSearchKeyRef.current = searchKey;

        // ✅ abort previous
        if (searchAbortRef.current) searchAbortRef.current.abort();
        const ac = new AbortController();
        searchAbortRef.current = ac;

        const seq = ++searchSeqRef.current;

        const t = setTimeout(async () => {
            try {
                setSearching(true);

                const res = await api.get("/api/user/search", {
                    // ✅ meetingId 전달 (이미 등록 여부 판단용)
                    params: { role: inviteRole, q: keyword, meetingId },
                    signal: ac.signal,
                });

                if (!ac.signal.aborted) {
                    const data = Array.isArray(res.data) ? res.data : [];
                    // (옵션) seq로 최신만 반영하고 싶으면 여기서 체크 가능
                    if (seq === searchSeqRef.current) {
                        searchCacheRef.current.set(searchKey, data);
                        setResults(data);
                    }
                }
            } catch (e) {
                if (ac.signal.aborted) return;
                setResults([]);
            } finally {
                if (!ac.signal.aborted) setSearching(false);
            }
        }, 300);

        return () => {
            clearTimeout(t);
            ac.abort();
        };
    }, [open, inviteRole, q, meetingId]);

    // =========================================================
    // 6) Submit invite
    // =========================================================
    const endpoint = useMemo(() => {
        if (inviteEndpoint) return inviteEndpoint;
        if (!meetingId) return "";
        return `/api/meetings/${meetingId}/participants/invite`;
    }, [inviteEndpoint, meetingId]);

    const submitInvite = async () => {
        if (!meetingId) return setError("meetingId가 없습니다.");
        if (invited.length === 0)
            return setError("초대할 사용자를 1명 이상 선택하세요.");
        if (!endpoint) return setError("초대 API endpoint가 없습니다.");

        try {
            setSubmitting(true);
            setError("");

            const payload = {
                participantUserIds: invited.map((x) => x.userId),
            };

            await api.post(endpoint, payload);

            onInvited?.();
            onClose?.();
        } catch (e) {
            const msg =
                e?.response?.data?.message ||
                e?.message ||
                "초대 중 오류가 발생했습니다.";
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return ReactDOM.createPortal(
        <div className="ipm-backdrop" onMouseDown={onClose}>
            <div
                className="ipm-modal"
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="ipm-header">
                    <h3 className="ipm-title">참여자 초대</h3>
                    <button className="ipm-x" onClick={onClose} type="button">
                        ✕
                    </button>
                </div>

                {error && <div className="ipm-error">{error}</div>}

                <div className="ipm-section">
                    <div className="ipm-row">
                        <label className="ipm-label">초대 대상</label>
                        <select
                            className="ipm-select"
                            value={inviteRole}
                            onChange={(e) => {
                                setInviteRole(e.target.value);
                                setQ("");
                                setResults([]);
                                setSearching(false);
                            }}
                        >
                            <option value="student">학생</option>
                            <option value="professor">교수</option>
                            <option value="staff">직원</option>
                        </select>
                    </div>

                    <div className="ipm-row">
                        <label className="ipm-label">이름 검색</label>
                        <input
                            className="ipm-input"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="이름을 입력하세요 (2글자 이상)"
                        />
                    </div>

                    <div className="ipm-searchbox">
                        {q.trim().length < 2 && (
                            <div className="ipm-muted">
                                2글자 이상 입력하세요.
                            </div>
                        )}

                        {q.trim().length >= 2 && (
                            <>
                                {searching && (
                                    <div className="ipm-muted">검색 중...</div>
                                )}

                                {!searching && results.length === 0 && (
                                    <div className="ipm-muted">
                                        검색 결과가 없습니다.
                                    </div>
                                )}

                                {results.map((u) => {
                                    const checked = isInvited(u.userId);
                                    const already = !!u.alreadyInMeeting;

                                    return (
                                        <div
                                            key={String(u.userId)}
                                            className={`ipm-result ${
                                                already ? "is-disabled" : ""
                                            }`}
                                            role="button"
                                            tabIndex={already ? -1 : 0}
                                            aria-disabled={
                                                already ? "true" : "false"
                                            }
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                            }}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (already) return;
                                                toggleInvite(u);
                                            }}
                                            onKeyDown={(e) => {
                                                if (already) return;
                                                if (
                                                    e.key === "Enter" ||
                                                    e.key === " "
                                                ) {
                                                    e.preventDefault();
                                                    toggleInvite(u);
                                                }
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={already}
                                                readOnly
                                                tabIndex={-1}
                                                aria-hidden="true"
                                                className="ipm-checkbox"
                                            />
                                            <div className="ipm-result-body">
                                                <div className="ipm-result-name">
                                                    {u.name} ({u.role})
                                                    {already && (
                                                        <span className="ipm-badge">
                                                            이미 등록됨
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="ipm-result-email">
                                                    {u.email || ""}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    <div className="ipm-invited">
                        <div className="ipm-invited-title">
                            초대 목록 ({invited.length})
                        </div>

                        {invited.length === 0 ? (
                            <div className="ipm-muted">
                                아직 선택된 사용자가 없습니다.
                            </div>
                        ) : (
                            <div className="ipm-chips">
                                {invited.map((u) => (
                                    <div
                                        className="ipm-chip"
                                        key={`${u.userId}-${u.role}`}
                                    >
                                        <span>
                                            {u.name} ({u.role})
                                        </span>
                                        <button
                                            className="ipm-chip-x"
                                            onClick={() =>
                                                removeInvite(u.userId)
                                            }
                                            type="button"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="ipm-footer">
                    <button
                        className="ipm-btn ghost"
                        onClick={onClose}
                        disabled={submitting}
                        type="button"
                    >
                        취소
                    </button>
                    <button
                        className="ipm-btn primary"
                        onClick={submitInvite}
                        disabled={submitting}
                        type="button"
                    >
                        {submitting ? "초대 중..." : "초대 보내기"}
                    </button>
                </div>

                <div className="ipm-debug">
                    <span>debug: {debugId}</span>
                </div>
            </div>
        </div>,
        document.body
    );
}
