// How prices and statuses are shown. Change the currency here, in one place.
export const CURRENCY = "USD";

// One formatter, created once (uses the browser's language for number style)
const currencyFormat = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY });

export function formatPrice(value) {
  return currencyFormat.format(Number(value));
}

// Whole numbers with the browser's thousands separator, e.g. 1,250
const countFormat = new Intl.NumberFormat();
export function formatCount(value) {
  return countFormat.format(Number(value));
}

// A date from the API (ISO text), e.g. "Oct 2, 2026"
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
export function formatDate(value) {
  return dateFormat.format(new Date(value));
}

// Status names used by the API -> label shown to people
export const STATUS_LABELS = {
  reading: "Reading",
  completed: "Completed",
  "to-read": "To read",
};
