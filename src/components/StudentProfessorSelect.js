// src/components/counseling/StudentProfessorSelect.js
import React from "react";

function StudentProfessorSelect({ professors, selectedId, onChange }) {
    return (
        <div style={{ marginBottom: "8px" }}>
            <label>
                담당 교수 선택:{" "}
                <select
                    value={selectedId || ""}
                    onChange={(e) => onChange(Number(e.target.value) || null)}
                >
                    <option value="">교수를 선택하세요</option>
                    {professors.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );
}

export default StudentProfessorSelect;
