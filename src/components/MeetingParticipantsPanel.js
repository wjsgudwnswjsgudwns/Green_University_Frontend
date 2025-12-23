import React, { useMemo, useState } from "react";
import "../styles/meetingParticipantsPanel.css";

export default function MeetingParticipantsPanel({
    joined = [],
    invited = [],
    isHost = false,
    onInvite,
}) {
    const [showInvited, setShowInvited] = useState(false);

    const onlineCount = useMemo(
        () => joined.filter((p) => p.online).length,
        [joined]
    );

    return (
        <div className="mpp">
            <div className="mpp__header">
                <h3 className="mpp__title">
                    참여자 ({joined.length}) · 접속중 {onlineCount}
                </h3>

                {isHost && (
                    <button
                        className="mpp__invite-btn"
                        onClick={onInvite}
                        type="button"
                    >
                        초대
                    </button>
                )}
            </div>

            {/* JOINED 목록 */}
            <ul className="mpp__list">
                {joined.map((p) => (
                    <li key={p.id} className="mpp__item">
                        <span className="mpp__name">
                            {p.name}
                            {p.isMe && <span className="mpp__tag">나</span>}
                            {p.isHost && (
                                <span className="mpp__tag mpp__tag--host">
                                    호스트
                                </span>
                            )}
                        </span>

                        <span
                            className={
                                p.online
                                    ? "mpp__status mpp__status--online"
                                    : "mpp__status mpp__status--offline"
                            }
                        >
                            {p.online ? "접속중" : "미접속"}
                        </span>
                    </li>
                ))}
            </ul>

            {/* INVITED: 기본 숨김 아코디언 */}
            {invited.length > 0 && (
                <div className="mpp__section">
                    <button
                        type="button"
                        className="mpp__accordion"
                        onClick={() => setShowInvited((v) => !v)}
                    >
                        초대중 ({invited.length})
                        <span className="mpp__accordion-icon">
                            {showInvited ? "▾" : "▸"}
                        </span>
                    </button>

                    {showInvited && (
                        <ul className="mpp__list mpp__list--sub">
                            {invited.map((p) => (
                                <li key={p.id} className="mpp__item">
                                    <span className="mpp__name">
                                        {p.name}
                                        {p.isHost && (
                                            <span className="mpp__tag mpp__tag--host">
                                                호스트
                                            </span>
                                        )}
                                    </span>
                                    <span className="mpp__status mpp__status--invited">
                                        초대중
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {joined.length === 0 && invited.length === 0 && (
                <div className="mpp__empty">참여자가 없습니다.</div>
            )}
        </div>
    );
}
