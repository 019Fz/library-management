// Rule-based parser: question text -> { intent, params } or null. Pure functions, no database.
// It only decides WHAT is asked; the parameters are validated later (intents.js) and the data is
// fetched by fixed queries (executor.js). Nothing here ever becomes SQL.
//
// Known limits: genres and authors are guessed from the phrasing ("fantasy books", "genre X",
// "books by X"), so a multi-word genre works best as "genre science fiction".
import { MAX_ROWS } from "./intents.js";

const MAX_LENGTH = 300;

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
// A number as digits ("5", "12.50") or a word (one to ten), after an optional $
const NUM = String.raw`\$?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)`;

// ---------- text helpers ----------

// raw keeps the original letters (for names), lower is for matching keywords. Punctuation is removed,
// except hyphens and apostrophes inside words and dots inside numbers.
export function normalise(text) {
  const raw = String(text ?? "")
    .slice(0, MAX_LENGTH)
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}$'\-.\s]/gu, " ")
    .replace(/[.\-']+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { raw, lower: raw.toLowerCase() };
}

// "5", "12.5" or "five" -> number, anything else -> null
export function parseNumber(token) {
  const word = String(token).toLowerCase();
  if (Object.hasOwn(NUMBER_WORDS, word)) return NUMBER_WORDS[word];
  const number = Number(word);
  return Number.isFinite(number) ? number : null;
}

// Regex built from a string (case-insensitive, unicode)
const re = (source) => new RegExp(source, "iu");
const anyMatch = (patterns, text) => patterns.some((pattern) => pattern.test(text));

// ---------- which intent? ----------

const SORT_WORDS = re(String.raw`\b(expensive|cheap\w*|priciest|costliest|newest|oldest|latest|sorted|price\w*)\b`);
const BOOK_NOUN = re(String.raw`\b(books?|titles?|novels?)\b`);

const TOP_OWNERS = [
  // (the negative lookahead keeps "who has the most expensive books" out of this intent)
  re(String.raw`\bwho\s+(owns|has|got|holds)\s+(the\s+)?(most|largest|biggest|highest|greatest)\b(?!\s+(expensive|costly|recent))`),
  re(String.raw`\bwhich\s+(user|person|member|reader|account)s?\s+(owns?|has|have)\s+(the\s+)?(most|largest|biggest|highest)\b(?!\s+(expensive|costly|recent))`),
  re(String.raw`\btop\s+(\w+\s+)?(owners|collectors|users)\b`),
  re(String.raw`\b(users?|owners?|people|readers)\s+(with|having|who (own|have))\s+(the\s+)?most\s+books\b`),
  re(String.raw`\b(biggest|largest)\s+(collection|library)\b`),
];

const POPULAR_BOOKS = [
  re(String.raw`\bpopular\s+(books?|titles?)\b`),
  re(String.raw`\bmost\s+(popular|owned|common|shared)\s+(books?|titles?)\b`),
  re(String.raw`\bwhich\s+(is|are)\s+(the\s+)?most\s+(popular|owned|common)\b`),
  re(String.raw`\bwhat('s|\s+is)\s+the\s+most\s+(popular|owned)\b`),
  re(String.raw`\bwhich\s+books?\s+(is|are|do|does)\b.*\b(popular|most\s+(people|users|readers))\b`),
  re(String.raw`\bbooks?\s+(owned|shared)\s+by\s+(the\s+)?most\s+(users|people)\b`),
];

const COUNT_USERS = [
  re(String.raw`\bhow\s+many\s+(users|people|members|readers|accounts)\b`),
  re(String.raw`\b(number|count|total)\s+of\s+(registered\s+)?(users|people|members|accounts)\b`),
  re(String.raw`\b(total\s+users|user\s+count)\b`),
];

const STATUS_BREAKDOWN = [
  re(String.raw`\b(by|per|each|every)\s+(reading\s+)?status\b`),
  re(String.raw`\bstatus\s+(breakdown|summary|overview|split|distribution)\b`),
  re(String.raw`\bbreak\s?down\b`),
  re(String.raw`\bhow\s+are\s+my\s+books\s+(split|divided|distributed)\b`),
  re(String.raw`\bsplit\b.*\bstatus\b`),
];

// "top genres", "favourite genre", "which genre has the most books", "what genres do I read most"
function asksForRanking(lower, noun) {
  if (SORT_WORDS.test(lower)) return false; // "the most expensive books in the fantasy genre" is a list
  return anyMatch(
    [
      re(String.raw`\b(top|favou?rite|best|most\s+(common|popular|frequent|read))\b.*\b(${noun})\b`),
      re(String.raw`\b(${noun})\b.*\b(most|top|popular|common|favou?rite|often|frequently)\b`),
      re(String.raw`^(show|list|give|what\s+are|what's)\b(?!.*\bbooks?\b).*\b(${noun})\b`),
    ],
    lower,
  );
}

// book_stats: which number is asked for? null when it is not a statistics question
function detectMetric(lower) {
  if (/\b(average|mean|avg)\b/.test(lower) && /\b(price|prices|cost|costs)\b/.test(lower)) return "avg_price";
  if (anyMatch([re(String.raw`\b(lowest|minimum|min|smallest|cheapest)\b.*\bprice\b`), re(String.raw`\bprice\b.*\b(lowest|minimum|smallest)\b`)], lower)) {
    return "min_price";
  }
  if (anyMatch([re(String.raw`\b(highest|maximum|max|largest|biggest|most\s+expensive)\b.*\bprice\b`), re(String.raw`\bprice\b.*\b(highest|maximum|largest)\b`)], lower)) {
    return "max_price";
  }
  const sum = [
    re(String.raw`\b(total|combined|overall|entire|whole)\b.*\b(value|worth|cost|price|prices|spent)\b`),
    re(String.raw`\bhow\s+much\b`),
    re(String.raw`\b(value|worth)\s+of\s+(my|all|the|our)\b`),
    re(String.raw`\b(what|how)\b.*\bworth\b`),
    re(String.raw`\bsum\b.*\bprices?\b`),
  ];
  if (anyMatch(sum, lower)) return "sum_price";
  const count = [
    re(String.raw`\bhow\s+many\b.*\b(books?|titles?|novels?)\b`),
    re(String.raw`\b(number|count|total)\s+of\b.*\b(books?|titles?)\b`),
    re(String.raw`\bcount\s+(my\s+|all\s+|the\s+)?(books?|titles?)\b`),
  ];
  return anyMatch(count, lower) ? "count" : null;
}

// list_books: a book word plus a request verb, a superlative or a "my/all/the" start
function isListQuestion(lower) {
  if (!BOOK_NOUN.test(lower)) return false;
  const verb = re(String.raw`\b(show|list|give|find|get|display|fetch|name|search)\b`);
  const question = re(String.raw`\b(what|which)\b.*\bbooks?\b`);
  const superlative = re(String.raw`\b(most\s+expensive|least\s+expensive|cheapest|priciest|costliest|expensive|newest|oldest|latest|most\s+recent|recently\s+added|alphabetical)\b`);
  // A start like "books by Tolkien" or "my books" counts, but a lone "books" is too vague
  const start = /^(my|all|the|every|books?|novels?|titles?)\b/.test(lower) && lower.includes(" ");
  return anyMatch([verb, question, superlative], lower) || start;
}

// Returns the intent name, or null when nothing matches
export function detectIntent(lower) {
  if (!lower) return null;
  if (anyMatch(TOP_OWNERS, lower)) return "top_owners";
  if (asksForRanking(lower, "genres?")) return "top_genres";
  if (asksForRanking(lower, "authors?|writers?")) return "top_authors";
  if (anyMatch(POPULAR_BOOKS, lower)) return "popular_books";
  if (anyMatch(COUNT_USERS, lower)) return "count_users";
  if (anyMatch(STATUS_BREAKDOWN, lower)) return "status_breakdown";
  const metric = detectMetric(lower);
  // "list books from the lowest price" asks for a list sorted by price, not for the lowest price itself
  const asksForList = /^(show|list|give|find|get|display|fetch)\b/.test(lower) && /\bbooks\b/.test(lower);
  if (metric && !(asksForList && (metric === "min_price" || metric === "max_price"))) return "book_stats";
  if (isListQuestion(lower)) return "list_books";
  return null;
}

// ---------- parameters ----------

// Words that can stand in front of "books" without being a genre
const NOT_A_GENRE = new Set(
  (
    "my all the a an our your their his her its of and or any every each some those these this that other same different such " +
    "many much more most few less least top best worst first last next new old newest oldest latest recent recently expensive " +
    "cheap cheapest cheaper pricier priciest costliest costly popular favourite favorite good great long short total entire whole " +
    "overall number count completed finished done reading unread read started owned own show list give find get display see fetch " +
    "name tell me us have has had do does did are is was were be how what which who whose where when there here with without for " +
    "from by in on at to than under over above below between books book titles title novels novel library collection things items " +
    "available price priced paid cost one two three four five six seven eight nine ten users user people"
  ).split(" "),
);

// (possessives like "everyone's" or "Mia's" are never genres)
const isGenreWord = (word) => word && !NOT_A_GENRE.has(word) && !/^[\d$]/.test(word) && !word.endsWith("'s");

// Words that end a captured name ("books by Tolkien under 20" -> "Tolkien")
const NAME_END = new Set(
  (
    "with that who which and under over above below in on at sorted ordered priced costing cheaper more less between do does " +
    "have has are is where by for from to than the as of or"
  ).split(" "),
);
const NAME_PATTERN = String.raw`(\p{L}[\p{L}\p{N}'-]*(?:\s+\p{L}[\p{L}\p{N}'-]*){0,3})`;
const NOT_A_NAME = new Set("status price title author date genre name cost year rating owner popularity id me myself i my".split(" "));

// Cuts a captured phrase at the first connector word and returns it (or null)
function takeName(phrase) {
  const words = [];
  for (const word of phrase.split(" ")) {
    if (NAME_END.has(word.toLowerCase())) break;
    words.push(word);
  }
  const name = words.join(" ");
  return name && !NOT_A_NAME.has(name.toLowerCase()) ? name : null;
}

function nameAfter(raw, triggers) {
  const match = re(String.raw`\b(?:${triggers})\s+${NAME_PATTERN}`).exec(raw);
  return match ? takeName(match[1]) : null;
}

function statusFrom(lower) {
  if (/\b(to[- ]read|unread|not\s+(yet\s+)?read|haven't\s+read|have\s+not\s+read|want\s+to\s+read|backlog|wishlist)\b/.test(lower)) return "to-read";
  if (/\b(currently\s+reading|am\s+reading|i'm\s+reading|im\s+reading|reading|in\s+progress|started)\b/.test(lower)) return "reading";
  if (/\b(completed|finished|done|read)\b/.test(lower)) return "completed";
  return undefined;
}

// "fantasy books", "genre fantasy", "in the sci-fi genre"
function genreFrom(raw, lower) {
  const phrase =
    re(String.raw`\b(?:in|of|from|under)\s+(?:the\s+)?(\S+(?:\s\S+)?)\s+genre\b`).exec(raw) ??
    re(String.raw`\bgenre\s*(?:is|=|:|of|named|called)?\s*(\S+(?:\s\S+)?)`).exec(raw);
  if (phrase) {
    const words = phrase[1].toLowerCase().split(" ").filter(isGenreWord);
    if (words.length) return words.join(" ");
  }

  // The (up to two) words just before a book word, if they are not ordinary words
  const tokens = lower.split(" ");
  for (let i = 1; i < tokens.length; i += 1) {
    if (!/^(books?|novels?|titles?)$/.test(tokens[i])) continue;
    const words = [];
    for (let j = i - 1; j >= Math.max(0, i - 2) && isGenreWord(tokens[j]); j -= 1) words.unshift(tokens[j]);
    if (words.length) return words.join(" ");
  }
  return undefined;
}

function priceFrom(raw) {
  const between = re(String.raw`\bbetween\s+${NUM}(?:\s+dollars?)?\s+and\s+${NUM}\b`).exec(raw);
  if (between) {
    const [a, b] = [parseNumber(between[1]), parseNumber(between[2])];
    return { minPrice: Math.min(a, b), maxPrice: Math.max(a, b) };
  }
  const result = {};
  const max = re(String.raw`\b(?:under|below|less\s+than|cheaper\s+than|lower\s+than|up\s+to|at\s+most|no\s+more\s+than|max(?:imum)?(?:\s+price)?(?:\s+of)?)\s+${NUM}\b`).exec(raw);
  const min = re(String.raw`\b(?:over|above|more\s+than|pricier\s+than|higher\s+than|at\s+least|no\s+less\s+than|min(?:imum)?(?:\s+price)?(?:\s+of)?)\s+${NUM}\b`).exec(raw);
  if (max) result.maxPrice = parseNumber(max[1]);
  if (min) result.minPrice = parseNumber(min[1]);
  return result;
}

function sortFrom(lower) {
  if (/\b(most\s+expensive|priciest|costliest|highest[- ]priced|highest\s+price|most\s+costly|expensive|price\s+(high\s+to\s+low|descending|desc))\b/.test(lower)) return { sort: "price", order: "desc" };
  if (/\b(cheapest|least\s+expensive|lowest[- ]priced|lowest\s+price|most\s+affordable|price\s+(low\s+to\s+high|ascending|asc))\b/.test(lower)) return { sort: "price", order: "asc" };
  if (/\b(newest|latest|most\s+recent|recently\s+added|recent)\b/.test(lower)) return { sort: "createdAt", order: "desc" };
  if (/\b(oldest|earliest|first\s+added)\b/.test(lower)) return { sort: "createdAt", order: "asc" };
  if (/\b(reverse\s+alphabetical|z[- ]a)\b/.test(lower)) return { sort: "title", order: "desc" };
  if (/\b(alphabetical(ly)?|a[- ]z|by\s+title|title\s+order)\b/.test(lower)) return { sort: "title", order: "asc" };
  if (/\bsorted\s+by\s+price\b/.test(lower)) return { sort: "price", order: "asc" };
  return {};
}

// "top 3", "five most expensive", "limit 10", "show 3 books"; clamped to 1..25
function limitFrom(lower, { singular = false } = {}) {
  const patterns = [
    String.raw`\b(?:top|first|best|biggest|largest|last|latest)\s+${NUM}\b`,
    String.raw`\b${NUM}\s+(?:most|least|cheapest|priciest|costliest|newest|oldest|latest|top|best|biggest|largest|highest|lowest|expensive|cheap|popular|common|recent)\b`,
    String.raw`\blimit(?:\s+to)?\s+${NUM}\b`,
    String.raw`\b(?:show|list|give|find|get|display|fetch)(?:\s+me)?(?:\s+the)?\s+${NUM}\b`,
    String.raw`\b${NUM}\s+(?:\S+\s+){0,2}(?:books?|titles?|novels?|genres?|authors?|owners?|users?)\b`,
  ];
  for (const pattern of patterns) {
    const match = re(pattern).exec(lower);
    const number = match ? Math.floor(parseNumber(match[1])) : null;
    if (number >= 1) return Math.min(number, MAX_ROWS);
  }
  // "the most expensive book" (singular) means one
  if (singular && /\b(most\s+expensive|least\s+expensive|cheapest|priciest|costliest|newest|oldest|latest|most\s+recent)\s+(\S+\s+){0,2}?(book|novel|title)\b/.test(lower)) return 1;
  return undefined;
}

// mine = first person ("my", "I"), all = "everyone", "all users"; undefined = not said (the default is "all")
function scopeFrom(lower) {
  if (/\b(everyone|everybody|every\s+user|all\s+(the\s+)?users|each\s+user)\b/.test(lower)) return "all";
  // "show me ..." is just polite, it does not mean "my books"
  const text = lower.replace(/\b(show|give|tell|get|find|list|bring|send)\s+me\b/g, "$1");
  if (/\b(my|mine|myself|i|i've|ive|i'm|im)\b/.test(text) || /\b(by|to)\s+me\b/.test(text)) return "mine";
  return undefined;
}

const OWNER_TRIGGERS = String.raw`owned\s+by|belonging\s+to|belongs\s+to|owner(?:\s+is|\s+named|\s+called)?|of\s+user|from\s+user|user\s+named|user\s+called`;
const AUTHOR_TRIGGERS = String.raw`written\s+by|authored\s+by|books?\s+by|titles?\s+by|novels?\s+by|by\s+author|author\s+named|author\s+called|author\s+is|author`;

// The filters shared by list_books and book_stats. Only what the question says is returned.
function bookFilters(raw, lower) {
  const filters = { scope: scopeFrom(lower), status: statusFrom(lower), genre: genreFrom(raw, lower), ...priceFrom(raw) };
  const author = nameAfter(raw, AUTHOR_TRIGGERS);
  if (author) filters.author = author;

  // "owned by Mia" is an admin question about another user; "owned by me" just means "mine"
  const owner = nameAfter(raw, OWNER_TRIGGERS);
  if (owner) filters.ownerName = owner;
  return filters;
}

const withoutUndefined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

function extractParams(intent, raw, lower) {
  switch (intent) {
    case "list_books":
      return withoutUndefined({ ...bookFilters(raw, lower), ...sortFrom(lower), limit: limitFrom(lower, { singular: true }) });
    case "book_stats":
      return withoutUndefined({ ...bookFilters(raw, lower), metric: detectMetric(lower) });
    case "top_genres":
    case "top_authors":
      return withoutUndefined({ scope: scopeFrom(lower), limit: limitFrom(lower) });
    case "status_breakdown":
      return withoutUndefined({ scope: scopeFrom(lower) });
    case "top_owners":
    case "popular_books":
      return withoutUndefined({ limit: limitFrom(lower) });
    default:
      return {};
  }
}

// The one function the rest of the code uses: { intent, params } or null
export function parseQuestion(text) {
  const { raw, lower } = normalise(text);
  const intent = detectIntent(lower);
  return intent ? { intent, params: extractParams(intent, raw, lower) } : null;
}
