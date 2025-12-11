import React, { useState, useEffect, useRef } from "react";
import api from "../api/axiosConfig";
import "../styles/chatbotModal.css";

const ChatbotModal = ({
  isOpen,
  onClose,
  initialMessages = [],
  onMessagesChange,
}) => {
  const [messages, setMessages] = useState(initialMessages);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scheduleSubjects, setScheduleSubjects] = useState([]); // 시간표 강의 리스트
  const messagesEndRef = useRef(null);
  const modalRef = useRef(null);
  const hasInitialized = useRef(false);
  const isLoadingRef = useRef(false); // 동기적 로딩 상태 추적
  const scrollTimeoutRef = useRef(null); // 스크롤 중복 호출 방지

  // 초기 메시지 설정 및 인사말 가져오기
  useEffect(() => {
    if (isOpen) {
      if (initialMessages.length === 0 && !hasInitialized.current) {
        fetchGreeting();
        hasInitialized.current = true;
      } else if (initialMessages.length > 0) {
        setMessages(initialMessages);
        hasInitialized.current = true;
      }
    }
  }, [isOpen, initialMessages]);

  // 모달이 열릴 때 스크롤을 최하단으로 이동
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      // 모달이 열리고 메시지가 있을 때 약간의 지연 후 스크롤
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 메시지 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    if (onMessagesChange && messages.length > 0) {
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange]);

  useEffect(() => {
    // 메시지가 추가되거나 로딩 상태가 변경될 때 스크롤
    if (messages.length > 0) {
      // 이전 스크롤 타이머 취소
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        scrollToBottom();
      }, 50);
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messages, isLoading]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const scrollToBottom = () => {
    // DOM 업데이트 후 스크롤
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const fetchGreeting = async () => {
    try {
      const response = await api.get("/api/chatbot/greeting");
      const greeting = response.data.response;
      setMessages([
        {
          type: "bot",
          text: greeting,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("인사말 가져오기 실패:", error);
      setMessages([
        {
          type: "bot",
          text: "안녕하세요! 그린대학교 챗봇입니다. 무엇을 도와드릴까요?",
          timestamp: new Date(),
        },
      ]);
    }
  };

  const sendMessage = async (messageText = null) => {
    const messageToSend = messageText || inputMessage.trim();

    // 동기적으로 로딩 상태 확인 (중복 호출 방지)
    if (!messageToSend || isLoadingRef.current) {
      return;
    }

    // 입력창에서 가져온 경우에만 입력창 초기화
    if (!messageText) {
      setInputMessage("");
    }

    // 사용자 메시지 즉시 추가
    const newUserMessage = {
      type: "user",
      text: messageToSend,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    // 로딩 상태 설정 (사용자 메시지 추가 후 즉시)
    isLoadingRef.current = true;
    setIsLoading(true);

    // 즉시 스크롤하여 사용자 메시지와 로딩 인디케이터가 보이도록
    setTimeout(() => {
      scrollToBottom();
    }, 50);

    try {
      const response = await api.post("/api/chatbot/message", null, {
        params: { message: messageToSend },
      });
      const botResponse = response.data.response;

      // 시간표 조회 응답인지 확인 (강의 리스트 형식)
      // 백엔드 응답 형식: "【2025년 2학기 수강 과목】\n\n아래 버튼을 클릭하여...\n\n1. 강의명\n2. 강의명..."
      const hasScheduleListPattern =
        botResponse.includes("【") && botResponse.includes("학기 수강 과목】");

      // 강의 리스트 패턴 찾기 (예: "1. 강의명")
      const lines = botResponse.split("\n");
      const scheduleLine = lines.find((line) => {
        const trimmed = line.trim();
        return /^\d+\.\s/.test(trimmed);
      });
      const isScheduleList =
        hasScheduleListPattern && scheduleLine !== undefined;

      // 시간표 리스트인 경우 강의 정보 추출
      if (isScheduleList) {
        const subjects = [];
        lines.forEach((line) => {
          const trimmedLine = line.trim();
          // "1. 강의명" 형식 매칭
          const match = trimmedLine.match(/^(\d+)\.\s(.+)$/);
          if (match) {
            const [, number, subjectName] = match;
            subjects.push({
              number: parseInt(number),
              name: subjectName.trim(),
            });
          }
        });
        if (subjects.length > 0) {
          setScheduleSubjects(subjects);
        }
      } else if (botResponse.includes("【강의 상세 정보】")) {
        // 강의 상세 정보를 조회한 경우 강의 리스트 유지 (사용자가 다른 강의도 볼 수 있도록)
        // 리스트는 유지하되, 필요시 사용자가 "전체 메뉴" 버튼으로 돌아갈 수 있음
      } else {
        // 시간표가 아닌 다른 응답이면 강의 리스트 초기화
        setScheduleSubjects([]);
      }

      const newBotMessage = {
        type: "bot",
        text: botResponse,
        timestamp: new Date(),
        isScheduleList: isScheduleList, // 시간표 리스트 여부
      };
      setMessages((prev) => [...prev, newBotMessage]);
    } catch (error) {
      console.error("메시지 전송 실패:", error);
      const errorMessage = {
        type: "bot",
        text: "죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  // 빠른 액션 버튼 클릭 시 바로 메시지 전송
  const handleQuickAction = (message) => {
    sendMessage(message);
  };

  // 대화 내역 초기화
  const handleClearChat = () => {
    if (window.confirm("대화 내역을 모두 삭제하시겠습니까?")) {
      setMessages([]);
      hasInitialized.current = false;
      // localStorage에서도 제거
      localStorage.removeItem("chatbot_history");
      if (onMessagesChange) {
        onMessagesChange([]);
      }
      // 인사말 다시 가져오기
      fetchGreeting();
    }
  };

  const formatTime = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="chatbot-modal-container" ref={modalRef}>
      <div className="chatbot-modal-header">
        <div className="chatbot-modal-header-content">
          <h2>챗봇 상담</h2>
          <p>
            등록 여부, 수강 신청, 학점, 졸업 요건, 휴학, 등록금, 시간표, 학적
            상태, 성적 등에 대해 물어보세요!
          </p>
        </div>
        <div className="chatbot-modal-header-actions">
          <button
            className="chatbot-modal-clear"
            onClick={handleClearChat}
            aria-label="대화 내역 삭제"
            title="대화 내역 삭제"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="chatbot-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="chatbot-modal-messages">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`chatbot-modal-message ${
              message.type === "user" ? "user-message" : "bot-message"
            }`}
          >
            <div className="message-content">
              {message.type === "bot" && (
                <div className="bot-avatar">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
              <div className="message-bubble">
                <div className="message-text">{message.text}</div>
                <div className="message-time">
                  {formatTime(message.timestamp)}
                </div>
              </div>
              {message.type === "user" && <div className="user-avatar">👤</div>}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chatbot-modal-message bot-message">
            <div className="message-content">
              <div className="bot-avatar">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="7"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="message-bubble">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chatbot-modal-quick-actions">
        {scheduleSubjects.length > 0 ? (
          // 시간표 강의 버튼들
          <>
            {scheduleSubjects.map((subject) => (
              <button
                key={subject.number}
                className="quick-action-btn"
                onClick={() => handleQuickAction(`${subject.number}번 강의`)}
                disabled={isLoading}
              >
                {subject.name}
              </button>
            ))}
            <button
              className="quick-action-btn"
              onClick={() => {
                setScheduleSubjects([]);
              }}
              disabled={isLoading}
              style={{
                border: "2px dashed #216d30",
                background: "transparent",
              }}
            >
              ← 전체 메뉴
            </button>
          </>
        ) : (
          // 일반 퀵 액션 버튼들
          <>
            <button
              className="quick-action-btn"
              onClick={() => handleQuickAction("등록 여부 확인")}
              disabled={isLoading}
            >
              등록 여부
            </button>
            <button
              className="quick-action-btn"
              onClick={() => handleQuickAction("수강 신청 내역")}
              disabled={isLoading}
            >
              수강 신청
            </button>
            <button
              className="quick-action-btn"
              onClick={() => handleQuickAction("취득 학점 조회")}
              disabled={isLoading}
            >
              취득 학점
            </button>
            <button
              className="quick-action-btn"
              onClick={() => handleQuickAction("졸업 요건 확인")}
              disabled={isLoading}
            >
              졸업 요건
            </button>
            <button
              className="quick-action-btn"
              onClick={() => handleQuickAction("휴학 신청 내역")}
              disabled={isLoading}
            >
              휴학 내역
            </button>
            <button
              className="quick-action-btn"
              onClick={() => handleQuickAction("시간표 조회")}
              disabled={isLoading}
            >
              시간표
            </button>
            <button
              className="quick-action-btn"
              onClick={() => handleQuickAction("학적 상태 조회")}
              disabled={isLoading}
            >
              학적 상태
            </button>
            <button
              className="quick-action-btn"
              onClick={() => handleQuickAction("학기별 성적 조회")}
              disabled={isLoading}
            >
              학기별 성적
            </button>
          </>
        )}
      </div>

      <form className="chatbot-modal-input-form" onSubmit={handleFormSubmit}>
        <input
          type="text"
          className="chatbot-modal-input"
          placeholder="메시지를 입력하세요..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          className="chatbot-modal-send-button"
          disabled={isLoading || !inputMessage.trim()}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatbotModal;
