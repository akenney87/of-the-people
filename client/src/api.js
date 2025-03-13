import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api"; // Update if backend URL changes

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Function to get a new access token using refresh token
const refreshAccessToken = async () => {
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("No refresh token available");

    const response = await axios.post(`${API_BASE_URL}/refresh-token`, { refreshToken });

    localStorage.setItem("accessToken", response.data.accessToken);
    return response.data.accessToken;
  } catch (error) {
    console.error("Refresh token failed:", error);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    window.location.href = "/login"; // Redirect to login
    return null;
  }
};

// Request Interceptor: Attach Access Token to API Requests
api.interceptors.request.use(
  async (config) => {
    let accessToken = localStorage.getItem("accessToken");
    if (!accessToken) return config;

    config.headers["Authorization"] = `Bearer ${accessToken}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Expired Tokens and Refresh Automatically
api.interceptors.response.use(
  (response) => response, // If the response is fine, return it
  async (error) => {
    if (error.response?.status === 401) {
      console.log("Access token expired, attempting to refresh...");
      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        error.config.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return axios(error.config); // Retry the request with the new token
      }
    }

    return Promise.reject(error);
  }
);

// Add a simple caching mechanism for development
const cache = new Map();

// Enhanced get method with basic caching
const originalGet = api.get;
api.get = async function(url, config = {}) {
  try {
    // Try to make the actual API call
    const response = await originalGet(url, config);
    
    // Cache successful responses
    if (response.status === 200) {
      cache.set(url, response.data);
    }
    
    return response;
  } catch (error) {
    // If we have cached data, return it
    if (cache.has(url)) {
      console.log('Using cached data for', url);
      return { data: cache.get(url) };
    }
    
    throw error;
  }
};

export default api;
