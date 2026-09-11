'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from 'react';

export { Reveal } from './Reveal';
export { AnimatedNumber, useCountUp } from './AnimatedNumber';
export { Tilt } from './Tilt';

/* ── Panel ─────────────────────────────────────────────────────────── */
export type PanelTone = 'default' | 'charge' | 'heat';

export function Panel({
  children,
  className = '',
  tone = 'default',
  lift = false,
  hud = false,
  trace = false,
  style,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  tone?: PanelTone;
  lift?: boolean;
  hud?: boolean;
  trace?: boolean;
  style?: CSSProperties;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  const cls = [
    'v-panel',
    tone === 'charge' && 'v-panel--charge',
    tone === 'heat' && 'v-panel--heat',
    lift && 'v-panel--lift',
    hud && 'v-hud',
    trace && 'v-trace-border',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={cls} style={style}>
      {children}
    </Tag>
  );
}

/* ── Button ────────────────────────────────────────────────────────── */
export type ButtonVariant = 'primary' | 'charge' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

function btnClass(variant: ButtonVariant, size: ButtonSize, className: string) {
  return [
    'v-btn',
    `v-btn--${variant}`,
    size === 'sm' && 'v-btn--sm',
    size === 'lg' && 'v-btn--lg',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      className={btnClass(variant, size, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  external = false,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  const cls = btnClass(variant, size, className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}

/* ── Chip / Badge ──────────────────────────────────────────────────── */
export type ChipTone = 'default' | 'brand' | 'charge' | 'ok' | 'warn' | 'heat';

export function Chip({
  children,
  tone = 'default',
  className = '',
  dot = false,
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={`v-chip ${tone !== 'default' ? `v-chip--${tone}` : ''} ${className}`}>
      {dot && <span className={`v-dot ${tone !== 'default' && tone !== 'brand' ? `v-dot--${tone}` : ''}`} />}
      {children}
    </span>
  );
}

export function Eyebrow({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  tone?: 'default' | 'charge' | 'brand';
  className?: string;
}) {
  return (
    <span className={`v-eyebrow ${tone !== 'default' ? `v-eyebrow--${tone}` : ''} ${className}`}>{children}</span>
  );
}

/* ── Stat tile ─────────────────────────────────────────────────────── */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'charge' | 'brand' | 'heat';
  className?: string;
}) {
  const valueColor =
    tone === 'charge' ? 'text-charge' : tone === 'brand' ? 'text-brand-hi' : tone === 'heat' ? 'text-heat' : 'text-ink';
  return (
    <div className={`v-panel v-hud p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="v-eyebrow">{label}</span>
        {icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand-hi">{icon}</span>}
      </div>
      <div className={`v-num mt-3 text-2xl font-extrabold sm:text-3xl ${valueColor}`}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

/* ── Section heading ───────────────────────────────────────────────── */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className = '',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <div className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-2xl ${className}`}>
      {eyebrow && <Eyebrow tone="charge">{eyebrow}</Eyebrow>}
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl">{title}</h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-ink-2 sm:text-lg">{subtitle}</p>}
    </div>
  );
}

/* ── Inputs ────────────────────────────────────────────────────────── */
export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="v-label">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs font-semibold text-heat">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({
  className = '',
  error = false,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={`v-input ${error ? 'v-input--error' : ''} ${className}`} {...rest} />;
}

/* ── Segmented control ─────────────────────────────────────────────── */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`v-seg ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`v-seg__item ${o.value === value ? 'v-seg__item--on' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Progress ──────────────────────────────────────────────────────── */
export function Progress({
  value,
  charge = false,
  className = '',
}: {
  value: number;
  charge?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`v-track ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`v-track__fill ${charge ? 'v-track__fill--charge' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── Circular gauge ────────────────────────────────────────────────── */
export function Gauge({
  value,
  size = 160,
  stroke = 12,
  label,
  sub,
  className = '',
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // 270° sweep, opening at the bottom.
  const arc = c * 0.75;
  const offset = arc - (arc * pct) / 100;
  const color = pct >= 95 ? 'rgb(var(--c-charge))' : pct >= 60 ? 'rgb(var(--c-warn))' : 'rgb(var(--c-heat))';
  return (
    <div className={`relative grid place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[135deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--c-line) / 0.15)"
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${c}`}
          strokeLinecap="round"
        />
        <circle
          className="v-gauge__arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="v-num text-3xl font-extrabold leading-none" style={{ color }}>
            {Math.round(pct)}
            <span className="text-base">%</span>
          </div>
          {label && <div className="v-eyebrow mt-1.5">{label}</div>}
          {sub && <div className="mt-1 text-[11px] text-ink-3">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Modal ─────────────────────────────────────────────────────────── */
export function Modal({
  open,
  onClose,
  children,
  title,
  className = '',
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-end bg-bg/70 p-0 backdrop-blur-sm animate-fade sm:place-items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`v-panel v-hud w-full animate-pop rounded-b-none rounded-t-3xl p-5 sm:rounded-3xl sm:p-7 ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        } ${className}`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {(
          <div className="mb-4 flex items-start justify-between gap-4">
            {title ? <h3 className="font-display text-lg font-bold text-ink">{title}</h3> : <span />}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line/25 text-ink-3 transition hover:border-heat/60 hover:text-heat"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── Empty / error states ──────────────────────────────────────────── */
export function Notice({
  tone = 'default',
  children,
  className = '',
  icon,
}: {
  tone?: 'default' | 'charge' | 'ok' | 'warn' | 'heat' | 'brand';
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const map: Record<string, string> = {
    default: 'border-line/25 bg-surface-2/60 text-ink-2',
    charge: 'border-charge/35 bg-charge/[0.07] text-charge',
    ok: 'border-ok/35 bg-ok/[0.08] text-ok',
    warn: 'border-warn/35 bg-warn/[0.08] text-warn',
    heat: 'border-heat/35 bg-heat/[0.08] text-heat',
    brand: 'border-brand/35 bg-brand/[0.1] text-brand-hi',
  };
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm leading-relaxed ${map[tone]} ${className}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`v-skeleton ${className}`} aria-hidden />;
}

/* ── Icons (stroke, currentColor) ──────────────────────────────────── */
export type IconName =
  | 'bolt'
  | 'home'
  | 'rig'
  | 'market'
  | 'swap'
  | 'user'
  | 'trophy'
  | 'users'
  | 'shield'
  | 'wallet'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'x'
  | 'check'
  | 'copy'
  | 'share'
  | 'flame'
  | 'snow'
  | 'plug'
  | 'chip'
  | 'gauge'
  | 'clock'
  | 'gift'
  | 'help'
  | 'logout'
  | 'sparkle'
  | 'arrow-up-right'
  | 'lock'
  | 'globe'
  | 'star'
  | 'play'
  | 'search'
  | 'bell'
  | 'settings'
  | 'card'
  | 'chart'
  | 'chain'
  | 'chat'
  | 'doc'
  | 'download'
  | 'swords';

const PATHS: Record<IconName, ReactNode> = {
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  rig: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="10" y="10" width="4" height="4" rx="0.5" />
      <path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" />
    </>
  ),
  market: (
    <>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 1.9-1.6L22 7H5" />
    </>
  ),
  swap: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M17 6h3a2 2 0 0 1-2 4h-1M7 6H4a2 2 0 0 0 2 4h1" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  wallet: (
    <>
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M16 3H6a2 2 0 0 0-2 2v2M16 14h4" />
    </>
  ),
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m20 6-11 11-5-5" />,
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  flame: <path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-3-8-1 4-5 6-5 12 0 4 3 7 7 7z" />,
  snow: <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1" />,
  plug: (
    <>
      <path d="M12 22v-5M9 8V2M15 8V2" />
      <path d="M6 8h12v4a6 6 0 0 1-12 0z" />
    </>
  ),
  chip: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
    </>
  ),
  gauge: (
    <>
      <path d="M12 14l4-4" />
      <path d="M3.3 17a9 9 0 1 1 17.4 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  gift: (
    <>
      <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />,
  'arrow-up-right': <path d="M7 17 17 7M8 7h9v9" />,
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
    </>
  ),
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
  play: <path d="m6 4 14 8-14 8z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  // Added for the admin console's navigation, which used emoji before.
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l3-4 3 3 5-7" />
    </>
  ),
  chain: (
    <>
      <path d="M10 13a5 5 0 0 0 7.1 0l2.9-2.9a5 5 0 0 0-7.1-7.1L11.5 4.4" />
      <path d="M14 11a5 5 0 0 0-7.1 0L4 13.9a5 5 0 0 0 7.1 7.1l1.4-1.4" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8z" />
    </>
  ),
  doc: (
    <>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5M9 13h6M9 17h4" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </>
  ),
  swords: (
    <>
      <path d="M14.5 14.5 21 21M3 3l7 7M3 9V3h6" />
      <path d="M9.5 14.5 3 21M21 3l-7 7M21 9V3h-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  className = '',
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
