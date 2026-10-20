// A small in-memory rate limiter (no dependency): at most `limit` requests per user in each time window.
// It is per process and starts empty after a restart. Use it after authenticate (it needs req.user).

// The limit for the AI endpoints, in one place (the tests import it too)
export const AI_RATE_LIMIT = { limit: 30, windowMs: 60 * 1000 };

// now = a clock function (tests pass a fake one)
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const windows = new Map(); // user id -> { count, resetAt }

  return function rateLimit(req, res, next) {
    const time = now();

    // Forget finished windows now and then, so the map cannot grow forever
    if (windows.size > 1000) {
      for (const [id, entry] of windows) if (entry.resetAt <= time) windows.delete(id);
    }

    let entry = windows.get(req.user.id);
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + windowMs };
      windows.set(req.user.id, entry);
    }
    entry.count += 1;

    if (entry.count > limit) {
      const seconds = Math.max(1, Math.ceil((entry.resetAt - time) / 1000));
      res.set("Retry-After", String(seconds));
      return res.status(429).json({ error: `Too many requests. Try again in ${seconds} seconds.` });
    }
    next();
  };
}

export const aiRateLimit = createRateLimiter(AI_RATE_LIMIT);

// A stricter limit for calls to the LLM (they cost money or time), in one place.
export const LLM_RATE_LIMIT = { limit: 10, windowMs: 60 * 1000 };

// Counts events per key in a time window: hit(key) is true while the key is under the limit.
// (Separate from the request limiter above, which answers 429 itself.)
export function createWindowCounter({ limit, windowMs, now = Date.now }) {
  const windows = new Map(); // key -> { count, resetAt }

  return function hit(key) {
    const time = now();
    if (windows.size > 1000) {
      for (const [id, entry] of windows) if (entry.resetAt <= time) windows.delete(id);
    }
    let entry = windows.get(key);
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + windowMs };
      windows.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

// True if this user may make another LLM call right now (and counts it)
export const llmAllowed = createWindowCounter(LLM_RATE_LIMIT);
