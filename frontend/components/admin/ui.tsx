'use client';

import React from 'react';
import { Icon, type IconName } from '../ui';

/**
 * The admin console's shared primitives.
 *
 * Before this, eighteen tabs each hand-rolled the same page header, seven
 * repeated the same error banner and five the same refresh button — so they
 * drifted: different paddings, different greys, three spellings of "Sync".
 * Every tab now composes the same four or five pieces.
 *
 * These wrap the miner-facing design system rather than replacing it:
 * `.card` is already aliased to `.v-panel` in globals.css, and the legacy
 * Tailwind scales the console uses (`slate`, `amber`, `sky`) are aliased to
 * the VOLTARA palette in tailwind.config.ts. What is added here is
 * consistency of *structure*, not a second look.
 *
 * One brand rule is enforced deliberately: **lime is scarce**. It marks what
 * is live — an event running, a job that just fired — and nothing else.
 * Structure (active nav, headings, primary actions) is violet. The old
 * console used lime for every active tab and every badge, which left nothing
 * to signal "this is happening right now".
 */

/* ───────────────────────────── tones ───────────────────────────── */

export type Tone = 'neutral' | 'brand' | 'live' | 'good' | 'warn' | 'bad';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-slate-300',
  brand: 'text-violet-400',
  live: 'text-amber-400',
  good: 'text-emerald-400',
  warn: 'text-amber-300',
  bad: 'text-rose-400',
};

const TONE_BORDER: Record<Tone, string> = {
  neutral: 'border-white/10',
  brand: 'border-violet-500/30',
  live: 'border-amber-500/30',
  good: 'border-emerald-500/25',
  warn: 'border-amber-500/30',
  bad: 'border-rose-500/40',
};

const TONE_BG: Record<Tone, string> = {
  neutral: 'bg-slate-900/70',
  brand: 'bg-violet-500/10',
  live: 'bg-amber-500/10',
  good: 'bg-emerald-500/10',
  warn: 'bg-amber-950/20',
  bad: 'bg-rose-950/30',
};

/* ──────────────────────────── page shell ───────────────────────── */

/**
 * Every tab's header, error slot and body in one wrapper.
 *
 * `loading` only shows its skeleton while there is nothing to show yet — a
 * refresh over existing data must not blank the page the operator is
 * reading.
 */
export function AdminPage({
  icon,
  title,
  subtitle,
  badge,
  badgeTone = 'brand',
  actions,
  error,
  loading,
  loadingLabel = 'Loading…',
  empty,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: Tone;
  actions?: React.ReactNode;
  error?: string | null;
  /** True only before the first successful load. */
  loading?: boolean;
  loadingLabel?: string;
  empty?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-300">
              <Icon name={icon} size={16} />
            </span>
            <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
            {badge && <Badge tone={badgeTone}>{badge}</Badge>}
          </div>
          {subtitle && (
            <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-slate-400">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>

      {error && <Notice tone="bad">{error}</Notice>}

      {loading ? (
        <LoadingBlock label={loadingLabel} />
      ) : empty ? (
        <div className="card border-white/10 bg-slate-900/70 p-10 text-center text-xs text-slate-400">
          {empty}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** The skeleton shown before a tab's first load. */
export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-slate-900/70" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-slate-900/50" />
      <p className="text-center text-xs text-slate-500">{label}</p>
    </div>
  );
}

/* ───────────────────────────── controls ────────────────────────── */

export function AdminButton({
  onClick,
  children,
  icon,
  tone = 'neutral',
  disabled,
  busy,
  title,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  icon?: IconName;
  tone?: 'neutral' | 'primary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  title?: string;
}) {
  const styles =
    tone === 'primary'
      ? 'border-violet-500/40 bg-violet-500/15 text-violet-200 hover:border-violet-400 hover:text-white'
      : tone === 'danger'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:text-rose-200'
        : 'border-white/10 bg-slate-900/80 text-slate-300 hover:border-violet-500/50 hover:text-white';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${styles}`}
    >
      {busy ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon && <Icon name={icon} size={13} />
      )}
      {children}
    </button>
  );
}

/** The refresh control every tab carries, spelled one way. */
export function SyncButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <AdminButton onClick={onClick} icon="sparkle" busy={busy} title="Reload this tab">
      Sync
    </AdminButton>
  );
}

/* ───────────────────────────── surfaces ────────────────────────── */

export function Badge({ tone = 'brand', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${TONE_BORDER[tone]} ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * A banner. `bad` and `warn` are the ones that matter: a failed job and a
 * zero look identical on a chart, so anything the operator must act on says
 * so in words here rather than being inferred from an empty tile.
 */
export function Notice({
  tone = 'warn',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
}) {
  const icon: IconName = tone === 'bad' ? 'flame' : tone === 'good' ? 'check' : 'gauge';
  return (
    <div
      className={`flex gap-2.5 rounded-xl border p-3.5 text-xs ${TONE_BORDER[tone]} ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}
    >
      <Icon name={icon} size={15} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title && <div className="font-black">{title}</div>}
        <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>
      </div>
    </div>
  );
}

/** A KPI tile. `value` is rendered tabular so a column of them lines up. */
export function StatTile({
  label,
  value,
  note,
  tone = 'neutral',
  live,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: Tone;
  /** Adds the pulsing dot — only for something genuinely happening now. */
  live?: boolean;
}) {
  return (
    <div className={`card bg-slate-900/70 p-5 backdrop-blur-md ${TONE_BORDER[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {live && <span className="pulse-dot h-2 w-2 rounded-full bg-amber-400" />}
      </div>
      <div className={`mt-2 text-3xl font-black tabular-nums ${TONE_TEXT[tone]}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-slate-400">{note}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}

/** A titled panel — the console's one content container. */
export function Section({
  title,
  aside,
  children,
  tone = 'neutral',
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <section className={`card bg-slate-900/70 p-5 backdrop-blur-md ${TONE_BORDER[tone]}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black text-white">{title}</h3>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Label/value pair, as used down the side of a detail panel. */
export function Row({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-bold tabular-nums ${tone === 'neutral' ? 'text-slate-200' : TONE_TEXT[tone]}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * A horizontally scrollable table.
 *
 * The console is opened on laptops as often as desktops, and a wide table
 * that forces the whole page sideways is the usual way an admin panel stops
 * being usable at 1280px.
 */
export function Table({
  head,
  children,
  minWidth = 440,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs" style={{ minWidth }}>
        <thead className="text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={`pb-2 font-bold ${i > 0 && i === head.length - 1 ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">{children}</tbody>
      </table>
    </div>
  );
}
