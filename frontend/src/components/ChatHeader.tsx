import { User } from "@/context/AppContext";
import { Menu, UserCircle } from "lucide-react";
import React from "react";

interface ChatHeaderProps {
  user: User | null;
  setSidebarOpen: (open: boolean) => void;
  isTyping: boolean;
  onlineUsers: string[];
}

const ChatHeader = ({
  user,
  setSidebarOpen,
  isTyping,
  onlineUsers,
}: ChatHeaderProps) => {
  const isOnlineUser = user && onlineUsers.includes(user._id);

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="sm:hidden fixed top-3 right-3 z-30">
        <button
          className="p-2 bg-[#202c33] rounded-md hover:bg-[#2a3942] transition"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5 text-gray-200" />
        </button>
      </div>

      {/* Chat Header */}
      <div className="bg-[#202c33] border-b border-[#2a3942] px-5 py-3">
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Avatar */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-gray-300" />
                </div>

                {isOnlineUser && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00a884] border-2 border-[#202c33]" />
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-semibold text-white truncate">
                  {user.name}
                </h2>

                <div className="mt-0.5">
                  {isTyping ? (
                    <div className="flex items-center gap-1 text-xs text-[#00a884]">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce"></div>
                        <div
                          className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                      <span>typing...</span>
                    </div>
                  ) : (
                    <span
                      className={`text-xs ${
                        isOnlineUser ? "text-[#00a884]" : "text-gray-400"
                      }`}
                    >
                      {isOnlineUser ? "Online" : "Offline"}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center">
                <UserCircle className="w-6 h-6 text-gray-300" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-gray-300">
                  Select a conversation
                </h2>
                <p className="text-xs text-gray-400">
                  Choose a chat to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatHeader;
