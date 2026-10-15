// Axios instance for the backend API, plus token storage helpers.
import axios from "axios";

const TOKEN_KEY = "token";

// Fallback used only when localStorage is blocked (e.g. some private windows)
let memoryToken = null;
let storageFailed = false;

export function getToken() {
  if (storageFailed) return memoryToken;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    storageFailed = true;
    return memoryToken;
  }
}

export function setToken(token) {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    storageFailed = true;
  }
}

// Clears both places so a stale token can never come back
export function clearToken() {
  memoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    storageFailed = true;
  }
}

// AuthContext registers a function here that logs the user out of React state
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Send the token with every request when we have one
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 on login/register just means wrong details, so the form shows the error.
// Any other 401 means the session is no longer valid: clear it and let the route guards redirect.
const AUTH_FORM_URLS = ["/api/auth/login", "/api/auth/register"];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthForm = AUTH_FORM_URLS.includes(error.config?.url);
    if (error.response?.status === 401 && !isAuthForm) {
      clearToken();
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  },
);

// Turn an Axios error into { message, details } for the forms
export function getApiError(error) {
  if (!error.response) {
    return { message: "Cannot reach the server. Please try again.", details: [] };
  }
  const data = error.response.data;
  return {
    message: data?.error || "Something went wrong. Please try again.",
    details: Array.isArray(data?.details) ? data.details.map((d) => d.message).filter(Boolean) : [],
  };
}

export default api;
