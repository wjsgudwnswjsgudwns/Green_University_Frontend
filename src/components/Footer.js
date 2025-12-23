import React from "react";
import { Link } from "react-router-dom";
import "../styles/footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-left">
          <p>개인정보처리방침</p>
          <p>서울 캠퍼스 : 서울 마포구 신촌로 176 중앙빌딩</p>
          <p>
            신단수 캠퍼스 : 서울 강남구 테헤란로 7길 7(역삼동 에스코빌딩 6층)
          </p>
          <p>
            COPYRIGHT© 2023&nbsp;
            <Link
              to="https://github.com/wjsgudwnswjsgudwns/GreenUniversity_Backend"
              target="_blank"
              rel="noopener noreferrer"
            >
              GREEN UNIVERSITY
            </Link>
            . ALL RIGHTS RESERVED.
          </p>
        </div>
        <div className="footer-right">
          <p>
            <Link to="/map" rel="noopener noreferrer">
              찾아오시는길
            </Link>
          </p>
          <p>TEL : 010-7338-7470</p>
          <p>TEL : 010-4332-9365</p>
          <p>TEL : 010-2009-6862</p>
        </div>
      </div>
    </footer>
  );
}
