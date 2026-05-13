import React from "react";
import axios from "axios";
import { io } from "socket.io-client";

const ENDPOINT = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
const socket = io(ENDPOINT, {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const App = () => {
  const [user, setUser] = React.useState("");
  const [room, setRoom] = React.useState("");
  const [input, setInput] = React.useState("");
  const [toUser, setToUser] = React.useState("");
  const [isBroadcast, setIsBroadcast] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [roomList, setRoomList] = React.useState([]);
  const [userList, setUserList] = React.useState([]);
  const [showDM, setShowDM] = React.useState(false);
  const [status, setStatus] = React.useState("connecting...");

  React.useEffect(() => {
    socket.on("connect", () => {
      setStatus("connected");
      const savedUser = localStorage.getItem("schat_user");
      const savedRoom = localStorage.getItem("schat_room");
      if (savedUser && savedRoom) {
        setUser(savedUser);
        setRoom(savedRoom);
        setConnected(true);
        socket.emit(
          "join",
          JSON.stringify({ user: savedUser, room: savedRoom }),
        );
        axios
          .post(`${ENDPOINT}/chat`, { room: savedRoom, user: savedUser })
          .then((res) => setMessages(res.data))
          .catch((err) => console.log(err));
      }
    });

    socket.on("disconnect", () => setStatus("disconnected"));

    socket.on("message", (msg) => {
      const data = JSON.parse(msg);
      setMessages((prev) => [...prev, data]);
    });

    socket.on("room", (msg) => {
      setRoomList(JSON.parse(msg));
    });

    socket.on("roomusers", (msg) => {
      const data = JSON.parse(msg);
      setUserList([...new Set(data)]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("message");
      socket.off("room");
      socket.off("roomusers");
    };
  }, []);

  const connect = () => {
    if (!user || !room) return alert("Enter username and room!");
    localStorage.setItem("schat_user", user);
    localStorage.setItem("schat_room", room);
    setConnected(true);
    socket.emit("join", JSON.stringify({ user, room }));
    socket.emit(
      "message",
      JSON.stringify({
        time: new Date(),
        user: "",
        room,
        data: `${user} has joined the room!`,
        type: "text",
        broadcast: 0,
        unicast: false,
        toUser: "",
      }),
    );
    axios
      .post(`${ENDPOINT}/chat`, { room, user })
      .then((res) => setMessages(res.data));
  };

  const send = () => {
    if (!input) return;
    const isUnicast = !isBroadcast && toUser !== "";
    if (!room && !isBroadcast && !isUnicast)
      return alert("Join a room or select Broadcast / DM");
    socket.emit(
      "message",
      JSON.stringify({
        time: new Date(),
        user,
        room,
        data: input,
        type: "text",
        broadcast: Number(isBroadcast),
        unicast: isUnicast,
        toUser,
      }),
    );
    setInput("");
    setToUser("");
  };

  const loadDM = async () => {
    setShowDM(true);
    const res = await axios.post(`${ENDPOINT}/chat/dm`, { user });
    setMessages(res.data);
  };

  const loadGroup = async () => {
    setShowDM(false);
    const res = await axios.post(`${ENDPOINT}/chat`, { room, user });
    setMessages(res.data);
  };

  const disconnect = () => {
    localStorage.removeItem("schat_user");
    localStorage.removeItem("schat_room");
    setConnected(false);
    setMessages([]);
    setUser("");
    setRoom("");
  };

  return (
    <div
      style={{
        maxWidth: 700,
        margin: "0 auto",
        padding: 20,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ color: "#2563eb" }}>Schat</h1>
        <span
          style={{
            fontSize: 12,
            color: status === "connected" ? "#16a34a" : "#dc2626",
          }}
        >
          ● {status}
        </span>
      </div>

      {roomList.length > 0 && (
        <div
          style={{
            background: "#f1f5f9",
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <strong>Active Rooms:</strong> {roomList.join(", ")}
        </div>
      )}

      {userList.length > 0 && (
        <div
          style={{
            background: "#f0fdf4",
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <strong>Users in Room:</strong> {userList.join(", ")}
        </div>
      )}

      {!connected ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="@Username"
            style={inputStyle}
          />
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="#Room"
            style={inputStyle}
          />
          <button onClick={connect} style={btnStyle("#2563eb")}>
            Connect
          </button>
        </div>
      ) : (
        <div
          style={{
            background: "#eff6ff",
            padding: 10,
            borderRadius: 8,
            marginBottom: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            User: <strong>{user}</strong> — Room: <strong>#{room}</strong>
          </span>
          <button onClick={disconnect} style={btnStyle("#dc2626")}>
            Leave
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={loadGroup}
          style={btnStyle(showDM ? "#94a3b8" : "#2563eb")}
        >
          Group Messages
        </button>
        <button
          onClick={loadDM}
          style={btnStyle(showDM ? "#2563eb" : "#94a3b8")}
        >
          Direct Messages
        </button>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: 12,
          minHeight: 200,
          maxHeight: 350,
          overflowY: "auto",
          marginBottom: 12,
          background: "#fafafa",
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No messages yet</p>
        ) : (
          messages.filter(Boolean).map((msg, i) => {
            if (showDM && !msg.unicast) return null;
            if (!showDM && msg.unicast) return null;
            return (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: "6px 10px",
                  background: msg.user === user ? "#dbeafe" : "#fff",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                }}
              >
                <span style={{ color: "#64748b", fontSize: 11 }}>
                  {new Date(msg.time).toLocaleTimeString()} —
                  <span
                    style={{
                      color: msg.broadcast
                        ? "#dc2626"
                        : msg.unicast
                          ? "#7c3aed"
                          : "#16a34a",
                      fontWeight: 600,
                    }}
                  >
                    {msg.broadcast
                      ? " Broadcast"
                      : msg.unicast
                        ? " DM"
                        : " Group"}
                  </span>
                  {msg.unicast && ` -> ${msg.toUser}`}
                </span>
                <div>
                  <strong>{msg.user || "System"}:</strong> {msg.data}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={send} style={btnStyle("#16a34a")}>
            Send
          </button>
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isBroadcast}
              onChange={(e) => setIsBroadcast(e.target.checked)}
            />
            Broadcast to all
          </label>
          <input
            value={toUser}
            onChange={(e) => setToUser(e.target.value)}
            placeholder="DM — @username"
            style={{ ...inputStyle, width: 180 }}
          />
        </div>
      </div>
    </div>
  );
};

const inputStyle = {
  padding: "8px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
  outline: "none",
};

const btnStyle = (bg) => ({
  padding: "8px 16px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
});

export default App;
