'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Chip, Icon, Notice, Progress } from './ui';

interface YouTubeTaskModalProps {
  rewardPoints: number;
  videoUrl?: string | null;
  onComplete: () => Promise<void>;
  onClose: () => void;
}

/** Helper to extract clean 11-char YouTube video ID from various URL formats */
export function extractYouTubeId(urlOrId?: string | null): string {
  if (!urlOrId) return 'kJQP7kiw5Fk';
  const trimmed = urlOrId.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  const longMatch =
    trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
    trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/) ||
    trimmed.match(/\/v\/([a-zA-Z0-9_-]{11})/);
  if (longMatch) return longMatch[1];

  return 'kJQP7kiw5Fk';
}

function useRewardSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const context = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playComplete = useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.1;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.15, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.42);
    });
  }, [context]);

  useEffect(() => () => void ctxRef.current?.close(), []);

  return { playComplete };
}

export function YouTubeTaskModal({ rewardPoints, videoUrl, onComplete, onClose }: YouTubeTaskModalProps) {
  const [mounted, setMounted] = useState(false);
  const [secondsWatched, setSecondsWatched] = useState(0);
  const [isPlaying] = useState(true);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // Require 45 seconds of watching or full video completion
  const REQUIRED_WATCH_SECS = 45;
  const videoId = extractYouTubeId(videoUrl);
  const { playComplete } = useRewardSound();

  useEffect(() => {
    setMounted(true);
  }, []);

  // In-website playback verification timer
  useEffect(() => {
    if (!mounted || hasCompleted) return;
    const timer = setInterval(() => {
      if (isPlaying) {
        setSecondsWatched((prev) => {
          const next = prev + 1;
          if (next >= REQUIRED_WATCH_SECS && !hasCompleted) {
            setHasCompleted(true);
            playComplete();
          }
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [mounted, isPlaying, hasCompleted, playComplete]);

  async function handleClaim() {
    if (!hasCompleted || claiming) return;
    setClaiming(true);
    try {
      await onComplete();
      onClose();
    } finally {
      setClaiming(false);
    }
  }

  const progressPercent = Math.min(100, Math.round((secondsWatched / REQUIRED_WATCH_SECS) * 100));
  const secondsRemaining = Math.max(0, REQUIRED_WATCH_SECS - secondsWatched);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-end bg-bg/80 p-0 backdrop-blur-md animate-fade sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-brand/20 blur-3xl" />

      <div
        className="v-panel v-hud relative w-full animate-pop overflow-hidden rounded-b-none rounded-t-3xl p-5 sm:max-w-xl sm:rounded-3xl sm:p-7"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line/15 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-heat/12 text-heat">
              <Icon name="play" size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold text-ink">Watch &amp; earn</h2>
              <p className="text-xs text-ink-3">
                Watch right here to earn <span className="v-num font-extrabold text-charge">+{rewardPoints}</span> VOLTS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line/25 text-ink-3 transition hover:border-heat/60 hover:text-heat"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Embedded player — plays in-site, no redirect. */}
        <div className="relative mt-5 aspect-video w-full overflow-hidden rounded-2xl border border-line/20 bg-black shadow-panel">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1`}
            title="VOLTARA YouTube Video Task"
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Verification tracker */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            {hasCompleted ? (
              <Chip tone="ok" dot>
                Verified
              </Chip>
            ) : (
              <Chip tone="brand" dot>
                Watching · <span className="v-num">{progressPercent}%</span>
              </Chip>
            )}
            <span className="v-num text-xs font-bold text-ink-3">{hasCompleted ? 'Complete' : `${secondsRemaining}s left`}</span>
          </div>
          <Progress value={Math.max(4, progressPercent)} charge={hasCompleted} className="mt-2.5" />
        </div>

        <Notice
          tone={hasCompleted ? 'ok' : 'default'}
          className="mt-4"
          icon={<Icon name={hasCompleted ? 'check' : 'lock'} size={16} />}
        >
          {hasCompleted
            ? 'Playback verified. You can now claim your reward.'
            : `Keep this video playing to unlock your reward (${secondsRemaining}s left).`}
        </Notice>

        <Button
          variant={hasCompleted ? 'charge' : 'ghost'}
          onClick={handleClaim}
          disabled={!hasCompleted || claiming}
          loading={claiming}
          className="mt-5 w-full"
        >
          {claiming ? (
            'Crediting reward…'
          ) : hasCompleted ? (
            <>
              <Icon name="sparkle" size={14} />
              Claim +{rewardPoints} VOLTS
            </>
          ) : (
            <>
              <Icon name="clock" size={14} />
              Watching · {secondsRemaining}s left
            </>
          )}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
