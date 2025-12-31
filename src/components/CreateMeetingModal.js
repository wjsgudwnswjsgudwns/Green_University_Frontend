// src/components/CreateMeetingModal.js
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import api from "../api/axiosConfig";
import "../styles/createMeetingModal.css";

// ✅ datetime-local("YYYY-MM-DDTHH:mm") -> "YYYY-MM-DDTHH:mm:00"
function toBackendLocalTs(v) {
    if (!v) return null;
    return v.length === 16 ? `${v}:00` : v;
}

function defaultStartEnd() {
    const now = new Date();
    const start = new Date(now.getTime() + 10 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const pad = (n) => String(n).padStart(2, "0");
    const toLocalInput = (d) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
            d.getHours()
        )}:${pad(d.getMinutes())}`;

    return { startAt: toLocalInput(start), endAt: toLocalInput(end) };
}

export default function CreateMeetingModal({ open, onClose, onCreated }) {
    // =========================================================
    // 0) stable debug id (리마운트/중복 호출 확인용)
    // =========================================================
    const debugIdRef = useRef(
        `CMM-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    const debugId = debugIdRef.current;

    const escHandlerRef = useRef(null);

    const [meetingType, setMeetingType] = useState("INSTANT"); // INSTANT | SCHEDULED

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [startAt, setStartAt] = useState("");
    const [endAt, setEndAt] = useState("");

    // 예약(SCHEDULED)에서만 초대
    const [inviteRole, setInviteRole] = useState("student");
    const [q, setQ] = useState("");
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [invited, setInvited] = useState([]); // [{userId,name,role,email}]

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // =========================================================
    // ✅ DEBUG LOGS
    // =========================================================
    useEffect(() => {
        console.log(`[${debugId}] MOUNT`);
        return () => console.log(`[${debugId}] UNMOUNT`);
    }, [debugId]);

    useEffect(() => {
        console.log(`[${debugId}] deps changed`, {
            open,
            meetingType,
            inviteRole,
            q,
            searching,
            resultsSize: results?.length ?? 0,
            invitedSize: invited?.length ?? 0,
        });
    }, [
        debugId,
        open,
        meetingType,
        inviteRole,
        q,
        searching,
        results,
        invited,
    ]);

    // =========================================================
    // ✅ 모달 열릴 때 초기화 (중요: useLayoutEffect)
    // - 렌더 후 useEffect로 초기화하면 "입력 먼저 들어간 뒤 리셋"이 가끔 발생
    // =========================================================
    useLayoutEffect(() => {
        if (!open) return;

        console.log(`[${debugId}] open -> init reset (layout)`);

        const { startAt: dStart, endAt: dEnd } = defaultStartEnd();

        setError("");
        setMeetingType("INSTANT");
        setTitle("");
        setDescription("");
        setStartAt(dStart);
        setEndAt(dEnd);

        setInviteRole("student");
        setQ("");
        setResults([]);
        setInvited([]);
        setSearching(false);
    }, [open, debugId]);

    // =========================================================
    // ESC 닫기
    // =========================================================
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        escHandlerRef.current = onKeyDown;
        window.addEventListener("keydown", onKeyDown);

        return () => {
            if (escHandlerRef.current) {
                window.removeEventListener("keydown", escHandlerRef.current);
            }
        };
    }, [open, onClose]);

    // =========================================================
    // meetingType이 INSTANT로 바뀌면 초대/검색 초기화(정책 고정)
    // =========================================================
    useEffect(() => {
        if (meetingType === "INSTANT") {
            console.log(
                `[${debugId}] meetingType=INSTANT -> reset invite/search`
            );
            setInvited([]);
            setResults([]);
            setQ("");
            setSearching(false);
        }
    }, [meetingType, debugId]);

    // =========================================================
    // ✅ 체크 토글(추가/해제)
    // =========================================================
    const toggleInvite = (u) => {
        if (!u?.userId) return;

        console.log(`[${debugId}] toggleInvite click`, {
            userId: u.userId,
            name: u.name,
            role: u.role,
        });

        setInvited((prev) => {
            const exists = prev.some(
                (x) => String(x.userId) === String(u.userId)
            );
            const next = exists
                ? prev.filter((x) => String(x.userId) !== String(u.userId))
                : [...prev, u];

            console.log(
                `[${debugId}] invited next`,
                next.map((x) => x.userId)
            );
            return next;
        });
    };

    const isInvited = (userId) => {
        return invited.some((x) => String(x.userId) === String(userId));
    };

    const removeInvite = (userId) => {
        console.log(`[${debugId}] removeInvite`, userId);
        setInvited((prev) =>
            prev.filter((x) => String(x.userId) !== String(userId))
        );
    };

    // =========================================================
    // ✅ 유저 검색 (예약일 때만)
    // - AbortController로 중복/늦은 응답 방지
    // - 캐시로 같은 키워드 재검색 방지(IME/백스페이스 흔들림 대응)
    // - keyword < 2일 때도 results 유지(리스트 깜빡임/클릭 씹힘 방지)
    // =========================================================
    const lastSearchKeyRef = useRef("");
    const searchAbortRef = useRef(null);
    const searchSeqRef = useRef(0);
    const searchCacheRef = useRef(new Map()); // key -> results[]

    useEffect(() => {
        if (!open) return;
        if (meetingType !== "SCHEDULED") return;

        const keyword = (q || "").trim();

        // ✅ 2글자 미만: API 호출 X / 기존 results 유지(중요)
        if (keyword.length < 2) {
            console.log(`[${debugId}] search skip (<2)`, { keyword });
            if (searchAbortRef.current) searchAbortRef.current.abort();
            setSearching(false);
            return;
        }

        const searchKey = `${inviteRole}:${keyword}`;

        // ✅ 캐시 히트면 즉시 반영 + API 호출 X
        const cached = searchCacheRef.current.get(searchKey);
        if (cached) {
            console.log(`[${debugId}] search cache hit`, {
                searchKey,
                size: cached.length,
            });
            setResults(cached);
            setSearching(false);
            lastSearchKeyRef.current = searchKey;
            return;
        }

        // ✅ 같은 키 재검색 방지
        if (lastSearchKeyRef.current === searchKey) {
            console.log(`[${debugId}] search dedup same key`, { searchKey });
            return;
        }
        lastSearchKeyRef.current = searchKey;

        // ✅ 이전 요청 취소
        if (searchAbortRef.current) searchAbortRef.current.abort();
        const ac = new AbortController();
        searchAbortRef.current = ac;

        const seq = ++searchSeqRef.current;
        console.log(`[${debugId}] search schedule`, { seq, searchKey });

        const t = setTimeout(async () => {
            try {
                setSearching(true);
                console.log(`[${debugId}] search start`, { seq, searchKey });

                const res = await api.get("/api/user/search", {
                    params: { role: inviteRole, q: keyword },
                    signal: ac.signal,
                });

                if (!ac.signal.aborted) {
                    const data = Array.isArray(res.data) ? res.data : [];
                    console.log(`[${debugId}] search success`, {
                        seq,
                        searchKey,
                        size: data.length,
                    });
                    searchCacheRef.current.set(searchKey, data);
                    setResults(data);
                }
            } catch (e) {
                if (ac.signal.aborted) {
                    console.log(`[${debugId}] search aborted`, {
                        seq,
                        searchKey,
                    });
                    return;
                }
                console.log(`[${debugId}] search error`, {
                    seq,
                    searchKey,
                    message:
                        e?.response?.data?.message || e?.message || "unknown",
                    status: e?.response?.status,
                });
                setResults([]);
            } finally {
                if (!ac.signal.aborted) {
                    setSearching(false);
                    console.log(`[${debugId}] search end`, { seq, searchKey });
                }
            }
        }, 350);

        return () => {
            clearTimeout(t);
            ac.abort();
            console.log(`[${debugId}] search cleanup(abort)`, {
                seq,
                searchKey,
            });
        };
    }, [open, meetingType, inviteRole, q, debugId]);

    // =========================================================
    // Validate / Submit
    // =========================================================
    const validate = () => {
        const t = (title || "").trim();
        if (!t) return "회의 제목을 입력하세요.";

        const s = new Date(startAt);
        const e = new Date(endAt);
        if (isNaN(s.getTime()) || isNaN(e.getTime()))
            return "시작/종료 시간이 올바르지 않습니다.";
        if (e.getTime() <= s.getTime())
            return "종료 시간은 시작 시간보다 뒤여야 합니다.";

        if (meetingType === "SCHEDULED" && invited.length === 0) {
            return "예약 회의는 초대할 참여자가 1명 이상 필요합니다.";
        }
        return "";
    };

    const submit = async () => {
        const msg = validate();
        if (msg) {
            setError(msg);
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const payload = {
                title: title.trim(),
                description: (description || "").trim(),
                meetingType, // INSTANT | SCHEDULED
                startAt: toBackendLocalTs(startAt),
                endAt: toBackendLocalTs(endAt),
                participantUserIds:
                    meetingType === "SCHEDULED"
                        ? invited.map((x) => x.userId)
                        : [],
            };

            const endpoint =
                meetingType === "INSTANT"
                    ? "/api/meetings/instant"
                    : "/api/meetings/scheduled";

            console.log(`[${debugId}] submit start`, { endpoint, payload });
            await api.post(endpoint, payload);
            console.log(`[${debugId}] submit success`);

            onCreated?.();
            onClose?.();
        } catch (e) {
            console.error(e);
            const msg =
                e?.response?.data?.message ||
                "회의 생성 중 오류가 발생했습니다.";
            setError(msg);
            console.log(`[${debugId}] submit error`, msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    // =========================================================
    // ✅ backdrop 닫기: onClick + target 가드
    // - 포커스는 mousedown에서 잡히므로, click 닫기가 안전
    // =========================================================
    const onBackdropClick = (e) => {
        if (e.target !== e.currentTarget) return;
        onClose?.();
    };

    return ReactDOM.createPortal(
        <div className="cmm-backdrop" onClick={onBackdropClick}>
            <div
                className="cmm-modal"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="cmm-header">
                    <h3 className="cmm-title">새 회의 만들기</h3>
                    <button className="cmm-x" onClick={onClose} type="button">
                        ✕
                    </button>
                </div>

                {error && <div className="cmm-error">{error}</div>}

                <div className="cmm-section">
                    <div className="cmm-row">
                        <label className="cmm-label">회의 유형</label>
                        <div className="cmm-toggle">
                            <button
                                className={`cmm-toggle-btn ${
                                    meetingType === "SCHEDULED" ? "active" : ""
                                }`}
                                onClick={() => setMeetingType("SCHEDULED")}
                                type="button"
                            >
                                예약
                            </button>
                            <button
                                className={`cmm-toggle-btn ${
                                    meetingType === "INSTANT" ? "active" : ""
                                }`}
                                onClick={() => setMeetingType("INSTANT")}
                                type="button"
                            >
                                즉시
                            </button>
                        </div>
                    </div>

                    <div className="cmm-row">
                        <label className="cmm-label">회의 제목</label>
                        <input
                            className="cmm-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="회의 제목을 입력하세요"
                        />
                    </div>

                    <div className="cmm-row">
                        <label className="cmm-label">시작 시간</label>
                        <input
                            className="cmm-input"
                            type="datetime-local"
                            value={startAt}
                            onChange={(e) => setStartAt(e.target.value)}
                        />
                    </div>

                    <div className="cmm-row">
                        <label className="cmm-label">종료 시간</label>
                        <input
                            className="cmm-input"
                            type="datetime-local"
                            value={endAt}
                            onChange={(e) => setEndAt(e.target.value)}
                        />
                    </div>

                    <div className="cmm-row">
                        <label className="cmm-label">설명</label>
                        <textarea
                            className="cmm-textarea"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="(선택) 회의 설명"
                        />
                    </div>
                </div>

                {meetingType === "SCHEDULED" && (
                    <div className="cmm-section">
                        <div className="cmm-row">
                            <label className="cmm-label">초대 대상</label>
                            <select
                                className="cmm-select"
                                value={inviteRole}
                                onChange={(e) => {
                                    console.log(
                                        `[${debugId}] inviteRole change`,
                                        e.target.value
                                    );
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

                        <div className="cmm-row">
                            <label className="cmm-label">이름 검색</label>
                            <input
                                className="cmm-input"
                                value={q}
                                onChange={(e) => {
                                    console.log(
                                        `[${debugId}] q change`,
                                        e.target.value
                                    );
                                    setQ(e.target.value);
                                }}
                                placeholder="이름을 입력하세요 (2글자 이상)"
                            />
                        </div>

                        <div className="cmm-searchbox">
                            {q.trim().length < 2 && (
                                <div className="cmm-muted">
                                    2글자 이상 입력하세요.
                                </div>
                            )}

                            {q.trim().length >= 2 && (
                                <>
                                    {searching && (
                                        <div className="cmm-muted">
                                            검색 중...
                                        </div>
                                    )}

                                    {!searching && results.length === 0 && (
                                        <div className="cmm-muted">
                                            검색 결과가 없습니다.
                                        </div>
                                    )}

                                    {/* ✅ searching이어도 결과는 유지 */}
                                    {results.map((u) => {
                                        const checked = isInvited(u.userId);
                                        return (
                                            <div
                                                key={String(u.userId)}
                                                className="cmm-result check"
                                                role="button"
                                                tabIndex={0}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                onClick={(e) => {
                                                    console.log(
                                                        `[${debugId}] result click`,
                                                        {
                                                            userId: u.userId,
                                                            name: u.name,
                                                        }
                                                    );
                                                    e.preventDefault();
                                                    toggleInvite(u);
                                                }}
                                                onKeyDown={(e) => {
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
                                                    readOnly
                                                    tabIndex={-1}
                                                    aria-hidden="true"
                                                    style={{
                                                        pointerEvents: "none",
                                                    }}
                                                />
                                                <div className="cmm-result-body">
                                                    <div className="cmm-result-name">
                                                        {u.name} ({u.role})
                                                    </div>
                                                    <div className="cmm-result-email">
                                                        {u.email || ""}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        <div className="cmm-invited">
                            <div className="cmm-invited-title">
                                초대 목록 ({invited.length})
                            </div>

                            {invited.length === 0 ? (
                                <div className="cmm-muted">
                                    아직 선택된 사용자가 없습니다.
                                </div>
                            ) : (
                                <div className="cmm-chips">
                                    {invited.map((u) => (
                                        <div
                                            className="cmm-chip"
                                            key={`${u.userId}-${u.role}`}
                                        >
                                            <span>
                                                {u.name} ({u.role})
                                            </span>
                                            <button
                                                className="cmm-chip-x"
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
                )}

                <div className="cmm-footer">
                    <button
                        className="cmm-btn ghost"
                        onClick={onClose}
                        disabled={submitting}
                        type="button"
                    >
                        취소
                    </button>
                    <button
                        className="cmm-btn primary"
                        onClick={submit}
                        disabled={submitting}
                        type="button"
                    >
                        {submitting ? "생성 중..." : "회의 생성"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
