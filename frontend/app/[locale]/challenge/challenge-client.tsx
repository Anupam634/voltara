'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError, getToken, type RigPartKind } from '../../../lib/api';
import {
  getChallenge,
  simulateRig,
  submitBuild,
  SIM_SLOTS,
  type CatalogPartDto,
  type ChallengeBoard,
  type SubmissionDto,
} from '../../../lib/api-market';
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
import { useMarket } from '../../../components/market/strings';
import { useDaily } from '../../../components/daily/strings';
import { RigCodeBar } from '../../../components/rigcode/RigCodeBar';
import { decodeRigCode, slotsFromCodes } from '../../../lib/rig-code';
import { useRigCode } from '../../../components/rigcode/strings';

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

function useCountdown(target: string | null) {
  const s = useMarket().challenge;
  const [left, setLeft] = useState(() => (target ? new Date(target).getTime() - Date.now() : 0));
  useEffect(() => {
    if (!target) return;
    const tick = () => setLeft(new Date(target).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  if (left <= 0) return s.ended;
  const h = Math.floor(left / 3_600_000);
  const d = Math.floor(h / 24);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const sec = Math.floor((left % 60_000) / 1000);
  if (d > 0) return `${d}d ${h % 24}h ${m}m`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Weekly blueprint: one hash target, build the cheapest rig that hits it at
 * 100% stability. The builder runs the rig maths client-side for a live
 * readout; the server recomputes on submit and ranks by cost.
 */
export default function ChallengeClient() {
  const s = useMarket().challenge;
  const RC = useRigCode();
  const daily = useDaily();
  const t = useTranslations('dashboard');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const search = useSearchParams();
  const { playTick, playInstall, playError } = useMiningFX();

  const [board, setBoard] = useState<ChallengeBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(SIM_SLOTS).fill(null));
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  // A build arriving in `?build=` is someone else's rig: it wins over the
  // miner's own saved entry, because they followed a link to look at it.
  const [fromLink, setFromLink] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await getChallenge();
      setBoard(b);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.replace(`/${params.locale}/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : s.offline);
    }
  }, [router, params.locale]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${params.locale}/login`);
      return;
    }
    load();
  }, [load, router, params.locale]);

  usePolling(load, 30_000);

  // A shared `?build=` code fills the grid as soon as the catalogue is in,
  // and claims the seed so the miner's own entry does not overwrite it.
  useEffect(() => {
    if (seeded || !board) return;
    const raw = search.get('build');
    if (!raw) return;
    const parsed = decodeRigCode(raw, board.catalog);
    if (!parsed || parsed.codes.length === 0) return;
    setSlots(slotsFromCodes(parsed.codes, SIM_SLOTS));
    setFromLink(true);
    setSeeded(true);
  }, [board, seeded, search]);

  // Seed the builder with the miner's existing entry once, so "update build"
  // starts from what they submitted rather than an empty grid.
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
    () => slots.filter((c): c is string => c !== null).map((c) => byCode.get(c)).filter((p): p is CatalogPartDto => !!p),
    [slots, byCode],
  );
  const sim = useMemo(() => simulateRig(parts), [parts]);
  const target = board?.challenge.targetHashPerHour ?? 0;
  const meetsHash = sim.hashPerHour >= target;
  const stable = sim.gridStability === 100;
  const valid = parts.length > 0 && meetsHash && stable;
  const ended = board ? new Date(board.challenge.endsAt).getTime() <= Date.now() : false;
  const countdown = useCountdown(board?.challenge.endsAt ?? null);

  function setSlot(i: number, code: string | null) {
    playTick();
    setSlots((prev) => prev.map((c, j) => (j === i ? code : c)));
  }

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submitBuild(parts.map((p) => p.code));
      playInstall();
      setFlash(s.submitted(res.rank));
      await load();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : s.offline);
    } finally {
      setBusy(false);
    }
  }

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
      {flash && (
        <Notice tone="charge" icon={<Icon name="trophy" size={16} />} className="mb-5 animate-rise">
          {flash}
        </Notice>
      )}

      {!board ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-40 w-full rounded-2xl lg:col-span-12" />
          <Skeleton className="h-96 w-full rounded-2xl lg:col-span-7" />
          <Skeleton className="h-96 w-full rounded-2xl lg:col-span-5" />
        </div>
      ) : (
        <>
          {/* ── The daily puzzle, for anyone who wants a shorter game ── */}
          <Reveal>
            <Link
              href={`/${params.locale}/daily`}
              className="v-panel v-panel--lift mb-6 flex items-center gap-4 p-4 sm:p-5"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-charge/30 bg-charge/12 text-charge">
                <Icon name="star" size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-bold text-ink">
                  {daily.challengeLinkTitle}
                </span>
                <span className="mt-0.5 block text-xs text-ink-2">{daily.challengeLinkBody}</span>
              </span>
              <span className="hidden shrink-0 text-xs font-bold text-charge sm:inline">
                {daily.challengeLinkCta}
              </span>
              <Icon name="chevron-right" size={16} className="shrink-0 text-ink-3" />
            </Link>
          </Reveal>

          {/* ── Header: the target ─────────────────────────────── */}
          <Reveal>
            <Panel hud tone={ended ? 'default' : 'charge'} className="v-scanlines relative overflow-hidden p-5 sm:p-7">
              <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-7">
                  <Eyebrow tone="charge">{board.challenge.weekKey}</Eyebrow>
                  <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{board.challenge.title}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">{board.challenge.body}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Chip tone="charge" dot>
                      {s.target} {fmt(target)} {s.perHour}
                    </Chip>
                    <Chip>
                      <Icon name="users" size={11} />
                      {board.challenge.submissions} {s.submissions}
                    </Chip>
                    <Chip tone={ended ? 'heat' : 'default'}>
                      <Icon name="clock" size={11} />
                      {s.endsIn} {countdown}
                    </Chip>
                  </div>
                </div>
                <div className="lg:col-span-5">
                  <Eyebrow>{s.rewards}</Eyebrow>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {board.challenge.rewards.map((code, i) => (
                      <div key={code + i} className="v-inset p-3 text-center">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-3">{s.rewardRank[i] ?? `#${i + 1}`}</div>
                        <div className={`v-num mt-1 text-base font-extrabold ${i === 0 ? 'text-charge' : 'text-brand-hi'}`}>{code}</div>
                        <div className="text-[10px] text-ink-3">{byCode.get(code)?.name ?? '30-day part'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="v-trace mt-5" />
            </Panel>
          </Reveal>

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            {/* ── Builder ────────────────────────────────────────── */}
            <Reveal index={1} className="lg:col-span-7">
              <Panel hud className="p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-ink">{s.builderTitle}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      playTick();
                      setSlots(Array(SIM_SLOTS).fill(null));
                      setFromLink(false);
                    }}
                    className="text-xs font-bold text-ink-3 transition hover:text-heat"
                  >
                    {s.clear}
                  </button>
                </div>
                <p className="mt-1 text-xs text-ink-3">{s.builderHint}</p>

                <RigCodeBar
                  className="mt-4"
                  codes={slots}
                  catalog={board.catalog}
                  locale={params.locale}
                  note={fromLink ? RC.loadedFromLink : null}
                  onLoad={(loadedCodes) => {
                    setSlots(slotsFromCodes(loadedCodes, SIM_SLOTS));
                    setFromLink(false);
                  }}
                />

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
                          disabled={ended}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">#{i + 1}</span>
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
                        disabled={ended}
                        title="Remove"
                      >
                        <span className={`rig-slot__kind ${style.stripe}`} />
                        <span className="flex items-center justify-between">
                          <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] ${style.text}`}>
                            <Icon name={style.icon} size={12} />
                            {part.code}
                          </span>
                          <span className="v-num text-[11px] font-bold text-ink-3">${part.priceUsd}</span>
                        </span>
                        <span>
                          <span className="block truncate text-sm font-bold text-ink">{part.name}</span>
                          <span className="mt-0.5 block text-[10px] text-ink-3">
                            {part.hashPerHour > 0 && `+${fmt(part.hashPerHour)}/h · `}
                            {part.cooling > 0 && `${part.cooling} TU cool · `}
                            {part.wattsSupplied > 0 && `${part.wattsSupplied} W supply · `}
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

            {/* ── Readout ────────────────────────────────────────── */}
            <Reveal index={2} className="lg:col-span-5">
              <Panel hud tone={valid ? 'charge' : sim.overheating || sim.brownout ? 'heat' : 'default'} className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Eyebrow>{s.cost}</Eyebrow>
                    <div className="v-num mt-1 text-3xl font-extrabold text-ink">${sim.costUsd}</div>
                    <Eyebrow className="mt-3 block">{s.hash}</Eyebrow>
                    <div className={`v-num mt-1 text-2xl font-extrabold ${meetsHash && parts.length ? 'text-charge' : 'text-ink'}`}>
                      {fmt(sim.hashPerHour)} <span className="text-xs text-ink-3">/h</span>
                    </div>
                  </div>
                  <Gauge value={parts.length ? sim.gridStability : 100} size={120} stroke={10} label={s.stability} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <Meter icon="flame" label={s.heat} used={sim.heatLoad} cap={sim.coolingCapacity} capLabel={s.cooling} />
                  <Meter icon="plug" label={s.draw} used={sim.powerDraw} cap={sim.powerSupply} capLabel={s.supply} />
                </div>

                <div className="mt-4">
                  {parts.length === 0 ? null : valid ? (
                    <Chip tone="ok" dot>
                      {s.meets}
                    </Chip>
                  ) : !stable ? (
                    <Chip tone="heat" dot>
                      {s.unstable}
                    </Chip>
                  ) : (
                    <Chip tone="warn" dot>
                      {s.belowTarget(Math.max(0, Math.ceil((target - sim.hashPerHour) * 10) / 10))}
                    </Chip>
                  )}
                </div>

                <Button
                  variant="charge"
                  size="lg"
                  className="mt-5 w-full"
                  disabled={!valid || ended}
                  loading={busy}
                  onClick={submit}
                >
                  <Icon name="trophy" size={16} />
                  {board.mine ? s.resubmit : s.submit}
                </Button>

                {board.mine && (
                  <div className="v-inset mt-4 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">{s.mine}</span>
                      <Chip tone="charge">#{board.mine.rank}</Chip>
                    </div>
                    <div className="mt-1 text-ink-3">
                      ${board.mine.costUsd} · {fmt(board.mine.hashPerHour)}/h · {board.mine.partCodes.join(' + ')}
                    </div>
                  </div>
                )}
              </Panel>
            </Reveal>
          </div>

          {/* ── Board ──────────────────────────────────────────────── */}
          <Reveal as="section" index={3} className="mt-8">
            <Panel className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 px-5 pt-5">
                <h3 className="font-display text-lg font-bold text-ink">{s.boardTitle}</h3>
                <Eyebrow>{board.challenge.weekKey}</Eyebrow>
              </div>
              {board.top.length === 0 ? (
                <div className="p-5">
                  <Notice tone="default" icon={<Icon name="trophy" size={16} />}>
                    {s.boardEmpty}
                  </Notice>
                </div>
              ) : (
                <BoardTable rows={board.top} />
              )}
            </Panel>
          </Reveal>

          <Reveal as="section" index={4} className="mt-6">
            <Panel className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 px-5 pt-5">
                <h3 className="font-display text-lg font-bold text-ink">{s.previousTitle}</h3>
                {board.previous && <Eyebrow>{board.previous.challenge.weekKey}</Eyebrow>}
              </div>
              {!board.previous ? (
                <p className="px-5 pb-5 pt-2 text-xs text-ink-3">{s.previousEmpty}</p>
              ) : (
                <>
                  <p className="px-5 pt-1 text-xs text-ink-2">{board.previous.challenge.title}</p>
                  {board.previous.winners.length === 0 ? (
                    <p className="px-5 pb-5 pt-2 text-xs text-ink-3">{s.boardEmpty}</p>
                  ) : (
                    <BoardTable rows={board.previous.winners} rewards={board.previous.challenge.rewards} />
                  )}
                </>
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
                  <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] ${style.text}`}>
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
                          <span className="v-num text-sm font-extrabold text-charge">${p.priceUsd}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-3">
                          {p.hashPerHour > 0 && <span className="text-ok">+{fmt(p.hashPerHour)}/h</span>}
                          {p.hashBoostPercent > 0 && <span className="text-ok">+{p.hashBoostPercent}% hash</span>}
                          {p.cooling > 0 && <span className="text-ok">{p.cooling} TU cooling</span>}
                          {p.wattsSupplied > 0 && <span className="text-ok">{p.wattsSupplied} W supply</span>}
                          {p.heat > 0 && <span className="text-warn">{p.heat} heat</span>}
                          {p.watts > 0 && <span className="text-warn">{p.watts} W draw</span>}
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

function BoardTable({ rows, rewards }: { rows: SubmissionDto[]; rewards?: string[] }) {
  const s = useMarket().challenge;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-y border-line/15 bg-surface-2/40 text-left">
            <th className="px-5 py-2.5 v-eyebrow">{s.rank}</th>
            <th className="px-3 py-2.5 v-eyebrow">{s.miner}</th>
            <th className="px-3 py-2.5 v-eyebrow">{s.cost}</th>
            <th className="px-3 py-2.5 v-eyebrow">{s.hash}</th>
            <th className="px-3 py-2.5 v-eyebrow">{s.build}</th>
          </tr>
        </thead>
        <tbody className="v-stagger">
          {rows.map((r, i) => (
            <tr
              key={r.id}
              className={`border-b border-line/10 ${r.mine ? 'bg-charge/[0.07]' : ''}`}
            >
              <td className="px-5 py-3">
                <span
                  className={`v-num inline-grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold ${
                    r.rank === 1 ? 'bg-charge text-[#0b1204]' : r.rank <= 3 ? 'bg-brand/25 text-brand-hi' : 'bg-surface-3 text-ink-2'
                  }`}
                >
                  {r.rank}
                </span>
              </td>
              <td className="px-3 py-3 font-semibold text-ink">
                {r.user.name}
                {r.mine && <Chip tone="charge" className="ml-2">{s.you}</Chip>}
                {rewards && rewards[i] && <Chip tone="brand" className="ml-2">+{rewards[i]}</Chip>}
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
