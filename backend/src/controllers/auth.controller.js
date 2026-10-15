// Handlers for register, login and "who am I".
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config.js";
import { registerSchema, loginSchema } from "../validation/auth.schemas.js";

// Fields that are safe to send to the client (never passwordHash)
export const publicUserSelect = { id: true, name: true, email: true, role: true, createdAt: true };

// Token holds only the user id (as a string, per the JWT "sub" convention)
function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: JWT_EXPIRES_IN,
  });
}

// Strip passwordHash from a full user record
function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email is already registered" });
  }

  // role is always "user"; a client-sent role was already stripped by Zod
  let user;
  try {
    user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 10), role: "user" },
      select: publicUserSelect,
    });
  } catch (err) {
    // P2002 = unique constraint failed: two requests registered the same email at once
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Email is already registered" });
    }
    throw err;
  }

  res.status(201).json({ user, token: signToken(user) });
}

export async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
  }
  const { email, password } = parsed.data;

  // Same message for unknown email and wrong password, so emails cannot be probed
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({ user: publicUser(user), token: signToken(user) });
}

// req.user is set by the authenticate middleware
export function me(req, res) {
  res.json({ user: req.user });
}
