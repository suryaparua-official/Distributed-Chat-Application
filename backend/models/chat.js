const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
  time: { type: Date },
  user: { type: String },
  room: { type: String },
  data: { type: String },
  type: { type: String }, // "text" or "image"
  broadcast: { type: Number }, // 1 = broadcast to everyone, 0 = room only
  unicast: { type: Boolean }, // true = private message
  toUser: { type: String }, // recipient for unicast messages
});

module.exports = mongoose.model("Chat", ChatSchema);
