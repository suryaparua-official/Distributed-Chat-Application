import React, { useCallback, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useChat } from "../context/ChatContext";

export default function MessageInput({ convId }) {
  const { conversations, user, phone, sendMessage, sendTyping } = useChat();
  const [text, setText] = useState("");
  const typingTimer = useRef(null);
  const isTyping    = useRef(false);

  const conv   = conversations[convId];
  const isRoom = conv?.type === "room";
  const isDM   = conv?.type === "dm";

  const handleChange = (e) => {
    setText(e.target.value);
    if (isRoom && conv?.name) {
      if (!isTyping.current) { isTyping.current = true; sendTyping(conv.name, true); }
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        isTyping.current = false;
        sendTyping(conv.name, false);
      }, 2500);
    }
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (typingTimer.current) clearTimeout(typingTimer.current);
    isTyping.current = false;
    if (isRoom && conv?.name) sendTyping(conv.name, false);

    if (isDM) {
      sendMessage({ content: trimmed, toUser: conv.phone || conv.name });
    } else if (isRoom) {
      sendMessage({ content: trimmed, room: conv.name });
    }

    setText("");
  }, [text, isDM, isRoom, conv, sendMessage, sendTyping]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const canSend = text.trim().length > 0 && (isDM || isRoom);

  const placeholder = isDM
    ? `Message ${conv?.name}…`
    : isRoom
    ? `Message #${conv?.name}…`
    : "Type a message…";

  return (
    <div className="input-bar">
      <div className="input-row">
        <textarea
          className="input-field"
          rows={1}
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!canSend}
          title="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
