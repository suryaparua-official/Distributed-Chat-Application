const router = require("express").Router();
const ChatSchema = require("../models/chat");

// fetch group messages
router.post("/", async (req, res) => {
  try {
    const { user, room } = req.body;
    let filter = {
      $or: [{ $and: [{ room: room }, { unicast: false }] }, { broadcast: 1 }],
    };
    const data = await ChatSchema.find(filter, { _id: 0 });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).send();
  }
});

// fetch private (DM) messages
router.post("/dm", async (req, res) => {
  try {
    const { user } = req.body;
    let filter = {
      $or: [
        { $and: [{ unicast: true }, { user: user }] },
        { $and: [{ unicast: true }, { toUser: user }] },
      ],
    };
    const data = await ChatSchema.find(filter, { _id: 0 });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).send();
  }
});

module.exports = router;
