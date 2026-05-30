import React, { useState } from "react";
import { X, Crown, LogOut, Trash2, MessageSquare, UserPlus } from "lucide-react";
import { useChat } from "../context/ChatContext";

export default function GroupInfoModal({ conv, onClose }) {
  const {
    phone, leaveGroup, deleteGroup, openDM, clearChat, addMember, lookupUser,
    avatarColor, avatarInitials, contacts,
  } = useChat();

  const [addInput,   setAddInput]   = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError,   setAddError]   = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  if (!conv) return null;

  const isCreator     = conv.creator === phone;
  const allMemberPhones = conv.allMembers || [];

  const handleAddMember = async (e) => {
    e.preventDefault();
    const p = addInput.trim();
    if (!p) return;
    setAddLoading(true); setAddError(""); setAddSuccess("");
    try {
      const data = await lookupUser(p);
      addMember(conv.name, data.phone);
      setAddSuccess(`${data.name} was added to the group`);
      setAddInput("");
    } catch (err) {
      setAddError(err.response?.data?.error || "No account found with that number.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleLeave = () => {
    leaveGroup(conv.name);
    onClose();
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${conv.name}"? This cannot be undone.`)) return;
    deleteGroup(conv.name);
    onClose();
  };

  const handleClearChat = () => {
    clearChat(conv.id);
    onClose();
  };

  return (
    <div className="group-info-overlay" onClick={onClose}>
      <div className="group-info-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="group-info-header">
          <span className="group-info-title">Group Info</span>
          <button className="group-info-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Group identity */}
        <div className="group-info-identity">
          <div className="group-info-avatar" style={{ background: avatarColor(conv.name) }}>
            {avatarInitials(conv.name)}
          </div>
          <div className="group-info-name"># {conv.name}</div>
          <div className="group-info-sub">{allMemberPhones.length} members</div>
        </div>

        {/* Creator badge */}
        {conv.creator && (
          <div className="group-info-meta">
            <Crown size={12} />
            <span>
              Created by{" "}
              <strong>{contacts[conv.creator] || conv.creator}</strong>
              {conv.creator === phone && " (you)"}
            </span>
          </div>
        )}

        {/* Member list */}
        <div className="group-info-section-label">Members</div>
        <div className="group-info-members">
          {allMemberPhones.length === 0 ? (
            <div className="group-info-empty">No members yet</div>
          ) : (
            allMemberPhones.map((memberPhone) => {
              const memberName = contacts[memberPhone] || memberPhone;
              const isMe       = memberPhone === phone;
              const isAdmin    = memberPhone === conv.creator;
              return (
                <div key={memberPhone} className="group-member-item">
                  <div className="avatar-circle avatar-circle--sm" style={{ background: avatarColor(memberName) }}>
                    {avatarInitials(memberName)}
                  </div>
                  <div className="group-member-info">
                    <span className="group-member-name">
                      {memberName}
                      {isMe && <span className="group-member-you"> (you)</span>}
                    </span>
                    <span className="group-member-phone">{memberPhone}</span>
                  </div>
                  {isAdmin && (
                    <span className="group-member-admin">
                      <Crown size={11} /> Admin
                    </span>
                  )}
                  {!isMe && (
                    <div className="group-member-actions">
                      <button
                        className="group-member-btn"
                        title={`DM ${memberName}`}
                        onClick={() => { openDM(memberPhone, memberName); onClose(); }}
                      >
                        <MessageSquare size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Member — creator only */}
        {isCreator && (
          <div className="group-add-member">
            <div className="group-info-section-label">Add Member</div>
            <form className="group-add-form" onSubmit={handleAddMember}>
              <input
                className="group-add-input"
                type="tel"
                placeholder="Phone number (+1234567890)"
                value={addInput}
                onChange={(e) => { setAddInput(e.target.value); setAddError(""); setAddSuccess(""); }}
              />
              <button className="group-add-btn" type="submit" disabled={addLoading || !addInput.trim()}>
                {addLoading ? "…" : <UserPlus size={15} />}
              </button>
            </form>
            {addError   && <div className="group-add-feedback group-add-feedback--error">{addError}</div>}
            {addSuccess && <div className="group-add-feedback group-add-feedback--ok">{addSuccess}</div>}
          </div>
        )}

        {/* Actions */}
        <div className="group-info-actions">
          <button className="group-action-btn group-action-btn--neutral" onClick={handleClearChat}>
            Clear Chat
          </button>
          <button className="group-action-btn group-action-btn--danger" onClick={handleLeave}>
            <LogOut size={15} /> Leave Group
          </button>
          {isCreator && (
            <button className="group-action-btn group-action-btn--delete" onClick={handleDelete}>
              <Trash2 size={15} /> Delete Group
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
