import { describe, it, expect } from "vitest";
import { generateRoomCode, pickColor } from "../src/infrastructure/ids.js";

describe("generateRoomCode", () => {
  it("produces adjective-noun-number codes", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    }
  });
});

describe("pickColor", () => {
  it("returns hex colors and cycles through the palette", () => {
    const first = pickColor(0);
    expect(first).toMatch(/^#[0-9a-f]{6}$/);
    // Palette has 10 entries; index 10 wraps back to index 0.
    expect(pickColor(10)).toBe(first);
    expect(pickColor(3)).not.toBe(pickColor(4));
  });
});
