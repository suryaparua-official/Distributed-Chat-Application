import axios from "axios";

const ENDPOINT = import.meta.env.VITE_BACKEND_URL || "";

// Module-level token store — lives outside React to avoid circular dependencies
// between AuthContext (which sets it) and axios interceptors (which read it).
export const tokenStore = {
  _t: null,
  set(t) { this._t = t; },
  get() { return this._t; },
  clear() { this._t = null; },
};

export const api = axios.create({
  baseURL: ENDPOINT,
  withCredentials: true, // include httpOnly refresh cookie on every request
});

// Inject access token into every outgoing request
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, attempt one silent refresh then retry the original request.
// Concurrent 401s share one in-flight refresh to avoid a thundering herd.
// The refresh endpoint itself is never retried — doing so creates a deadlock
// where the interceptor awaits a promise that it itself is blocking.
let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isRefreshCall = original.url?.includes("/auth/refresh");
    if (err.response?.status === 401 && !original._retry && !isRefreshCall) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = api
          .get("/auth/refresh")
          .then((r) => {
            tokenStore.set(r.data.token);
            return r.data.token;
          })
          .finally(() => { refreshPromise = null; });
      }
      try {
        const newToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        tokenStore.clear();
        window.dispatchEvent(new CustomEvent("schat:sessionExpired"));
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);
