"use strict";

const router     = require("express").Router();
const ChatSchema = require("../models/chat");

// POST /chat — group message history (excludes DMs, exposes msgId)
router.post("/", async (req, res) => {
  const { room } = req.body;
  if (!room) return res.status(400).json({ error: "room is required" });

  try {
    const data = await ChatSchema.find(
      { room, unicast: { $ne: true } },
      { __v: 0 }
    ).sort({ time: 1 }).lean();

    const msgs = data.map(({ _id, ...m }) => ({ ...m, msgId: _id.toString() }));
    res.status(200).json(msgs);
  } catch (err) {
    console.error("GET /chat error:", err.message);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST /chat/dm — DM history for the authenticated user (stable, no changes)
router.post("/dm", async (req, res) => {
  const phone = req.user?.phone;
  if (!phone) return res.status(401).json({ error: "Authentication required" });

  try {
    const data = await ChatSchema.find(
      { unicast: true, $or: [{ user: phone }, { toUser: phone }] },
      { __v: 0 }
    ).sort({ time: 1 }).lean();

    const msgs = data.map(({ _id, ...m }) => ({ ...m, msgId: _id.toString() }));
    res.status(200).json(msgs);
  } catch (err) {
    console.error("GET /chat/dm error:", err.message);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

module.exports = router;
