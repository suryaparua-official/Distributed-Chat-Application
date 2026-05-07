const express = require("express");
const socketio = require("socket.io");
const http = require("http");
const redis = require("redis");
const cors = require("cors");
const mongoose = require("mongoose");
const ChatSchema = require("./models/chat");
const ServeChat = require("./routes/serveChats");

const SERVER_NAME = process.env.SERVER_NAME || "APP";
const PORT = process.env.PORT || 8080;

// ── Express + HTTP + Socket.io setup ──────────────────────
const app = express();
const httpServer = http.createServer(app);
const io = socketio(httpServer, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());
app.use("/chat", ServeChat);

app.get("/", (req, res) => {
  res.send(`<h1>SChat Backend — ${SERVER_NAME}</h1>`);
});

// ── Redis setup ────────────────────────────────────────────
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: 6379,
  },
};

const publisher = redis.createClient(redisConfig);
const subscriber = redis.createClient(redisConfig); // chat message subscriber
const subscriber2 = redis.createClient(redisConfig); // new room updates subscriber
const subscriber3 = redis.createClient(redisConfig); // room user list subscriber

// ── MongoDB connect ────────────────────────────────────────
mongoose
  .connect(process.env.MONGO || "mongodb://localhost:27017/SChat")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB error:", err.message));

// ── Socket connection map (for unicast) ───────────────
const connections = {}; // { username: socketId }

// ── Socket.io events ──────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id}`);

  // on connect, send current room list
  publisher.lRange("roomSCHAT", 0, -1).then((rooms) => {
    socket.emit("room", JSON.stringify(rooms));
  });

  // ── join: user is joining a room ──
  socket.on("join", async (msg) => {
    const { user, room } = JSON.parse(msg);
    connections[user] = socket.id;
    socket.join(room);

    // cache new room if it does not exist
    const exists = await publisher.get(room);
    if (!exists) {
      await publisher.set(room, "1");
      await publisher.lPush("roomSCHAT", room);
      await publisher.publish("schat-rooms", "1");
    }

    // update the user list for the room
    await publisher.lPush(`${room}_meta`, user);
    await publisher.publish("schat-users", room);
  });

  // ── message: a message arrived ──
  socket.on("message", async (msg) => {
    const data = JSON.parse(msg);

    // publish to Redis so other servers receive it
    await publisher.publish("schat-chats", msg);

    // save to MongoDB
    const chat = new ChatSchema(data);
    await chat.save();

    // if unicast, confirm the message to the sender too
    if (data.unicast) {
      socket.emit("message", msg);
    }
  });
});

// ── Redis Subscribers ──────────────────────────────────────

// chat messages — handle broadcast / unicast / multicast
subscriber.subscribe("schat-chats", (msg) => {
  try {
    const data = JSON.parse(msg);
    if (data.broadcast) {
      io.emit("message", msg); // to everyone
    } else if (data.unicast) {
      const targetId = connections[data.toUser];
      if (targetId) io.to(targetId).emit("message", msg); // to one user
    } else {
      io.to(data.room).emit("message", msg); // to the room
    }
  } catch (e) {
    console.log(`${SERVER_NAME}: error —`, e.message);
  }
});

// send updated room list to everyone when a new room is created
subscriber2.subscribe("schat-rooms", async () => {
  const rooms = await publisher.lRange("roomSCHAT", 0, -1);
  io.emit("room", JSON.stringify(rooms));
});

// notify the room when its user list updates
subscriber3.subscribe("schat-users", async (roomName) => {
  const users = await publisher.lRange(`${roomName}_meta`, 0, -1);
  const unique = [...new Set(users)];
  io.to(roomName).emit("roomusers", JSON.stringify(unique));
});

// ── Connect Redis, then start the server ─────────────
Promise.all([
  publisher.connect(),
  subscriber.connect(),
  subscriber2.connect(),
  subscriber3.connect(),
])
  .then(() => {
    console.log("Redis connected");
    httpServer.listen(PORT, () =>
      console.log(`${SERVER_NAME} running on port ${PORT}`),
    );
  })
  .catch((err) => console.log("Redis error:", err.message));
