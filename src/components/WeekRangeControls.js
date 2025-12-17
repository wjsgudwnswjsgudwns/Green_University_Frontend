// src/components/counseling/WeekRangeControls.js
import React from "react";

function WeekRangeControls({
    fromDate,
    toDate,
    onChangeFrom,
    onChangeTo,
    onPrevWeek,
    onNextWeek,
    /**
     * Optional callback to reset the week range to the current week (월~금).
     */
    onResetWeek,
}) {
    return (
        <section style={{ marginBottom: "16px" }}>
            <div
                style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                }}
            >
                <label>
                    From:{" "}
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => onChangeFrom(e.target.value)}
                    />
                </label>
                <label>
                    To:{" "}
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => onChangeTo(e.target.value)}
                    />
                </label>

                <button type="button" onClick={onPrevWeek}>
                    이전 주
                </button>
                <button type="button" onClick={onNextWeek}>
                    다음 주
                </button>
                {onResetWeek && (
                    <button
                        type="button"
                        onClick={onResetWeek}
                        style={{ marginLeft: "8px" }}
                    >
                        이번 주
                    </button>
                )}
            </div>
        </section>
    );
}

export default WeekRangeControls;
