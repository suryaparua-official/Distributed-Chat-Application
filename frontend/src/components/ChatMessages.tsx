import { Message } from "@/app/chat/page";
import { User } from "@/context/AppContext";
import React, { useEffect, useMemo, useRef } from "react";
import moment from "moment";
import { Check, CheckCheck } from "lucide-react";

interface ChatMessagesProps {
  selectedUser: string | null;
  messages: Message[] | null;
  loggedInUser: User | null;
}

const ChatMessages = ({
  selectedUser,
  messages,
  loggedInUser,
}: ChatMessagesProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  const uniqueMessages = useMemo(() => {
    if (!messages) return [];
    const seen = new Set();
    return messages.filter((message) => {
      if (seen.has(message._id)) return false;
      seen.add(message._id);
      return true;
    });
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedUser, uniqueMessages]);

  return (
    <div className="flex-1 bg-[#0b141a]">
      <div className="h-full max-h-[calc(100vh-215px)] overflow-y-auto px-6 py-4 space-y-2">
        {!selectedUser ? (
          <p className="text-gray-400 text-center mt-24 text-sm">
            Please select a user to start chatting
          </p>
        ) : (
          <>
            {uniqueMessages.map((e, i) => {
              const isSentByMe = e.sender === loggedInUser?._id;
              const uniqueKey = `${e._id}-${i}`;

              return (
                <div
                  key={uniqueKey}
                  className={`flex ${
                    isSentByMe ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`
                      relative px-3 py-2
                      text-[14px] leading-relaxed
                      max-w-[65%]
                      rounded-lg
                      ${
                        isSentByMe
                          ? "bg-[#005c4b] text-white rounded-br-sm"
                          : "bg-[#202c33] text-white rounded-bl-sm"
                      }
                    `}
                  >
                    {/* Image */}
                    {e.messageType === "image" && e.image && (
                      <div className="mb-2 overflow-hidden rounded-md">
                        <img
                          src={e.image.url}
                          alt="shared image"
                          className="max-w-full h-auto rounded-md object-cover"
                        />
                      </div>
                    )}

                    {/* Text */}
                    {e.text && (
                      <p className="whitespace-pre-wrap break-words">
                        {e.text}
                      </p>
                    )}

                    {/* Time + Seen (inside bubble like WhatsApp) */}
                    <div
                      className={`flex items-center gap-1 mt-1 text-[10px] ${
                        isSentByMe
                          ? "justify-end text-gray-200"
                          : "justify-end text-gray-400"
                      }`}
                    >
                      <span>{moment(e.createdAt).format("HH:mm")}</span>

                      {isSentByMe && (
                        <>
                          {e.seen ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-gray-300" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
};

export default ChatMessages;
