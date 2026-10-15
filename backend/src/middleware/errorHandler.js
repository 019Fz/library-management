// 404 for unknown routes, and one place that turns errors into JSON responses.

export function notFound(req, res) {
  res.status(404).json({ error: "Route not found" });
}

// Express recognises error handlers by their four arguments
export function errorHandler(err, req, res, next) {
  // Malformed JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  // Anything else is unexpected: log it, but do not leak details
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
