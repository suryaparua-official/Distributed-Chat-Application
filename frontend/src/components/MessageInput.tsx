import { Loader2, Paperclip, Send, X } from "lucide-react";
import React, { useState } from "react";

interface MessageInputProps {
  selectedUser: string | null;
  message: string;
  setMessage: (message: string) => void;
  handleMessageSend: (e: any, imageFile?: File | null) => void;
}

const MessageInput = ({
  selectedUser,
  message,
  setMessage,
  handleMessageSend,
}: MessageInputProps) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!message.trim() && !imageFile) return;

    setIsUploading(true);
    await handleMessageSend(e, imageFile);
    setImageFile(null);
    setIsUploading(false);
  };

  if (!selectedUser) return null;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#202c33] border-t border-[#2a3942] px-4 py-1.5"
    >
      {imageFile && (
        <div className="relative mb-2 w-fit">
          <img
            src={URL.createObjectURL(imageFile)}
            alt="preview"
            className="w-24 h-24 object-cover rounded-md"
          />
          <button
            type="button"
            className="absolute -top-2 -right-2 bg-[#111b21] rounded-full p-1 hover:bg-red-600 transition"
            onClick={() => setImageFile(null)}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Attachment Icon */}
        <label className="cursor-pointer text-gray-400 hover:text-white transition flex items-center">
          <Paperclip size={20} />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.type.startsWith("image/")) {
                setImageFile(file);
              }
            }}
          />
        </label>

        {/* Input */}
        <input
          type="text"
          className="flex-1 bg-[#2a3942] rounded-full px-4 py-2
          text-[15px] text-white placeholder-gray-400
          focus:outline-none"
          placeholder={imageFile ? "Add a caption" : "Type a message"}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={(!imageFile && !message) || isUploading}
          className="w-9 h-9 flex items-center justify-center 
          rounded-full bg-[#00a884] hover:bg-[#029e7d] 
          transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
        </button>
      </div>
    </form>
  );
};

export default MessageInput;
