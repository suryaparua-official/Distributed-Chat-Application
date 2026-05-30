"use strict";
const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name:      { type: String, required: true, unique: true, trim: true },
  creator:   { type: String, required: true },   // phone of creator/admin
  members:   [{ type: String }],                  // array of member phones
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Group", groupSchema);
