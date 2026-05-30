"use strict";

const path = require("path");
const express = require("express");
const socketio = require("socket.io");
const http = require("http");
const redis = require("redis");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const ChatModel = require("./models/chat");
const GroupModel = require("./models/group");
const StatusModel = require("./models/status");
const UserModel = require("./models/user");

const ServeChat = require("./routes/serveChats");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const groupsRoutes = require("./routes/groups");
const statusRoutes = require("./routes/status");
const authMiddleware = require("./middleware/auth");

const SERVER_NAME = process.env.SERVER_NAME || "SCHAT";
const PORT = parseInt(process.env.PORT || "8080", 10);
const STATUS_TTL = 12 * 60 * 60 * 1000;

const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:8080"];

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || CORS_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

// ── Express + HTTP + Socket.IO ────────────────────────────
const app = express();
const httpServer = http.createServer(app);
const io = socketio(httpServer, {
  cors: { origin: CORS_ORIGINS, credentials: true, methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/chat", authMiddleware, ServeChat);
app.use("/users", authMiddleware, usersRoutes);
app.use("/groups", authMiddleware, groupsRoutes);
app.use("/status", authMiddleware, statusRoutes);

// ── Redis ─────────────────────────────────────────────────
// Supports both:
//   REDIS_URL  = "rediss://default:pass@host.upstash.io:6379"  (Upstash)
//   REDIS_HOST = "hostname"                                     (local / ElastiCache)
const redisConfig = process.env.REDIS_URL
  ? {
      url: process.env.REDIS_URL,
      socket: { reconnectStrategy: (r) => Math.min(r * 100, 3000) },
    }
  : {
      socket: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        reconnectStrategy: (r) => Math.min(r * 100, 3000),
      },
    };

const publisher = redis.createClient(redisConfig);
const subscriber = redis.createClient(redisConfig);
const subscriber2 = redis.createClient(redisConfig);
const subscriber3 = redis.createClient(redisConfig);

publisher.on("error", (e) =>
  console.error(`[${SERVER_NAME}] Redis pub:`, e.message),
);
subscriber.on("error", (e) =>
  console.error(`[${SERVER_NAME}] Redis sub1:`, e.message),
);
subscriber2.on("error", (e) =>
  console.error(`[${SERVER_NAME}] Redis sub2:`, e.message),
);
subscriber3.on("error", (e) =>
  console.error(`[${SERVER_NAME}] Redis sub3:`, e.message),
);

// ── MongoDB ───────────────────────────────────────────────
// Supports both MONGO_URI (new) and MONGO (old) env var names
mongoose
  .connect(
    process.env.MONGO_URI ||
      process.env.MONGO ||
      "mongodb://localhost:27017/SChat",
  )
  .then(() => console.log(`[${SERVER_NAME}] MongoDB connected`))
  .catch((e) => console.error(`[${SERVER_NAME}] MongoDB error:`, e.message));

// ── Health ────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  let redisOk = false;
  try {
    await publisher.ping();
    redisOk = true;
  } catch {
    /* not ready */
  }
  const mongoOk = mongoose.connection.readyState === 1;
  const status = redisOk && mongoOk ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({
    status,
    server: SERVER_NAME,
    redis: redisOk ? "ok" : "error",
    mongodb: mongoOk ? "ok" : "error",
  });
});

// ── In-memory routing ─────────────────────────────────────
const connections = {};
const socketMeta = {};

// ── Socket.IO auth middleware ─────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required"));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

// ── Helper: route a signal to a specific user by phone ────
function callRoute(toPhone, event, payload) {
  const sid = connections[toPhone];
  if (sid) io.to(sid).emit(event, payload);
  return Boolean(sid);
}

// ── Socket.IO connection handler ──────────────────────────
io.on("connection", async (socket) => {
  const { phone, name } = socket.user;
  console.log(`[${SERVER_NAME}] connect  ${socket.id} (${name})`);

  connections[phone] = socket.id;
  socketMeta[socket.id] = { phone, name, rooms: new Set() };

  await publisher.hSet("schat:users", phone, name).catch(() => {});

  try {
    const userGroups = await GroupModel.find(
      { members: phone },
      { __v: 0 },
    ).lean();
    for (const g of userGroups) {
      socket.join(g.name);
      socketMeta[socket.id].rooms.add(g.name);
      await publisher.lRem(`${g.name}_meta`, 0, phone).catch(() => {});
      await publisher.lPush(`${g.name}_meta`, phone).catch(() => {});
    }
    socket.emit("myGroups", JSON.stringify(userGroups));
    for (const g of userGroups) {
      await publisher.publish("schat-users", g.name).catch(() => {});
    }
  } catch (e) {
    console.error(`[${SERVER_NAME}] Group rejoin error:`, e.message);
  }

  publisher
    .lRange("roomSCHAT", 0, -1)
    .then((rooms) => socket.emit("room", JSON.stringify(rooms)))
    .catch(() => {});

  socket.on("join", async (msg) => {
    try {
      const { room } = JSON.parse(msg);
      if (!room) {
        socket.emit("error", { message: "room is required" });
        return;
      }

      const existingGroup = await GroupModel.findOne({ name: room });

      if (existingGroup) {
        if (!existingGroup.members.includes(phone)) {
          socket.emit("error", {
            message: `"${room}" already exists. Ask the group creator to add you.`,
          });
          return;
        }
        socket.join(room);
        socketMeta[socket.id].rooms.add(room);
        await publisher.lRem(`${room}_meta`, 0, phone).catch(() => {});
        await publisher.lPush(`${room}_meta`, phone).catch(() => {});
        await publisher.publish("schat-users", room).catch(() => {});
        socket.emit("groupInfo", JSON.stringify(existingGroup));
        return;
      }

      socket.join(room);
      socketMeta[socket.id].rooms.add(room);

      await publisher.set(room, "1");
      await publisher.lPush("roomSCHAT", room);
      await publisher.publish("schat-rooms", "1");

      const newGroup = await GroupModel.create({
        name: room,
        creator: phone,
        members: [phone],
      });

      await publisher.lRem(`${room}_meta`, 0, phone);
      await publisher.lPush(`${room}_meta`, phone);
      await publisher.publish("schat-users", room);

      const sysMsg = await new ChatModel({
        time: new Date(),
        user: null,
        senderName: null,
        room,
        data: `${name} created the group`,
        type: "system",
      }).save();
      await publisher.publish(
        "schat-chats",
        JSON.stringify({
          ...sysMsg.toObject(),
          _id: undefined,
          msgId: sysMsg._id.toString(),
        }),
      );

      socket.emit(
        "groupInfo",
        JSON.stringify({
          _id: newGroup._id,
          name: room,
          creator: phone,
          members: [phone],
        }),
      );
    } catch (err) {
      console.error(`[${SERVER_NAME}] join error:`, err.message);
      socket.emit("error", { message: "Failed to create group" });
    }
  });

  socket.on("group:addMember", async (msg) => {
    try {
      const { room, memberPhone } = JSON.parse(msg);
      if (!room || !memberPhone) return;

      const group = await GroupModel.findOne({ name: room });
      if (!group) {
        socket.emit("error", { message: "Group not found" });
        return;
      }
      if (group.creator !== phone) {
        socket.emit("error", {
          message: "Only the group creator can add members",
        });
        return;
      }
      if (group.members.includes(memberPhone)) {
        socket.emit("error", { message: "That user is already in the group" });
        return;
      }

      const targetUser = await UserModel.findOne({ phone: memberPhone });
      if (!targetUser) {
        socket.emit("error", {
          message: "No account found with that phone number",
        });
        return;
      }

      await GroupModel.updateOne(
        { name: room },
        { $push: { members: memberPhone } },
      );

      await publisher.lRem(`${room}_meta`, 0, memberPhone).catch(() => {});
      await publisher.lPush(`${room}_meta`, memberPhone).catch(() => {});
      await publisher.publish("schat-users", room).catch(() => {});

      const memberSid = connections[memberPhone];
      if (memberSid) {
        const memberSocket = io.sockets.sockets.get(memberSid);
        if (memberSocket) {
          memberSocket.join(room);
          if (socketMeta[memberSid]) socketMeta[memberSid].rooms.add(room);
          const allGroups = await GroupModel.find(
            { members: memberPhone },
            { __v: 0 },
          ).lean();
          memberSocket.emit("myGroups", JSON.stringify(allGroups));
        }
      }

      const updated = await GroupModel.findOne(
        { name: room },
        { __v: 0 },
      ).lean();
      io.to(room).emit("groupInfo", JSON.stringify(updated));

      const sysMsg = await new ChatModel({
        time: new Date(),
        user: null,
        senderName: null,
        room,
        data: `${targetUser.name} was added to the group`,
        type: "system",
      }).save();
      await publisher.publish(
        "schat-chats",
        JSON.stringify({
          ...sysMsg.toObject(),
          _id: undefined,
          msgId: sysMsg._id.toString(),
        }),
      );
    } catch (err) {
      console.error(`[${SERVER_NAME}] group:addMember error:`, err.message);
      socket.emit("error", { message: "Failed to add member" });
    }
  });

  socket.on("group:leave", async (msg) => {
    try {
      const { room } = JSON.parse(msg);
      if (!room) return;

      const group = await GroupModel.findOne({ name: room });
      if (!group) {
        socket.emit("group:left", { room });
        return;
      }

      const newMembers = group.members.filter((m) => m !== phone);

      if (newMembers.length === 0) {
        await GroupModel.deleteOne({ name: room });
        await publisher.del(room);
        await publisher.lRem("roomSCHAT", 0, room);
        await publisher.del(`${room}_meta`);
        await publisher.publish("schat-rooms", "1");
      } else {
        const newCreator =
          group.creator === phone ? newMembers[0] : group.creator;
        await GroupModel.updateOne(
          { name: room },
          { members: newMembers, creator: newCreator },
        );
        await publisher.lRem(`${room}_meta`, 0, phone);
        await publisher.publish("schat-users", room);

        const updated = await GroupModel.findOne(
          { name: room },
          { __v: 0 },
        ).lean();
        io.to(room).emit("groupInfo", JSON.stringify(updated));
      }

      socket.leave(room);
      socketMeta[socket.id].rooms.delete(room);
      socket.emit("group:left", { room });
    } catch (err) {
      console.error(`[${SERVER_NAME}] group:leave error:`, err.message);
      socket.emit("error", { message: "Failed to leave group" });
    }
  });

  socket.on("group:delete", async (msg) => {
    try {
      const { room } = JSON.parse(msg);
      if (!room) return;

      const group = await GroupModel.findOne({ name: room });
      if (!group) {
        socket.emit("error", { message: "Group not found" });
        return;
      }
      if (group.creator !== phone) {
        socket.emit("error", {
          message: "Only the group creator can delete this group",
        });
        return;
      }

      io.to(room).emit("group:deleted", JSON.stringify({ room }));

      await GroupModel.deleteOne({ name: room });
      await publisher.del(room);
      await publisher.lRem("roomSCHAT", 0, room);
      await publisher.del(`${room}_meta`);
      await publisher.publish("schat-rooms", "1");
    } catch (err) {
      console.error(`[${SERVER_NAME}] group:delete error:`, err.message);
      socket.emit("error", { message: "Failed to delete group" });
    }
  });

  socket.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);
      if (!data.data) {
        socket.emit("error", { message: "Invalid message" });
        return;
      }

      data.user = phone;
      data.senderName = name;
      data.time = data.time || new Date().toISOString();

      const saved = await new ChatModel(data).save();
      data.msgId = saved._id.toString();

      const serialized = JSON.stringify(data);
      await publisher.publish("schat-chats", serialized);

      if (data.unicast) socket.emit("message", serialized);
    } catch (err) {
      console.error(`[${SERVER_NAME}] message error:`, err.message);
      socket.emit("error", { message: "Message delivery failed" });
    }
  });

  socket.on("message:delete", async (msg) => {
    try {
      const { msgId, scope, room, toUser } = JSON.parse(msg);
      if (scope !== "everyone") return;

      const chatMsg = await ChatModel.findById(msgId);
      if (!chatMsg) {
        socket.emit("error", { message: "Message not found" });
        return;
      }
      if (chatMsg.user !== phone) {
        socket.emit("error", {
          message: "Cannot delete another user's message",
        });
        return;
      }

      chatMsg.deletedForEveryone = true;
      chatMsg.data = "";
      await chatMsg.save();

      const payload = JSON.stringify({ msgId, type: "deleted_everyone" });
      if (room) {
        io.to(room).emit("message:deleted", payload);
      } else if (toUser) {
        socket.emit("message:deleted", payload);
        const sid = connections[toUser];
        if (sid) io.to(sid).emit("message:deleted", payload);
      }
    } catch (err) {
      console.error(`[${SERVER_NAME}] message:delete error:`, err.message);
    }
  });

  socket.on("status:post", async (msg) => {
    try {
      const { content } = JSON.parse(msg);
      if (!content?.trim() || content.trim().length > 700) return;

      const expiresAt = new Date(Date.now() + STATUS_TTL);
      const status = await StatusModel.create({
        user: phone,
        senderName: name,
        content: content.trim(),
        expiresAt,
      });

      io.emit(
        "status:new",
        JSON.stringify({
          _id: status._id.toString(),
          user: phone,
          senderName: name,
          content: content.trim(),
          createdAt: status.createdAt,
          expiresAt,
          viewedBy: [],
        }),
      );
    } catch (err) {
      console.error(`[${SERVER_NAME}] status:post error:`, err.message);
    }
  });

  socket.on("status:view", async (msg) => {
    try {
      const { statusId } = JSON.parse(msg);
      const updated = await StatusModel.findByIdAndUpdate(
        statusId,
        { $addToSet: { viewedBy: phone } },
        { new: true },
      ).lean();
      if (updated) {
        const ownerSid = connections[updated.user];
        if (ownerSid) {
          io.to(ownerSid).emit(
            "status:viewed",
            JSON.stringify({
              statusId: statusId.toString(),
              viewerPhone: phone,
              viewedBy: updated.viewedBy,
            }),
          );
        }
      }
    } catch {
      /* ignore */
    }
  });

  socket.on("status:delete", async (msg) => {
    try {
      const { statusId } = JSON.parse(msg);
      if (!statusId) return;
      const status = await StatusModel.findById(statusId);
      if (!status) return;
      if (status.user !== phone) {
        socket.emit("error", {
          message: "Cannot delete someone else's status",
        });
        return;
      }
      await StatusModel.deleteOne({ _id: statusId });
      io.emit(
        "status:deleted",
        JSON.stringify({ statusId: statusId.toString(), userPhone: phone }),
      );
    } catch (err) {
      console.error(`[${SERVER_NAME}] status:delete error:`, err.message);
    }
  });

  socket.on("typing", (msg) => {
    try {
      const parsed = JSON.parse(msg);
      parsed.user = phone;
      parsed.senderName = name;
      if (parsed.room)
        socket.to(parsed.room).emit("typing", JSON.stringify(parsed));
    } catch {
      /* ignore */
    }
  });

  socket.on("disconnect", async () => {
    try {
      const meta = socketMeta[socket.id];
      if (!meta) return;
      const { phone: mPhone, rooms } = meta;
      delete socketMeta[socket.id];
      if (connections[mPhone] === socket.id) delete connections[mPhone];

      for (const room of rooms) {
        await publisher.lRem(`${room}_meta`, 0, mPhone).catch(() => {});
        await publisher.publish("schat-users", room).catch(() => {});
      }
      console.log(`[${SERVER_NAME}] disconnect ${socket.id} (${name})`);
    } catch (err) {
      console.error(`[${SERVER_NAME}] disconnect cleanup:`, err.message);
    }
  });

  socket.on("call:initiate", ({ toPhone, callType }) => {
    const online = callRoute(toPhone, "call:incoming", {
      fromPhone: phone,
      fromName: name,
      callType,
    });
    if (!online) socket.emit("call:unavailable", { toPhone });
  });
  socket.on("call:accept", ({ toPhone }) =>
    callRoute(toPhone, "call:accepted", { fromPhone: phone, fromName: name }),
  );
  socket.on("call:reject", ({ toPhone }) =>
    callRoute(toPhone, "call:rejected", { fromPhone: phone }),
  );
  socket.on("call:end", ({ toPhone }) =>
    callRoute(toPhone, "call:ended", { fromPhone: phone }),
  );
  socket.on("call:busy", ({ toPhone }) =>
    callRoute(toPhone, "call:busy", { fromPhone: phone }),
  );
  socket.on("call:offer", ({ toPhone, offer }) =>
    callRoute(toPhone, "call:offer", { fromPhone: phone, offer }),
  );
  socket.on("call:answer", ({ toPhone, answer }) =>
    callRoute(toPhone, "call:answer", { fromPhone: phone, answer }),
  );
  socket.on("call:ice-candidate", ({ toPhone, candidate }) =>
    callRoute(toPhone, "call:ice-candidate", { fromPhone: phone, candidate }),
  );
});

// ── Redis subscribers ─────────────────────────────────────

subscriber.subscribe("schat-chats", (msg) => {
  try {
    const data = JSON.parse(msg);
    if (data.unicast) {
      const sid = connections[data.toUser];
      if (sid) io.to(sid).emit("message", msg);
    } else if (data.room) {
      io.to(data.room).emit("message", msg);
    }
  } catch (e) {
    console.error(`[${SERVER_NAME}] schat-chats:`, e.message);
  }
});

subscriber2.subscribe("schat-rooms", async () => {
  try {
    const rooms = await publisher.lRange("roomSCHAT", 0, -1);
    io.emit("room", JSON.stringify(rooms));
  } catch (e) {
    console.error(`[${SERVER_NAME}] schat-rooms:`, e.message);
  }
});

subscriber3.subscribe("schat-users", async (roomName) => {
  try {
    const phones = await publisher.lRange(`${roomName}_meta`, 0, -1);
    const unique = [...new Set(phones)];
    let users = unique.map((p) => ({ phone: p, name: p }));
    if (unique.length > 0) {
      const names = await publisher.hmGet("schat:users", unique);
      users = unique.map((p, i) => ({ phone: p, name: names[i] || p }));
    }
    io.to(roomName).emit(
      "roomusers",
      JSON.stringify({ room: roomName, users }),
    );
  } catch (e) {
    console.error(`[${SERVER_NAME}] schat-users:`, e.message);
  }
});

// ── Startup ───────────────────────────────────────────────
Promise.all([
  publisher.connect(),
  subscriber.connect(),
  subscriber2.connect(),
  subscriber3.connect(),
])
  .then(() => {
    console.log(`[${SERVER_NAME}] Redis connected`);
    httpServer.listen(PORT, () =>
      console.log(`[${SERVER_NAME}] Listening on :${PORT}`),
    );
  })
  .catch((e) => {
    console.error(`[${SERVER_NAME}] Startup failed:`, e.message);
    process.exit(1);
  });

// NOTE: Static frontend serving removed — frontend is served via S3 + CloudFront

// ── Graceful shutdown ─────────────────────────────────────
const shutdown = (sig) => {
  console.log(`[${SERVER_NAME}] ${sig} — shutting down…`);
  httpServer.close(() => {
    Promise.all([
      publisher.quit(),
      subscriber.quit(),
      subscriber2.quit(),
      subscriber3.quit(),
      mongoose.connection.close(),
    ])
      .then(() => {
        console.log(`[${SERVER_NAME}] Clean shutdown`);
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
  setTimeout(() => process.exit(1), 30_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
