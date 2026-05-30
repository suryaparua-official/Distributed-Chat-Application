"use strict";
const router = require("express").Router();
const Status = require("../models/status");

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// GET /status/feed — all active statuses (used on initial load)
router.get("/feed", async (req, res) => {
  try {
    const statuses = await Status.find(
      { expiresAt: { $gt: new Date() } },
      { __v: 0 }
    ).sort({ createdAt: -1 }).lean();
    res.json(statuses);
  } catch (err) {
    console.error("GET /status/feed error:", err.message);
    res.status(500).json({ error: "Failed to fetch statuses" });
  }
});

// POST /status/:id/view — mark a status as viewed by this user
router.post("/:id/view", async (req, res) => {
  try {
    await Status.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { viewedBy: req.user.phone } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to record view" });
  }
});

module.exports = router;
