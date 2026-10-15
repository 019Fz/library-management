// authenticate: checks the Bearer token and loads the user. requireAdmin: admin-only guard.
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { JWT_SECRET } from "../config.js";
import { publicUserSelect } from "../controllers/auth.controller.js";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Load the user so deleted users and role changes take effect immediately
  const id = Number(payload.sub);
  if (!Number.isInteger(id)) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  if (!user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = user;
  next();
}

// Use after authenticate. Not applied to any route yet.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
