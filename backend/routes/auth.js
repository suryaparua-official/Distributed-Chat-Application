"use strict";

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const ACCESS_TTL   = "15m";
const REFRESH_TTL  = "7d";
const BCRYPT_ROUNDS = 12;

// E.164-compatible: optional +, then 10–15 digits
const PHONE_RE = /^\+?[1-9]\d{9,14}$/;

function signAccess(user) {
  return jwt.sign(
    { id: user._id.toString(), phone: user.phone, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signRefresh(user) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  return jwt.sign(
    { id: user._id.toString() },
    secret,
    { expiresIn: REFRESH_TTL }
  );
}

function setRefreshCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

// POST /auth/register
router.post("/register", async (req, res) => {
  const { name, phone, password } = req.body;

  if (!name?.trim())  return res.status(400).json({ error: "Name is required" });
  if (!phone?.trim()) return res.status(400).json({ error: "Mobile number is required" });
  if (!password)      return res.status(400).json({ error: "Password is required" });

  const cleanName  = name.trim();
  const cleanPhone = phone.trim().replace(/\s+/g, "");

  if (cleanName.length > 64) {
    return res.status(400).json({ error: "Name must be at most 64 characters" });
  }
  if (!PHONE_RE.test(cleanPhone)) {
    return res.status(400).json({ error: "Enter a valid mobile number (10–15 digits, optional + prefix)" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const exists = await User.findOne({ phone: cleanPhone }).lean();
    if (exists) return res.status(409).json({ error: "An account with this number already exists" });

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ name: cleanName, phone: cleanPhone, password: hashed });

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      token: accessToken,
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { phone, password } = req.body;

  if (!phone?.trim()) return res.status(400).json({ error: "Mobile number is required" });
  if (!password)      return res.status(400).json({ error: "Password is required" });

  const cleanPhone = phone.trim().replace(/\s+/g, "");

  try {
    const user = await User.findOne({ phone: cleanPhone });
    if (!user) return res.status(401).json({ error: "Invalid mobile number or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid mobile number or password" });

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);
    setRefreshCookie(res, refreshToken);

    res.json({
      token: accessToken,
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /auth/refresh
router.get("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: "No refresh token" });

  try {
    const secret  = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const payload = jwt.verify(token, secret);

    const user = await User.findById(payload.id).lean();
    if (!user) return res.status(401).json({ error: "User not found" });

    const accessToken = signAccess(user);
    res.json({
      token: accessToken,
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// POST /auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie("refresh_token", { path: "/" });
  res.json({ message: "Logged out" });
});

module.exports = router;
