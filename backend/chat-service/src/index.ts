import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/db.js";
import chatRoutes from "./routes/chat.js";
import cors from "cors";
import { app, server } from "./config/socket.js";

dotenv.config();

connectDb();

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v1", chatRoutes);

const port = process.env.PORT || 5002;

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
