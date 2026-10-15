// Checks and helpers for the add/edit book form. The backend validates again.
export const LIMITS = { title: 200, author: 150, genre: 50 };

// Up to 8 digits, optionally a dot and 1-2 decimals. 8 digits makes 99999999.99 the maximum.
const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

// "12.5" and "12.50" -> a number; anything else -> null
export function parsePrice(text) {
  const trimmed = String(text).trim();
  return PRICE_PATTERN.test(trimmed) ? Number(trimmed) : null;
}

// values: { title, author, genre, price (text), status }
// Returns { errors, book }. errors has one message per bad field; book is the trimmed payload.
export function validateBookForm(values) {
  const errors = {};
  const title = values.title.trim();
  const author = values.author.trim();
  const genre = values.genre.trim();

  if (!title) errors.title = "Enter a title.";
  else if (title.length > LIMITS.title) errors.title = `Title must be at most ${LIMITS.title} characters.`;

  if (!author) errors.author = "Enter an author.";
  else if (author.length > LIMITS.author) errors.author = `Author must be at most ${LIMITS.author} characters.`;

  if (!genre) errors.genre = "Enter a genre.";
  else if (genre.length > LIMITS.genre) errors.genre = `Genre must be at most ${LIMITS.genre} characters.`;

  const price = parsePrice(values.price);
  if (price === null) errors.price = "Enter a price like 12.50 (0 to 99999999.99, at most 2 decimals).";

  return { errors, book: { title, author, genre, price, status: values.status } };
}

// Only the fields of `next` that differ from `original`. An empty object means nothing changed.
export function buildPatch(original, next) {
  const patch = {};
  for (const key of ["title", "author", "genre", "status"]) {
    if (next[key] !== original[key]) patch[key] = next[key];
  }
  if (Number(next.price) !== Number(original.price)) patch.price = next.price;
  return patch;
}
