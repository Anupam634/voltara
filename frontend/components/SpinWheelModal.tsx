'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Button, Eyebrow, Icon, Notice } from './ui';

const FULL_TURNS = 7;
const SPIN_MS = 4500;
const NUM_LEDS = 24;

/**
 * Slice colours. Deliberately fixed rather than themed — the wheel is a
 * game surface, and its hues are part of the brand on every theme.
 */
const SLICE_PALETTE = [
  { fill1: '#6d28d9', fill2: '#8b5cf6', stroke: '#c4b5fd' }, // violet
  { fill1: '#65a30d', fill2: '#a3e635', stroke: '#d9f99d' }, // lime
  { fill1: '#4c1d95', fill2: '#6d28d9', stroke: '#a78bfa' }, // deep violet
  { fill1: '#0e7490', fill2: '#22d3ee', stroke: '#a5f3fc' }, // coolant
  { fill1: '#be123c', fill2: '#f43f5e', stroke: '#fda4af' }, // heat
  { fill1: '#b45309', fill2: '#fbbf24', stroke: '#fde68a' }, // warn
];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useWheelSound(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const context = useCallback(() => {
    if (muted) return null;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, [muted]);

  const tick = useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1100;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }, [context]);

  const fanfare = useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.12;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.5);
    });
  }, [context]);

  useEffect(() => () => void ctxRef.current?.close(), []);

  return { tick, fanfare };
}

export function SpinWheelModal({
  segments,
  onSpin,
  onClose,
}: {
  segments: number[];
  onSpin: () => Promise<{ index: number; earned: number }>;
  onClose: () => void;
}) {
  const t = useTranslations('tasks');
  const [mounted, setMounted] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ index: number; earned: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { tick, fanfare } = useWheelSound(muted);
  const wheelRef = useRef<SVGGElement | null>(null);

  const n = segments.length;
  const sliceAngle = 360 / n;

  async function handleSpin() {
    if (spinning || result) return;
    setSpinning(true);
    setResult(null);
    setError(null);

    let outcome: { index: number; earned: number };
    try {
      outcome = await onSpin();
    } catch (err) {
      setSpinning(false);
      setError(err instanceof Error ? err.message : t('offline'));
      return;
    }

    if (prefersReducedMotion()) {
      setResult(outcome);
      setSpinning(false);
      fanfare();
      return;
    }

    const targetCenter = (outcome.index + 0.5) * sliceAngle;
    const targetAngle = 360 - targetCenter;
    const currentModulo = ((rotation % 360) + 360) % 360;
    let forward = targetAngle - currentModulo;
    if (forward <= 0) forward += 360;
    const delta = FULL_TURNS * 360 + forward;

    const startRot = rotation;
    const targetRot = startRot + delta;
    setRotation(targetRot);

    let lastTickAngle = startRot;
    const startTime = performance.now();

    const checkTick = () => {
      if (!wheelRef.current) return;
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / SPIN_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentAngle = startRot + delta * eased;

      if (Math.abs(currentAngle - lastTickAngle) >= sliceAngle) {
        tick();
        lastTickAngle = currentAngle;
      }
      if (progress < 1) requestAnimationFrame(checkTick);
    };
    requestAnimationFrame(checkTick);

    window.setTimeout(() => {
      setResult(outcome);
      setSpinning(false);
      fanfare();
    }, SPIN_MS);
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-end bg-bg/75 p-0 backdrop-blur-md animate-fade sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !spinning) onClose();
      }}
    >
      <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-brand/20 blur-3xl" />

      <div
        className="v-panel v-hud relative w-full animate-pop overflow-hidden rounded-b-none rounded-t-3xl p-5 text-center sm:max-w-md sm:rounded-3xl sm:p-7"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line/15 pb-4 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-charge/12 text-charge">
              <Icon name="gift" size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-ink">{t('wheelTitle')}</h2>
              <p className="text-xs text-ink-3">{t('wheelBody')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              title={muted ? t('unmute') : t('mute')}
              aria-label={muted ? t('unmute') : t('mute')}
              className={`grid h-8 w-8 place-items-center rounded-full border transition ${
                muted ? 'border-line/25 text-ink-3' : 'border-brand/40 bg-brand/10 text-brand-hi'
              }`}
            >
              <Icon name="bell" size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={spinning}
              aria-label={t('close')}
              className="grid h-8 w-8 place-items-center rounded-full border border-line/25 text-ink-3 transition hover:border-heat/60 hover:text-heat disabled:opacity-40"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        {/* Wheel */}
        <div className="relative mx-auto mt-6 aspect-square w-full max-w-[19rem]">
          {/* Pointer */}
          <div className="absolute left-1/2 top-0 z-30 flex -translate-x-1/2 -translate-y-2 flex-col items-center" aria-hidden>
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '14px solid transparent',
                borderRight: '14px solid transparent',
                borderTop: '24px solid rgb(var(--c-charge))',
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.8)) drop-shadow(0 0 10px rgb(var(--c-charge) / 0.6))',
              }}
            />
            <div className="-mt-6 h-2.5 w-2.5 rounded-full bg-heat ring-2 ring-white shadow-md" />
          </div>

          <svg
            viewBox="-58 -58 116 116"
            className="h-full w-full rounded-full drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)]"
            aria-label={t('wheelAria', { n })}
          >
            <defs>
              <radialGradient id="wheelCore" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1e1930" />
                <stop offset="100%" stopColor="#07060b" />
              </radialGradient>
              {SLICE_PALETTE.map((pal, idx) => (
                <linearGradient key={idx} id={`sliceGrad-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={pal.fill2} />
                  <stop offset="100%" stopColor={pal.fill1} />
                </linearGradient>
              ))}
              <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d9f99d" />
                <stop offset="35%" stopColor="#a3e635" />
                <stop offset="70%" stopColor="#4d7c0f" />
                <stop offset="100%" stopColor="#d9f99d" />
              </linearGradient>
            </defs>

            {/* Bezel */}
            <circle cx="0" cy="0" r="56" fill="#07060b" stroke="url(#rimGrad)" strokeWidth="3" />
            <circle cx="0" cy="0" r="51.5" fill="none" stroke="rgba(163,230,53,0.4)" strokeWidth="1" />

            {/* LEDs */}
            {Array.from({ length: NUM_LEDS }).map((_, i) => {
              const ang = (i * (360 / NUM_LEDS) * Math.PI) / 180;
              const x = 53.8 * Math.cos(ang);
              const y = 53.8 * Math.sin(ang);
              const activeBulb = i % 2 === 0;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="1.4"
                  fill={activeBulb ? '#d9f99d' : '#a3e635'}
                  className={activeBulb ? 'animate-breathe' : ''}
                  style={{ filter: activeBulb ? 'drop-shadow(0 0 2px #d9f99d)' : undefined }}
                />
              );
            })}

            {/* Rotating group */}
            <g
              ref={wheelRef}
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: '0px 0px',
                transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.88, 0.2, 1)` : 'none',
              }}
            >
              {segments.map((value, i) => {
                const from = i * sliceAngle - 90;
                const to = from + sliceAngle;
                const rad = (deg: number) => (deg * Math.PI) / 180;
                const x1 = 50 * Math.cos(rad(from));
                const y1 = 50 * Math.sin(rad(from));
                const x2 = 50 * Math.cos(rad(to));
                const y2 = 50 * Math.sin(rad(to));
                const mid = rad(from + sliceAngle / 2);
                const won = result?.index === i;
                const palIndex = i % SLICE_PALETTE.length;

                return (
                  <g key={i}>
                    <path
                      d={`M0 0 L${x1} ${y1} A50 50 0 0 1 ${x2} ${y2} Z`}
                      fill={`url(#sliceGrad-${palIndex})`}
                      stroke="#ffffff"
                      strokeWidth="0.75"
                      opacity={result && !won ? 0.35 : 1}
                    />
                    <circle cx={x1} cy={y1} r="1.2" fill="#ffffff" stroke="#4d7c0f" strokeWidth="0.4" />
                    <text
                      x={33 * Math.cos(mid)}
                      y={33 * Math.sin(mid)}
                      fill="#ffffff"
                      fontSize="7"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${i * sliceAngle + sliceAngle / 2}, ${33 * Math.cos(mid)}, ${33 * Math.sin(mid)})`}
                      style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.9))', fontFamily: 'var(--font-mono), monospace' }}
                    >
                      +{value}
                    </text>
                  </g>
                );
              })}
              <circle r="16" fill="url(#wheelCore)" stroke="url(#rimGrad)" strokeWidth="2" />
            </g>
          </svg>

          {/* Hub button */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning || result !== null}
            className="absolute left-1/2 top-1/2 z-20 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full p-1 transition-all active:scale-95 disabled:opacity-80"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #ecfccb 0%, #a3e635 35%, #3f6212 100%)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.7), inset 0 2px 4px rgba(255,255,255,0.8), 0 0 20px rgba(163,230,53,0.5)',
            }}
          >
            <span className="flex h-full w-full flex-col items-center justify-center rounded-full bg-gradient-to-b from-[#a3e635] to-[#65a30d] font-display font-bold uppercase tracking-wider text-[#0b1204] shadow-inner">
              <Icon name="bolt" size={16} strokeWidth={2.5} />
              <span className="-mt-0.5 text-[10px] tracking-widest">{spinning ? '…' : t('spin')}</span>
            </span>
          </button>
        </div>

        {error && (
          <Notice tone="heat" className="mt-4 text-left" icon={<Icon name="flame" size={16} />}>
            {error}
          </Notice>
        )}

        {result && (
          <div className="v-panel v-panel--charge mt-6 animate-pop p-4 text-center">
            <Eyebrow tone="charge">{t('wheelWon', { points: result.earned })}</Eyebrow>
            <div className="v-num mt-1.5 text-3xl font-extrabold text-charge">+{result.earned} VOLTS</div>
          </div>
        )}

        <Button
          variant={result ? 'charge' : 'ghost'}
          onClick={onClose}
          disabled={spinning}
          className="mt-6 w-full"
        >
          {result ? t('collect') : t('close')}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
