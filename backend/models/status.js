"use strict";
const mongoose = require("mongoose");

const statusSchema = new mongoose.Schema({
  user:       { type: String, required: true },          // poster's phone
  senderName: { type: String, required: true },
  content:    { type: String, required: true, maxlength: 700 },
  createdAt:  { type: Date, default: Date.now },
  expiresAt:  { type: Date, required: true },
  viewedBy:   [{ type: String }],                        // phones who viewed
});

// MongoDB TTL — documents auto-deleted after expiresAt
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Status", statusSchema);
