import { expect, it } from "vitest";
import { relativeTime } from "../src/presentation.js";

it("uses the shipped App relative-time copy for millisecond timestamps", () => {
  const now = 100_000_000;
  expect(relativeTime(now - 8 * 60_000, now)).toBe("8m ago");
  expect(relativeTime(now + 8 * 60_000, now)).toBe("in 8m");
  expect(relativeTime(now - 30_000, now)).toBe("just now");
  expect(relativeTime(now - 86_400_000, now)).toBe("yesterday");
});
