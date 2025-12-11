// src/hooks/useWeekRange.js
import { useCallback, useState } from "react";

// YYYY-MM-DD 포맷
function formatYmdLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// 기준 날짜가 포함된 주 월요일
function getMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0=일,1=월...
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// yyyy-MM-dd + days
function addDaysStr(dateStr, days) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const base = new Date(y, m - 1, d);
    base.setDate(base.getDate() + days);
    return formatYmdLocal(base);
}

export function useWeekRange() {
    const today = new Date();
    const monday = getMonday(today);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const [fromDate, _setFromDate] = useState(formatYmdLocal(monday));
    const [toDate, setToDate] = useState(formatYmdLocal(friday));

    //  from을 값 또는 업데이트 함수 둘 다 받을 수 있게 처리
    const setWeekFrom = useCallback((nextFromOrUpdater) => {
        _setFromDate((prevFrom) => {
            const nextFrom =
                typeof nextFromOrUpdater === "function"
                    ? nextFromOrUpdater(prevFrom) // prevFrom → 새 from
                    : nextFromOrUpdater; // 그냥 문자열 직접

            const nextTo = addDaysStr(nextFrom, 4); // 항상 월~금
            setToDate(nextTo);
            return nextFrom;
        });
    }, []);

    const goPrevWeek = useCallback(() => {
        setWeekFrom((prevFrom) => addDaysStr(prevFrom, -7));
    }, [setWeekFrom]);

    const goNextWeek = useCallback(() => {
        setWeekFrom((prevFrom) => addDaysStr(prevFrom, 7));
    }, [setWeekFrom]);

    return {
        fromDate,
        toDate,
        setFromDate: setWeekFrom, // 시작일만 바꾸면 자동으로 끝나는 날 맞춰짐
        setToDate, // 필요하면 직접 조정할 수도 있게 남겨둠
        goPrevWeek,
        goNextWeek,
    };
}
