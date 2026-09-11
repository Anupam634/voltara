/**
 * The VOLTARA emblem as live SVG — a hex grid cell with a bolt cut through
 * it. Vector so it recolours with the theme and stays crisp at any size;
 * the PNGs from `tools/brand/generate-assets.js` remain for favicons, the
 * OG card and the Expo icons.
 */
export function LogoMark({
  size = 36,
  className = '',
  glow = true,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  glow?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`shrink-0 ${className}`}
      aria-label="VOLTARA"
      role="img"
    >
      <defs>
        <linearGradient id="vl-hex" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--c-brand-hi))" />
          <stop offset="1" stopColor="rgb(var(--c-brand))" />
        </linearGradient>
        <linearGradient id="vl-bolt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(var(--c-charge-hi))" />
          <stop offset="1" stopColor="rgb(var(--c-charge))" />
        </linearGradient>
        {glow && (
          <filter id="vl-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      {/* Hex ring */}
      <path
        d="M50 6 88 28v44L50 94 12 72V28z"
        fill="none"
        stroke="url(#vl-hex)"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      {/* Grid stubs */}
      <path d="M50 6V-2M88 72l7 4M12 72l-7 4" stroke="url(#vl-hex)" strokeWidth="6" strokeLinecap="round" />
      {/* Bolt */}
      <path
        d="M56 22 34 54h14l-4 24 22-32H52z"
        fill="url(#vl-bolt)"
        filter={glow ? 'url(#vl-glow)' : undefined}
      />
    </svg>
  );
}

/**
 * Mark plus wordmark. Set in live type so it stays selectable and
 * recolours with the theme.
 */
export function LogoLockup({
  width = 260,
  className = '',
  href,
}: {
  width?: number;
  priority?: boolean;
  className?: string;
  href?: string;
}) {
  const mark = Math.round(width * 0.24);
  const body = (
    <>
      <LogoMark size={mark} />
      <div className="min-w-0 leading-none">
        <div
          className="truncate font-display font-bold tracking-[0.2em] text-ink"
          style={{ fontSize: Math.round(width * 0.12) }}
        >
          VOLTARA
        </div>
        <div
          className="mt-1 truncate font-mono font-bold uppercase tracking-[0.34em] text-charge"
          style={{ fontSize: Math.round(width * 0.042) }}
        >
          The Grid
        </div>
      </div>
    </>
  );
  const cls = `flex items-center gap-3 ${className}`;
  if (href) {
    return (
      <a href={href} className={cls} style={{ width }} aria-label="VOLTARA">
        {body}
      </a>
    );
  }
  return (
    <div className={cls} style={{ width }} aria-label="VOLTARA">
      {body}
    </div>
  );
}
