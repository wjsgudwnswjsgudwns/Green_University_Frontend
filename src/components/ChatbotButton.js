import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import ChatbotModal from "./ChatbotModal";
import "../styles/chatbotButton.css";

const ChatbotButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const { user } = useAuth();

  // localStorage에서 대화 내역 불러오기 (페이지 이동 후에도 유지, 로그아웃 시 초기화)
  useEffect(() => {
    // 학생이 아니면 실행하지 않음
    if (!user || user.userRole !== "student") {
      return;
    }

    // localStorage 사용 (페이지 이동 후에도 유지됨)
    const savedHistory = localStorage.getItem("chatbot_history");
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setChatHistory(parsed);
      } catch (e) {
        console.error("대화 내역 불러오기 실패:", e);
      }
    }
  }, [user]);

  // 대화 내역 저장 (localStorage 사용)
  const saveChatHistory = (messages) => {
    setChatHistory(messages);
    localStorage.setItem("chatbot_history", JSON.stringify(messages));
  };

  const handleClick = () => {
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  // 학생만 표시 (조건부 렌더링은 return에서 처리)
  if (!user || user.userRole !== "student") {
    return null;
  }

  return (
    <>
      <div className="chatbot-floating-button-container">
        <button
          className={`chatbot-floating-button ${isModalOpen ? "active" : ""}`}
          onClick={handleClick}
          aria-label="챗봇 열기"
          title="챗봇 상담"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 채팅 아이콘 */}
            <path
              d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M7 9H17M7 12H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <ChatbotModal
        isOpen={isModalOpen}
        onClose={handleClose}
        initialMessages={chatHistory}
        onMessagesChange={saveChatHistory}
      />
    </>
  );
};

export default ChatbotButton;
