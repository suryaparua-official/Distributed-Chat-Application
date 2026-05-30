import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { api, tokenStore } from "../api";
import { useAuth } from "./AuthContext";

const ENDPOINT = import.meta.env.VITE_BACKEND_URL || "";

const ChatContext = createContext(null);

// Stable DM ID: always same regardless of who initiated
function dmId(a, b) {
  return `dm:${[a, b].sort().join(":")}`;
}

const AVATAR_COLORS = [
  "#e57373", "#f06292", "#ba68c8", "#9575cd",
  "#7986cb", "#64b5f6", "#4fc3f7", "#4dd0e1",
  "#4db6ac", "#81c784", "#aed581", "#ff8a65",
  "#a1887f", "#90a4ae",
];

export function avatarColor(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarInitials(str = "") {
  const parts = str.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.slice(0, 2).toUpperCase() || "?";
}

export function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function dedup(msgs) {
  const seen = new Set();
  return msgs.filter((m) => {
    const key = `${m.time}|${m.user}|${m.data}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Provider ───────────────────────────────────────────────
export function ChatProvider({ children }) {
  const { user: authUser, logout: authLogout } = useAuth();
  const phone = authUser?.phone ?? null;
  const name  = authUser?.name  ?? null;

  // ── Chat state ─────────────────────────────────────────
  const [status,        setStatus]        = useState("disconnected");
  const [rooms,         setRooms]         = useState([]);
  const [conversations, setConversations] = useState({});
  const [activeId,      setActiveId]      = useState(null);
  const [typingUsers,   setTypingUsers]   = useState({});
  const [contacts,      setContacts]      = useState({});

  // ── Status state ───────────────────────────────────────
  // { [phone]: StatusItem[] }
  const [statuses,           setStatuses]           = useState({});
  const [viewingStatusPhone, setViewingStatusPhone] = useState(null);
  const [creatingStatus,     setCreatingStatus]     = useState(false);

  // ── Message deletion state (persisted per user) ──────────
  const [deletedForMe, setDeletedForMe] = useState(new Set());
  const [clearedAt,    setClearedAt]    = useState({});  // { convId: timestamp }

  // ── Persist deletedForMe / clearedAt per user in localStorage ──
  useEffect(() => {
    if (!phone) { setDeletedForMe(new Set()); setClearedAt({}); return; }
    try {
      const dm = localStorage.getItem(`schat:dfm:${phone}`);
      if (dm) setDeletedForMe(new Set(JSON.parse(dm)));
      const ca = localStorage.getItem(`schat:ca:${phone}`);
      if (ca) setClearedAt(JSON.parse(ca));
    } catch { /* corrupt storage — start fresh */ }
  }, [phone]);

  useEffect(() => {
    if (!phone) return;
    try { localStorage.setItem(`schat:dfm:${phone}`, JSON.stringify([...deletedForMe])); } catch {}
  }, [deletedForMe, phone]);

  useEffect(() => {
    if (!phone) return;
    try { localStorage.setItem(`schat:ca:${phone}`, JSON.stringify(clearedAt)); } catch {}
  }, [clearedAt, phone]);

  // ── Call state ─────────────────────────────────────────
  const [callState,    setCallState]    = useState("idle");
  const [callType,     setCallType]     = useState(null);
  const [callPeer,     setCallPeer]     = useState(null);
  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted,      setIsMuted]      = useState(false);
  const [isVideoOff,   setIsVideoOff]   = useState(false);

  // ── Refs ───────────────────────────────────────────────
  const socketRef         = useRef(null);
  const activeRef         = useRef(null);
  const conversationsRef  = useRef({});
  const typingTimers      = useRef({});
  const callStateRef      = useRef("idle");
  const callPeerRef       = useRef(null);
  const callTypeRef       = useRef(null);
  const localStreamRef    = useRef(null);
  const pcRef             = useRef(null);
  const cleanupFnRef      = useRef(() => {});

  useEffect(() => { activeRef.current       = activeId;       }, [activeId]);
  useEffect(() => { conversationsRef.current = conversations;  }, [conversations]);
  useEffect(() => { callStateRef.current    = callState;      }, [callState]);
  useEffect(() => { callPeerRef.current     = callPeer;       }, [callPeer]);
  useEffect(() => { callTypeRef.current     = callType;       }, [callType]);
  useEffect(() => { localStreamRef.current  = localStream;    }, [localStream]);

  // ── Socket + call lifecycle ────────────────────────────
  useEffect(() => {
    if (!phone) {
      setConversations({});
      setRooms([]);
      setActiveId(null);
      setStatus("disconnected");
      setStatuses({});
      return;
    }

    setStatus("connecting");

    const socket = io(ENDPOINT, {
      transports: ["websocket"],
      auth: { token: tokenStore.get() },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    // ── WebRTC helpers ──────────────────────────────────

    function cleanupCall() {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
      setRemoteStream(null);
      setCallState("idle");
      setCallType(null);
      setCallPeer(null);
      setIsMuted(false);
      setIsVideoOff(false);
      callStateRef.current = "idle";
      callPeerRef.current  = null;
      callTypeRef.current  = null;
    }
    cleanupFnRef.current = cleanupCall;

    function createPeerConnection(toPhone) {
      if (pcRef.current) pcRef.current.close();
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit("call:ice-candidate", { toPhone, candidate: candidate.toJSON() });
      };
      pc.ontrack = ({ streams }) => { if (streams[0]) setRemoteStream(streams[0]); };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallState("active"); callStateRef.current = "active";
        } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          cleanupCall();
        }
      };
      return pc;
    }

    async function getMedia(cType) {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: cType === "video" });
    }

    // ── connect ─────────────────────────────────────────
    socket.on("connect", async () => {
      setStatus("connected");

      // Load status feed
      try {
        const res = await api.get("/status/feed");
        const grouped = {};
        res.data.forEach((s) => {
          if (!grouped[s.user]) grouped[s.user] = [];
          grouped[s.user].push(s);
        });
        setStatuses(grouped);
      } catch (e) {
        console.error("Status feed load failed:", e.message);
      }

      // Restore DM conversations from message history
      try {
        const res = await api.post("/chat/dm", {});
        if (res.data.length > 0) {
          const byPartner = {};
          res.data.forEach((msg) => {
            const partnerPhone = msg.user === phone ? msg.toUser : msg.user;
            if (!partnerPhone) return;
            if (!byPartner[partnerPhone]) byPartner[partnerPhone] = [];
            byPartner[partnerPhone].push(msg);
          });
          const dmConvs = {};
          Object.entries(byPartner).forEach(([partnerPhone, msgs]) => {
            const id = dmId(phone, partnerPhone);
            const sorted = [...msgs].sort((a, b) => new Date(a.time) - new Date(b.time));
            const partnerMsg = sorted.find((m) => m.user === partnerPhone);
            const partnerName = partnerMsg?.senderName || partnerPhone;
            dmConvs[id] = {
              id, type: "dm",
              name: partnerName, phone: partnerPhone,
              messages: dedup(sorted),
              lastMessage: sorted[sorted.length - 1] || null,
              users: [], unread: 0,
            };
          });
          setConversations((prev) => ({ ...prev, ...dmConvs }));
        }
      } catch (e) {
        console.error("DM restore failed:", e.message);
      }
    });

    socket.on("disconnect",    () => setStatus("disconnected"));
    socket.on("connect_error", async (err) => {
      setStatus("disconnected");
      if (!/token|auth|unauthorized/i.test(err.message)) return;
      try {
        const r = await api.get("/auth/refresh");
        tokenStore.set(r.data.token);
        socket.auth = { token: r.data.token };
        socket.connect();
      } catch {
        authLogout();
      }
    });

    // ── myGroups — server sends all persistent groups on connect ─
    socket.on("myGroups", async (raw) => {
      const groups = JSON.parse(raw);

      // Create conversation stubs for every group
      setConversations((prev) => {
        const next = { ...prev };
        groups.forEach((g) => {
          next[g.name] = {
            ...(next[g.name] || {}),
            id: g.name, type: "room", name: g.name,
            creator: g.creator, allMembers: g.members,
            messages: next[g.name]?.messages || [],
            users:    next[g.name]?.users    || [],
            unread:   next[g.name]?.unread   || 0,
            lastMessage: next[g.name]?.lastMessage || null,
          };
        });
        return next;
      });

      // Load history for all groups in parallel
      const histories = await Promise.all(
        groups.map(async (g) => {
          try {
            const res = await api.post(`${ENDPOINT}/chat`, { room: g.name });
            return { name: g.name, messages: dedup(res.data), lastMessage: res.data[res.data.length - 1] || null };
          } catch { return null; }
        })
      );
      setConversations((prev) => {
        const next = { ...prev };
        histories.forEach((h) => {
          if (h && next[h.name]) {
            next[h.name] = { ...next[h.name], messages: h.messages, lastMessage: h.lastMessage };
          }
        });
        return next;
      });
    });

    // ── groupInfo — group metadata updated (join, leave, delete) ─
    socket.on("groupInfo", (raw) => {
      const group = JSON.parse(raw);
      setConversations((prev) => {
        if (!prev[group.name]) return prev;
        return {
          ...prev,
          [group.name]: { ...prev[group.name], creator: group.creator, allMembers: group.members },
        };
      });
    });

    // ── group:deleted — server deleted the group ─────────
    socket.on("group:deleted", (raw) => {
      const { room } = JSON.parse(raw);
      setConversations((prev) => {
        const next = { ...prev };
        delete next[room];
        return next;
      });
      setRooms((prev) => prev.filter((r) => r !== room));
      if (activeRef.current === room) {
        activeRef.current = null;
        setActiveId(null);
      }
    });

    // ── room list (global discovery) ─────────────────────
    socket.on("room", (raw) => {
      setRooms(JSON.parse(raw));
    });

    // ── room user list ────────────────────────────────────
    socket.on("roomusers", (raw) => {
      const { room, users } = JSON.parse(raw);
      setConversations((prev) => {
        if (!prev[room]) return prev;
        return { ...prev, [room]: { ...prev[room], users } };
      });
      setContacts((prev) => {
        const next = { ...prev };
        users.forEach(({ phone: p, name: n }) => { next[p] = n; });
        return next;
      });
    });

    // ── message ───────────────────────────────────────────
    socket.on("message", (raw) => {
      const msg = JSON.parse(raw);
      let convId;

      if (msg.unicast) {
        const other = msg.user === phone ? msg.toUser : msg.user;
        convId = dmId(phone, other);
        setConversations((prev) => {
          if (prev[convId]) return prev;
          if (msg.senderName && msg.user !== phone) {
            setContacts((c) => ({ ...c, [msg.user]: msg.senderName }));
          }
          return {
            ...prev,
            [convId]: {
              id: convId, type: "dm",
              name:  msg.user !== phone ? (msg.senderName || msg.user) : msg.toUser,
              phone: msg.user !== phone ? msg.user : msg.toUser,
              messages: [], users: [], unread: 0, lastMessage: null,
            },
          };
        });
      } else {
        convId = msg.room;
        if (!convId) return;
      }

      setConversations((prev) => {
        const conv = prev[convId];
        if (!conv) return prev;
        const key = `${msg.time}|${msg.user}|${msg.data}`;
        if (conv.messages.some((m) => `${m.time}|${m.user}|${m.data}` === key)) return prev;
        const isActive = activeRef.current === convId;
        return {
          ...prev,
          [convId]: {
            ...conv,
            messages: [...conv.messages, msg],
            lastMessage: msg,
            unread: isActive ? 0 : conv.unread + 1,
          },
        };
      });
    });

    // ── message:deleted — delete-for-everyone ─────────────
    socket.on("message:deleted", (raw) => {
      const { msgId } = JSON.parse(raw);
      setConversations((prev) => {
        const next = { ...prev };
        for (const convId in next) {
          const conv = next[convId];
          const idx  = conv.messages.findIndex((m) => m.msgId === msgId);
          if (idx >= 0) {
            const msgs  = [...conv.messages];
            msgs[idx]   = { ...msgs[idx], deletedForEveryone: true, data: "" };
            // Also sync lastMessage so sidebar preview updates
            const newLastMessage = conv.lastMessage?.msgId === msgId
              ? { ...conv.lastMessage, deletedForEveryone: true, data: "" }
              : conv.lastMessage;
            next[convId] = { ...conv, messages: msgs, lastMessage: newLastMessage };
            break;
          }
        }
        return next;
      });
    });

    // ── status:deleted — status removed by owner ──────────
    socket.on("status:deleted", (raw) => {
      const { statusId, userPhone } = JSON.parse(raw);
      setStatuses((prev) => {
        if (!prev[userPhone]) return prev;
        const filtered = prev[userPhone].filter((s) => s._id !== statusId);
        return { ...prev, [userPhone]: filtered };
      });
    });

    // ── status:viewed — owner gets real-time viewer list ──
    socket.on("status:viewed", (raw) => {
      const { statusId, viewedBy } = JSON.parse(raw);
      setStatuses((prev) => {
        const next = { ...prev };
        for (const p in next) {
          const idx = next[p].findIndex((s) => s._id === statusId);
          if (idx >= 0) {
            const arr = [...next[p]];
            arr[idx] = { ...arr[idx], viewedBy };
            next[p] = arr;
            return next;
          }
        }
        return next;
      });
    });

    // ── typing ────────────────────────────────────────────
    socket.on("typing", (raw) => {
      try {
        const { user: tPhone, senderName: tName, room, typing } = JSON.parse(raw);
        if (!room) return;
        const timerKey   = `${room}:${tPhone}`;
        const displayName = tName || tPhone;
        setTypingUsers((prev) => {
          const ct = { ...(prev[room] || {}) };
          if (typing === false) delete ct[displayName];
          else ct[displayName] = Date.now();
          return { ...prev, [room]: ct };
        });
        if (typingTimers.current[timerKey]) clearTimeout(typingTimers.current[timerKey]);
        typingTimers.current[timerKey] = setTimeout(() => {
          setTypingUsers((prev) => {
            const ct = { ...(prev[room] || {}) };
            delete ct[displayName];
            return { ...prev, [room]: ct };
          });
        }, 3500);
      } catch { /* ignore */ }
    });

    socket.on("error", (e) => console.error("Socket error:", e));

    // ── status:new ───────────────────────────────────────
    socket.on("status:new", (raw) => {
      const s = JSON.parse(raw);
      setStatuses((prev) => ({
        ...prev,
        [s.user]: [s, ...(prev[s.user] || [])],
      }));
    });

    // ── WebRTC signaling ──────────────────────────────────

    socket.on("call:incoming", ({ fromPhone, fromName, callType: cType }) => {
      if (callStateRef.current !== "idle") {
        socket.emit("call:busy", { toPhone: fromPhone });
        return;
      }
      const peer = { phone: fromPhone, name: fromName };
      setCallState("incoming"); setCallType(cType); setCallPeer(peer);
      callStateRef.current = "incoming"; callPeerRef.current = peer; callTypeRef.current = cType;
    });

    socket.on("call:accepted", async ({ fromPhone }) => {
      setCallState("connecting"); callStateRef.current = "connecting";
      try {
        const stream = await getMedia(callTypeRef.current);
        setLocalStream(stream); localStreamRef.current = stream;
        const pc = createPeerConnection(fromPhone);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", { toPhone: fromPhone, offer: pc.localDescription });
      } catch (err) {
        console.error("Offer creation failed:", err);
        socket.emit("call:end", { toPhone: fromPhone });
        cleanupCall();
      }
    });

    socket.on("call:offer", async ({ fromPhone, offer }) => {
      setCallState("connecting"); callStateRef.current = "connecting";
      try {
        const stream = await getMedia(callTypeRef.current);
        setLocalStream(stream); localStreamRef.current = stream;
        const pc = createPeerConnection(fromPhone);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:answer", { toPhone: fromPhone, answer: pc.localDescription });
      } catch (err) {
        console.error("Answer creation failed:", err);
        socket.emit("call:end", { toPhone: fromPhone });
        cleanupCall();
      }
    });

    socket.on("call:answer", async ({ answer }) => {
      try {
        if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) { console.error("Set remote description failed:", err); }
    });

    socket.on("call:ice-candidate", async ({ candidate }) => {
      try {
        if (pcRef.current && candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ICE errors are usually non-fatal */ }
    });

    socket.on("call:rejected",    () => {
      cleanupCall(); setCallState("rejected"); callStateRef.current = "rejected";
      setTimeout(() => { setCallState("idle"); callStateRef.current = "idle"; }, 2500);
    });
    socket.on("call:ended",       () => cleanupCall());
    socket.on("call:busy",        () => {
      cleanupCall(); setCallState("busy"); callStateRef.current = "busy";
      setTimeout(() => { setCallState("idle"); callStateRef.current = "idle"; }, 2500);
    });
    socket.on("call:unavailable", () => {
      cleanupCall(); setCallState("unavailable"); callStateRef.current = "unavailable";
      setTimeout(() => { setCallState("idle"); callStateRef.current = "idle"; }, 2500);
    });

    return () => {
      cleanupCall();
      socket.disconnect();
      socketRef.current = null;
      setStatus("disconnected");
    };
  }, [phone, authLogout]);

  // ── Chat actions ───────────────────────────────────────

  const logout = useCallback(async () => {
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    setConversations({});
    setRooms([]);
    setActiveId(null);
    setStatuses({});
    await authLogout();
  }, [authLogout]);

  // createGroup — emits "join" (server creates group if name is available)
  const createGroup = useCallback(async (roomName) => {
    if (!socketRef.current || !phone || !roomName.trim()) return;
    const n = roomName.trim();

    // Optimistic stub so the sidebar shows immediately
    setConversations((prev) => ({
      ...prev,
      [n]: prev[n] || { id: n, type: "room", name: n, messages: [], users: [], unread: 0, lastMessage: null },
    }));
    activeRef.current = n;
    setActiveId(n);

    // Server validates: creates if new, rejects if exists and caller is not a member
    socketRef.current.emit("join", JSON.stringify({ room: n }));

    try {
      const res = await api.post("/chat", { room: n });
      setConversations((prev) => ({
        ...prev,
        [n]: {
          ...(prev[n] || { id: n, type: "room", name: n, users: [], unread: 0 }),
          messages: dedup(res.data),
          lastMessage: res.data[res.data.length - 1] || null,
        },
      }));
    } catch (e) {
      console.error("Room history failed:", e.message);
    }
  }, [phone, name]);

  // joinRoom kept as alias so any existing callers still work
  const joinRoom = createGroup;

  const addMember = useCallback((roomName, memberPhone) => {
    if (!socketRef.current || !roomName || !memberPhone) return;
    socketRef.current.emit("group:addMember", JSON.stringify({ room: roomName, memberPhone }));
  }, []);

  const leaveGroup = useCallback((roomName) => {
    if (!socketRef.current || !roomName) return;
    socketRef.current.emit("group:leave", JSON.stringify({ room: roomName }));
    setConversations((prev) => {
      const next = { ...prev };
      delete next[roomName];
      return next;
    });
    setRooms((prev) => prev.filter((r) => r !== roomName));
    if (activeRef.current === roomName) {
      activeRef.current = null;
      setActiveId(null);
    }
  }, []);

  const deleteGroup = useCallback((roomName) => {
    if (!socketRef.current || !roomName) return;
    socketRef.current.emit("group:delete", JSON.stringify({ room: roomName }));
  }, []);

  const openDM = useCallback(async (targetPhone, targetName) => {
    if (!phone || !targetPhone || targetPhone === phone) return;
    const convId = dmId(phone, targetPhone);
    const displayName = targetName || contacts[targetPhone] || targetPhone;

    if (targetName) setContacts((prev) => ({ ...prev, [targetPhone]: targetName }));

    activeRef.current = convId;
    setConversations((prev) => ({
      ...prev,
      [convId]: prev[convId] || {
        id: convId, type: "dm",
        name: displayName, phone: targetPhone,
        messages: [], users: [], unread: 0, lastMessage: null,
      },
    }));
    setActiveId(convId);

    try {
      const res = await api.post(`${ENDPOINT}/chat/dm`, {});
      const filtered = res.data.filter(
        (m) =>
          (m.user === phone && m.toUser === targetPhone) ||
          (m.user === targetPhone && m.toUser === phone)
      );
      setConversations((prev) => ({
        ...prev,
        [convId]: {
          ...(prev[convId] || { id: convId, type: "dm", name: displayName, phone: targetPhone, users: [], unread: 0 }),
          messages: dedup(filtered),
          lastMessage: filtered[filtered.length - 1] || null,
        },
      }));
    } catch (e) {
      console.error("DM history failed:", e.message);
    }
  }, [phone, contacts]);

  const sendMessage = useCallback(({ content, toUser, room }) => {
    if (!socketRef.current || !content?.trim()) return;
    const isUnicast = Boolean(toUser);
    socketRef.current.emit("message", JSON.stringify({
      time: new Date().toISOString(),
      user: phone, senderName: name,
      room: room || "",
      data: content.trim(),
      type: "text",
      unicast: isUnicast,
      toUser: toUser || "",
    }));
  }, [phone, name]);

  const sendTyping = useCallback((room, isTyping) => {
    if (!socketRef.current || !room) return;
    socketRef.current.emit("typing", JSON.stringify({ user: phone, senderName: name, room, typing: isTyping }));
  }, [phone, name]);

  const selectConversation = useCallback((id) => {
    activeRef.current = id;
    setActiveId(id);
    if (id) {
      setConversations((prev) => {
        if (!prev[id] || prev[id].unread === 0) return prev;
        return { ...prev, [id]: { ...prev[id], unread: 0 } };
      });
    }
  }, []);

  const lookupUser = useCallback(async (lookupPhone) => {
    const res = await api.get(`/users/lookup?phone=${encodeURIComponent(lookupPhone.trim())}`);
    return res.data;
  }, []);

  // ── Message deletion / clear ───────────────────────────

  const deleteMessage = useCallback((msgId, scope, convId) => {
    if (!msgId) return;
    if (scope === "me") {
      setDeletedForMe((prev) => new Set([...prev, msgId]));
      return;
    }
    if (!socketRef.current) return;
    const conv = conversationsRef.current[convId];
    socketRef.current.emit("message:delete", JSON.stringify({
      msgId,
      scope: "everyone",
      room:   conv?.type === "room" ? conv.name   : undefined,
      toUser: conv?.type === "dm"   ? conv.phone  : undefined,
    }));
  }, []);

  const clearChat = useCallback((convId) => {
    setClearedAt((prev) => ({ ...prev, [convId]: Date.now() }));
  }, []);

  // ── Status actions ─────────────────────────────────────

  const postStatus = useCallback((content) => {
    if (!socketRef.current || !content?.trim()) return;
    socketRef.current.emit("status:post", JSON.stringify({ content: content.trim() }));
  }, []);

  const viewStatus = useCallback((statusPhone) => {
    setViewingStatusPhone(statusPhone);
  }, []);

  const closeStatusViewer = useCallback(() => {
    setViewingStatusPhone(null);
  }, []);

  const markStatusViewed = useCallback((statusId) => {
    if (!socketRef.current) return;
    socketRef.current.emit("status:view", JSON.stringify({ statusId }));
    setStatuses((prev) => {
      const next = { ...prev };
      for (const p in next) {
        next[p] = next[p].map((s) =>
          s._id === statusId
            ? { ...s, viewedBy: [...(s.viewedBy || []), phone] }
            : s
        );
      }
      return next;
    });
  }, [phone]);

  // ── Call actions ───────────────────────────────────────

  const initiateCall = useCallback((peerPhone, peerName, cType) => {
    if (!socketRef.current || callStateRef.current !== "idle") return;
    const peer = { phone: peerPhone, name: peerName };
    setCallState("calling"); setCallType(cType); setCallPeer(peer);
    callStateRef.current = "calling"; callPeerRef.current = peer; callTypeRef.current = cType;
    socketRef.current.emit("call:initiate", { toPhone: peerPhone, callType: cType });
  }, []);

  const acceptCall = useCallback(() => {
    if (!socketRef.current || !callPeerRef.current) return;
    socketRef.current.emit("call:accept", { toPhone: callPeerRef.current.phone });
    setCallState("connecting"); callStateRef.current = "connecting";
  }, []);

  const rejectCall = useCallback(() => {
    if (!socketRef.current || !callPeerRef.current) return;
    socketRef.current.emit("call:reject", { toPhone: callPeerRef.current.phone });
    cleanupFnRef.current();
  }, []);

  const endCall = useCallback(() => {
    if (!callPeerRef.current) return;
    if (socketRef.current) socketRef.current.emit("call:end", { toPhone: callPeerRef.current.phone });
    cleanupFnRef.current();
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
      setIsMuted((m) => !m);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
      setIsVideoOff((v) => !v);
    }
  }, []);

  const value = {
    // identity
    user: name,
    phone,
    // chat state
    status, rooms, conversations, activeId, typingUsers, contacts,
    // deletion/clear
    deletedForMe, clearedAt,
    // helpers
    formatTime, formatDate, avatarColor, avatarInitials,
    // chat actions
    logout, joinRoom, createGroup, leaveGroup, deleteGroup, addMember, openDM,
    sendMessage, sendTyping, selectConversation, lookupUser,
    deleteMessage, clearChat,
    // status state
    statuses, viewingStatusPhone, creatingStatus,
    // status actions
    postStatus, viewStatus, closeStatusViewer, markStatusViewed,
    setCreatingStatus,
    // call state
    callState, callType, callPeer, localStream, remoteStream, isMuted, isVideoOff,
    // call actions
    initiateCall, acceptCall, rejectCall, endCall, toggleMute, toggleVideo,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
