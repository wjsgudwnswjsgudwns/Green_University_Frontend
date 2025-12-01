import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/login.css';

/**
 * Login page allowing users to authenticate into the LMS.
 * It contains fields for ID (numeric) and password, as well as
 * an optional "remember me" checkbox. When submitted, it calls
 * the login function from AuthContext and redirects to the home page.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Basic validation: ensure fields are not empty
    if (!id || !password) {
      alert('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    // Perform login. A real app would send credentials to the server.
    login({ id, password });
    // Save ID to localStorage if remember is checked
    if (rememberId) {
      localStorage.setItem('rememberedId', id);
    } else {
      localStorage.removeItem('rememberedId');
    }
    navigate('/');
  };

  // Retrieve remembered ID on first render
  React.useEffect(() => {
    const remembered = localStorage.getItem('rememberedId');
    if (remembered) {
      setId(remembered);
      setRememberId(true);
    }
  }, []);

  return (
    <div className="login-page page-container">
      <div className="login-container">
        <div className="login-logo">
          {/* Replace with your own logo asset */}
          <span className="material-symbols-outlined" style={{ fontSize: '64px', color: '#2a8fbd' }}>
            school
          </span>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="id">
              <span className="material-symbols-outlined">person</span>
            </label>
            <input
              type="number"
              id="id"
              placeholder="아이디를 입력하세요"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
              max={2147483647}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">
              <span className="material-symbols-outlined">lock</span>
            </label>
            <input
              type="password"
              id="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="remember-id">
            <input
              type="checkbox"
              id="rememberId"
              checked={rememberId}
              onChange={(e) => setRememberId(e.target.checked)}
            />
            <label htmlFor="rememberId">ID 저장</label>
          </div>
          <button type="submit" className="login-button">
            로그인
          </button>
        </form>
        <ul className="login-links">
          {/* In a real application these would open modals or new pages */}
          <li>
            <a href="#" onClick={() => alert('ID 찾기 기능은 구현되지 않았습니다.')}>ID 찾기</a>
          </li>
          <li>
            <a href="#" onClick={() => alert('비밀번호 찾기 기능은 구현되지 않았습니다.')}>비밀번호 찾기</a>
          </li>
        </ul>
      </div>
    </div>
  );
}