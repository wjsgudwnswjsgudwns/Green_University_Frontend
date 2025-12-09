import React, { useState, useEffect, useRef } from "react";
import api from "../../api/axiosConfig";
import "../../styles/chatbot.css";

const ChatbotPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const hasInitialized = useRef(false);
  const isLoadingRef = useRef(false); // 동기적 로딩 상태 추적
  const scrollTimeoutRef = useRef(null); // 스크롤 중복 호출 방지

  // localStorage에서 대화 내역 불러오기
  useEffect(() => {
    const savedHistory = localStorage.getItem("chatbot_history");
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (parsed.length > 0) {
          setMessages(parsed);
          hasInitialized.current = true;
          // 메시지 로드 후 스크롤을 최하단으로 이동
          setTimeout(() => {
            scrollToBottom();
          }, 100);
          return;
        }
      } catch (e) {
        console.error("대화 내역 불러오기 실패:", e);
      }
    }
    // 저장된 내역이 없으면 인사말 가져오기
    if (!hasInitialized.current) {
      fetchGreeting();
      hasInitialized.current = true;
    }
  }, []);

  // 메시지 변경 시 localStorage에 저장
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chatbot_history", JSON.stringify(messages));
    }
  }, [messages]);

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

      const newBotMessage = {
        type: "bot",
        text: botResponse,
        timestamp: new Date(),
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

  useEffect(() => {
    // 챗봇 페이지 클래스 추가 (플로팅 버튼 숨기기용)
    document.body.classList.add("chatbot-page-active");
    return () => {
      document.body.classList.remove("chatbot-page-active");
    };
  }, []);

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <div className="chatbot-header-content">
          <h1>챗봇 상담</h1>
          <p>등록 여부, 수강 신청, 학점, 졸업 요건 등에 대해 물어보세요!</p>
        </div>
        <button
          className="chatbot-clear-btn"
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
      </div>

      <div className="chatbot-messages">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`chatbot-message ${
              message.type === "user" ? "user-message" : "bot-message"
            }`}
          >
            <div className="message-content">
              {message.type === "bot" && (
                <div className="bot-avatar">
                  <svg
                    width="24"
                    height="24"
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
          <div className="chatbot-message bot-message">
            <div className="message-content">
              <div className="bot-avatar">
                <svg
                  width="24"
                  height="24"
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

      <div className="chatbot-quick-actions">
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
      </div>

      <form className="chatbot-input-form" onSubmit={handleFormSubmit}>
        <input
          type="text"
          className="chatbot-input"
          placeholder="메시지를 입력하세요..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          className="chatbot-send-button"
          disabled={isLoading || !inputMessage.trim()}
        >
          전송
        </button>
      </form>
    </div>
  );
};

export default ChatbotPage;
