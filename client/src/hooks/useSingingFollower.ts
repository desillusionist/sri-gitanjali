/**
 * Microphone side of “Follow the singing”: asks for the microphone only when
 * switched on, measures loudness in the voice band about 50 times a second and
 * feeds it to SingingTracker. Audio never leaves the device and nothing is
 * recorded. Switching off releases the microphone at once.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { SingingTracker, type SingingState } from "@/lib/singingTracker";

export type SingingFollowerStatus = "off" | "starting" | "listening" | "denied" | "unavailable";

const IDLE_STATE: SingingState = { isSinging: false, syllablesPerSecond: null, syllableCount: 0, level: 0 };

export function useSingingFollower(enabled: boolean) {
  const [status, setStatus] = useState<SingingFollowerStatus>("off");
  const [state, setState] = useState<SingingState>(IDLE_STATE);
  const trackerRef = useRef<SingingTracker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      setState(IDLE_STATE);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      setStatus("unavailable");
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let timer: number | null = null;
    setStatus("starting");

    void (async () => {
      try {
        // Raw signal: echo cancellation and noise suppression would flatten the syllables.
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (cancelled) return;
        context = new AudioContext();
        await context.resume();
        const source = context.createMediaStreamSource(stream);
        // Keep the singing voice; drop drum thumps and cymbal hiss as much as a simple filter can.
        const highPass = new BiquadFilterNode(context, { type: "highpass", frequency: 180 });
        const lowPass = new BiquadFilterNode(context, { type: "lowpass", frequency: 3_200 });
        const analyser = new AnalyserNode(context, { fftSize: 1_024, smoothingTimeConstant: 0 });
        source.connect(highPass).connect(lowPass).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const tracker = new SingingTracker();
        trackerRef.current = tracker;
        let lastPublished = 0;
        timer = window.setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
          const db = 10 * Math.log10(sum / samples.length + 1e-10);
          const now = performance.now();
          const next = tracker.push(db, now);
          // Re-render the controls about ten times a second, not on every frame.
          if (now - lastPublished > 100) {
            lastPublished = now;
            setState(next);
          }
        }, 20);
        setStatus("listening");
      } catch (error) {
        if (cancelled) return;
        setStatus(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "denied" : "unavailable");
      }
    })();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      trackerRef.current = null;
    };
  }, [enabled]);

  /** Starts counting syllables afresh (a new slide). */
  const resetSyllableCount = useCallback(() => {
    trackerRef.current?.resetCount();
    setState((current) => ({ ...current, syllableCount: 0 }));
  }, []);

  return { status, ...state, resetSyllableCount };
}
