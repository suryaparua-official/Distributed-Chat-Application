import React, { useState } from "react";
import { useChat } from "../context/ChatContext";
import { MessageSquare } from "lucide-react";

export default function AuthScreen() {
  const { login } = useChat();
  const [username, setUsername] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed) login(trimmed);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo"><MessageSquare size={36} /></div>
        <div>
          <div className="auth-title">Welcome to Schat</div>
          <div className="auth-subtitle">Real-time group and direct messaging</div>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={32}
            autoFocus
            autoComplete="off"
          />
          <button
            className="auth-btn"
            type="submit"
            disabled={!username.trim()}
          >
            Start Chatting
          </button>
        </form>
      </div>
    </div>
  );
}
