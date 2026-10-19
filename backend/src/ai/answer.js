// Builds the answer from the result rows: a table, a number or a message. The wording is fixed here;
// nothing in an answer is written by an LLM. Prices and counts are numbers, statuses use API names.
// Shape: { type, title, summary, columns, rows } (+ value and format for numbers, suggestions for messages).
import { MAX_ROWS, examplesFor } from "./intents.js";

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const money = (value) => value.toFixed(2);

// columns: [{ key, label, type }] where type is text | number | price | status (so the UI can format it)
const col = (key, label, type = "text") => ({ key, label, type });

function table(title, summary, columns, rows) {
  return { type: "table", title, summary, columns, rows: rows.slice(0, MAX_ROWS) };
}

function number(title, summary, value, format) {
  return { type: "number", title, summary, columns: [], rows: [], value, format };
}

export function message(title, summary, suggestions = []) {
  return { type: "message", title, summary, columns: [], rows: [], suggestions };
}

// "I can't answer that", with examples for the caller's role
export function unsupportedAnswer(role) {
  return message(
    "I can't answer that",
    "I don't understand that question yet. Here are some questions I can answer:",
    examplesFor(role),
  );
}

// A normal user asked about other users, owners or popularity
export function adminOnlyAnswer(role) {
  return message(
    "That question is for admins",
    "Questions about other users, who owns the most books or which books are popular can only be asked by admins. Here are questions you can ask:",
    examplesFor(role),
  );
}

// "Your" for a normal user (or an admin asking about their own books), "The library's" for an admin looking at everything
function possessive(params, user) {
  return user.role !== "admin" || params.scope === "mine" ? "Your" : "The library's";
}

// The filters of a question as text, e.g. ' (status completed, genre "fantasy", price up to 20)'
function filterText(params) {
  const parts = [];
  if (params.status) parts.push(`status ${params.status}`);
  if (params.genre) parts.push(`genre "${params.genre}"`);
  if (params.author) parts.push(`author "${params.author}"`);
  if (params.minPrice !== undefined && params.maxPrice !== undefined) parts.push(`price ${params.minPrice} to ${params.maxPrice}`);
  else if (params.minPrice !== undefined) parts.push(`price from ${params.minPrice}`);
  else if (params.maxPrice !== undefined) parts.push(`price up to ${params.maxPrice}`);
  if (params.ownerName) parts.push(`owner "${params.ownerName}"`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

const SORT_TEXT = {
  "price:desc": "most expensive first",
  "price:asc": "cheapest first",
  "createdAt:desc": "newest first",
  "createdAt:asc": "oldest first",
  "title:asc": "A to Z",
  "title:desc": "Z to A",
};

const STAT_TITLES = {
  count: "Number of books",
  sum_price: "Total value",
  avg_price: "Average price",
  min_price: "Lowest price",
  max_price: "Highest price",
};

const STAT_WORDS = {
  sum_price: "total value",
  avg_price: "average price",
  min_price: "lowest price",
  max_price: "highest price",
};

const builders = {
  list_books(params, result) {
    const columns = [
      col("title", "Title"),
      col("author", "Author"),
      col("genre", "Genre"),
      col("status", "Status", "status"),
      col("price", "Price", "price"),
      ...(result.showOwner ? [col("owner", "Owner")] : []),
    ];
    const shown = result.books.length;
    let summary = "No books match your question.";
    if (shown > 0) {
      const lead = shown === result.total ? `Found ${plural(shown, "book")}` : `Showing ${shown} of ${plural(result.total, "book")}`;
      summary = `${lead}${filterText(params)}, ${SORT_TEXT[`${params.sort}:${params.order}`]}.`;
    }
    return table("Books", summary, columns, result.books);
  },

  book_stats(params, result) {
    const filters = filterText(params);
    if (params.metric === "count") {
      return number("Number of books", `${plural(result.value, "book")} match${result.value === 1 ? "es" : ""}${filters}.`, result.value, "count");
    }
    if (result.value === null) {
      return message(STAT_TITLES[params.metric], `No books match${filters}, so there is no ${STAT_WORDS[params.metric]}.`);
    }
    return number(
      STAT_TITLES[params.metric],
      `The ${STAT_WORDS[params.metric]} of the ${plural(result.count, "matching book")}${filters} is ${money(result.value)}.`,
      result.value,
      "price",
    );
  },

  top_genres(params, result, user) {
    const rows = result.items.map((item) => ({ genre: item.genre, books: item.count }));
    const first = rows[0];
    const summary = first
      ? `${possessive(params, user)} most common genre is ${first.genre} (${plural(first.books, "book")}).`
      : "There are no books yet.";
    return table("Top genres", summary, [col("genre", "Genre"), col("books", "Books", "number")], rows);
  },

  top_authors(params, result, user) {
    const rows = result.items.map((item) => ({ author: item.author, books: item.count }));
    const first = rows[0];
    const summary = first
      ? `${possessive(params, user)} most common author is ${first.author} (${plural(first.books, "book")}).`
      : "There are no books yet.";
    return table("Top authors", summary, [col("author", "Author"), col("books", "Books", "number")], rows);
  },

  status_breakdown(params, result) {
    const { counts, total } = result;
    const rows = ["reading", "completed", "to-read"].map((status) => ({ status, books: counts[status] }));
    const summary = total
      ? `${plural(total, "book")}: ${counts.reading} reading, ${counts.completed} completed, ${counts["to-read"]} to-read.`
      : "There are no books yet.";
    return table("Books by status", summary, [col("status", "Status", "status"), col("books", "Books", "number")], rows);
  },

  top_owners(params, result) {
    const first = result.owners[0];
    const summary = first ? `${first.name} owns the most books (${first.books}).` : "No user owns any books yet.";
    return table(
      "Top owners",
      summary,
      [col("name", "Name"), col("email", "Email"), col("books", "Books", "number")],
      result.owners,
    );
  },

  popular_books(params, result) {
    const first = result.books[0];
    let summary = "There are no books yet.";
    if (first) {
      summary = `"${first.title}" is the most popular book, owned by ${plural(first.owners, "user")}.`;
      if (first.owners === 1) summary += " No book is owned by several users yet.";
    }
    return table("Popular books", summary, [col("title", "Title"), col("owners", "Owners", "number")], result.books);
  },

  count_users(params, result) {
    const summary = `There ${result.users === 1 ? "is" : "are"} ${plural(result.users, "registered user")}, ${result.admins} of them admin${result.admins === 1 ? "" : "s"}.`;
    return number("Number of users", summary, result.users, "count");
  },
};

// name = the intent, params = validated parameters, result = what executor.js returned, user = req.user
export function buildAnswer(name, params, result, user) {
  return builders[name](params, result, user);
}
