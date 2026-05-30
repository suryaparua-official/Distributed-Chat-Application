"use strict";
const router = require("express").Router();
const Group  = require("../models/group");

// GET /groups — return the current user's persistent groups
router.get("/", async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.phone }, { __v: 0 }).lean();
    res.json(groups);
  } catch (err) {
    console.error("GET /groups error:", err.message);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

module.exports = router;
