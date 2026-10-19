import { describe, expect, it } from "vitest";
import { donutSegments } from "./donut.js";

describe("donutSegments", () => {
  it("returns the three statuses in a fixed order with exact counts", () => {
    const segments = donutSegments({ reading: 2, completed: 3, "to-read": 5 });
    expect(segments.map((s) => s.key)).toEqual(["reading", "completed", "to-read"]);
    expect(segments.map((s) => s.count)).toEqual([2, 3, 5]);
  });

  it("makes the segments fill the ring exactly, one after the other", () => {
    const segments = donutSegments({ reading: 2, completed: 3, "to-read": 5 });
    expect(segments.map((s) => s.length)).toEqual([20, 30, 50]);
    expect(segments.map((s) => s.offset)).toEqual([0, 20, 50]);
    expect(segments.reduce((sum, s) => sum + s.length, 0)).toBeCloseTo(100);
  });

  it("rounds the percentages", () => {
    const segments = donutSegments({ reading: 1, completed: 1, "to-read": 1 });
    expect(segments.map((s) => s.percent)).toEqual([33, 33, 33]);
  });

  it("gives an empty segment for a status with no books", () => {
    const [reading, completed, toRead] = donutSegments({ reading: 0, completed: 4, "to-read": 0 });
    expect(reading).toMatchObject({ count: 0, percent: 0, length: 0 });
    expect(completed).toMatchObject({ count: 4, percent: 100, length: 100 });
    expect(toRead.count).toBe(0);
  });

  it("handles no books at all and missing keys", () => {
    for (const segment of donutSegments({ reading: 0, completed: 0, "to-read": 0 })) {
      expect(segment).toMatchObject({ count: 0, percent: 0, length: 0, offset: 0 });
    }
    expect(donutSegments({}).every((segment) => segment.count === 0)).toBe(true);
  });
});
