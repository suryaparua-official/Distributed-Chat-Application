import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ChatProvider, useChat } from "./context/ChatContext";
import AuthPage from "./components/auth/AuthPage";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import CallOverlay from "./components/call/CallOverlay";
import { StatusViewer } from "./components/StatusPanel";

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="loading-spinner" />
    </div>
  );
}

function Shell() {
  const { user, loading } = useAuth();
  const { activeId } = useChat();

  if (loading) return <LoadingScreen />;
  if (!user)   return <AuthPage />;

  return (
    <>
      <div className={`app${activeId ? " app--chat-open" : ""}`}>
        <Sidebar />
        <ChatArea />
      </div>
      <CallOverlay />
      <StatusViewer />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <Shell />
      </ChatProvider>
    </AuthProvider>
  );
}
