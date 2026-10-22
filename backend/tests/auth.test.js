// Integration tests for /api/auth. They use the real database (the Postgres container must be running).
import crypto from "node:crypto";
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";

// Unique emails per run; we remember them so we only delete what the tests created
const runId = Date.now();
const createdEmails = [];
let counter = 0;
function newEmail() {
  const email = `auth-test-${runId}-${counter++}@example.test`;
  createdEmails.push(email);
  return email;
}

// A new random password for every run, never a fixed string (32 characters, inside the 8 to 72 limit)
const PASSWORD = crypto.randomBytes(16).toString("hex");

// Helper: register a user and return the response body
async function registerUser(email) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Test User", email, password: PASSWORD });
  return res.body;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates a user and returns 201 with a token and no passwordHash", async () => {
    const email = newEmail();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe("user");
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 409 for a duplicate email", async () => {
    const email = newEmail();
    await registerUser(email);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Other", email, password: PASSWORD });

    expect(res.status).toBe(409);
  });

  it("returns 400 for a weak password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: newEmail(), password: "short" });

    expect(res.status).toBe(400);
  });

  it("ignores a role sent by the client", async () => {
    const email = newEmail();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Sneaky", email, password: PASSWORD, role: "admin" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("user");

    // Also check what was actually stored
    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored.role).toBe("user");
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const email = newEmail();
    await registerUser(email);

    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(email);
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 with a generic message for a wrong password", async () => {
    const email = newEmail();
    await registerUser(email);

    const res = await request(app).post("/api/auth/login").send({ email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("returns the same 401 message for an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `nobody-${runId}@example.test`, password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user with a valid token", async () => {
    const email = newEmail();
    const { token } = await registerUser(email);

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
