import express from "express";
import dotenv from "dotenv";
import { startSendOtpConsumer } from "./consumer.js";

dotenv.config();

startSendOtpConsumer();

const app = express();

const port = process.env.PORT || 5001;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
