'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './ui';

/**
 * The landing hero clip.
 *
 * Autoplay is deliberately not an attribute: the effect starts playback only
 * when the visitor hasn't asked for reduced motion, and the poster (the
 * clip's own logo frame) stands in until then. A toggle is always offered,
 * because a looping video nobody can stop is hostile on a page people are
 * trying to read.
 */
export function HeroVideo() {
  const t = useTranslations('landing');
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Muted playback is allowed without a gesture, but a browser may still
    // refuse (low power mode, data saver) — the poster simply stays put.
    video
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, []);

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="v-panel v-hud relative overflow-hidden rounded-3xl p-1.5">
      <video
        ref={ref}
        poster="/hero-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        className="block h-auto w-full rounded-[1.25rem] bg-bg"
        // Decorative: the surrounding copy already carries the message.
        aria-hidden
        tabIndex={-1}
      >
        {/* H.264 first: every major browser decodes it in hardware, which is
            kinder to phone batteries. VP9 covers builds shipped without the
            proprietary codec. */}
        <source src="/hero.mp4" type="video/mp4" />
        <source src="/hero.webm" type="video/webm" />
      </video>

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('hero.pauseVideo') : t('hero.playVideo')}
        className="v-glass absolute bottom-4 left-4 grid h-9 w-9 place-items-center rounded-full border text-ink transition hover:border-charge/60 hover:text-charge"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
          </svg>
        ) : (
          <Icon name="play" size={14} />
        )}
      </button>
    </div>
  );
}
