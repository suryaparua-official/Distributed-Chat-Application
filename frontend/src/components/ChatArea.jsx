import React, { useEffect, useRef, useState } from "react";
import {
  Phone, Video, LogOut, MoreVertical, Info, Eraser,
} from "lucide-react";
import { useChat } from "../context/ChatContext";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import GroupInfoModal from "./GroupInfoModal";

function DateDivider({ label }) {
  return (
    <div className="date-divider">
      <span className="date-divider-label">{label}</span>
    </div>
  );
}

function TypingIndicator({ names }) {
  if (!names.length) return null;
  const label = names.length === 1
    ? `${names[0]} is typing`
    : `${names.slice(0, 2).join(", ")} are typing`;
  return (
    <div className="typing-row">
      <div className="typing-bubble">
        <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
        <span className="typing-label">{label}</span>
      </div>
    </div>
  );
}

// ── Header 3-dot dropdown ──────────────────────────────────
function HeaderMenu({ conv, onGroupInfo, onClearChat }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="icon-btn" title="More options" onClick={() => setOpen((v) => !v)}>
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="header-dropdown">
          {conv.type === "room" && (
            <button className="header-dropdown-item" onClick={() => { onGroupInfo(); setOpen(false); }}>
              <Info size={14} /> Group Info
            </button>
          )}
          <button className="header-dropdown-item" onClick={() => { onClearChat(); setOpen(false); }}>
            <Eraser size={14} /> Clear Chat
          </button>
          {conv.type === "room" && (
            <button
              className="header-dropdown-item header-dropdown-item--danger"
              onClick={() => { /* handled in GroupInfoModal */ onGroupInfo(); setOpen(false); }}
            >
              <LogOut size={14} /> Leave / Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ChatArea ──────────────────────────────────────────
export default function ChatArea() {
  const {
    activeId, conversations, typingUsers, user, phone,
    status, formatDate, avatarColor, avatarInitials,
    openDM, initiateCall, contacts,
    deletedForMe, clearedAt, clearChat,
  } = useChat();

  const bottomRef      = useRef(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const conv = activeId ? conversations[activeId] : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages?.length, typingUsers]);

  // Close GroupInfoModal if conversation changes
  useEffect(() => { setShowGroupInfo(false); }, [activeId]);

  if (!activeId || !conv) {
    return (
      <div className="chat-area">
        <div className="chat-empty">
          <div className="chat-empty-icon" style={{ opacity: 0.15 }}>
            <svg width="72" height="72" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" />
            </svg>
          </div>
          <div className="chat-empty-text">Select a conversation</div>
          <div className="chat-empty-sub">Choose a group or direct message to start chatting</div>
        </div>
      </div>
    );
  }

  const messages  = conv.messages || [];
  const typing    = Object.keys(typingUsers[activeId] || {}).filter((n) => n !== user);
  const convCleared = clearedAt[activeId] || 0;

  // Header subtitle
  let headerSub = "";
  if (conv.type === "room") {
    const members = (conv.users || []).map((u) => (typeof u === "object" ? u.name : u));
    headerSub = members.length
      ? `${members.length} online: ${members.slice(0, 4).join(", ")}${members.length > 4 ? "…" : ""}`
      : "Group";
  } else if (conv.type === "dm") {
    headerSub = conv.phone || "";
  }

  // Build render list with date dividers, filtered by deletion/clear
  const filtered = messages.filter((msg) => {
    if (msg.msgId && deletedForMe.has(msg.msgId)) return false;
    if (convCleared && new Date(msg.time).getTime() < convCleared) return false;
    return true;
  });

  const items = [];
  let lastDate = null;
  filtered.forEach((msg, i) => {
    const label = formatDate(msg.time);
    if (label && label !== lastDate) {
      items.push({ type: "divider", label, key: `d-${i}` });
      lastDate = label;
    }
    items.push({ type: "msg", msg, prev: filtered[i - 1] || null, key: `m-${i}` });
  });

  const headerName = conv.type === "room" ? `# ${conv.name}` : conv.name;
  const peerPhone  = conv.type === "dm" ? conv.phone : null;
  const peerName   = conv.type === "dm" ? conv.name  : null;

  return (
    <div className="chat-area" style={{ position: "relative" }}>
      {status !== "connected" && (
        <div className="status-bar">
          {status === "connecting" ? "Connecting to server…" : "Disconnected — trying to reconnect…"}
        </div>
      )}

      {/* Header */}
      <div className="chat-header">
        <div
          className="avatar-circle avatar-circle--sm"
          style={{ background: avatarColor(conv.name) }}
        >
          {avatarInitials(conv.name)}
        </div>

        <div className="chat-header-info">
          <div className="chat-header-name">{headerName}</div>
          {headerSub && <div className="chat-header-sub">{headerSub}</div>}
        </div>

        <div className="chat-header-actions">
          {/* DM call buttons */}
          {conv.type === "dm" && peerPhone && (
            <>
              <button
                className="icon-btn call-btn"
                title="Voice call"
                onClick={() => initiateCall(peerPhone, peerName, "voice")}
              >
                <Phone size={18} />
              </button>
              <button
                className="icon-btn call-btn"
                title="Video call"
                onClick={() => initiateCall(peerPhone, peerName, "video")}
              >
                <Video size={18} />
              </button>
            </>
          )}

          {/* Group member quick-DM avatars */}
          {conv.type === "room" && (conv.users || []).length > 0 && (
            <div style={{ display: "flex", gap: 4 }}>
              {(conv.users || [])
                .filter((u) => (typeof u === "object" ? u.phone : u) !== phone)
                .slice(0, 3)
                .map((u) => {
                  const uPhone = typeof u === "object" ? u.phone : u;
                  const uName  = typeof u === "object" ? u.name  : (contacts[u] || u);
                  return (
                    <button
                      key={uPhone}
                      className="icon-btn"
                      title={`DM ${uName}`}
                      onClick={() => openDM(uPhone, uName)}
                      style={{
                        width: 28, height: 28, fontSize: 11, fontWeight: 700,
                        background: avatarColor(uName), color: "#fff", borderRadius: "50%",
                      }}
                    >
                      {avatarInitials(uName)}
                    </button>
                  );
                })}
            </div>
          )}

          {/* 3-dot menu */}
          <HeaderMenu
            conv={conv}
            onGroupInfo={() => setShowGroupInfo(true)}
            onClearChat={() => clearChat(activeId)}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="message-list">
        {items.length === 0 ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-muted)", fontSize: 14, paddingTop: 48,
          }}>
            No messages yet. Say hello!
          </div>
        ) : (
          items.map((item) =>
            item.type === "divider" ? (
              <DateDivider key={item.key} label={item.label} />
            ) : (
              <MessageBubble
                key={item.key}
                msg={item.msg}
                prevMsg={item.prev}
                convType={conv.type}
                convId={activeId}
              />
            )
          )
        )}
        <TypingIndicator names={typing} />
        <div ref={bottomRef} />
      </div>

      <MessageInput convId={activeId} />

      {/* Group info panel */}
      {showGroupInfo && (
        <GroupInfoModal conv={conv} onClose={() => setShowGroupInfo(false)} />
      )}
    </div>
  );
}
