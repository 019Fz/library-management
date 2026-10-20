// Unit tests for the optional LLM translator. No network and no database: fetch is always a fake.
import { describe, it, expect, afterEach, vi } from "vitest";
import { getLlmConfig } from "../src/config.js";
import { INTENTS, validateIntent } from "../src/ai/intents.js";
import { parseQuestion } from "../src/ai/rules.js";
import { EXAMPLES, buildCatalog, buildMessages, parseModelOutput, translateWithLlm } from "../src/ai/llm.js";
import { createWindowCounter, LLM_RATE_LIMIT } from "../src/middleware/rateLimit.js";

const KEY = "sk-test-not-a-real-key-123";
const QUESTION = "What is the priciest thing on my shelf?";

// Set AI_LLM_* for one test; afterEach puts everything back
const saved = {};
function setLlmEnv(values) {
  for (const key of ["AI_LLM_BASE_URL", "AI_LLM_MODEL", "AI_LLM_API_KEY", "AI_LLM_TIMEOUT_MS"]) {
    if (!(key in saved)) saved[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, values);
}
const enabled = (extra = {}) =>
  setLlmEnv({ AI_LLM_BASE_URL: "http://llm.test/v1", AI_LLM_MODEL: "test-model", AI_LLM_API_KEY: KEY, ...extra });

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

// A fake fetch that answers with a chat completion carrying `content`
function fakeFetch(content, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  }));
}
const answer = (intent, params = {}) => JSON.stringify({ intent, params });

describe("getLlmConfig", () => {
  it("is off without a base URL or a model", () => {
    setLlmEnv({});
    expect(getLlmConfig()).toBeNull();
    setLlmEnv({ AI_LLM_BASE_URL: "http://llm.test/v1" });
    expect(getLlmConfig()).toBeNull();
    setLlmEnv({ AI_LLM_MODEL: "m" });
    expect(getLlmConfig()).toBeNull();
  });

  it("accepts only http: and https: URLs", () => {
    for (const url of ["ftp://x.test/v1", "file:///etc/passwd", "javascript:alert(1)", "not a url", "  "]) {
      setLlmEnv({ AI_LLM_BASE_URL: url, AI_LLM_MODEL: "m" });
      expect(getLlmConfig()).toBeNull();
    }
    setLlmEnv({ AI_LLM_BASE_URL: "https://api.example.test/v1/", AI_LLM_MODEL: "m" });
    expect(getLlmConfig().baseUrl).toBe("https://api.example.test/v1");
  });

  it("uses the timeout from the environment, or 10000 when missing or invalid", () => {
    enabled({ AI_LLM_TIMEOUT_MS: "15000" });
    expect(getLlmConfig().timeoutMs).toBe(15000);
    for (const bad of ["", "abc", "0", "-5"]) {
      enabled({ AI_LLM_TIMEOUT_MS: bad });
      expect(getLlmConfig().timeoutMs).toBe(10000);
    }
  });

  it("treats the key as optional", () => {
    setLlmEnv({ AI_LLM_BASE_URL: "http://localhost:11434/v1", AI_LLM_MODEL: "m" });
    expect(getLlmConfig().apiKey).toBeNull();
  });
});

describe("parseModelOutput", () => {
  it("reads plain JSON and strips code fences", () => {
    expect(parseModelOutput('{"intent":"top_genres"}')).toEqual({ intent: "top_genres" });
    expect(parseModelOutput('```json\n{"intent":"top_genres"}\n```')).toEqual({ intent: "top_genres" });
    expect(parseModelOutput('```\n{"intent":"top_genres"}\n```')).toEqual({ intent: "top_genres" });
  });

  it("returns null for anything else", () => {
    for (const bad of ["", "hello", "{broken", "[1,2]", "42", "null", undefined, 5, "x".repeat(5000)]) {
      expect(parseModelOutput(bad)).toBeNull();
    }
  });
});

describe("translateWithLlm", () => {
  it("turns a valid JSON answer into a validated intent (defaults filled in)", async () => {
    enabled();
    const fetchImpl = fakeFetch(answer("list_books", { sort: "price", order: "desc", limit: 1 }));
    const result = await translateWithLlm(QUESTION, { role: "user", fetchImpl });
    expect(result.intent).toBe("list_books");
    expect(result.params).toMatchObject({ sort: "price", order: "desc", limit: 1, scope: "all" });
  });

  it("strips code fences", async () => {
    enabled();
    const fetchImpl = fakeFetch("```json\n" + answer("top_authors", { limit: 3 }) + "\n```");
    const result = await translateWithLlm(QUESTION, { role: "user", fetchImpl });
    expect(result).toEqual({ intent: "top_authors", params: { scope: "all", limit: 3 } });
  });

  it("returns null for bad model output", async () => {
    enabled();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const outputs = [
      "I think you want the top genres",
      answer("drop_table", {}),
      answer("list_books", { limit: 999 }),
      answer("list_books", { minPrice: 50, maxPrice: 5 }),
      answer("unsupported"),
      JSON.stringify({ intent: 5 }),
      JSON.stringify({ params: {} }),
      "[]",
    ];
    for (const output of outputs) {
      expect(await translateWithLlm(QUESTION, { role: "user", fetchImpl: fakeFetch(output) })).toBeNull();
    }
  });

  it("returns null on an HTTP error, a network error or a missing choice, and calls fetch once", async () => {
    enabled();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const http500 = fakeFetch("{}", 500);
    expect(await translateWithLlm(QUESTION, { role: "user", fetchImpl: http500 })).toBeNull();
    expect(http500).toHaveBeenCalledTimes(1);

    const failing = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await translateWithLlm(QUESTION, { role: "user", fetchImpl: failing })).toBeNull();

    const empty = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    expect(await translateWithLlm(QUESTION, { role: "user", fetchImpl: empty })).toBeNull();
  });

  it("returns null after the timeout", async () => {
    enabled({ AI_LLM_TIMEOUT_MS: "50" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const hanging = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        }),
    );
    expect(await translateWithLlm(QUESTION, { role: "user", fetchImpl: hanging })).toBeNull();
  });

  it("never calls fetch when disabled", async () => {
    setLlmEnv({});
    const fetchImpl = fakeFetch(answer("top_genres"));
    expect(await translateWithLlm(QUESTION, { role: "user", fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    setLlmEnv({ AI_LLM_BASE_URL: "ftp://llm.test", AI_LLM_MODEL: "m" });
    expect(await translateWithLlm(QUESTION, { role: "user", fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries once without response_format when the provider rejects it", async () => {
    enabled();
    const bodies = [];
    const fetchImpl = vi.fn(async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      if (bodies.length === 1) return { ok: false, status: 400, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: answer("top_genres") } }] }) };
    });
    const result = await translateWithLlm(QUESTION, { role: "user", fetchImpl });
    expect(result.intent).toBe("top_genres");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(bodies[0].response_format).toEqual({ type: "json_object" });
    expect(bodies[1].response_format).toBeUndefined();
  });

  it("uses one deadline for the first request and the fallback", async () => {
    enabled({ AI_LLM_TIMEOUT_MS: "100" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    const fetchImpl = vi.fn((_url, { signal }) => {
      calls += 1;
      if (calls === 1) {
        // Rejects after 70 ms, leaving only about 30 ms of the 100 ms deadline
        return new Promise((resolve) => setTimeout(() => resolve({ ok: false, status: 400, json: async () => ({}) }), 70));
      }
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    });
    const started = Date.now();
    expect(await translateWithLlm(QUESTION, { role: "user", fetchImpl })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // With a fresh 100 ms timer for the second request this would take about 170 ms
    expect(Date.now() - started).toBeLessThan(160);
  });

  it("sends the question and the catalog to the right URL, with the key only in the header", async () => {
    enabled();
    const fetchImpl = fakeFetch(answer("top_genres"));
    await translateWithLlm(QUESTION, { role: "user", fetchImpl });
    const [url, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(url).toBe("http://llm.test/v1/chat/completions");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(options.body).not.toContain(KEY);
    expect(body).toMatchObject({ model: "test-model", temperature: 0, max_tokens: expect.any(Number) });
    expect(body.messages).toHaveLength(2);
    expect(JSON.parse(body.messages[1].content)).toEqual({ question: QUESTION });
    // Catalog and examples are in the system message; nothing else is
    expect(body.messages[0].content).toContain('"top_genres"');
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "response_format", "temperature"]);
  });

  it("sends no Authorization header without a key", async () => {
    setLlmEnv({ AI_LLM_BASE_URL: "http://localhost:11434/v1", AI_LLM_MODEL: "m" });
    const fetchImpl = fakeFetch(answer("top_genres"));
    await translateWithLlm(QUESTION, { role: "user", fetchImpl });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("ignores scope and ownerName from the model for a normal user, but not for an admin", async () => {
    enabled();
    const content = answer("list_books", { scope: "all", ownerName: "Someone", genre: "Fantasy" });
    const user = await translateWithLlm(QUESTION, { role: "user", fetchImpl: fakeFetch(content) });
    expect(user.params.ownerName).toBeUndefined();
    expect(user.params.scope).toBe("all"); // the schema default; the controller forces "mine" for normal users
    expect(user.params.genre).toBe("Fantasy");

    const admin = await translateWithLlm(QUESTION, { role: "admin", fetchImpl: fakeFetch(content) });
    expect(admin.params.ownerName).toBe("Someone");
  });

  it("never logs the key, the question or the model output", async () => {
    enabled();
    const spies = ["log", "info", "warn", "error", "debug"].map((name) =>
      vi.spyOn(console, name).mockImplementation(() => {}),
    );
    const secretOutput = "SECRET-MODEL-OUTPUT-XYZ";
    await translateWithLlm(QUESTION, { role: "user", fetchImpl: fakeFetch(secretOutput) });
    await translateWithLlm(QUESTION, { role: "user", fetchImpl: fakeFetch(secretOutput, 500) });
    await translateWithLlm(QUESTION, {
      role: "user",
      fetchImpl: vi.fn(async () => {
        throw new Error(`boom ${KEY} ${QUESTION}`);
      }),
    });
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain(QUESTION);
    expect(logged).not.toContain(secretOutput);
  });
});

describe("the prompt", () => {
  it("builds a catalog for every intent and both roles", () => {
    for (const role of ["user", "admin"]) {
      const catalog = buildCatalog(role);
      expect(() => JSON.stringify(catalog)).not.toThrow();
      const expected = Object.entries(INTENTS).filter(([, i]) => role === "admin" || !i.adminOnly);
      expect(catalog.map((c) => c.intent)).toEqual(expected.map(([name]) => name));
      for (const entry of catalog) {
        expect(entry.description).toBe(INTENTS[entry.intent].description);
        expect(typeof entry.params).toBe("object");
      }
    }
  });

  it("is generated from the schemas", () => {
    const list = buildCatalog("admin").find((c) => c.intent === "list_books");
    expect(Object.keys(list.params)).toEqual(
      expect.arrayContaining(["scope", "genre", "status", "author", "minPrice", "maxPrice", "ownerName", "sort", "order", "limit"]),
    );
    expect(list.params.status.enum).toEqual(["reading", "completed", "to-read"]);
    expect(list.params.sort.enum).toEqual(["price", "title", "createdAt"]);
    const stats = buildCatalog("admin").find((c) => c.intent === "book_stats");
    expect(stats.params.metric.enum).toContain("avg_price");
  });

  it("lists only what a normal user may use", () => {
    const names = buildCatalog("user").map((c) => c.intent);
    expect(names).not.toContain("top_owners");
    expect(names).not.toContain("popular_books");
    expect(names).not.toContain("count_users");
    const text = JSON.stringify(buildCatalog("user"));
    expect(text).not.toContain("ownerName");
    expect(text).not.toContain("scope");
    expect(JSON.stringify(buildCatalog("admin"))).toContain("ownerName");
  });

  it("hides admin-only examples from normal users", () => {
    const user = buildMessages("hello", "user")[0].content;
    const admin = buildMessages("hello", "admin")[0].content;
    expect(user).not.toContain("top_owners");
    expect(admin).toContain("top_owners");
  });

  it("has fixed examples that are valid and that really need the LLM", () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(3);
    for (const example of EXAMPLES) {
      expect(INTENTS[example.answer.intent]).toBeDefined();
      expect(validateIntent(example.answer.intent, example.answer.params).ok).toBe(true);
      expect(parseQuestion(example.question)).toBeNull(); // the rules do not already handle it
    }
  });
});

describe("LLM rate-limit counter", () => {
  it("allows the limit per user in a window, then blocks, then resets", () => {
    let time = 0;
    const hit = createWindowCounter({ ...LLM_RATE_LIMIT, now: () => time });
    for (let i = 0; i < LLM_RATE_LIMIT.limit; i++) expect(hit(1)).toBe(true);
    expect(hit(1)).toBe(false);
    expect(hit(2)).toBe(true); // another user is not affected
    time += LLM_RATE_LIMIT.windowMs;
    expect(hit(1)).toBe(true);
  });

  it("is stricter than the overall AI limit", () => {
    expect(LLM_RATE_LIMIT.limit).toBe(10);
  });
});
