import axios from "axios";

// Single axios instance for the whole frontend. We point at a configurable
// backend URL so the same bundle can target localhost during dev and a
// Vercel/Render URL in prod. `withCredentials: true` is required for the
// browser to send our httpOnly auth cookies on cross-origin XHRs.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// On 401, try the refresh endpoint exactly once. If that also fails, send the
// user to /login. The cookie is httpOnly so we don't read or write tokens here
// — the server handles the cookie lifecycle.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status === 401 && original && !original._retried) {
      original._retried = true;
      try {
        await api.post("/refresh-token");
        return api(original);
      } catch {
        // Refresh failed — session is gone. Bounce to /login unless we're
        // already on a public page (so we don't get into a loop).
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Simple in-memory cache so a temporarily-offline tab can keep rendering the
// most recent good response for a given URL. Survives only for the current
// page; for true offline we have the workbox service worker.
const cache = new Map();
const originalGet = api.get.bind(api);
api.get = async function (url, config = {}) {
  try {
    const response = await originalGet(url, config);
    if (response.status === 200) cache.set(url, response.data);
    return response;
  } catch (error) {
    if (cache.has(url)) {
      console.log("Using cached data for", url);
      return { data: cache.get(url) };
    }
    throw error;
  }
};

export default api;
