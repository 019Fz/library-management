// Express app setup (kept separate from server.js so it can be tested later).
import express from "express";
import cors from "cors";

const app = express();

// Allow the React dev server to call this API
app.use(cors({ origin: process.env.CORS_ORIGIN }));
// Parse JSON request bodies
app.use(express.json());

// Health check: confirms the server is running
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
