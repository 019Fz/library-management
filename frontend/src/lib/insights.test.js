import { describe, expect, it } from "vitest";
import {
  bucketBars,
  completionPercent,
  describeSegments,
  parseInsightsParams,
  percentLabel,
  reasonText,
  scaleBars,
  stackedSegments,
} from "./insights.js";

const sum = (list) => list.reduce((total, n) => total + n, 0);
const percents = (counts) => stackedSegments(counts).map((s) => s.percent);

describe("stackedSegments", () => {
  it("returns the statuses in a fixed order with exact counts", () => {
    const segments = stackedSegments({ reading: 6, completed: 10, "to-read": 8 });
    expect(segments.map((s) => s.key)).toEqual(["completed", "reading", "to-read"]);
    expect(segments.map((s) => s.count)).toEqual([10, 6, 8]);
    expect(segments.map((s) => s.label)).toEqual(["Completed", "Reading", "To read"]);
    expect(segments.map((s) => s.percent)).toEqual([42, 25, 33]);
  });

  it("always makes the percents add up to exactly 100", () => {
    const cases = [
      { reading: 1, completed: 1, "to-read": 1 }, // 33.3 each
      { reading: 2, completed: 3, "to-read": 3 }, // 25 / 37.5 / 37.5
      { reading: 1, completed: 1, "to-read": 0 },
      { reading: 7, completed: 11, "to-read": 13 },
      { reading: 999, completed: 1, "to-read": 1 },
      { reading: 0, completed: 0, "to-read": 5 },
    ];
    for (const counts of cases) expect(sum(percents(counts))).toBe(100);
  });

  it("gives the extra point to the biggest remainder, and to the earlier status on a tie", () => {
    expect(percents({ reading: 1, completed: 1, "to-read": 1 })).toEqual([34, 33, 33]);
    expect(percents({ reading: 2, completed: 3, "to-read": 3 })).toEqual([38, 25, 37]);
  });

  it("handles one status only", () => {
    expect(percents({ reading: 0, completed: 0, "to-read": 5 })).toEqual([0, 0, 100]);
  });

  it("returns zeros for no books and tolerates missing or bad values", () => {
    for (const counts of [{ reading: 0, completed: 0, "to-read": 0 }, {}, undefined, null]) {
      const segments = stackedSegments(counts);
      expect(segments.map((s) => s.percent)).toEqual([0, 0, 0]);
      expect(segments.map((s) => s.width)).toEqual([0, 0, 0]);
    }
    expect(percents({ completed: "x", reading: -3, "to-read": 2 })).toEqual([0, 0, 100]);
  });

  it("keeps the exact share for the bar width", () => {
    const [completed, reading, toRead] = stackedSegments({ reading: 1, completed: 1, "to-read": 1 });
    expect(completed.width).toBeCloseTo(33.333, 2);
    expect(completed.width + reading.width + toRead.width).toBeCloseTo(100, 5);
  });
});

describe("completionPercent", () => {
  it("is the same number as the Completed legend entry", () => {
    const cases = [
      { reading: 6, completed: 10, "to-read": 8 },
      { reading: 1, completed: 1, "to-read": 1 }, // plain rounding would say 33, the legend says 34
      { reading: 2, completed: 3, "to-read": 3 },
      { reading: 0, completed: 0, "to-read": 0 },
      { reading: 0, completed: 4, "to-read": 0 },
    ];
    for (const counts of cases) {
      const legend = stackedSegments(counts).find((s) => s.key === "completed").percent;
      expect(completionPercent(counts)).toBe(legend);
    }
    expect(completionPercent({ reading: 1, completed: 1, "to-read": 1 })).toBe(34);
    expect(completionPercent({ reading: 0, completed: 0, "to-read": 0 })).toBe(0);
  });
});

describe("describeSegments", () => {
  it("lists every status with its count and percent", () => {
    const text = describeSegments(stackedSegments({ reading: 6, completed: 10, "to-read": 8 }));
    expect(text).toBe("Completed 10 (42%), Reading 6 (25%), To read 8 (33%)");
  });
});

describe("scaleBars and bucketBars", () => {
  it("scales to the biggest count", () => {
    const bars = scaleBars([{ count: 380 }, { count: 760 }, { count: 82 }]);
    expect(bars.map((b) => b.percent)).toEqual([50, 100, 11]);
  });

  it("gives every bar 0 when all counts are 0 (no NaN)", () => {
    expect(scaleBars([{ count: 0 }, { count: 0 }]).map((b) => b.percent)).toEqual([0, 0]);
    expect(bucketBars([{ label: "<10", count: 0 }, { label: "50+", count: 0 }]).map((b) => b.percent)).toEqual([0, 0]);
  });

  it("keeps a small value visible, and handles bad input", () => {
    expect(scaleBars([{ count: 1 }, { count: 1000 }])[0].percent).toBe(4);
    expect(scaleBars(undefined)).toEqual([]);
    expect(bucketBars(null)).toEqual([]);
  });

  it("turns the five API buckets into readable bars", () => {
    const bars = bucketBars([
      { label: "<10", count: 5 },
      { label: "10-20", count: 10 },
      { label: "20-30", count: 0 },
      { label: "30-50", count: 2 },
      { label: "50+", count: 1 },
    ]);
    expect(bars.map((b) => b.label)).toEqual(["Under 10", "10-20", "20-30", "30-50", "50+"]);
    expect(bars.map((b) => b.count)).toEqual([5, 10, 0, 2, 1]);
    expect(bars.map((b) => b.percent)).toEqual([50, 100, 0, 20, 10]);
  });
});

describe("percentLabel", () => {
  it("rounds and clamps", () => {
    expect(percentLabel(42)).toBe("42%");
    expect(percentLabel(41.6)).toBe("42%");
    expect(percentLabel(0)).toBe("0%");
    expect(percentLabel(120)).toBe("100%");
    expect(percentLabel(-5)).toBe("0%");
  });

  it("treats anything that is not a number as 0", () => {
    for (const bad of [undefined, null, NaN, "abc"]) expect(percentLabel(bad)).toBe("0%");
  });
});

describe("parseInsightsParams", () => {
  const params = (query) => new URLSearchParams(query);

  it("makes a normal user always see their own view, whatever the URL says", () => {
    for (const query of ["", "view=user&userId=5", "view=platform", "userId=9"]) {
      expect(parseInsightsParams(params(query), "user")).toEqual({ mode: "self", userId: null });
    }
  });

  it("shows the platform to an admin by default and for bad views", () => {
    for (const query of ["", "view=platform", "view=other", "view=", "userId=5", "view=USER"]) {
      expect(parseInsightsParams(params(query), "admin")).toEqual({ mode: "platform", userId: null });
    }
  });

  it("reads view=user and a valid user id", () => {
    expect(parseInsightsParams(params("view=user&userId=7"), "admin")).toEqual({ mode: "user", userId: 7 });
    expect(parseInsightsParams(params("view=user&userId=2147483647"), "admin")).toEqual({ mode: "user", userId: 2147483647 });
  });

  it("shows the user picker when the id is missing or bad", () => {
    for (const query of ["view=user", "view=user&userId=", "view=user&userId=abc", "view=user&userId=0", "view=user&userId=-1", "view=user&userId=1.5", "view=user&userId=99999999999", "view=user&userId=07"]) {
      expect(parseInsightsParams(params(query), "admin")).toEqual({ mode: "user", userId: null });
    }
  });
});

describe("reasonText", () => {
  it("uses the backend reason", () => {
    expect(reasonText({ reason: "Owned by 14 readers. Fantasy is your top genre.", owners: 14 })).toBe(
      "Owned by 14 readers. Fantasy is your top genre.",
    );
  });

  it("falls back to a sentence built from the owners", () => {
    expect(reasonText({ reason: "", owners: 3 })).toBe("Owned by 3 readers.");
    expect(reasonText({ owners: 1 })).toBe("Owned by 1 reader.");
    expect(reasonText({ reason: "   ", owners: 2 })).toBe("Owned by 2 readers.");
  });

  it("never throws on odd items", () => {
    expect(reasonText(undefined)).toBe("Popular with other readers.");
    expect(reasonText({})).toBe("Popular with other readers.");
    expect(reasonText({ owners: 0 })).toBe("Popular with other readers.");
  });
});
