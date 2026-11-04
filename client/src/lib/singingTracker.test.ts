import { describe, expect, it } from "vitest";
import { SingingTracker } from "./singingTracker";

// Synthetic loudness: a quiet room (-60 dB) with sung syllables as bursts.
function feed(tracker: SingingTracker, seconds: number, syllablesPerSecond: number, startMs = 0, frameMs = 20) {
  let state = tracker.current;
  for (let time = 0; time < seconds * 1_000; time += frameMs) {
    let db = -60 + Math.random() * 2;
    if (syllablesPerSecond > 0) {
      const phase = (time / 1_000) * syllablesPerSecond % 1;
      db = phase < 0.65 ? -24 - phase * 6 : -38; // each syllable: loud vowel, short dip
    }
    state = tracker.push(db, startMs + time);
  }
  return state;
}

describe("following live singing", () => {
  it("hears silence as not singing", () => {
    const state = feed(new SingingTracker(), 4, 0);
    expect(state.isSinging).toBe(false);
    expect(state.syllablesPerSecond).toBeNull();
  });

  it("estimates a slow and a fast syllable rate", () => {
    const slow = feed(new SingingTracker(), 10, 2);
    expect(slow.isSinging).toBe(true);
    expect(slow.syllablesPerSecond).toBeGreaterThan(1.5);
    expect(slow.syllablesPerSecond).toBeLessThan(2.8);

    const fast = feed(new SingingTracker(), 10, 5);
    expect(fast.syllablesPerSecond).toBeGreaterThan(3.8);
    expect(fast.syllablesPerSecond).toBeLessThan(6.2);
  });

  it("notices when singing stops, and counts syllables for the slideshow", () => {
    const tracker = new SingingTracker();
    feed(tracker, 6, 3);
    tracker.resetCount();
    const sung = feed(tracker, 4, 3, 6_000);
    expect(sung.syllableCount).toBeGreaterThanOrEqual(10);
    expect(sung.syllableCount).toBeLessThanOrEqual(14);
    const after = feed(tracker, 3, 0, 10_000);
    expect(after.isSinging).toBe(false);
  });
});
