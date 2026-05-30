import React, { useRef, useState, useEffect } from "react";
import { MoreVertical, Copy, Trash2, Trash } from "lucide-react";
import { useChat } from "../context/ChatContext";

export default function MessageBubble({ msg, prevMsg, convType, convId }) {
  const { phone, formatTime, avatarColor, deleteMessage } = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef  = useRef(null);

  const isOwn      = msg.user === phone;
  const isSystem   = !msg.user;
  const isUnicast  = Boolean(msg.unicast);
  const isDeleted  = Boolean(msg.deletedForEveryone);

  const displayName = msg.senderName || msg.user || "";

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (isSystem) {
    return (
      <div className="msg-row msg-row--system">
        <div className="msg-bubble msg-bubble--system">{msg.data}</div>
      </div>
    );
  }

  const showSender =
    !isOwn && convType === "room" &&
    (!prevMsg || prevMsg.user !== msg.user || !prevMsg.user);

  const rowClass = [
    "msg-row",
    isOwn ? "msg-row--out" : "msg-row--in",
    showSender ? "msg-row--first-in" : "",
  ].filter(Boolean).join(" ");

  const bubbleClass = [
    "msg-bubble",
    isOwn ? "msg-bubble--out" : "msg-bubble--in",
    isDeleted ? "msg-bubble--deleted" : "",
  ].join(" ");

  const handleCopy = () => {
    if (msg.data) navigator.clipboard.writeText(msg.data).catch(() => {});
    setMenuOpen(false);
  };

  const handleDeleteForMe = () => {
    deleteMessage(msg.msgId, "me", convId);
    setMenuOpen(false);
  };

  const handleDeleteForEveryone = () => {
    deleteMessage(msg.msgId, "everyone", convId);
    setMenuOpen(false);
  };

  return (
    <div className={rowClass}>
      <div className="msg-bubble-wrap" ref={menuRef}>
        <div className={bubbleClass}>
          {showSender && !isDeleted && (
            <div className="msg-sender" style={{ color: avatarColor(displayName) }}>
              {displayName}
            </div>
          )}
          {isUnicast && !isOwn && !isDeleted && (
            <div className="msg-sender" style={{ color: avatarColor(displayName) }}>
              {displayName}
            </div>
          )}

          {isDeleted ? (
            <div className="msg-deleted">
              <Trash size={12} />
              This message was deleted
            </div>
          ) : (
            <div className="msg-text">{msg.data}</div>
          )}

          <div className="msg-meta">
            <span className="msg-time">{formatTime(msg.time)}</span>
          </div>
        </div>

        {/* Hover action button */}
        {!isDeleted && (
          <button
            className={`msg-action-btn${isOwn ? " msg-action-btn--out" : " msg-action-btn--in"}`}
            onClick={() => setMenuOpen((v) => !v)}
            title="Message actions"
          >
            <MoreVertical size={14} />
          </button>
        )}

        {/* Context menu */}
        {menuOpen && !isDeleted && (
          <div className={`msg-menu${isOwn ? " msg-menu--out" : " msg-menu--in"}`}>
            <button className="msg-menu-item" onClick={handleCopy}>
              <Copy size={13} /> Copy Text
            </button>
            <button className="msg-menu-item" onClick={handleDeleteForMe}>
              <Trash size={13} /> Delete for Me
            </button>
            {isOwn && msg.msgId && (
              <button className="msg-menu-item msg-menu-item--danger" onClick={handleDeleteForEveryone}>
                <Trash2 size={13} /> Delete for Everyone
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
