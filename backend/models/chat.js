const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
  time:               { type: Date },
  user:               { type: String },   // sender's phone
  senderName:         { type: String },   // sender's display name
  room:               { type: String },
  data:               { type: String },
  type:               { type: String },   // "text"
  unicast:            { type: Boolean },  // true = direct message
  toUser:             { type: String },   // recipient's phone for DMs
  deletedForEveryone: { type: Boolean, default: false },
});

module.exports = mongoose.model("Chat", ChatSchema);
