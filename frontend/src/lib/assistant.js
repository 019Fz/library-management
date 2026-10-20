// Pure helpers for the assistant widget (no React, easy to test).
import { formatCount, formatPrice, STATUS_LABELS } from "./format.js";

export const MAX_QUESTION_LENGTH = 300;
export const MAX_MESSAGES = 50;
export const DEFAULT_RETRY_SECONDS = 30;
const MAX_RETRY_SECONDS = 300;

// Is this a usable value to show? (text that is not empty, or a finite number)
const hasText = (value) => typeof value === "string" && value.trim() !== "";
const hasNumber = (value) => typeof value === "number" && Number.isFinite(value);

// Plain words for the filters that list_books and book_stats share
function filterWords(params) {
  const words = [];
  if (params.scope === "mine") words.push("your books only");
  if (hasText(params.ownerName)) words.push(`owned by ${params.ownerName}`);
  if (hasText(params.status)) words.push(`status: ${STATUS_LABELS[params.status] ?? params.status}`);
  if (hasText(params.genre)) words.push(`genre: ${params.genre}`);
  if (hasText(params.author)) words.push(`author: ${params.author}`);
  if (hasNumber(params.minPrice) && hasNumber(params.maxPrice)) {
    words.push(`price from ${formatPrice(params.minPrice)} to ${formatPrice(params.maxPrice)}`);
  } else if (hasNumber(params.minPrice)) {
    words.push(`price over ${formatPrice(params.minPrice)}`);
  } else if (hasNumber(params.maxPrice)) {
    words.push(`price under ${formatPrice(params.maxPrice)}`);
  }
  return words;
}

// "price, highest first" / "title, A to Z" / "date added, newest first"
const SORT_WORDS = {
  price: { name: "price", asc: "lowest first", desc: "highest first" },
  title: { name: "title", asc: "A to Z", desc: "Z to A" },
  createdAt: { name: "date added", asc: "oldest first", desc: "newest first" },
};

function sortWords(params) {
  const sort = Object.hasOwn(SORT_WORDS, params.sort) ? SORT_WORDS[params.sort] : null;
  if (!sort) return null;
  const order = params.order === "asc" ? "asc" : "desc";
  return `sorted by ${sort.name}, ${sort[order]}`;
}

const METRIC_WORDS = {
  count: "Counting books",
  sum_price: "Adding up book prices",
  avg_price: "Average book price",
  min_price: "Lowest book price",
  max_price: "Highest book price",
};

// "Top 5 genres" / "Top genres"
const topLabel = (params, noun) => (hasNumber(params.limit) ? `Top ${params.limit} ${noun}` : `Top ${noun}`);

// The "Understood as" text: the intent name and its main parameters in plain words
export function describeIntent(intent, params) {
  const p = params && typeof params === "object" ? params : {};
  let base;
  let extras = [];

  switch (intent) {
    case "list_books":
      base = "Listing books";
      extras = filterWords(p);
      if (sortWords(p)) extras.push(sortWords(p));
      if (hasNumber(p.limit)) extras.push(`up to ${p.limit}`);
      break;
    case "book_stats":
      base = Object.hasOwn(METRIC_WORDS, p.metric) ? METRIC_WORDS[p.metric] : METRIC_WORDS.count;
      extras = filterWords(p);
      break;
    case "top_genres":
      base = topLabel(p, "genres");
      extras = p.scope === "mine" ? ["your books only"] : [];
      break;
    case "top_authors":
      base = topLabel(p, "authors");
      extras = p.scope === "mine" ? ["your books only"] : [];
      break;
    case "status_breakdown":
      base = "Books by status";
      extras = p.scope === "mine" ? ["your books only"] : [];
      break;
    case "top_owners":
      base = "Users with the most books";
      if (hasNumber(p.limit)) extras = [`up to ${p.limit}`];
      break;
    case "popular_books":
      base = "Most popular books";
      if (hasNumber(p.limit)) extras = [`up to ${p.limit}`];
      break;
    case "count_users":
      base = "Counting users";
      break;
    case "unsupported":
      base = "Not understood";
      break;
    default:
      // A name this version does not know: show it readably instead of failing
      base = hasText(intent) ? intent.replaceAll("_", " ") : "Unknown request";
  }

  return extras.length > 0 ? `${base} (${extras.join(", ")})` : base;
}

// "rules" or "AI", from understood.source
export function sourceLabel(source) {
  return source === "llm" ? "AI" : "rules";
}

// One table cell as text. The column type comes from the API: text, number, price or status.
export function formatCell(value, type) {
  if (value === null || value === undefined || value === "") return "-";
  if (type === "price" || type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return type === "price" ? formatPrice(number) : formatCount(number);
  }
  if (type === "status") return STATUS_LABELS[value] ?? String(value);
  return String(value);
}

// Seconds to wait after a 429, from the Retry-After header. Missing or invalid -> the default.
export function parseRetryAfter(value) {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d+(\.\d+)?$/.test(text)) return DEFAULT_RETRY_SECONDS;
  const seconds = Math.ceil(Number(text));
  if (seconds < 1) return DEFAULT_RETRY_SECONDS;
  return Math.min(seconds, MAX_RETRY_SECONDS);
}

// Seconds to wait for a 429 answer. Browsers hide Retry-After from other origins unless the server
// exposes it, so when the header is not readable, fall back to the number in the message
// ("Too many requests. Try again in 12 seconds.").
export function retrySecondsFrom(headerValue, bodyMessage) {
  const fromHeader = parseRetryAfter(headerValue);
  if (fromHeader !== DEFAULT_RETRY_SECONDS || headerValue !== undefined) return fromHeader;
  const match = typeof bodyMessage === "string" ? bodyMessage.match(/in (\d{1,4}) seconds?/) : null;
  return match ? parseRetryAfter(match[1]) : DEFAULT_RETRY_SECONDS;
}

// Which example questions to show as chips.
// Empty conversation: all of them. Later: up to 3 not asked yet. While waiting: none.
export function chipsToShow({ examples, messages, busy }) {
  if (busy || !Array.isArray(examples) || examples.length === 0) return [];
  const asked = new Set(
    (messages ?? []).filter((m) => m.role === "user").map((m) => String(m.text).trim().toLowerCase()),
  );
  const fresh = examples.filter((example) => !asked.has(example.trim().toLowerCase()));
  return asked.size === 0 ? fresh : fresh.slice(0, 3);
}

// Keep only the newest messages so a long session cannot grow without limit
export function capMessages(messages) {
  return messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
}
