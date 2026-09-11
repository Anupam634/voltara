'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError, getToken, type RigPartKind } from '../../../lib/api';
import {
  getDaily,
  simulateRig,
  SIM_SLOTS,
  submitDaily,
  type CatalogPartDto,
  type DailyBoard,
  type DailySubmissionDto,
} from '../../../lib/api-daily';
import { AppShell } from '../../../components/AppShell';
import {
  Button,
  Chip,
  Eyebrow,
  Gauge,
  Icon,
  Modal,
  Notice,
  Panel,
  Reveal,
  Skeleton,
  type IconName,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';
import { usePolling } from '../../../lib/use-polling';
import { fill, useDaily } from '../../../components/daily/strings';

const KIND_ORDER: RigPartKind[] = ['CORE', 'COOLER', 'PSU', 'MODULE'];
const KIND_STYLE: Record<RigPartKind, { stripe: string; icon: IconName; text: string }> = {
  CORE: { stripe: 'rig-slot__kind--core', icon: 'chip', text: 'text-brand-hi' },
  COOLER: { stripe: 'rig-slot__kind--cooler', icon: 'snow', text: 'text-[#67e8f9]' },
  PSU: { stripe: 'rig-slot__kind--psu', icon: 'plug', text: 'text-charge' },
  MODULE: { stripe: 'rig-slot__kind--module', icon: 'sparkle', text: 'text-[#f9a8d4]' },
};

function fmt(n: number, d = 1) {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Counts down to the next UTC midnight, so the reset is never a surprise. */
function useCountdown(target: string | null, endedLabel: string) {
  const [left, setLeft] = useState(() => (target ? new Date(target).getTime() - Date.now() : 0));
  useEffect(() => {
    if (!target) return;
    const tick = () => setLeft(new Date(target).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target || left <= 0) return endedLabel;
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * The daily rig puzzle.
 *
 * Same budget and target for everyone, reset at midnight UTC. The builder
 * scores locally so the numbers move as parts go in; the server re-scores on
 * submit and hands back the block the miner pastes into a chat.
 */
export default function DailyClient() {
  const s = useDaily();
  const t = useTranslations('dashboard');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const { playTick, playInstall, playError } = useMiningFX();

  const [board, setBoard] = useState<DailyBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(SIM_SLOTS).fill(null));
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await getDaily();
      setBoard(b);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.replace(`/${params.locale}/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : s.offline);
    }
  }, [router, params.locale, s.offline]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${params.locale}/login`);
      return;
    }
    load();
  }, [load, router, params.locale]);

  usePolling(load, 30_000);

  // Seed the sockets from today's entry once, so "submit a better build"
  // starts from what they already had rather than an empty rig.
  useEffect(() => {
    if (seeded || !board?.mine) return;
    const next: (string | null)[] = Array(SIM_SLOTS).fill(null);
    board.mine.partCodes.slice(0, SIM_SLOTS).forEach((c, i) => {
      next[i] = c;
    });
    setSlots(next);
    setSeeded(true);
  }, [board, seeded]);

  const byCode = useMemo(() => {
    const m = new Map<string, CatalogPartDto>();
    board?.catalog.forEach((p) => m.set(p.code, p));
    return m;
  }, [board]);

  const parts = useMemo(
    () =>
      slots
        .filter((c): c is string => c !== null)
        .map((c) => byCode.get(c))
        .filter((p): p is CatalogPartDto => !!p),
    [slots, byCode],
  );
  const sim = useMemo(() => simulateRig(parts), [parts]);

  const budget = board?.puzzle.budgetUsd ?? 0;
  const target = board?.puzzle.targetHashPerHour ?? 0;
  const withinBudget = sim.costUsd <= budget;
  const meetsHash = sim.hashPerHour >= target;
  const stable = sim.gridStability === 100;
  const valid = parts.length > 0 && withinBudget && meetsHash && stable;
  const countdown = useCountdown(board?.puzzle.endsAt ?? null, s.ended);

  function setSlot(i: number, code: string | null) {
    playTick();
    setSlots((prev) => prev.map((c, j) => (j === i ? code : c)));
  }

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitDaily(parts.map((p) => p.code));
      playInstall();
      setBeat(res.beatPercent);
      await load();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : s.offline);
    } finally {
      setBusy(false);
    }
  }

  async function copyResult(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      playTick();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused (insecure origin, or the user denied it). The block
      // is on screen in a selectable plate, so there is still a way through.
    }
  }

  const shareUrl =
    typeof window === 'undefined' ? '' : `${window.location.origin}/${params.locale}/daily`;
  const shareBody = board?.mine ? `${board.mine.shareText}\n${shareUrl}` : '';

  // The verdict chip names the first rule the build breaks, in the order a
  // miner would fix them: afford it, stabilise it, then hit the number.
  const verdict = !parts.length
    ? { tone: 'default' as const, label: s.addParts }
    : !withinBudget
      ? { tone: 'heat' as const, label: s.overBudget }
      : !stable
        ? { tone: 'heat' as const, label: s.unstable }
        : !meetsHash
          ? { tone: 'warn' as const, label: s.belowTarget }
          : { tone: 'ok' as const, label: s.meets };

  return (
    <AppShell
      locale={params.locale}
      backLabel={t('navDashboard')}
      eyebrow={s.eyebrow}
      title={s.title}
      subtitle={s.subtitle}
      width="max-w-6xl"
    >
      {error && (
        <Notice tone="heat" icon={<Icon name="flame" size={16} />} className="mb-5 animate-rise">
          {error}
        </Notice>
      )}

      {!board ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-36 w-full rounded-2xl lg:col-span-12" />
          <Skeleton className="h-96 w-full rounded-2xl lg:col-span-7" />
          <Skeleton className="h-96 w-full rounded-2xl lg:col-span-5" />
        </div>
      ) : (
        <>
          {/* ── Today's constraint ─────────────────────────────── */}
          <Reveal>
            <Panel hud tone="charge" className="v-scanlines relative overflow-hidden p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Eyebrow tone="charge">
                    {s.puzzleNo} #{board.puzzle.number}
                  </Eyebrow>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <div>
                      <span className="v-eyebrow">{s.budget}</span>
                      <div className="v-num text-3xl font-extrabold text-ink sm:text-4xl">
                        ${board.puzzle.budgetUsd}
                      </div>
                    </div>
                    <div>
                      <span className="v-eyebrow">{s.target}</span>
                      <div className="v-num text-3xl font-extrabold text-charge sm:text-4xl">
                        {fmt(target)}
                        <span className="text-sm text-ink-3">{s.perHour}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip dot>
                    <Icon name="clock" size={11} />
                    {s.endsIn} {countdown}
                  </Chip>
                  <Chip tone="brand">
                    <Icon name="users" size={11} />
                    {board.solvedCount} {board.solvedCount === 1 ? s.solversOne : s.solvers}
                  </Chip>
                </div>
              </div>
              <div className="v-trace mt-5" />
            </Panel>
          </Reveal>

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            {/* ── Builder ──────────────────────────────────────── */}
            <Reveal index={1} className="lg:col-span-7">
              <Panel hud className="p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-ink">{s.builderTitle}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      playTick();
                      setSlots(Array(SIM_SLOTS).fill(null));
                    }}
                    className="text-xs font-bold text-ink-3 transition hover:text-heat"
                  >
                    {s.clear}
                  </button>
                </div>
                <p className="mt-1 text-xs text-ink-3">{s.builderHint}</p>

                <div className="rig-grid mt-4">
                  {slots.map((code, i) => {
                    const part = code ? byCode.get(code) : undefined;
                    if (!part) {
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            playTick();
                            setPicking(i);
                          }}
                          className="rig-slot rig-slot--empty text-left"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                            #{i + 1}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs font-bold">
                            <Icon name="sparkle" size={13} />
                            {s.slotAdd}
                          </span>
                        </button>
                      );
                    }
                    const style = KIND_STYLE[part.kind];
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSlot(i, null)}
                        className="rig-slot rig-slot--filled text-left"
                      >
                        <span className={`rig-slot__kind ${style.stripe}`} />
                        <span className="flex items-center justify-between">
                          <span
                            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] ${style.text}`}
                          >
                            <Icon name={style.icon} size={12} />
                            {part.code}
                          </span>
                          <span className="v-num text-[11px] font-bold text-ink-3">
                            ${part.priceUsd}
                          </span>
                        </span>
                        <span>
                          <span className="block truncate text-sm font-bold text-ink">
                            {part.name}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-ink-3">
                            {part.hashPerHour > 0 && `+${fmt(part.hashPerHour)}/h · `}
                            {part.cooling > 0 && `${part.cooling} TU · `}
                            {part.wattsSupplied > 0 && `${part.wattsSupplied} W · `}
                            {part.hashBoostPercent > 0 && `+${part.hashBoostPercent}% · `}
                            {part.heat > 0 && `${part.heat} heat · `}
                            {part.watts > 0 && `${part.watts} W`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            </Reveal>

            {/* ── Readout ──────────────────────────────────────── */}
            <Reveal index={2} className="lg:col-span-5">
              <Panel
                hud
                tone={valid ? 'charge' : !withinBudget || !stable ? 'heat' : 'default'}
                className="p-5 sm:p-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Eyebrow>{s.cost}</Eyebrow>
                    <div
                      className={`v-num mt-1 text-3xl font-extrabold ${
                        withinBudget ? 'text-ink' : 'text-heat'
                      }`}
                    >
                      ${sim.costUsd}
                      <span className="text-sm text-ink-3"> / ${budget}</span>
                    </div>
                    <Eyebrow className="mt-3 block">{s.hash}</Eyebrow>
                    <div
                      className={`v-num mt-1 text-2xl font-extrabold ${
                        meetsHash && parts.length ? 'text-charge' : 'text-ink'
                      }`}
                    >
                      {fmt(sim.hashPerHour)}
                      <span className="text-xs text-ink-3"> / {fmt(target)}</span>
                    </div>
                  </div>
                  <Gauge
                    value={parts.length ? sim.gridStability : 100}
                    size={120}
                    stroke={10}
                    label={s.stability}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <Meter
                    icon="flame"
                    label={s.heat}
                    used={sim.heatLoad}
                    cap={sim.coolingCapacity}
                    capLabel={s.cooling}
                  />
                  <Meter
                    icon="plug"
                    label={s.draw}
                    used={sim.powerDraw}
                    cap={sim.powerSupply}
                    capLabel={s.supply}
                  />
                </div>

                <div className="mt-4">
                  <Chip tone={verdict.tone} dot={verdict.tone !== 'default'}>
                    {verdict.label}
                  </Chip>
                </div>

                <Button
                  variant="charge"
                  size="lg"
                  className="mt-5 w-full"
                  disabled={!valid}
                  loading={busy}
                  onClick={submit}
                >
                  <Icon name="bolt" size={16} />
                  {board.mine ? s.resubmit : s.submit}
                </Button>
              </Panel>
            </Reveal>
          </div>

          {/* ── The result block ───────────────────────────────── */}
          {board.mine && (
            <Reveal index={3} className="mt-6">
              <Panel hud tone="charge" className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Eyebrow tone="charge">{s.solvedTitle}</Eyebrow>
                    <h3 className="mt-1 font-display text-lg font-bold text-ink">{s.yourResult}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="charge">
                      {s.rankLabel} #{board.mine.rank}
                    </Chip>
                    <Chip>
                      {board.mine.attempts} {s.attempts}
                    </Chip>
                  </div>
                </div>

                <pre className="v-inset mt-4 overflow-x-auto whitespace-pre px-4 py-3 font-mono text-sm leading-relaxed text-ink">
                  {board.mine.shareText}
                </pre>

                {beat !== null && (
                  <p className="mt-3 text-sm font-semibold text-charge">
                    {beat === 100 && board.solvedCount <= 1
                      ? s.beatAlone
                      : fill(s.beat, { n: beat })}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="charge" size="sm" onClick={() => copyResult(shareBody)}>
                    <Icon name="copy" size={14} />
                    {copied ? s.copied : s.copy}
                  </Button>
                  <a
                    className="v-btn v-btn--ghost v-btn--sm"
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareBody)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="arrow-up-right" size={14} />
                    {s.shareX}
                  </a>
                  <a
                    className="v-btn v-btn--ghost v-btn--sm"
                    href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(board.mine.shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="arrow-up-right" size={14} />
                    {s.shareTelegram}
                  </a>
                  <a
                    className="v-btn v-btn--ghost v-btn--sm"
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareBody)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="arrow-up-right" size={14} />
                    {s.shareWhatsApp}
                  </a>
                </div>
              </Panel>
            </Reveal>
          )}

          {/* ── What it cost everyone else ─────────────────────── */}
          <Reveal index={4} className="mt-6">
            <Panel className="p-5 sm:p-6">
              <h3 className="font-display text-lg font-bold text-ink">{s.distributionTitle}</h3>
              {board.distribution.length === 0 ? (
                <p className="mt-2 text-xs text-ink-3">{s.distributionEmpty}</p>
              ) : (
                <Distribution
                  rows={board.distribution}
                  mineCost={board.mine?.costUsd ?? null}
                  label={s.atCost}
                />
              )}
            </Panel>
          </Reveal>

          {/* ── Boards ─────────────────────────────────────────── */}
          <Reveal as="section" index={5} className="mt-6">
            <Panel className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 px-5 pt-5">
                <h3 className="font-display text-lg font-bold text-ink">{s.boardTitle}</h3>
                <Eyebrow>{board.puzzle.dayKey}</Eyebrow>
              </div>
              {board.top.length === 0 ? (
                <p className="px-5 pb-5 pt-2 text-xs text-ink-3">{s.boardEmpty}</p>
              ) : (
                <BoardTable rows={board.top} />
              )}
            </Panel>
          </Reveal>

          <Reveal as="section" index={6} className="mt-6">
            <Panel className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 px-5 pt-5">
                <h3 className="font-display text-lg font-bold text-ink">{s.yesterdayTitle}</h3>
                {board.yesterday && <Eyebrow>#{board.yesterday.number}</Eyebrow>}
              </div>
              {!board.yesterday || board.yesterday.best.length === 0 ? (
                <p className="px-5 pb-5 pt-2 text-xs text-ink-3">{s.yesterdayEmpty}</p>
              ) : (
                <BoardTable rows={board.yesterday.best} />
              )}
            </Panel>
          </Reveal>
        </>
      )}

      {picking !== null && board && (
        <Modal open onClose={() => setPicking(null)} title={s.pickerTitle} wide>
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
            {KIND_ORDER.map((kind) => {
              const items = board.catalog.filter((p) => p.kind === kind);
              if (items.length === 0) return null;
              const style = KIND_STYLE[kind];
              return (
                <div key={kind}>
                  <div
                    className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] ${style.text}`}
                  >
                    <Icon name={style.icon} size={13} />
                    {s.kinds[kind]}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {items.map((p) => (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => {
                          setSlot(picking, p.code);
                          setPicking(null);
                        }}
                        className="relative overflow-hidden rounded-xl border border-line/25 bg-surface-2/50 p-3 text-left transition hover:border-charge/60 hover:bg-charge/[0.06]"
                      >
                        <span className={`rig-slot__kind ${style.stripe}`} />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-ink">{p.name}</span>
                          <span className="v-num text-sm font-extrabold text-charge">
                            ${p.priceUsd}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-3">
                          {p.hashPerHour > 0 && <span className="text-ok">+{fmt(p.hashPerHour)}/h</span>}
                          {p.hashBoostPercent > 0 && <span className="text-ok">+{p.hashBoostPercent}%</span>}
                          {p.cooling > 0 && <span className="text-ok">{p.cooling} TU</span>}
                          {p.wattsSupplied > 0 && <span className="text-ok">{p.wattsSupplied} W</span>}
                          {p.heat > 0 && <span className="text-warn">{p.heat} heat</span>}
                          {p.watts > 0 && <span className="text-warn">{p.watts} W</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

function Meter({
  icon,
  label,
  used,
  cap,
  capLabel,
}: {
  icon: IconName;
  label: string;
  used: number;
  cap: number;
  capLabel: string;
}) {
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  const over = used > cap;
  return (
    <div className="v-inset p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-ink-3">
          <Icon name={icon} size={12} />
          {label}
        </span>
        <span className={`v-num font-bold ${over ? 'text-heat' : 'text-ink'}`}>
          {used} / {cap}
        </span>
      </div>
      <div className="stability-track mt-2">
        <div
          className={`stability-fill ${over ? 'stability-fill--critical' : pct >= 80 ? 'stability-fill--warn' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-ink-3">{capLabel}</div>
    </div>
  );
}

/** A cost histogram — where the crowd landed, and where you did. */
function Distribution({
  rows,
  mineCost,
  label,
}: {
  rows: { cost: number; count: number }[];
  mineCost: number | null;
  label: string;
}) {
  const peak = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="mt-4 space-y-1.5">
      {rows.map((r) => {
        const mine = mineCost === r.cost;
        return (
          <div key={r.cost} className="flex items-center gap-3">
            <span
              className={`v-num w-12 shrink-0 text-right text-xs font-bold ${
                mine ? 'text-charge' : 'text-ink-3'
              }`}
            >
              {fill(label, { n: r.cost })}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-3/60">
              <div
                className={`h-full rounded-full ${mine ? 'bg-charge' : 'bg-brand/60'}`}
                style={{ width: `${Math.max(4, (r.count / peak) * 100)}%` }}
              />
            </div>
            <span className="v-num w-8 shrink-0 text-xs text-ink-3">{r.count}</span>
          </div>
        );
      })}
    </div>
  );
}

function BoardTable({ rows }: { rows: DailySubmissionDto[] }) {
  const s = useDaily();
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-y border-line/15 bg-surface-2/40 text-left">
            <th className="v-eyebrow px-5 py-2.5">{s.rank}</th>
            <th className="v-eyebrow px-3 py-2.5">{s.miner}</th>
            <th className="v-eyebrow px-3 py-2.5">{s.cost}</th>
            <th className="v-eyebrow px-3 py-2.5">{s.hash}</th>
            <th className="v-eyebrow px-3 py-2.5">{s.build}</th>
          </tr>
        </thead>
        <tbody className="v-stagger">
          {rows.map((r) => (
            <tr key={r.id} className={`border-b border-line/10 ${r.mine ? 'bg-charge/[0.07]' : ''}`}>
              <td className="px-5 py-3">
                <span
                  className={`v-num inline-grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold ${
                    r.rank === 1
                      ? 'bg-charge text-[#0b1204]'
                      : r.rank <= 3
                        ? 'bg-brand/25 text-brand-hi'
                        : 'bg-surface-3 text-ink-2'
                  }`}
                >
                  {r.rank}
                </span>
              </td>
              <td className="px-3 py-3 font-semibold text-ink">
                {r.user.name}
                {r.mine && (
                  <Chip tone="charge" className="ml-2">
                    {s.you}
                  </Chip>
                )}
              </td>
              <td className="v-num px-3 py-3 font-bold text-ink">${r.costUsd}</td>
              <td className="v-num px-3 py-3 text-ink-2">{fmt(r.hashPerHour)}/h</td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1">
                  {r.partCodes.map((c, j) => (
                    <Chip key={c + j} className="text-[10px]">
                      {c}
                    </Chip>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
