import React, { useState } from "react";
import { Search, LogOut, Plus, MessageSquare, Users } from "lucide-react";
import { useChat } from "../context/ChatContext";
import ConversationItem from "./ConversationItem";
import { StatusStrip, CreateStatusOverlay } from "./StatusPanel";

// ── Phone-based DM lookup panel ────────────────────────────
function DMLookupPanel({ onClose }) {
  const { lookupUser, openDM, phone: myPhone, avatarColor, avatarInitials } = useChat();
  const [input,   setInput]   = useState("");
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleLookup = async (e) => {
    e?.preventDefault();
    const p = input.trim();
    if (!p) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await lookupUser(p);
      if (data.phone === myPhone) setError("That's your own number.");
      else setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || "No account found with that number.");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (result) { openDM(result.phone, result.name); onClose(); }
  };

  return (
    <div className="dm-lookup-panel">
      <form className="dm-lookup-form" onSubmit={handleLookup}>
        <input
          className="dm-lookup-input"
          type="tel"
          placeholder="+1234567890"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
        <button className="dm-lookup-btn" type="submit" disabled={loading || !input.trim()}>
          {loading ? "…" : "Find"}
        </button>
      </form>
      {error && <div className="dm-lookup-error">{error}</div>}
      {result && (
        <div className="dm-profile-card">
          <div className="dm-profile-avatar" style={{ background: avatarColor(result.name) }}>
            {avatarInitials(result.name)}
          </div>
          <div className="dm-profile-info">
            <div className="dm-profile-name">{result.name}</div>
            <div className="dm-profile-phone">{result.phone}</div>
          </div>
          <button className="dm-profile-start" onClick={handleStart}>Chat</button>
        </div>
      )}
    </div>
  );
}

// ── Main Sidebar ───────────────────────────────────────────
export default function Sidebar() {
  const {
    user, phone, status,
    conversations, activeId,
    createGroup, openDM, logout,
    selectConversation, avatarColor, avatarInitials,
    creatingStatus,
  } = useChat();

  const [search,         setSearch]         = useState("");
  const [newGroupInput,  setNewGroupInput]   = useState("");
  const [showGroupInput, setShowGroupInput]  = useState(false);
  const [showDMLookup,   setShowDMLookup]   = useState(false);

  const allConvs = Object.values(conversations);

  const groupConvs = allConvs.filter(
    (c) => c.type === "room" && (!search || c.name.toLowerCase().includes(search.toLowerCase()))
  );
  const dmConvs = allConvs.filter(
    (c) => c.type === "dm" && (!search || c.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleGroupSubmit = (e) => {
    e.preventDefault();
    const n = newGroupInput.trim();
    if (n) { createGroup(n); setNewGroupInput(""); setShowGroupInput(false); }
  };

  const statusLabel =
    status === "connected"   ? "Online"
    : status === "connecting" ? "Connecting…"
    : "Offline";

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="avatar-circle" style={{ background: avatarColor(user || "") }}>
          {avatarInitials(user || "")}
        </div>
        <div className="sidebar-header-user">
          <div className="sidebar-header-username">{user}</div>
          <div
            className="sidebar-header-status"
            style={{ color: status === "connected" ? "var(--online-dot)" : "var(--offline-dot)" }}
          >
            ● {statusLabel}
          </div>
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-btn" title="Sign out" onClick={logout} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <div className="sidebar-search-inner">
          <span className="sidebar-search-icon"><Search size={14} /></span>
          <input
            className="sidebar-search-input"
            placeholder="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Status strip */}
      {!search && <StatusStrip />}

      {/* Conversation list */}
      <div className="sidebar-section">

        {/* Groups */}
        <div className="section-header">
          <div className="section-label-row">
            <Users size={12} />
            <span className="section-label">Groups</span>
          </div>
          <button
            className="section-add-btn"
            title="Join or create group"
            onClick={() => { setShowGroupInput((v) => !v); setShowDMLookup(false); }}
          >
            <Plus size={14} />
          </button>
        </div>

        {showGroupInput && (
          <div className="section-new-input-row">
            <form onSubmit={handleGroupSubmit}>
              <input
                className="section-new-input"
                placeholder="Group name, then Enter"
                value={newGroupInput}
                onChange={(e) => setNewGroupInput(e.target.value)}
                autoFocus
                maxLength={32}
                onBlur={() => !newGroupInput && setShowGroupInput(false)}
              />
            </form>
          </div>
        )}

        {groupConvs.length === 0 && !search && (
          <div className="section-empty">No groups yet — tap + to join or create one</div>
        )}

        {groupConvs.map((c) => (
          <div key={c.id} className="conv-item-wrap">
            <ConversationItem
              convId={c.id}
              isActive={activeId === c.id}
              onClick={() => selectConversation(c.id)}
            />
          </div>
        ))}

        {/* Direct Messages */}
        <div className="section-header" style={{ marginTop: 8 }}>
          <div className="section-label-row">
            <MessageSquare size={12} />
            <span className="section-label">Direct Messages</span>
          </div>
          <button
            className="section-add-btn"
            title="New direct message"
            onClick={() => { setShowDMLookup((v) => !v); setShowGroupInput(false); }}
          >
            <Plus size={14} />
          </button>
        </div>

        {showDMLookup && <DMLookupPanel onClose={() => setShowDMLookup(false)} />}

        {dmConvs.length === 0 && !search && (
          <div className="section-empty">No messages — tap + to find someone by number</div>
        )}

        {dmConvs.map((c) => (
          <ConversationItem
            key={c.id}
            convId={c.id}
            isActive={activeId === c.id}
            onClick={() => selectConversation(c.id)}
          />
        ))}

        <div style={{ height: 16 }} />
      </div>

      {/* Create status overlay */}
      {creatingStatus && <CreateStatusOverlay />}
    </div>
  );
}
