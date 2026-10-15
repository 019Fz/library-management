// Express app setup (kept separate from server.js so it can be tested later).
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Allow the React dev server to call this API
app.use(cors({ origin: process.env.CORS_ORIGIN }));
// Parse JSON request bodies
app.use(express.json());

// Health check: confirms the server is running
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

// Must stay last: unknown routes, then error handling
app.use(notFound);
app.use(errorHandler);

export default app;
