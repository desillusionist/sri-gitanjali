/**
 * Follows live singing from microphone loudness alone: whether someone is
 * singing, and roughly how many syllables per second. Nothing is recorded or
 * sent anywhere; only a loudness value per frame is analysed.
 *
 * Feed it one loudness reading (in dB) every few tens of milliseconds. It keeps
 * an adaptive noise floor, treats sound well above the floor as singing, and
 * counts a syllable each time loudness rises again after a dip, which in sung
 * kīrtana falls roughly on each vowel.
 */
export type SingingTrackerOptions = {
  /** dB above the noise floor that counts as singing. */
  voiceMarginDb?: number;
  /** A syllable starts after a dip of at least this many dB and ends after a fall of as much from its peak. */
  syllableDipDb?: number;
  /** Shortest gap between two syllables. */
  minSyllableGapMs?: number;
  /** How long quiet must last before singing counts as stopped. */
  silenceHoldMs?: number;
  /** Window over which the syllable rate is averaged. */
  rateWindowMs?: number;
};

export type SingingState = {
  isSinging: boolean;
  /** Syllables per second while singing, or null until enough has been heard. */
  syllablesPerSecond: number | null;
  /** Syllables counted since the last reset (for the slideshow). */
  syllableCount: number;
  /** 0–1, for a level meter. */
  level: number;
};

export class SingingTracker {
  private readonly voiceMarginDb: number;
  private readonly syllableDipDb: number;
  private readonly minSyllableGapMs: number;
  private readonly silenceHoldMs: number;
  private readonly rateWindowMs: number;
  private floorDb = -60;
  private smoothedDb = -90;
  private valleyDb = Infinity;
  private peakDb = -90;
  private inSyllable = false;
  private lastSyllableAt = -Infinity;
  private lastVoiceAt = -Infinity;
  private singingSince: number | null = null;
  private syllableTimes: number[] = [];
  private lastFrameAt: number | null = null;
  private recentLows: Array<{ at: number; db: number }> = [];
  private readonly floorWindowMs = 4_000;
  private count = 0;
  private state: SingingState = { isSinging: false, syllablesPerSecond: null, syllableCount: 0, level: 0 };

  constructor(options: SingingTrackerOptions = {}) {
    this.voiceMarginDb = options.voiceMarginDb ?? 9;
    this.syllableDipDb = options.syllableDipDb ?? 3;
    this.minSyllableGapMs = options.minSyllableGapMs ?? 110;
    this.silenceHoldMs = options.silenceHoldMs ?? 1_400;
    this.rateWindowMs = options.rateWindowMs ?? 8_000;
  }

  resetCount() {
    this.count = 0;
    this.state = { ...this.state, syllableCount: 0 };
  }

  get current(): SingingState {
    return this.state;
  }

  /** Processes one loudness reading taken at time `now` (ms). */
  push(levelDb: number, now: number): SingingState {
    this.lastFrameAt = now;
    // Light smoothing removes flicker without blurring syllables.
    this.smoothedDb = this.smoothedDb < -89 ? levelDb : this.smoothedDb * 0.55 + levelDb * 0.45;
    const db = this.smoothedDb;

    // Noise floor: the quietest moment of the last few seconds (breaths and the
    // gaps between syllables), so it adapts to the room but not to the singing.
    while (this.recentLows.length && this.recentLows[this.recentLows.length - 1].db >= db) this.recentLows.pop();
    this.recentLows.push({ at: now, db });
    while (this.recentLows[0].at < now - this.floorWindowMs) this.recentLows.shift();
    this.floorDb = this.recentLows[0].db;

    const voiced = db > this.floorDb + this.voiceMarginDb;
    if (voiced) this.lastVoiceAt = now;

    // Syllables: entering a loud stretch after a dip, leaving it once loudness
    // falls back from its peak (hysteresis keeps one vowel from counting twice).
    if (!this.inSyllable) {
      this.valleyDb = Math.min(this.valleyDb, db);
      if (voiced && db >= this.valleyDb + this.syllableDipDb && now - this.lastSyllableAt >= this.minSyllableGapMs) {
        this.inSyllable = true;
        this.peakDb = db;
        this.lastSyllableAt = now;
        this.syllableTimes.push(now);
        this.count += 1;
      }
    } else {
      this.peakDb = Math.max(this.peakDb, db);
      if (db <= this.peakDb - this.syllableDipDb || !voiced) {
        this.inSyllable = false;
        this.valleyDb = db;
      }
    }

    const isSinging = now - this.lastVoiceAt <= this.silenceHoldMs;
    if (!isSinging) this.singingSince = null;
    else this.singingSince ??= now;
    const windowStart = now - this.rateWindowMs;
    while (this.syllableTimes.length && this.syllableTimes[0] < windowStart) this.syllableTimes.shift();
    const heardFrom = this.singingSince === null ? now : Math.max(windowStart, this.singingSince);
    const heardSeconds = (now - heardFrom) / 1_000;
    const heardSyllables = this.syllableTimes.filter((time) => time >= heardFrom).length;
    const syllablesPerSecond = isSinging && heardSeconds >= 1.5 && heardSyllables >= 4
      ? Math.min(8, Math.max(0.4, heardSyllables / heardSeconds))
      : null;

    this.state = {
      isSinging,
      syllablesPerSecond,
      syllableCount: this.count,
      level: Math.min(1, Math.max(0, (db - this.floorDb) / 30)),
    };
    return this.state;
  }
}
