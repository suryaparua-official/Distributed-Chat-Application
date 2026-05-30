import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api, tokenStore } from "../api";

const AuthContext = createContext(null);

function tokenExpiry(token) {
  try {
    return JSON.parse(atob(token.split(".")[1])).exp;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null); // { id, name, phone }
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const scheduleRefresh = useCallback((token) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const exp = tokenExpiry(token);
    if (!exp) return;
    const delay = exp * 1000 - Date.now() - 60_000;
    if (delay <= 0) return;
    timerRef.current = setTimeout(async () => {
      try {
        const r = await api.get("/auth/refresh");
        tokenStore.set(r.data.token);
        setUser(r.data.user);
        scheduleRefresh(r.data.token);
      } catch {
        setUser(null);
        tokenStore.clear();
      }
    }, delay);
  }, []);

  useEffect(() => {
    api
      .get("/auth/refresh")
      .then((r) => {
        tokenStore.set(r.data.token);
        setUser(r.data.user);
        scheduleRefresh(r.data.token);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const onExpired = () => { setUser(null); tokenStore.clear(); };
    window.addEventListener("schat:sessionExpired", onExpired);
    return () => {
      window.removeEventListener("schat:sessionExpired", onExpired);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleRefresh]);

  const register = useCallback(async (name, phone, password) => {
    const r = await api.post("/auth/register", { name, phone, password });
    tokenStore.set(r.data.token);
    setUser(r.data.user);
    scheduleRefresh(r.data.token);
    return r.data.user;
  }, [scheduleRefresh]);

  const login = useCallback(async (phone, password) => {
    const r = await api.post("/auth/login", { phone, password });
    tokenStore.set(r.data.token);
    setUser(r.data.user);
    scheduleRefresh(r.data.token);
    return r.data.user;
  }, [scheduleRefresh]);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    tokenStore.clear();
    if (timerRef.current) clearTimeout(timerRef.current);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
