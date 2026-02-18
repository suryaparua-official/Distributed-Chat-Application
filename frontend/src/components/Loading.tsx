import React from "react";

const Loading = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#111b21] text-white">
      {/* Spinner */}
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-4 border-[#2a3942]"></div>
        <div className="absolute inset-0 h-14 w-14 rounded-full border-4 border-t-[#00a884] border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
      </div>

      {/* Text */}
      <p className="mt-6 text-sm text-gray-400 tracking-wide">Connecting...</p>
    </div>
  );
};

export default Loading;
