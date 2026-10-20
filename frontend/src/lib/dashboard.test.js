import { describe, expect, it } from "vitest";
import { attentionItems, chartBars, chartSummary, chartTotal, relativeTime, weeklyDeltaLabel } from "./dashboard.js";
import { formatDate, formatShortDay } from "./format.js";

const days = (counts) => counts.map((count, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, count }));

describe("chartBars", () => {
  it("scales the bars to the biggest day", () => {
    const bars = chartBars(days([0, 5, 10, 2]));
    expect(bars.map((b) => b.percent)).toEqual([0, 50, 100, 20]);
    expect(bars.map((b) => b.count)).toEqual([0, 5, 10, 2]);
    expect(bars.map((b) => b.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  });

  it("gives every bar height 0 when all days are 0 (no NaN)", () => {
    const bars = chartBars(days([0, 0, 0]));
    expect(bars.map((b) => b.percent)).toEqual([0, 0, 0]);
  });

  it("keeps a small day visible next to a big one", () => {
    const bars = chartBars(days([1, 1000]));
    expect(bars[0].percent).toBe(4);
    expect(bars[1].percent).toBe(100);
  });

  it("handles a single non-zero day and bad input", () => {
    expect(chartBars(days([0, 0, 7])).map((b) => b.percent)).toEqual([0, 0, 100]);
    expect(chartBars(undefined)).toEqual([]);
    expect(chartBars([])).toEqual([]);
  });
});

describe("chartTotal and chartSummary", () => {
  it("adds up the days", () => {
    expect(chartTotal(days([1, 2, 3]))).toBe(6);
    expect(chartTotal(undefined)).toBe(0);
  });

  it("lists every value with its date", () => {
    const text = chartSummary([
      { date: "2026-02-28", count: 3 },
      { date: "2026-03-01", count: 0 },
    ]);
    expect(text).toContain(`${formatShortDay("2026-02-28")}: 3`);
    expect(text).toContain(`${formatShortDay("2026-03-01")}: 0`);
    expect(text).toContain("last 2 days");
    expect(text).toContain("3 books in total");
  });
});

describe("formatShortDay", () => {
  it("keeps the UTC day", () => {
    expect(formatShortDay("2026-10-07")).toBe(new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date("2026-10-07T12:00:00Z")));
    expect(formatShortDay("2026-03-01")).not.toBe(formatShortDay("2026-02-28"));
  });
});

describe("weeklyDeltaLabel", () => {
  it("prints the word and the number", () => {
    expect(weeklyDeltaLabel(6)).toBe("+6 this week");
    expect(weeklyDeltaLabel(1210)).toBe(`+${new Intl.NumberFormat().format(1210)} this week`);
  });

  it("is null when there is nothing to show", () => {
    expect(weeklyDeltaLabel(0)).toBeNull();
    expect(weeklyDeltaLabel(-2)).toBeNull();
    expect(weeklyDeltaLabel(undefined)).toBeNull();
    expect(weeklyDeltaLabel(NaN)).toBeNull();
  });
});

describe("relativeTime", () => {
  const now = new Date(2026, 9, 20, 15, 0, 0); // local time: Oct 20 2026, 15:00
  const ago = (ms) => new Date(now.getTime() - ms).toISOString();

  it("says just now, minutes and hours", () => {
    expect(relativeTime(ago(59 * 1000), now)).toBe("Just now");
    expect(relativeTime(ago(60 * 1000), now)).toBe("1 min ago");
    expect(relativeTime(ago(59 * 60 * 1000), now)).toBe("59 min ago");
    expect(relativeTime(ago(2 * 60 * 60 * 1000), now)).toBe("2 h ago");
    expect(relativeTime(ago(23 * 60 * 60 * 1000), now)).toBe("23 h ago");
  });

  it("says yesterday for the previous calendar day, and the date after that", () => {
    expect(relativeTime(new Date(2026, 9, 19, 9, 0, 0).toISOString(), now)).toBe("Yesterday");
    const older = new Date(2026, 9, 17, 9, 0, 0).toISOString();
    expect(relativeTime(older, now)).toBe(formatDate(older));
  });

  it("treats a time in the future as just now and an invalid date as empty", () => {
    expect(relativeTime(new Date(now.getTime() + 5000).toISOString(), now)).toBe("Just now");
    expect(relativeTime("not a date", now)).toBe("");
    expect(relativeTime(undefined, now)).toBe("");
  });
});

describe("attentionItems", () => {
  it("hides items that are zero", () => {
    expect(attentionItems({ usersWithoutBooks: 0, newUsersLast48h: 0 })).toEqual([]);
    const onlyOne = attentionItems({ usersWithoutBooks: 7, newUsersLast48h: 0 });
    expect(onlyOne).toEqual([{ key: "no-books", text: "7 users have no books yet", to: "/users?sort=books&order=asc" }]);
  });

  it("shows both items with their links", () => {
    const items = attentionItems({ usersWithoutBooks: 7, newUsersLast48h: 4 });
    expect(items.map((i) => i.text)).toEqual(["7 users have no books yet", "4 users joined in the last 48 hours"]);
    expect(items.map((i) => i.to)).toEqual(["/users?sort=books&order=asc", "/users"]);
  });

  it("uses singular wording for 1", () => {
    const items = attentionItems({ usersWithoutBooks: 1, newUsersLast48h: 1 });
    expect(items.map((i) => i.text)).toEqual(["1 user has no books yet", "1 user joined in the last 48 hours"]);
  });

  it("gives nothing for missing data", () => {
    expect(attentionItems(undefined)).toEqual([]);
    expect(attentionItems(null)).toEqual([]);
    expect(attentionItems({})).toEqual([]);
  });
});
