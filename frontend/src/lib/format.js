// How prices and statuses are shown. Change the currency here, in one place.
export const CURRENCY = "USD";

// One formatter, created once (uses the browser's language for number style)
const currencyFormat = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY });

export function formatPrice(value) {
  return currencyFormat.format(Number(value));
}

// Status names used by the API -> label shown to people
export const STATUS_LABELS = {
  reading: "Reading",
  completed: "Completed",
  "to-read": "To read",
};
