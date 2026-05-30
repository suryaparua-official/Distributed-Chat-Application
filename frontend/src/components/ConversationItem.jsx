import React from "react";
import { useChat } from "../context/ChatContext";

function lastMsgPreview(conv, myPhone) {
  const msg = conv.lastMessage;
  if (!msg) return "";
  if (msg.deletedForEveryone) return "This message was deleted";
  const sender = msg.user === myPhone ? "You" : (msg.senderName || msg.user || "");
  const prefix = conv.type === "room" ? `${sender}: ` : "";
  return `${prefix}${msg.data}`.slice(0, 50);
}

export default function ConversationItem({ convId, isActive, onClick }) {
  const { conversations, phone, formatTime, avatarColor, avatarInitials } = useChat();
  const conv = conversations[convId];
  if (!conv) return null;

  const displayName = conv.name;
  const color       = avatarColor(displayName);
  const initials    = avatarInitials(displayName);
  const preview     = lastMsgPreview(conv, phone);
  const time        = conv.lastMessage ? formatTime(conv.lastMessage.time) : "";
  const nameTag     = conv.type === "room" ? `# ${displayName}` : displayName;

  return (
    <div
      className={`conv-item${isActive ? " conv-item--active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="conv-avatar">
        <div className="avatar-circle" style={{ background: color }}>
          {initials}
        </div>
      </div>

      <div className="conv-info">
        <div className="conv-info-top">
          <span className="conv-name">{nameTag}</span>
          {time && <span className="conv-time">{time}</span>}
        </div>
        <div className="conv-info-bottom">
          <span className="conv-last-msg">
            {preview || <em style={{ opacity: 0.5 }}>No messages yet</em>}
          </span>
          {conv.unread > 0 && (
            <span className="unread-badge">{conv.unread > 99 ? "99+" : conv.unread}</span>
          )}
        </div>
      </div>
    </div>
  );
}
