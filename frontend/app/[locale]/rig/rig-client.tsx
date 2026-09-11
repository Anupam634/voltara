'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  getRig,
  getToken,
  installPart,
  uninstallPart,
  type RigOverview,
  type RigPartDto,
  type RigPartKind,
  type RigTelemetryDto,
} from '../../../lib/api';
import { AppShell } from '../../../components/AppShell';
import {
  AnimatedNumber,
  Button,
  ButtonLink,
  Chip,
  Eyebrow,
  Gauge,
  Icon,
  Notice,
  Panel,
  Reveal,
  Skeleton,
  type IconName,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';
import { usePolling } from '../../../lib/use-polling';
import { craftPart, salvagePart, setOverclock } from '../../../lib/api-grid';
import { WeatherChip } from '../../../components/grid/WeatherChip';
import { GridEventBanner } from '../../../components/grid/GridEventBanner';
import { LoanerBanner } from '../../../components/onboarding/LoanerBanner';
import { OverclockPanel } from '../../../components/grid/OverclockPanel';
import { SkinPicker } from '../../../components/grid/SkinPicker';
import { Modal } from '../../../components/ui';
import { useS } from '../../../components/grid/strings';
import { RescueBanner } from '../../../components/rescue/RescueBanner';
import { RigCodeBar } from '../../../components/rigcode/RigCodeBar';

/** The server stays the source of truth; a slow refresh keeps burn-out timers honest. */
const REFRESH_MS = 30_000;

/** Kind → stripe, icon and accent, shared by every part on this page. */
const KIND_STYLE: Record<RigPartKind, { stripe: string; icon: IconName; text: string; ring: string }> = {
  CORE: { stripe: 'rig-slot__kind--core', icon: 'chip', text: 'text-brand-hi', ring: 'border-brand/45' },
  COOLER: { stripe: 'rig-slot__kind--cooler', icon: 'snow', text: 'text-[#67e8f9]', ring: 'border-[#22d3ee]/45' },
  PSU: { stripe: 'rig-slot__kind--psu', icon: 'plug', text: 'text-charge', ring: 'border-charge/45' },
  MODULE: { stripe: 'rig-slot__kind--module', icon: 'sparkle', text: 'text-[#f9a8d4]', ring: 'border-[#ec4899]/45' },
};

function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A part that can be turned into scrap: spent, burned, or nearly spent. */
function canSalvage(part: RigPartDto): boolean {
  if (part.burned) return true;
  return new Date(part.expiresAt).getTime() - Date.now() < 3 * 86_400_000;
}

/** "6d 4h" / "4h 12m" / "12m" — a part's remaining life, at a glance. */
function untilBurnout(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '0m';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function RigClient() {
  const S = useS();
  const t = useTranslations('rig');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const { playTick, playInstall, playError } = useMiningFX();

  const [data, setData] = useState<RigOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Slot the miner is filling. Drives the inventory drawer's highlight. */
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  /** Slot that just received a part — gets the seat-in animation once. */
  const [justInstalled, setJustInstalled] = useState<number | null>(null);
  /** The part the forge just produced, shown once in a modal. */
  const [crafted, setCrafted] = useState<{ part: RigPartDto; slot: number | null } | null>(null);
  /** Equipped skin, tracked locally so the grid recolours the moment it changes. */
  const [skin, setSkin] = useState<string>('stock');

  const load = useCallback(async () => {
    try {
      const next = await getRig();
      setData(next);
      setSkin(next.chassis.skin ?? 'stock');
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.replace(`/${params.locale}/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : t('offline'));
    }
  }, [router, params.locale, t]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${params.locale}/login`);
      return;
    }
    load();
  }, [load, router, params.locale]);

  usePolling(load, REFRESH_MS);

  const firstFreeSlot = useMemo(() => data?.grid.find((s) => !s.part)?.index ?? null, [data]);

  async function act(fn: () => Promise<unknown>, onOk?: () => void) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      onOk?.();
      // Re-read rather than patching state locally: installing changes the
      // rate, the stability gauge and every headroom figure at once, and
      // re-deriving those on the client would be a second implementation of
      // the engine that could disagree with the one that pays out.
      await load();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : t('offline'));
    } finally {
      setBusy(false);
    }
  }

  function handleInstall(part: RigPartDto) {
    const slot = targetSlot ?? firstFreeSlot;
    if (slot === null) {
      playError();
      setError(t('rigFull'));
      return;
    }
    setTargetSlot(null);
    act(
      () => installPart(part.id, slot),
      () => {
        playInstall();
        setJustInstalled(slot);
        setTimeout(() => setJustInstalled(null), 600);
      },
    );
  }

  function handleTarget(index: number) {
    playTick();
    setTargetSlot(targetSlot === index ? null : index);
  }

  const rigEmpty = !!data && data.telemetry.installedCount === 0;
  const hasCore = !!data && data.grid.some((s) => s.part?.kind === 'CORE' && !s.part.burned);
  const overclockOn = !!data?.overclock?.active;

  function handleOverclock(on: boolean) {
    playTick();
    act(() => setOverclock(on), () => (on ? playInstall() : undefined));
  }

  function handleSalvage(part: RigPartDto) {
    playTick();
    act(() => salvagePart(part.id));
  }

  function handleCraft() {
    playTick();
    act(
      async () => {
        const res = await craftPart();
        setCrafted({ part: res.part, slot: res.slot });
        if (res.slot !== null) {
          setJustInstalled(res.slot);
          setTimeout(() => setJustInstalled(null), 600);
        }
      },
      () => playInstall(),
    );
  }

  return (
    <AppShell
      locale={params.locale}
      backLabel={t('backToDashboard')}
      eyebrow={t('chassis')}
      title={t('title')}
      subtitle={t('subtitle')}
      width="max-w-5xl"
      actions={
        <ButtonLink href={`/${params.locale}/boosters`} variant={rigEmpty ? 'charge' : 'primary'} size="sm">
          <Icon name="market" size={14} />
          {t('shopCta')}
        </ButtonLink>
      }
    >
      {error && (
        <Notice tone="heat" icon={<Icon name="flame" size={16} />} className="mb-5 animate-rise">
          {error}
        </Notice>
      )}

      <GridEventBanner className="mb-5" />

      {/* A rig below 60% stability is the clearest reason to buy a part, so
          it gets the loudest panel on the page — and the thermal skin. */}
      <RescueBanner
        telemetry={data?.telemetry}
        lostPerHour={data?.rate.throttledAwayPerHour ?? 0}
        locale={params.locale}
        themeOverlay
        className="mb-5"
      />

      {!data ? (
        <RigSkeleton />
      ) : (
        <>
          <Reveal>
            <TelemetryPanel
              telemetry={data.telemetry}
              rate={data.rate}
              chassis={data.chassis}
              overclock={overclockOn}
              weather={data.weather}
              collective={data.collective}
            />
          </Reveal>

          {data.overclock && (
            <Reveal index={1} className="mt-4">
              <OverclockPanel overclock={data.overclock} hasCore={hasCore} busy={busy} onToggle={handleOverclock} />
            </Reveal>
          )}

          {/* The free starter core, if one is still running. Fed from the
              rig we already loaded rather than a second request. */}
          <LoanerBanner
            locale={params.locale}
            className="mt-4"
            parts={[
              ...data.grid.map((s) => s.part).filter((p): p is RigPartDto => p !== null),
              ...data.inventory,
            ]}
          />

          {/* ── The grid ── */}
          <Reveal as="section" index={1} className="mt-8">
            <SectionHead
              title={t('gridTitle')}
              hint={t('gridHint', { used: data.telemetry.installedCount, total: data.chassis.slots })}
            />
            {/* This build, as one line a miner can paste anywhere. Read-only:
                the rig is changed by socketing parts, not by typing a code. */}
            <RigCodeBar
              className="mt-3"
              codes={data.grid.map((sl) => sl.part?.code ?? null)}
              catalog={data.grid
                .map((sl) => sl.part)
                .filter((p): p is RigPartDto => p !== null)
                .map((p) => ({ code: p.code ?? '', kind: p.kind }))}
              locale={params.locale}
            />

            <div className={`rig-grid v-stagger mt-3 rig-skin--${skin} ${overclockOn ? 'rig-grid--overclock' : ''}`}>
              {data.grid.map((slot) => (
                <SlotCard
                  key={slot.index}
                  index={slot.index}
                  part={slot.part}
                  targeted={targetSlot === slot.index}
                  picking={targetSlot !== null}
                  installing={justInstalled === slot.index}
                  overheating={data.telemetry.overheating}
                  busy={busy}
                  onTarget={() => handleTarget(slot.index)}
                  onRemove={() => {
                    playTick();
                    act(() => uninstallPart(slot.index));
                  }}
                  labels={{
                    empty: t('slotEmpty'),
                    tapToFill: t('slotTapToFill'),
                    remove: t('remove'),
                    burnsIn: t('burnsIn'),
                  }}
                />
              ))}
            </div>
          </Reveal>

          <Reveal index={2} className="mt-6">
            <SkinPicker onChange={setSkin} onError={setError} />
          </Reveal>

          {/* ── Inventory ── */}
          <Reveal as="section" index={2} className="mt-8">
            <SectionHead
              title={t('inventoryTitle')}
              hint={targetSlot !== null ? t('inventoryPickFor', { slot: targetSlot + 1 }) : t('inventoryHint')}
              live={targetSlot !== null}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/20 bg-surface/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-warn/15 text-warn">
                  <Icon name="settings" size={16} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-ink">
                    {S.parts.scrap} <span className="v-num text-warn">{data.scrap ?? 0}</span>
                  </p>
                  <p className="text-[11px] text-ink-3">{S.parts.salvageHint}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant={(data.scrap ?? 0) >= 3 ? 'charge' : 'ghost'}
                disabled={busy || (data.scrap ?? 0) < 3}
                onClick={handleCraft}
              >
                <Icon name="sparkle" size={13} />
                {S.parts.craft} · {S.parts.craftCost}
              </Button>
            </div>
            {data.inventory.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-line/30 bg-surface/40 p-6 text-center">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand-hi">
                  <Icon name="rig" size={18} />
                </span>
                <p className="mt-3 text-sm text-ink-2">{t('inventoryEmpty')}</p>
                <ButtonLink
                  href={`/${params.locale}/boosters`}
                  variant={rigEmpty ? 'charge' : 'ghost'}
                  size="sm"
                  className="mt-4"
                >
                  {t('shopCta')}
                </ButtonLink>
              </div>
            ) : (
              <div className="v-stagger mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.inventory.map((part) => (
                  <InventoryCard
                    key={part.id}
                    part={part}
                    busy={busy || (targetSlot === null && firstFreeSlot === null)}
                    full={targetSlot === null && firstFreeSlot === null}
                    picking={targetSlot !== null}
                    onInstall={() => handleInstall(part)}
                    onSalvage={canSalvage(part) ? () => handleSalvage(part) : undefined}
                    labels={{ install: t('install'), rigFull: t('rigFull'), burnsIn: t('burnsIn') }}
                  />
                ))}
              </div>
            )}
          </Reveal>

          <p className="mt-8 text-xs leading-relaxed text-ink-3">{t('footnote')}</p>

          <Modal open={crafted !== null} onClose={() => setCrafted(null)} title={S.parts.craftedTitle}>
            {crafted && (
              <div className="animate-pop">
                <p className="text-sm text-ink-2">{S.parts.craftedBody}</p>
                <div className={`rig-slot rig-slot--filled rig-slot--installing mt-4 rig-skin--${skin}`}>
                  <span className={`rig-slot__kind ${KIND_STYLE[crafted.part.kind].stripe}`} />
                  <div>
                    <span className={`grid h-7 w-7 place-items-center rounded-lg bg-surface-3/80 ${KIND_STYLE[crafted.part.kind].text}`}>
                      <Icon name={KIND_STYLE[crafted.part.kind].icon} size={15} />
                    </span>
                    <p className="mt-1.5 text-sm font-extrabold text-ink">{crafted.part.name}</p>
                    <div className="mt-1.5">
                      <PartFigures part={crafted.part} />
                    </div>
                  </div>
                  <Chip tone="brand" className="mt-2 self-start">T{crafted.part.tier}</Chip>
                </div>
                <Notice tone={crafted.slot !== null ? 'charge' : 'default'} className="mt-4 text-xs">
                  {crafted.slot !== null ? `${S.parts.craftedInstalled} ${crafted.slot + 1}` : S.parts.craftedInventory}
                </Notice>
                <Button variant="primary" className="mt-4 w-full" onClick={() => setCrafted(null)}>
                  {S.parts.close}
                </Button>
              </div>
            )}
          </Modal>
        </>
      )}
    </AppShell>
  );
}

function RigSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="rig-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    </div>
  );
}

function SectionHead({ title, hint, live = false }: { title: string; hint: string; live?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-ink">{title}</h2>
      <span className={`v-eyebrow ${live ? 'v-eyebrow--charge' : ''}`}>{hint}</span>
    </div>
  );
}

/**
 * The gauge.
 *
 * Stability is the one number that explains every other number on the page,
 * so it is the largest thing on it — and the two bars underneath say which
 * of the two ceilings is the one being hit.
 */
function TelemetryPanel({
  telemetry,
  rate,
  chassis,
  overclock = false,
  weather,
  collective,
}: {
  telemetry: RigTelemetryDto;
  rate: RigOverview['rate'];
  chassis: RigOverview['chassis'];
  overclock?: boolean;
  weather?: RigOverview['weather'];
  collective?: RigOverview['collective'];
}) {
  const S = useS();
  const t = useTranslations('rig');
  const s = telemetry.gridStability;
  const stable = s >= 100;
  const failing = telemetry.overheating || telemetry.brownout;
  const tone = s >= 100 ? '' : s >= 60 ? 'stability-fill--warn' : 'stability-fill--critical';
  const mods = telemetry.modifiers;

  return (
    <Panel
      hud
      tone={failing || overclock ? 'heat' : stable && telemetry.installedCount > 0 ? 'charge' : 'default'}
      className="v-scanlines overflow-hidden p-5 sm:p-6"
      as="section"
    >
      <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
        {/* The gauge itself. */}
        <div className="flex flex-col items-center gap-3">
          <Gauge value={s} size={176} stroke={13} label={t('stabilityLabel')} />
          {failing ? (
            <Chip tone="heat" dot>
              {telemetry.overheating ? t('overheating').split(' — ')[0] : t('brownout').split(' — ')[0]}
            </Chip>
          ) : (
            <Chip tone={stable ? 'charge' : 'warn'} dot>
              {stable ? '100%' : `${s}%`}
            </Chip>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>{t('liveRate')}</Eyebrow>
              <p className="mt-1 flex items-baseline gap-1.5 leading-none">
                <AnimatedNumber value={rate.ratePerHour} decimals={2} className="text-4xl font-extrabold text-charge sm:text-5xl" />
                <span className="text-sm font-bold text-ink-3">{t('voltsPerHour')}</span>
              </p>
              {rate.throttledAwayPerHour > 0.005 && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-heat">
                  <Icon name="flame" size={12} />
                  {t('throttledAway', { amount: fmt(rate.throttledAwayPerHour, 2) })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip tone="brand">
                {t('hash')} <span className="v-num">{fmt(telemetry.hashPerHour, 1)}</span>
              </Chip>
              <Chip tone="charge">
                {t('multiplier')} <span className="v-num">×{rate.referralTier.multiplier}</span>
              </Chip>
              <Chip>
                {t('chassis')}{' '}
                <span className="v-num">
                  {chassis.slots} {t('slots')}
                </span>
              </Chip>
              {overclock && (
                <Chip tone="heat" dot>
                  {S.overclock.on}
                </Chip>
              )}
              {(telemetry.disabledCount ?? 0) > 0 && (
                <Chip tone="heat">
                  <span className="v-num">{telemetry.disabledCount}</span> {S.parts.burned.toLowerCase()}
                </Chip>
              )}
              {mods && (mods.squadCooling > 0 || mods.squadPower > 0) && (
                <Chip tone="ok">
                  squad +{mods.squadCooling} TU · +{mods.squadPower} W
                </Chip>
              )}
              <WeatherChip weather={weather} />
              {collective?.holding && (
                <Chip tone="charge" dot>
                  grid +{collective.bonusPercent}%
                </Chip>
              )}
            </div>
          </div>

          <div className="stability-track mt-4">
            <div className={`stability-fill ${tone}`} style={{ width: `${s}%` }} />
          </div>
          <div className="v-trace mt-1.5 opacity-70" />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Meter
              icon="flame"
              label={t('thermal')}
              used={telemetry.heatLoad}
              capacity={telemetry.coolingCapacity}
              unit="TU"
              bad={telemetry.overheating}
              badLabel={t('overheating')}
              goodLabel={t('headroom', { amount: telemetry.coolingCapacity - telemetry.heatLoad })}
            />
            <Meter
              icon="plug"
              label={t('power')}
              used={telemetry.powerDraw}
              capacity={telemetry.powerSupply}
              unit="W"
              bad={telemetry.brownout}
              badLabel={t('brownout')}
              goodLabel={t('headroom', { amount: telemetry.powerSupply - telemetry.powerDraw })}
            />
          </div>
        </div>
      </div>

      {failing && (
        <Notice tone="heat" icon={<Icon name="flame" size={16} />} className="mt-5">
          {telemetry.overheating ? t('overheating') : t('brownout')}
        </Notice>
      )}
    </Panel>
  );
}

/** One capacity bar: demand against the capacity that serves it. */
function Meter({
  icon,
  label,
  used,
  capacity,
  unit,
  bad,
  badLabel,
  goodLabel,
}: {
  icon: IconName;
  label: string;
  used: number;
  capacity: number;
  unit: string;
  bad: boolean;
  badLabel: string;
  goodLabel: string;
}) {
  // Over capacity the bar pins at full and turns — the overflow is the point,
  // so it must not silently run off the end of the track.
  const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
  const tone = bad ? 'stability-fill--critical' : pct >= 80 ? 'stability-fill--warn' : '';
  return (
    <div className="v-inset p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="v-eyebrow flex items-center gap-1.5">
          <Icon name={icon} size={12} className={bad ? 'text-heat' : ''} />
          {label}
        </span>
        <span className="v-num text-xs font-bold text-ink-2">
          {used} / {capacity} {unit}
        </span>
      </div>
      <div className="stability-track mt-2 h-1.5">
        <div className={`stability-fill ${tone}`} style={{ width: `${bad ? 100 : pct}%` }} />
      </div>
      <p className={`mt-1.5 text-[11px] font-bold ${bad ? 'text-heat' : 'text-ink-3'}`}>{bad ? badLabel : goodLabel}</p>
    </div>
  );
}

/** The gain/cost figures of a part, as a compact mono row. */
function PartFigures({ part, hot = false }: { part: RigPartDto; hot?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[10px] text-ink-3">
      {part.hashPerHour > 0 && <span className="text-brand-hi">+{fmt(part.hashPerHour)}/h</span>}
      {part.hashBoostPercent > 0 && <span className="text-[#f9a8d4]">+{part.hashBoostPercent}%</span>}
      {part.cooling > 0 && <span className="text-[#67e8f9]">-{part.cooling} TU</span>}
      {part.heat > 0 && <span className={hot ? 'text-heat' : 'text-warn'}>+{part.heat} TU</span>}
      {part.wattsSupplied > 0 && <span className="text-charge">+{part.wattsSupplied} W</span>}
      {part.watts > 0 && <span>-{part.watts} W</span>}
    </div>
  );
}

function SlotCard({
  index,
  part,
  targeted,
  picking,
  installing,
  overheating,
  busy,
  onTarget,
  onRemove,
  labels,
}: {
  index: number;
  part: RigPartDto | null;
  targeted: boolean;
  picking: boolean;
  installing: boolean;
  overheating: boolean;
  busy: boolean;
  onTarget: () => void;
  onRemove: () => void;
  labels: { empty: string; tapToFill: string; remove: string; burnsIn: string };
}) {
  const S = useS();
  const num = String(index + 1).padStart(2, '0');

  if (!part) {
    return (
      <button
        type="button"
        onClick={onTarget}
        aria-pressed={targeted}
        className={`rig-slot rig-slot--empty text-left ${targeted ? 'rig-slot--target' : ''} ${
          picking && !targeted ? 'opacity-60' : ''
        }`}
      >
        <span className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-widest opacity-70">{num}</span>
          {targeted && <span className="v-dot" />}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <Icon name={targeted ? 'chevron-down' : 'rig'} size={14} className={targeted ? 'animate-breathe' : 'opacity-60'} />
          {targeted ? labels.tapToFill : labels.empty}
        </span>
      </button>
    );
  }

  const style = KIND_STYLE[part.kind];
  // Only cores are blamed for the heat: a cooler or PSU flagged as "hot"
  // would point the miner at the part that is solving the problem.
  const hot = overheating && part.kind === 'CORE' && part.heat > 0 && !part.burned;
  const burned = !!part.burned;

  return (
    <div
      className={`rig-slot rig-slot--filled ${hot ? 'rig-slot--hot' : ''} ${installing ? 'rig-slot--installing' : ''} ${
        burned ? 'rig-slot--burned' : ''
      }`}
    >
      <span className={`rig-slot__kind ${style.stripe}`} />
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-lg bg-surface-3/80 ${style.text}`}>
            <Icon name={style.icon} size={15} />
          </span>
          {burned && part.disabledUntil ? (
            <span className="rig-slot__burned">
              <Icon name="flame" size={9} /> {S.parts.burned} · {untilBurnout(part.disabledUntil)}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">{num}</span>
          )}
        </div>
        <p className="mt-1.5 text-sm font-extrabold leading-tight text-ink">{part.name}</p>
        <div className="mt-1.5">
          <PartFigures part={part} hot={hot} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">
          <Icon name="clock" size={10} />
          {labels.burnsIn} {untilBurnout(part.expiresAt)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="rounded-lg border border-line/25 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-3 transition hover:border-heat/60 hover:text-heat disabled:opacity-40"
        >
          {labels.remove}
        </button>
      </div>
    </div>
  );
}

function InventoryCard({
  part,
  busy,
  full,
  picking,
  onInstall,
  onSalvage,
  labels,
}: {
  part: RigPartDto;
  busy: boolean;
  full: boolean;
  picking: boolean;
  onInstall: () => void;
  onSalvage?: () => void;
  labels: { install: string; rigFull: string; burnsIn: string };
}) {
  const S = useS();
  const style = KIND_STYLE[part.kind];
  const burned = !!part.burned;
  return (
    <Panel
      lift
      trace={picking}
      className={`flex flex-col gap-2 border p-3.5 ${style.ring} ${picking ? 'v-trace-border--on' : ''} ${
        burned ? 'rig-slot--burned' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`flex min-w-0 items-center gap-2 text-sm font-extrabold ${style.text}`}>
          <Icon name={style.icon} size={15} className="shrink-0" />
          <span className="truncate">{part.name}</span>
        </span>
        {burned && part.disabledUntil ? (
          <span className="rig-slot__burned shrink-0">
            <Icon name="flame" size={9} /> {S.parts.burned} · {untilBurnout(part.disabledUntil)}
          </span>
        ) : (
          <Chip className="shrink-0">T{part.tier}</Chip>
        )}
      </div>
      <PartFigures part={part} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">
          <Icon name="clock" size={10} />
          {labels.burnsIn} {untilBurnout(part.expiresAt)}
        </span>
        <span className="flex items-center gap-1.5">
          {onSalvage && (
            <Button size="sm" variant="ghost" onClick={onSalvage} disabled={busy}>
              {S.parts.salvage}
            </Button>
          )}
          <Button
            size="sm"
            variant={picking ? 'charge' : full ? 'ghost' : 'primary'}
            onClick={onInstall}
            disabled={busy || burned}
          >
            {full ? labels.rigFull : labels.install}
          </Button>
        </span>
      </div>
    </Panel>
  );
}
