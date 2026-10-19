// Math for the books-by-status donut chart. The ring has a circumference of 100, so the length of
// a segment equals its share in percent.
export const STATUS_ORDER = ["reading", "completed", "to-read"];

// counts = { reading, completed, "to-read" } -> one entry per status, in a fixed order:
//   count   = the exact number of books
//   percent = share rounded to a whole number (the counts are always shown too)
//   length  = exact share of the ring (0-100), offset = where the segment starts (0-100)
export function donutSegments(counts) {
  const total = STATUS_ORDER.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
  let offset = 0;

  return STATUS_ORDER.map((key) => {
    const count = counts[key] ?? 0;
    const length = total ? (count / total) * 100 : 0;
    const segment = { key, count, percent: Math.round(length), length, offset };
    offset += length;
    return segment;
  });
}
