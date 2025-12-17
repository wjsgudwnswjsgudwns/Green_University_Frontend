// src/components/counseling/StudentOpenSlotGrid.js
import React, { useMemo } from "react";

function parseYmd(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function isPastCell(dateStr, hour) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const cellStart = new Date(y, m - 1, d, hour, 0, 0);
    const now = new Date();
    return cellStart.getTime() < now.getTime();
}

function formatYmdLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function getMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function StudentOpenSlotGrid({
    fromDate,
    toDate,
    slots,
    myReservedSlotIds = [],
    onSelectSlot,
    /**
     * Currently selected slotId to highlight on the grid. Optional.
     */
    selectedSlotId,
}) {
    const dayList = useMemo(() => {
        const list = [];
        try {
            const base = getMonday(parseYmd(fromDate));
            for (let i = 0; i < 5; i++) {
                const d = new Date(base);
                d.setDate(base.getDate() + i);
                const ymd = formatYmdLocal(d);
                const label = `${d.getMonth() + 1}/${d.getDate()}`;
                list.push({ date: ymd, label });
            }
        } catch (e) {
            console.error(e);
        }
        return list;
    }, [fromDate]);

    const hourStart = 9;
    const hourEnd = 18;
    const hourList = [];
    for (let h = hourStart; h <= hourEnd; h++) hourList.push(h);

    const slotMap = {};
    slots.forEach((slot) => {
        if (!slot.startAt) return;
        const [datePart, timePart] = String(slot.startAt).split("T");
        if (!datePart || !timePart) return;
        const hourKey = parseInt(timePart.slice(0, 2), 10);
        const key = `${datePart}-${hourKey}`;
        slotMap[key] = slot;
    });

    return (
        <div>
            <div
                style={{
                    marginTop: "8px",
                    border: "1px solid #ccc",
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${dayList.length}, 1fr)`,
                }}
            >
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

                {hourList.map((hour) => (
                    <React.Fragment key={hour}>
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
                            const past = isPastCell(day.date, hour);
                            const isMine =
                                slot && myReservedSlotIds.includes(slot.slotId);

                            let bg = "#ffffff";
                            let text = "";
                            let border = "1px solid #eee";
                            let clickable = false;

                            if (past) {
                                // 과거: 무조건 클릭 불가
                                bg = "#f5f5f5";
                                border = "1px solid #ddd";
                            } else if (slot && slot.status === "OPEN") {
                                // 예약 가능 (새 예약)
                                bg = "#e6fffb";
                                text = "예약 가능";
                                border = "1px solid #36cfc9";
                                clickable = true;
                            } else if (slot && slot.status === "RESERVED") {
                                if (isMine) {
                                    // 내 예약 (상세 보기)
                                    bg = "#e6f7ff";
                                    text = "내 예약";
                                    border = "1px solid #1890ff";
                                    clickable = true;
                                } else {
                                    // 남의 예약: 예약 마감
                                    bg = "#fff1f0";
                                    text = "예약 마감";
                                    border = "1px solid #ffa39e";
                                    clickable = false;
                                }
                            }

                            // 🟡 선택된 슬롯 강조: 현재 선택된 slotId가 전달된 경우 배경 강조
                            const isSelected =
                                slot &&
                                selectedSlotId &&
                                Number(slot.slotId) === Number(selectedSlotId);
                            if (isSelected) {
                                bg = "#fffbe6"; // 연한 노랑
                                border = "1px solid #d48806";
                            }

                            const cursor =
                                clickable && slot ? "pointer" : "default";

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
                                        if (!slot || !clickable || past) return;
                                        // ⚠️ 여기서 내 예약 여부 같이 넘김
                                        onSelectSlot &&
                                            onSelectSlot(slot, { isMine });
                                    }}
                                >
                                    {text}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

export default StudentOpenSlotGrid;
