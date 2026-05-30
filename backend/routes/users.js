"use strict";

const router = require("express").Router();
const User = require("../models/user");

// GET /users/lookup?phone=+1234567890
// Authenticated: returns public profile for a given phone number
router.get("/lookup", async (req, res) => {
  const phone = req.query.phone?.trim().replace(/\s+/g, "");
  if (!phone) return res.status(400).json({ error: "phone is required" });

  try {
    const user = await User.findOne({ phone }, { password: 0, __v: 0 }).lean();
    if (!user) return res.status(404).json({ error: "No account found with that number" });
    res.json({ id: user._id, name: user.name, phone: user.phone });
  } catch (err) {
    console.error("User lookup error:", err.message);
    res.status(500).json({ error: "Lookup failed" });
  }
});

module.exports = router;
