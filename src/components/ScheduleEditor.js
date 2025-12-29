// src/components/counseling/ScheduleEditor.js
import React, { useCallback, useEffect, useState } from "react";
import { getMySlots, createSingleSlot, closeSlot } from "../api/counselingApi";

// ===== 공통 날짜 헬퍼 =====

// 로컬 기준 YYYY-MM-DD 문자열로 포맷
function formatYmdLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// YYYY-MM-DD → 로컬 Date 객체
function parseYmd(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
}

// 특정 날짜가 포함된 주의 월요일 구하기 (로컬 기준)
function getMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); // 날짜만
    const day = d.getDay(); // 0=일,1=월,...
    const diff = (day === 0 ? -6 : 1) - day; // 일요일이면 -6, 그 외엔 월요일까지 이동
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// 날짜 문자열(YYYY-MM-DD) + 시간(hour) 기준으로
// 그 칸이 "이미 지난 칸"인지 판단 (로컬 기준, 🔥 시작 시간 기준)
function isPastCell(dateStr, hour) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const cellStart = new Date(y, m - 1, d, hour + 1, 0, 0); // 칸 시작 시간
    const now = new Date();
    return cellStart.getTime() < now.getTime();
}

function ScheduleEditor({
    fromDate,
    toDate,
    editMode,
    onSelectSlot,
    onHasDraftChange,
}) {
    const [slots, setSlots] = useState([]);

    // 🔹 열기 초안: "YYYY-MM-DD-HH" → true
    const [draftOpenCells, setDraftOpenCells] = useState({});
    // 🔹 닫기 초안: slotId → true
    const [draftCloseSlotIds, setDraftCloseSlotIds] = useState({});

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // ====== 슬롯 조회 ======
    const loadMySlots = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const data = await getMySlots(fromDate, toDate);
            setSlots(data || []);
        } catch (e) {
            console.error(e);
            setError("슬롯 조회 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        setDraftOpenCells({});
        setDraftCloseSlotIds({});
        if (onHasDraftChange) {
            onHasDraftChange(false);
        }
        loadMySlots();
    }, [loadMySlots, onHasDraftChange]);

    // ====== 그리드용 날짜/시간 리스트 ======
    const dayList = [];
    try {
        // fromDate가 속한 주의 월요일 기준으로 월~금 5일
        const base = getMonday(parseYmd(fromDate));

        for (let i = 0; i < 5; i++) {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            const ymd = formatYmdLocal(d);
            const label = `${d.getMonth() + 1}/${d.getDate()}`;
            dayList.push({ date: ymd, label });
        }
    } catch (e) {
        console.error(e);
    }

    const hourStart = 9;
    const hourEnd = 18;
    const hourList = [];
    for (let h = hourStart; h <= hourEnd; h++) {
        hourList.push(h);
    }

    // DB 슬롯 → "YYYY-MM-DD-HH" 키로 매핑
    const slotMap = {};
    slots.forEach((slot) => {
        if (!slot.startAt) return;
        const [datePart, timePart] = String(slot.startAt).split("T");
        if (!datePart || !timePart) return;
        const hourKey = parseInt(timePart.slice(0, 2), 10);
        const key = `${datePart}-${hourKey}`;
        slotMap[key] = slot;
    });

    // ====== 초안 토글 ======

    // 열기 초안 토글
    const toggleDraftOpen = (date, hour) => {
        const key = `${date}-${hour}`;
        setDraftOpenCells((prev) => {
            const copy = { ...prev };

            if (copy[key]) {
                delete copy[key];
            } else {
                copy[key] = true;
            }

            if (onHasDraftChange) {
                const hasDraftNow =
                    Object.keys(copy).length > 0 ||
                    Object.keys(draftCloseSlotIds).length > 0;
                onHasDraftChange(hasDraftNow);
            }

            return copy;
        });
    };

    // 닫기 초안 토글
    const toggleDraftClose = (slot) => {
        setDraftCloseSlotIds((prev) => {
            const copy = { ...prev };

            if (copy[slot.slotId]) {
                delete copy[slot.slotId];
            } else {
                copy[slot.slotId] = true;
            }

            if (onHasDraftChange) {
                const hasDraftNow =
                    Object.keys(copy).length > 0 ||
                    Object.keys(draftOpenCells).length > 0;
                onHasDraftChange(hasDraftNow);
            }

            return copy;
        });
    };

    // 셀 클릭
    const handleCellClick = (date, hour) => {
        const key = `${date}-${hour}`;
        const slot = slotMap[key];
        const past = isPastCell(date, hour);

        // 🔒 과거 칸은 어떤 동작도 하지 않음 (선택 + 편집 모두 막기)
        if (past) {
            return;
        }

        // 1) 슬롯이 있으면 선택 이벤트 전달
        if (slot && onSelectSlot) {
            onSelectSlot(slot);
        }

        // 2) 편집 모드 아니면 여기서 끝
        if (!editMode) return;

        if (slot) {
            // RESERVED는 편집 불가
            if (slot.status === "RESERVED") {
                return;
            }

            if (slot.status === "OPEN") {
                // 기존 OPEN → "닫기 초안" 토글
                toggleDraftClose(slot);
                return;
            }

            // 그 외 상태는 무시
            return;
        } else {
            // 슬롯 없음 → "열기 초안" 토글
            toggleDraftOpen(date, hour);
        }
    };

    // ====== 적용 버튼 ======
    const handleApplyWeek = async () => {
        if (!editMode) return;

        try {
            setLoading(true);
            setError("");

            const draftOpenKeys = Object.keys(draftOpenCells);
            const draftCloseIds = Object.keys(draftCloseSlotIds);

            if (draftOpenKeys.length === 0 && draftCloseIds.length === 0) {
                setError("변경된 시간이 없습니다.");
                return;
            }

            // 1) 열기 초안 → createSingleSlot
            if (draftOpenKeys.length > 0) {
                const openPromises = draftOpenKeys.map((key) => {
                    const parts = key.split("-"); // ["YYYY","MM","DD","HH"]
                    const date = parts.slice(0, 3).join("-"); // YYYY-MM-DD
                    const hourStr = parts[3];
                    const hour = parseInt(hourStr, 10);

                    const startAt = `${date}T${String(hour).padStart(
                        2,
                        "0"
                    )}:00:00`;
                    const endAt = `${date}T${String(hour + 1).padStart(
                        2,
                        "0"
                    )}:00:00`;

                    return createSingleSlot({ startAt, endAt });
                });
                await Promise.all(openPromises);
            }

            // 2) 닫기 초안 → closeSlot
            if (draftCloseIds.length > 0) {
                const closePromises = draftCloseIds.map((id) =>
                    closeSlot(Number(id))
                );
                await Promise.all(closePromises);
            }

            // 초안 초기화 + 재조회
            setDraftOpenCells({});
            setDraftCloseSlotIds({});
            if (onHasDraftChange) {
                onHasDraftChange(false);
            }
            await loadMySlots();
        } catch (e) {
            console.error(e);
            setError("시간표 적용 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // ====== 렌더링 ======
    return (
        <div>
            {/* 주간 그리드 */}
            <section style={{ marginBottom: "16px" }}>
                <div
                    style={{
                        marginTop: "8px",
                        border: "1px solid #ccc",
                        display: "grid",
                        gridTemplateColumns: `80px repeat(${dayList.length}, 1fr)`,
                    }}
                >
                    {/* 헤더 */}
                    <div
                        style={{
                            borderBottom: "1px solid #ccc",
                            borderRight: "1px solid #ccc",
                            padding: "8px",
                            fontWeight: "bold",
                            backgroundColor: "#f8f8f8",
                        }}
                    >
                        시간
                    </div>
                    {dayList.map((day) => (
                        <div
                            key={day.date}
                            style={{
                                borderBottom: "1px solid #ccc",
                                borderRight: "1px solid #ccc",
                                padding: "8px",
                                textAlign: "center",
                                fontWeight: "bold",
                                backgroundColor: "#f8f8f8",
                            }}
                        >
                            {day.label}
                        </div>
                    ))}

                    {/* 시간 행 */}
                    {hourList.map((hour) => (
                        <React.Fragment key={hour}>
                            {/* 왼쪽 시간 라벨 */}
                            <div
                                style={{
                                    borderBottom: "1px solid #eee",
                                    borderRight: "1px solid #ccc",
                                    padding: "8px",
                                    fontSize: "12px",
                                    backgroundColor: "#fafafa",
                                }}
                            >
                                {String(hour).padStart(2, "0")}:00
                            </div>

                            {dayList.map((day) => {
                                const key = `${day.date}-${hour}`;
                                const slot = slotMap[key];
                                const isDraftOpen = !!draftOpenCells[key];
                                const isDraftClose =
                                    slot && draftCloseSlotIds[slot.slotId];

                                const past = isPastCell(day.date, hour);

                                let bg = "#ffffff";
                                let text = "";
                                let border = "1px solid #eee";

                                // 🔹 색/텍스트는 기존 로직 유지
                                if (past) {
                                    bg = "#f5f5f5";
                                    border = "1px solid #ddd";
                                } else if (slot) {
                                    if (slot.status === "OPEN") {
                                        if (isDraftClose) {
                                            bg = "#f5f5f5";
                                            text = "닫기 예정";
                                            border = "1px dashed #ff4d4f";
                                        } else {
                                            bg = "#e6f7ff";
                                            text = "OPEN";
                                            border = "1px solid #1890ff";
                                        }
                                    } else if (slot.status === "RESERVED") {
                                        bg = "#fff1f0";
                                        text = "예약됨";
                                        border = "1px solid #ffccc7";
                                    } else {
                                        bg = "#f5f5f5";
                                        text = slot.status;
                                        border = "1px solid #ccc";
                                    }
                                } else if (isDraftOpen) {
                                    bg = "#d6f4ff";
                                    text = "열기 예정";
                                    border = "1px solid #40a9ff";
                                } else {
                                    bg = "#ffffff";
                                    border = "1px solid #ddd";
                                }

                                // 🔑 여기서 실제 "클릭 가능 여부"를 계산
                                // - 과거: 무조건 false
                                // - 현재/미래 + slot 존재: 상세 보기 가능 → true
                                // - 현재/미래 + editMode: 초안 토글 가능 → true
                                const clickable = !past && (slot || editMode);
                                const cursor = clickable
                                    ? "pointer"
                                    : "default";

                                return (
                                    <div
                                        key={key}
                                        style={{
                                            borderBottom: "1px solid #eee",
                                            borderRight: "1px solid #eee",
                                            padding: "4px",
                                            minHeight: "40px",
                                            fontSize: "11px",
                                            textAlign: "center",
                                            boxSizing: "border-box",
                                            backgroundColor: bg,
                                            border,
                                            cursor,
                                        }}
                                        onClick={() => {
                                            // 🔒 과거/비클릭 영역 방어
                                            if (!clickable) return;
                                            handleCellClick(day.date, hour);
                                        }}
                                    >
                                        {text}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>

                <div style={{ marginTop: "8px" }}>
                    <button onClick={handleApplyWeek} disabled={!editMode}>
                        이 주 변경사항 적용
                    </button>
                    {!editMode && (
                        <span
                            style={{
                                marginLeft: "8px",
                                fontSize: "12px",
                                color: "#888",
                            }}
                        >
                            (편집 모드를 켠 후 변경 가능합니다)
                        </span>
                    )}
                </div>
            </section>
        </div>
    );
}

export default ScheduleEditor;
