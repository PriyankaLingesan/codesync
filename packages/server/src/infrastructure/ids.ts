/**
 * Room-code generation and participant color assignment.
 * Room codes are human-friendly and shareable ("indigo-otter-42").
 */

const ADJECTIVES = [
  "indigo",
  "amber",
  "crimson",
  "teal",
  "violet",
  "coral",
  "olive",
  "azure",
  "scarlet",
  "jade"
];

const NOUNS = [
  "otter",
  "falcon",
  "maple",
  "comet",
  "harbor",
  "willow",
  "lynx",
  "orbit",
  "pixel",
  "cedar"
];

/** A distinct, readable palette for cursors and name labels. */
const PALETTE = [
  "#e57373",
  "#64b5f6",
  "#81c784",
  "#ffb74d",
  "#ba68c8",
  "#4db6ac",
  "#f06292",
  "#a1887f",
  "#7986cb",
  "#90a4ae"
];

const pick = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

export function generateRoomCode(): string {
  const num = Math.floor(Math.random() * 90) + 10; // 10–99
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${num}`;
}

/** Deterministic color for the nth participant in a room. */
export function pickColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
