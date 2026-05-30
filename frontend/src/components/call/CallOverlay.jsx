import React, { useEffect, useRef } from "react";
import { useChat } from "../../context/ChatContext";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

// Displayed when callState is anything other than "idle"
export default function CallOverlay() {
  const {
    callState, callType, callPeer,
    localStream, remoteStream,
    isMuted, isVideoOff,
    acceptCall, rejectCall, endCall, toggleMute, toggleVideo,
    avatarColor, avatarInitials,
  } = useChat();

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  // Attach MediaStreams to video elements — srcObject can't be set via JSX prop
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callState === "idle") return null;

  const peerName   = callPeer?.name || callPeer?.phone || "Unknown";
  const peerColor  = avatarColor(peerName);
  const peerInit   = avatarInitials(peerName);
  const isVideo    = callType === "video";
  const isActive   = callState === "active";
  const isIncoming = callState === "incoming";
  const isCalling  = callState === "calling";
  const isConnecting = callState === "connecting";

  // Transient info states (rejected / busy / unavailable)
  const infoStates = { rejected: "Call declined", busy: "User is busy", unavailable: "User is not online" };
  if (infoStates[callState]) {
    return (
      <div className="call-overlay call-overlay--info">
        <div className="call-info-badge">{infoStates[callState]}</div>
      </div>
    );
  }

  return (
    <div className={`call-overlay${isActive && isVideo ? " call-overlay--video" : ""}`}>
      {/* Remote video (full background for video calls) */}
      {isVideo && isActive && (
        <video
          ref={remoteVideoRef}
          className="call-video-remote"
          autoPlay
          playsInline
        />
      )}

      {/* Main content */}
      <div className="call-content">
        {/* Peer avatar (voice calls and non-active states) */}
        {(!isVideo || !isActive) && (
          <div className="call-peer-avatar" style={{ background: peerColor }}>
            {peerInit}
          </div>
        )}

        <div className="call-peer-name">{peerName}</div>

        <div className="call-status">
          {isIncoming   && `Incoming ${isVideo ? "video" : "voice"} call`}
          {isCalling    && "Calling…"}
          {isConnecting && "Connecting…"}
          {isActive     && <CallTimer />}
        </div>

        {/* Local video PiP */}
        {isVideo && (isActive || isConnecting) && (
          <video
            ref={localVideoRef}
            className="call-video-local"
            autoPlay
            playsInline
            muted
          />
        )}

        {/* Controls */}
        <div className="call-controls">
          {isIncoming ? (
            <>
              <button className="call-btn call-btn--reject" onClick={rejectCall} title="Decline">
                <PhoneDownIcon />
              </button>
              <button className="call-btn call-btn--accept" onClick={acceptCall} title="Accept">
                <PhoneIcon />
              </button>
            </>
          ) : (
            <>
              {/* Mute */}
              {(isActive || isConnecting) && (
                <button
                  className={`call-ctrl-btn${isMuted ? " call-ctrl-btn--active" : ""}`}
                  onClick={toggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  <span>{isMuted ? "Unmute" : "Mute"}</span>
                </button>
              )}

              {/* Video toggle */}
              {isVideo && (isActive || isConnecting) && (
                <button
                  className={`call-ctrl-btn${isVideoOff ? " call-ctrl-btn--active" : ""}`}
                  onClick={toggleVideo}
                  title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                >
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                  <span>{isVideoOff ? "Camera off" : "Camera"}</span>
                </button>
              )}

              {/* End call */}
              <button className="call-btn call-btn--end" onClick={endCall} title="End call">
                <PhoneDownIcon />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple elapsed timer for active calls
function CallTimer() {
  const [secs, setSecs] = React.useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return <>{m}:{s}</>;
}

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C9.6 21 3 14.4 3 6c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/>
    </svg>
  );
}

function PhoneDownIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 7H17a1 1 0 0 0-1 1v1.5c0 .3.1.5.3.7l1.5 1.5c-1 2-2.7 3.7-4.7 4.7l-1.5-1.5a1 1 0 0 0-.7-.3H9a1 1 0 0 0-1 1v2.59A1.41 1.41 0 0 1 6.41 19C4 16.14 3 12.9 3 12S4 7.86 6.41 5A1.41 1.41 0 0 1 8 5.41V8a1 1 0 0 0 1 1h1.5c.3 0 .5-.1.7-.3L13 7a1 1 0 0 0 0-1.41l-2-2a1 1 0 0 0-1.41 0C6.27 6.9 5 9.3 5 12s1.27 5.1 3.59 7.41A3.41 3.41 0 0 0 11 21h2a3 3 0 0 0 2.62-1.52l.76-1.38A14 14 0 0 0 21 12a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1 11.9 11.9 0 0 1-.41 3z"/>
    </svg>
  );
}
