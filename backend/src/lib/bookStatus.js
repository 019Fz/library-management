// The API says "to-read"; the Prisma enum says "to_read". This is the only place that converts.
const TO_DB = { "to-read": "to_read" };
const FROM_DB = { to_read: "to-read" };

// API value -> Prisma value (undefined stays undefined)
export function toDbStatus(status) {
  return TO_DB[status] ?? status;
}

// Prisma value -> API value
export function fromDbStatus(status) {
  return FROM_DB[status] ?? status;
}
