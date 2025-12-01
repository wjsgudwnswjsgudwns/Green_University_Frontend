import React, { createContext, useState, useContext } from 'react';

// This context stores authentication related information.  
// In a real application the authentication state would be
// persisted (e.g. via cookies or JWT) and fetch user info
// from the backend. For this front‑end only implementation
// we simply hold a user object in state.
const AuthContext = createContext();

/**
 * Provider component exposing authentication state and helpers.
 *
 * The default user object includes a role (student, professor or staff),
 * name, id and email. You can adjust this shape as needed to fit
 * your backend API. The login/logout functions here are placeholders
 * that simply update state; integrating a real backend would require
 * making HTTP requests and storing tokens securely.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  /**
   * Log a user into the system by setting the user state.  
   * In production this would also involve token management and
   * server communication.
   * @param {Object} credentials - An object containing login fields
   */
  const login = (credentials) => {
    // TODO: replace this with real authentication logic
    // Simulate a logged in user based on provided credentials.
    const { id, password, role = 'student' } = credentials;
    setUser({
      name: '사용자',
      id,
      email: `${id}@example.com`,
      role,
    });
  };

  /**
   * Log out the current user. Clears user information from state.
   */
  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Convenience hook for accessing authentication context.
 */
export function useAuth() {
  return useContext(AuthContext);
}