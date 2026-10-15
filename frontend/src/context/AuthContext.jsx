// Holds the logged-in user and the login/register/logout actions for the whole app.
import { useEffect, useState } from "react";
import api, { getToken, setToken, clearToken, setUnauthorizedHandler } from "../api/client.js";
import { AuthContext } from "./auth-context.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only "loading" at start if there is a token to check
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // Declared before the restore effect on purpose: effects run in order, so the handler
  // exists before the /me request below can come back with a 401.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // On app start, restore the user from the stored token
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false; // ignore results if React StrictMode re-runs this effect
    api
      .get("/api/auth/me")
      .then((res) => {
        if (!cancelled) setUser(res.data.user);
      })
      .catch(() => {
        if (!cancelled) clearToken();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Errors are not caught here; the forms catch them and show the message
  async function login(email, password) {
    const { data } = await api.post("/api/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
  }

  async function register(name, email, password) {
    const { data } = await api.post("/api/auth/register", { name, email, password });
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
