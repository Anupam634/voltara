'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Web Audio API synthesizer for Mining actions + Mobile Haptics.
 * Generates rich cybernetic mining strikes and crypto reward cascades
 * with zero external assets, ensuring instant playback on all mobile & desktop browsers.
 */
export function useMiningFX() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioCtx();
      }
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  // 1. Tactile Mining Energy Strike & Spark sound
  const playMiningStrike = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Mobile Haptic Feedback (if supported by device)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([35, 25, 60]);
      } catch {
        /* Ignore vibration errors */
      }
    }

    // A. Cyber Sub-bass Energy Pulse
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(320, now + 0.18);
    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    subOsc.connect(subGain).connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.3);

    // B. Crisp Metallic Mining Chime (C6 - E6 - G6 arpeggio)
    const notes = [1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.22, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.38);
    });

    // C. White noise spark crackle
    try {
      const bufferSize = ctx.sampleRate * 0.08;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(3500, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.12, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.09);
    } catch {
      /* fallback gracefully if buffer fails */
    }
  }, [getContext]);

  // 2. Victorious Mining Claim Reward Cascade
  const playClaimReward = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Mobile Haptic Double-Beat
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([40, 40, 80, 40, 120]);
      } catch {
        /* Ignore vibration errors */
      }
    }

    // Ascending celebratory gold chime chord sequence
    const fanNotes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    fanNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startTime = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.28, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.48);
    });
  }, [getContext]);


  // 3. A short UI tick — tab switches, part install, toggle.
  const playTick = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }, [getContext]);

  // 4. A part seating into a slot: a low thunk and a rising hum.
  const playInstall = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(30);
      } catch {
        /* ignore */
      }
    }
    const thunk = ctx.createOscillator();
    const tg = ctx.createGain();
    thunk.type = 'sine';
    thunk.frequency.setValueAtTime(180, now);
    thunk.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    tg.gain.setValueAtTime(0.3, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    thunk.connect(tg).connect(ctx.destination);
    thunk.start(now);
    thunk.stop(now + 0.18);

    const hum = ctx.createOscillator();
    const hg = ctx.createGain();
    hum.type = 'sawtooth';
    hum.frequency.setValueAtTime(220, now + 0.08);
    hum.frequency.exponentialRampToValueAtTime(660, now + 0.4);
    hg.gain.setValueAtTime(0.0001, now + 0.08);
    hg.gain.exponentialRampToValueAtTime(0.08, now + 0.2);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, now);
    hum.connect(lp).connect(hg).connect(ctx.destination);
    hum.start(now + 0.08);
    hum.stop(now + 0.52);
  }, [getContext]);

  // 5. Something went wrong: a dull two-note drop.
  const playError = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [330, 220].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.12);
      g.gain.setValueAtTime(0.12, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.18);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.2);
    });
  }, [getContext]);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return { playMiningStrike, playClaimReward, playTick, playInstall, playError };
}
