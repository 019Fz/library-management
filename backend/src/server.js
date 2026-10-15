// Entry point: load env vars, then start the HTTP server.
import "dotenv/config";
import "./config.js"; // stops startup with a clear message if JWT_SECRET is missing
import app from "./app.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
