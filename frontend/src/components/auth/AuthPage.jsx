import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Smartphone } from "lucide-react";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [tab,      setTab]      = useState("login");
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const switchTab = (t) => {
    setTab(t);
    setError("");
    setName("");
    setPhone("");
    setPassword("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        await login(phone, password);
      } else {
        await register(name, phone, password);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    tab === "login"
      ? phone.trim().length >= 10 && password.length >= 6
      : name.trim().length >= 1 && phone.trim().length >= 10 && password.length >= 6;

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow--1" />
      <div className="auth-glow auth-glow--2" />

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="auth-title">Schat</h1>
          <p className="auth-subtitle">Real-time messaging for teams</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === "login" ? " auth-tab--active" : ""}`}
            onClick={() => switchTab("login")}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab${tab === "register" ? " auth-tab--active" : ""}`}
            onClick={() => switchTab("register")}
            type="button"
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {tab === "register" && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-name">Full Name</label>
              <input
                id="auth-name"
                className="auth-input"
                type="text"
                placeholder="Your display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                autoFocus={tab === "register"}
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-phone">Mobile Number</label>
            <div className="auth-phone-wrap">
              <span className="auth-phone-icon"><Smartphone size={16} /></span>
              <input
                id="auth-phone"
                className="auth-input auth-input--phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus={tab === "login"}
                autoComplete="tel"
              />
            </div>
            <p className="auth-hint">Include country code, e.g. +91 9876543210</p>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete={tab === "register" ? "new-password" : "current-password"}
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
              </svg>
              {error}
            </div>
          )}

          <button
            className="auth-btn"
            type="submit"
            disabled={loading || !canSubmit}
          >
            {loading ? (
              <span className="auth-spinner" />
            ) : tab === "login" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="auth-footer">
          {tab === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button className="auth-link" type="button" onClick={() => switchTab("register")}>
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="auth-link" type="button" onClick={() => switchTab("login")}>
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
