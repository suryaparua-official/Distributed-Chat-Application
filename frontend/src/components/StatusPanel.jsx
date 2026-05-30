import React, { useState, useEffect, useRef } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Eye, Check, Send } from "lucide-react";
import { useChat } from "../context/ChatContext";

// ── Helpers ────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 12) return `${h}h ago`;
  return "";
}

function timeLeft(expiresAt) {
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

// ── StatusRing avatar ──────────────────────────────────────
export function StatusRing({ seen, mine, size = 44 }) {
  if (mine)  return <div className="status-ring status-ring--mine"  style={{ width: size, height: size }} />;
  if (!seen) return <div className="status-ring status-ring--unseen" style={{ width: size, height: size }} />;
  return       <div className="status-ring status-ring--seen"   style={{ width: size, height: size }} />;
}

// ── Status strip (horizontal scrollable row in sidebar) ────
export function StatusStrip() {
  const {
    user, phone, statuses, viewStatus, setCreatingStatus,
    avatarColor, avatarInitials,
  } = useChat();

  // Filter out expired statuses on render
  const now     = Date.now();
  const others  = Object.entries(statuses).filter(
    ([p, list]) => p !== phone && list.some((s) => new Date(s.expiresAt).getTime() > now)
  );
  const myList  = (statuses[phone] || []).filter(
    (s) => new Date(s.expiresAt).getTime() > now
  );

  return (
    <div className="status-strip">
      <div className="status-strip-scroll">
        {/* My Status */}
        <div className="status-item" onClick={() => myList.length ? viewStatus(phone) : setCreatingStatus(true)}>
          <div className="status-item-avatar">
            <StatusRing mine={myList.length > 0} seen={false} size={48} />
            <div className="avatar-circle" style={{ background: avatarColor(user || "") }}>
              {avatarInitials(user || "")}
            </div>
            {myList.length === 0 && (
              <div className="status-add-badge">
                <Plus size={10} />
              </div>
            )}
          </div>
          <span className="status-item-name">My Status</span>
        </div>

        {/* Others */}
        {others.map(([userPhone, list]) => {
          const latest = list[0];
          const hasUnseen = list.some((s) => !(s.viewedBy || []).includes(phone));
          return (
            <div key={userPhone} className="status-item" onClick={() => viewStatus(userPhone)}>
              <div className="status-item-avatar">
                <StatusRing seen={!hasUnseen} size={48} />
                <div className="avatar-circle" style={{ background: avatarColor(latest.senderName) }}>
                  {avatarInitials(latest.senderName)}
                </div>
              </div>
              <span className="status-item-name">{latest.senderName.split(" ")[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Create Status Overlay ──────────────────────────────────
export function CreateStatusOverlay() {
  const { setCreatingStatus, postStatus } = useChat();
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!text.trim()) return;
    postStatus(text.trim());
    setCreatingStatus(false);
  };

  return (
    <div className="status-create-overlay" onClick={() => setCreatingStatus(false)}>
      <div className="status-create-card" onClick={(e) => e.stopPropagation()}>
        <div className="status-create-header">
          <button className="status-create-close" onClick={() => setCreatingStatus(false)}>
            <X size={20} />
          </button>
          <span className="status-create-title">New Status</span>
        </div>

        <div className="status-create-body">
          <textarea
            ref={textareaRef}
            className="status-create-input"
            placeholder="Type a status update… (visible to all for 12 hours)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={700}
            rows={5}
          />
          <div className="status-create-meta">
            <span className="status-create-count">{text.length}/700</span>
            <span className="status-create-hint">Expires in 12 hours</span>
          </div>
        </div>

        <div className="status-create-footer">
          <button
            className="status-create-submit"
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            <Send size={16} />
            Share Status
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status Viewer Overlay ──────────────────────────────────
export function StatusViewer() {
  const {
    statuses, viewingStatusPhone, phone,
    closeStatusViewer, markStatusViewed,
    avatarColor, avatarInitials, setCreatingStatus,
    user,
  } = useChat();

  const [currentIdx, setCurrentIdx] = useState(0);

  // Compute list with hooks unconditionally before any early return
  const now  = Date.now();
  const list = viewingStatusPhone
    ? (statuses[viewingStatusPhone] || []).filter(
        (s) => new Date(s.expiresAt).getTime() > now
      )
    : [];

  const isOwnStatus = viewingStatusPhone === phone;
  const status      = list[currentIdx] || list[0] || null;
  const posterName  = isOwnStatus ? user : (status?.senderName || viewingStatusPhone);
  const viewers     = status?.viewedBy?.length || 0;

  useEffect(() => { setCurrentIdx(0); }, [viewingStatusPhone]);

  // Close viewer when statuses expire or are all gone
  useEffect(() => {
    if (viewingStatusPhone && list.length === 0) closeStatusViewer();
  }, [viewingStatusPhone, list.length, closeStatusViewer]);

  // Mark viewed on mount / index change
  useEffect(() => {
    if (status?._id && !isOwnStatus) markStatusViewed(status._id);
  }, [status?._id, isOwnStatus]);

  const prev = () => setCurrentIdx((i) => Math.max(0, i - 1));
  const next = () => {
    if (currentIdx < list.length - 1) setCurrentIdx((i) => i + 1);
    else closeStatusViewer();
  };

  if (!viewingStatusPhone || !list.length) return null;

  return (
    <div className="status-viewer" onClick={closeStatusViewer}>
      <div className="status-viewer-inner" onClick={(e) => e.stopPropagation()}>
        {/* Progress bars */}
        <div className="status-progress-bar-row">
          {list.map((_, i) => (
            <div key={i} className={`status-progress-seg${i < currentIdx ? " status-progress-seg--done" : i === currentIdx ? " status-progress-seg--active" : ""}`} />
          ))}
        </div>

        {/* Header */}
        <div className="status-viewer-header">
          <div className="status-viewer-user">
            <div className="avatar-circle avatar-circle--sm" style={{ background: avatarColor(posterName) }}>
              {avatarInitials(posterName)}
            </div>
            <div className="status-viewer-meta">
              <span className="status-viewer-name">{isOwnStatus ? "My Status" : posterName}</span>
              <span className="status-viewer-time">{timeAgo(status?.createdAt)} · {timeLeft(status?.expiresAt)}</span>
            </div>
          </div>
          <button className="status-viewer-close" onClick={closeStatusViewer}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="status-viewer-content">
          <p className="status-viewer-text">{status?.content}</p>
        </div>

        {/* Navigation */}
        <div className="status-viewer-nav">
          {currentIdx > 0 && (
            <button className="status-nav-btn status-nav-btn--prev" onClick={prev}>
              <ChevronLeft size={24} />
            </button>
          )}
          {currentIdx < list.length - 1 && (
            <button className="status-nav-btn status-nav-btn--next" onClick={next}>
              <ChevronRight size={24} />
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="status-viewer-footer">
          {isOwnStatus ? (
            <>
              <span className="status-viewer-views">
                <Eye size={14} /> {viewers} {viewers === 1 ? "view" : "views"}
              </span>
              <button
                className="status-viewer-add"
                onClick={() => { closeStatusViewer(); setCreatingStatus(true); }}
              >
                <Plus size={14} /> Add another
              </button>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              <Check size={12} /> Status viewed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
