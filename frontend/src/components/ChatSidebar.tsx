import { User } from "@/context/AppContext";
import {
  CornerDownRight,
  CornerUpLeft,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  UserCircle,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

interface ChatSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  showAllUsers: boolean;
  setShowAllUsers: (show: boolean | ((prev: boolean) => boolean)) => void;
  users: User[] | null;
  loggedInUser: User | null;
  chats: any[] | null;
  selectedUser: string | null;
  setSelectedUser: (userId: string | null) => void;
  handleLogout: () => void;
  createChat: (user: User) => void;
  onlineUsers: string[];
}

const ChatSidebar = ({
  sidebarOpen,
  setShowAllUsers,
  setSidebarOpen,
  showAllUsers,
  users,
  loggedInUser,
  chats,
  selectedUser,
  setSelectedUser,
  handleLogout,
  createChat,
  onlineUsers,
}: ChatSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <aside
      className={`fixed z-30 sm:static top-0 left-0 h-screen w-80 
      bg-[#111b21] border-r border-[#2a3942]
      transform ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } sm:translate-x-0 
      transition-transform duration-300 
      flex flex-col`}
    >
      {/* HEADER */}
      <div className="px-4 py-3 bg-[#202c33] border-b border-[#2a3942]">
        <div className="sm:hidden flex justify-end mb-2">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-md hover:bg-[#2a3942] transition"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-white">
            {showAllUsers ? "New Chat" : "Messages"}
          </h2>

          <button
            className={`p-2 rounded-md transition ${
              showAllUsers
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-[#00a884] hover:bg-[#029e7d] text-white"
            }`}
            onClick={() => setShowAllUsers((prev) => !prev)}
          >
            {showAllUsers ? (
              <X className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden">
        {showAllUsers ? (
          <div className="px-4 py-3 space-y-3 h-full">
            {/* SEARCH */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                className="w-full pl-9 pr-3 py-2 rounded-md 
                bg-[#202c33] text-white text-sm
                placeholder-gray-400
                focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* USERS LIST */}
            <div className="overflow-y-auto space-y-1 h-full">
              {users
                ?.filter(
                  (u) =>
                    u._id !== loggedInUser?._id &&
                    u.name.toLowerCase().includes(searchQuery.toLowerCase()),
                )
                .map((u) => (
                  <button
                    key={u._id}
                    onClick={() => createChat(u)}
                    className="w-full text-left px-3 py-2.5 hover:bg-[#202c33] transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <UserCircle className="w-9 h-9 text-gray-300" />
                        {onlineUsers.includes(u._id) && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00a884] border-2 border-[#111b21]" />
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-medium text-white">
                          {u.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {onlineUsers.includes(u._id) ? "Online" : "Offline"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ) : chats && chats.length > 0 ? (
          <div className="overflow-y-auto">
            {chats.map((chat) => {
              const latestMessage = chat.chat.latestMessage;
              const isSelected = selectedUser === chat.chat._id;
              const isSentByMe = latestMessage?.sender === loggedInUser?._id;
              const unseenCount = chat.chat.unseenCount || 0;

              return (
                <button
                  key={chat.chat._id}
                  onClick={() => {
                    setSelectedUser(chat.chat._id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 transition ${
                    isSelected ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <UserCircle className="w-10 h-10 text-gray-300" />
                      {onlineUsers.includes(chat.user._id) && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00a884] border-2 border-[#111b21]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white truncate">
                          {chat.user.name}
                        </span>

                        {unseenCount > 0 && (
                          <div className="bg-[#00a884] text-white text-xs font-semibold rounded-full min-w-[18px] h-5 flex items-center justify-center px-1.5">
                            {unseenCount > 99 ? "99+" : unseenCount}
                          </div>
                        )}
                      </div>

                      {latestMessage && (
                        <div className="flex items-center gap-2 mt-1">
                          {isSentByMe ? (
                            <CornerUpLeft
                              size={14}
                              className="text-gray-400 shrink-0"
                            />
                          ) : (
                            <CornerDownRight
                              size={14}
                              className="text-gray-400 shrink-0"
                            />
                          )}
                          <span className="text-xs text-gray-400 truncate">
                            {latestMessage.text}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <MessageCircle className="w-10 h-10 text-gray-500 mb-3" />
            <p className="text-sm text-gray-400">No conversations yet</p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="border-t border-[#2a3942] p-3 space-y-1">
        <Link
          href={"/profile"}
          className="flex items-center gap-3 px-3 py-2 hover:bg-[#202c33] transition text-sm text-gray-300"
        >
          <UserCircle className="w-5 h-5" />
          Profile
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#202c33] transition text-sm text-red-400"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default ChatSidebar;
