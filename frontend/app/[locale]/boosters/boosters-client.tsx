'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  createBoosterIntent,
  getBoosters,
  getToken,
  submitBoosterPayment,
  type ActiveBoosterDto,
  type BoosterOverview,
  type BoosterPlanDto,
  type BoosterPurchaseDto,
  type PartFit,
  type RigPartKind,
} from '../../../lib/api';
import { AppShell } from '../../../components/AppShell';
import { BnbBadge } from '../../../components/BnbLogo';
import {
  Button,
  ButtonLink,
  Chip,
  Eyebrow,
  Field,
  Icon,
  Input,
  Modal,
  Notice,
  Panel,
  Progress,
  Reveal,
  Segmented,
  Skeleton,
  type IconName,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';
import { PlayerMarket } from '../../../components/market/PlayerMarket';
import { useMarket } from '../../../components/market/strings';

type KindFilter = 'ALL' | RigPartKind;
type View = 'shop' | 'market';

/** Cores first: they are what a miner came for; the rest is what it costs. */
const KIND_ORDER: RigPartKind[] = ['CORE', 'COOLER', 'PSU', 'MODULE'];

/** Kind → stripe, icon and accent, shared with the rig so a part looks the same. */
const KIND_STYLE: Record<RigPartKind, { stripe: string; icon: IconName; text: string; label: string; hint: string }> = {
  CORE: { stripe: 'rig-slot__kind--core', icon: 'chip', text: 'text-brand-hi', label: 'kindCore', hint: 'kindCoreHint' },
  COOLER: { stripe: 'rig-slot__kind--cooler', icon: 'snow', text: 'text-[#67e8f9]', label: 'kindCooler', hint: 'kindCoolerHint' },
  PSU: { stripe: 'rig-slot__kind--psu', icon: 'plug', text: 'text-charge', label: 'kindPsu', hint: 'kindPsuHint' },
  MODULE: { stripe: 'rig-slot__kind--module', icon: 'sparkle', text: 'text-[#f9a8d4]', label: 'kindModule', hint: 'kindModuleHint' },
};

export default function BoostersClient() {
  const MS = useMarket();
  const t = useTranslations('boosters');
  const tr = useTranslations('rig');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  // A rescue CTA links here naming the one part that fixes the rig, e.g.
  // `?part=CX2`. Light that card up and scroll to it.
  const wantedPart = useSearchParams()?.get('part') ?? null;
  const { playTick } = useMiningFX();

  const [data, setData] = useState<BoosterOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<BoosterPlanDto | null>(null);
  const [filter, setFilter] = useState<KindFilter>('ALL');
  const [view, setView] = useState<View>('shop');

  const load = useCallback(async () => {
    try {
      setData(await getBoosters());
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

  // Bring the named part into view once the catalogue has painted. Runs on
  // the data, not on mount, because the card does not exist before then.
  useEffect(() => {
    if (!wantedPart || !data) return;
    const el = document.getElementById(`part-${wantedPart}`);
    if (!el) return;
    const id = window.setTimeout(
      () => el.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      120,
    );
    return () => window.clearTimeout(id);
  }, [wantedPart, data]);

  const kinds = useMemo(() => (filter === 'ALL' ? KIND_ORDER : [filter]), [filter]);

  return (
    <AppShell
      locale={params.locale}
      backLabel={t('backToDashboard')}
      eyebrow={<BnbBadge label={t('poweredByBnb')} />}
      title={t('title')}
      subtitle={t('subtitle')}
      width="max-w-5xl"
      actions={
        <ButtonLink href={`/${params.locale}/rig`} variant="ghost" size="sm">
          <Icon name="rig" size={14} />
          {tr('title')}
        </ButtonLink>
      }
    >
      {/* Two ways to get a part: buy new from the shop, or buy a used one
          from another miner for VOLTS. Same page so the choice is visible. */}
      <div className="mb-6 animate-rise">
        <Segmented<View>
          className="grid w-full max-w-sm grid-cols-2"
          value={view}
          onChange={(v) => {
            playTick();
            setView(v);
          }}
          options={[
            {
              value: 'shop',
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Icon name="market" size={12} />
                  {MS.market.segmentShop}
                </span>
              ),
            },
            {
              value: 'market',
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Icon name="users" size={12} />
                  {MS.market.segmentMarket}
                </span>
              ),
            },
          ]}
        />
      </div>

      {view === 'market' ? (
        <PlayerMarket />
      ) : (
        <>
      {error && (
        <Notice tone="heat" icon={<Icon name="flame" size={16} />} className="mb-5 animate-rise">
          {error}
        </Notice>
      )}

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {!data.payment.enabled && (
            <Notice tone="warn" icon={<Icon name="lock" size={16} />} className="mb-6 animate-rise">
              {t('paymentsDisabled')}
              {data.payment.disabledReason && (
                <span className="mt-1 block font-mono text-xs opacity-80">{data.payment.disabledReason}</span>
              )}
            </Notice>
          )}

          {data.activeBoosters.length > 0 && (
            <Reveal as="section" className="mb-8">
              <ActiveParts parts={data.activeBoosters} />
            </Reveal>
          )}

          {/* Parts are grouped by what they do, because that is how a
              build decision is actually made: a miner comes here to fix
              heat, or to fix power, not to browse a price list. */}
          <Reveal index={1} className="mb-4 overflow-x-auto pb-1">
            <Segmented<KindFilter>
              value={filter}
              onChange={(v) => {
                playTick();
                setFilter(v);
              }}
              options={[
                { value: 'ALL', label: 'All' },
                ...KIND_ORDER.map((k) => ({
                  value: k,
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Icon name={KIND_STYLE[k].icon} size={12} />
                      {t(KIND_STYLE[k].label)}
                    </span>
                  ),
                })),
              ]}
            />
          </Reveal>

          {kinds.map((kind, ki) => {
            const parts = data.plans.filter((p) => p.kind === kind);
            if (parts.length === 0) return null;
            const style = KIND_STYLE[kind];
            return (
              <Reveal as="section" key={kind} index={ki + 2} className="mb-10">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className={`flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] ${style.text}`}>
                    <Icon name={style.icon} size={15} />
                    {t(style.label)}
                  </h2>
                  <Eyebrow>{t(style.hint)}</Eyebrow>
                </div>
                <div className="v-stagger mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {parts.map((p) => (
                    <div key={p.id} id={`part-${p.code ?? p.id}`} className="scroll-mt-28">
                      <PlanCard
                        plan={p}
                        highlight={!!p.code && p.code === wantedPart}
                        disabled={!data.payment.enabled}
                        onBuy={() => {
                          playTick();
                          setCheckout(p);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </Reveal>
            );
          })}

          {data.purchases.length > 0 && (
            <Reveal as="section" index={3}>
              <PurchaseHistory purchases={data.purchases} />
            </Reveal>
          )}
        </>
      )}
        </>
      )}

      {checkout && (
        <CheckoutModal
          plan={checkout}
          minConfirmations={data?.payment.minConfirmations ?? 6}
          onClose={() => setCheckout(null)}
          onDone={async () => {
            setCheckout(null);
            await load();
          }}
        />
      )}
    </AppShell>
  );
}

/** Owned parts and how much life is left in each. */
function ActiveParts({ parts }: { parts: ActiveBoosterDto[] }) {
  const t = useTranslations('boosters');
  return (
    <Panel hud className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-ink">{t('activeTitle')}</h2>
        <Eyebrow>{parts.length}</Eyebrow>
      </div>
      <ul className="v-stagger mt-4 space-y-2.5">
        {parts.map((b) => {
          const style = KIND_STYLE[b.kind];
          const start = new Date(b.startedAt).getTime();
          const end = new Date(b.expiresAt).getTime();
          const left = end > start ? Math.max(0, Math.min(100, ((end - Date.now()) / (end - start)) * 100)) : 0;
          const running = b.installedSlot !== null;
          return (
            <li key={b.id} className="v-inset p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`flex min-w-0 items-center gap-2 text-sm font-extrabold ${style.text}`}>
                  <Icon name={style.icon} size={15} className="shrink-0" />
                  <span className="truncate text-ink">{b.name}</span>
                </span>
                <span className="flex items-center gap-2">
                  {/* Owning a part is not running it — say which. */}
                  <Chip tone={running ? 'ok' : 'warn'} dot={running}>
                    {running ? t('inSlot', { slot: (b.installedSlot as number) + 1 }) : t('inInventory')}
                  </Chip>
                  <span className="text-[11px] text-ink-3">
                    {t('expires')} {new Date(b.expiresAt).toLocaleDateString()}
                  </span>
                </span>
              </div>
              <Progress value={left} charge={running} className="mt-2.5 h-1.5" />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function PlanCard({
  plan,
  disabled,
  onBuy,
  highlight = false,
}: {
  plan: BoosterPlanDto;
  disabled: boolean;
  onBuy: () => void;
  /** Arrived here from a rescue CTA naming this exact part. */
  highlight?: boolean;
}) {
  const t = useTranslations('boosters');
  const style = KIND_STYLE[plan.kind];

  return (
    <Panel
      lift
      trace
      tone={highlight ? 'charge' : 'default'}
      className={`relative flex flex-col justify-between overflow-hidden p-5 ${
        highlight ? 'v-trace-border--on' : ''
      }`}
    >
      <span className={`rig-slot__kind ${style.stripe}`} />
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`flex items-center gap-2 text-sm font-extrabold ${style.text}`}>
              <Icon name={style.icon} size={15} className="shrink-0" />
              <span className="truncate text-ink">{plan.name}</span>
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-3">
              {plan.code ?? '—'} · T{plan.tier}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="v-num text-2xl font-extrabold text-ink">${plan.priceUsd}</span>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-3">/ {plan.durationDays}d</span>
          </div>
        </div>

        {/* What it gives, then what it costs to run. Both, always — a part
            bought without the second number is what overheats a rig. */}
        <dl className="mt-4 space-y-1.5">
          {plan.rateBonusPerHour > 0 && (
            <Figure icon="chip" tone="gain" label="Hash" value={`+${plan.rateBonusPerHour} VOLTS/h`} />
          )}
          {plan.hashBoostPercent > 0 && (
            <Figure icon="sparkle" tone="gain" label="Hash" value={`+${plan.hashBoostPercent}%`} />
          )}
          {plan.cooling > 0 && <Figure icon="snow" tone="gain" label="Cooling" value={`−${plan.cooling} TU`} />}
          {plan.wattsSupplied > 0 && <Figure icon="plug" tone="gain" label="Supply" value={`+${plan.wattsSupplied} W`} />}
          {plan.heat > 0 && <Figure icon="flame" tone="cost" label="Heat" value={`+${plan.heat} TU`} />}
          {plan.watts > 0 && <Figure icon="plug" tone="cost" label="Draw" value={`−${plan.watts} W`} />}
        </dl>

        <div className="v-divider mt-4" />

        {/* What this part does to THIS miner's rig. The stock-chassis figure
            below it is right only for someone who owns nothing, and it is
            the number that sells a core no rig can cool. */}
        {plan.fit ? (
          <FitBlock fit={plan.fit} />
        ) : null}

        <div className="mt-3 space-y-1.5 text-xs">
          {plan.kind === 'CORE' && !plan.fit && (
            <div className="flex items-center justify-between">
              <span className="text-ink-3">{t('resultingRate')}</span>
              <span className="v-num font-extrabold text-charge">{plan.resultingRatePerHour} /h</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-ink-3">{t('duration')}</span>
            <span className="v-num font-bold text-ink-2">
              {plan.durationDays} {t('days')} · {t('stackable')}
            </span>
          </div>
        </div>
      </div>

      <Button variant={plan.kind === 'CORE' ? 'charge' : 'primary'} className="mt-5 w-full" onClick={onBuy} disabled={disabled}>
        {t('buy')}
        <Icon name="arrow-up-right" size={14} />
      </Button>
    </Panel>
  );
}

/**
 * "What happens if I buy this?", answered against the miner's own rig.
 *
 * Three states, and each is honest about a different thing:
 *  - clean: the part runs as sold. The rate shown is the rate they will earn.
 *  - deficit with a fix: the part throttles the rig, and here is what the
 *    working build actually costs. The total is shown BEFORE the buy button,
 *    not discovered after.
 *  - no free slot: nothing to sell here yet.
 *
 * A cooler is the case that justifies the whole component: it adds no hash,
 * so the old card read "+0/hr" — but on an overheating rig it is often the
 * largest rate increase on the page, because stability multiplies everything.
 */
function FitBlock({ fit }: { fit: PartFit }) {
  const t = useTranslations('boosters');

  if (!fit.fits) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-warn/10 px-3 py-2 text-[11px] text-warn">
        <Icon name="lock" size={13} className="shrink-0" />
        <span>{t('fitNoSlot')}</span>
      </div>
    );
  }

  const gain = fit.ratePerHourAfter - fit.ratePerHourBefore;
  const drops = fit.stabilityAfter < fit.stabilityBefore;

  return (
    <div className="mt-3 rounded-xl border border-line/20 bg-bg/40 p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-3">
        {t('fitTitle')}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-ink-3">{t('fitRate')}</span>
        <span className="v-num font-bold text-ink-2">
          {fit.ratePerHourBefore.toFixed(2)}
          <span className="mx-1 text-ink-3">→</span>
          <span className={`font-extrabold ${gain > 0 ? 'text-charge' : 'text-warn'}`}>
            {fit.ratePerHourAfter.toFixed(2)}
          </span>
          <span className="ml-1 text-ink-3">/h</span>
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-ink-3">{t('fitStability')}</span>
        <span className="v-num font-bold text-ink-2">
          {fit.stabilityBefore}%<span className="mx-1 text-ink-3">→</span>
          <span className={`font-extrabold ${fit.clean ? 'text-ok' : 'text-warn'}`}>
            {fit.stabilityAfter}%
          </span>
        </span>
      </div>

      {fit.clean ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-ok">
          <Icon name="check" size={12} className="shrink-0" />
          {t('fitClean')}
        </p>
      ) : (
        <div className="mt-2.5 space-y-1.5">
          {/* Name the actual shortfall. "Stability 61%" is a symptom; "38 TU
              short of cooling" is something a miner can act on. */}
          <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-warn">
            {fit.heatShort > 0 && <span>{t('fitHeatShort', { n: fit.heatShort })}</span>}
            {fit.wattsShort > 0 && <span>{t('fitWattsShort', { n: fit.wattsShort })}</span>}
          </p>

          {fit.fix ? (
            <div className="rounded-lg bg-charge/[0.08] p-2.5 ring-1 ring-charge/25">
              <p className="text-[11px] font-extrabold text-ink">
                {t('fitAdd', { parts: fit.fix.steps.map((s) => s.name).join(' + ') })}
              </p>
              <p className="v-num mt-0.5 text-[11px] text-ink-3">
                {t('fitAddResult', {
                  stability: fit.fix.stability,
                  rate: fit.fix.ratePerHour.toFixed(2),
                })}
              </p>
              <div className="mt-1.5 flex items-center justify-between border-t border-line/15 pt-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-ink-3">
                  {t('fitTotal')}
                </span>
                <span className="v-num text-sm font-extrabold text-charge">
                  ${fit.fix.totalUsd}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-ink-3">{t('fitNoFix')}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** One physics figure. Gain is what you get, cost is what it burns. */
function Figure({ icon, tone, label, value }: { icon: IconName; tone: 'gain' | 'cost'; label: string; value: string }) {
  const color = tone === 'gain' ? 'text-ok' : 'text-warn';
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <dt className="flex items-center gap-1.5 text-ink-3">
        <Icon name={icon} size={12} className={color} />
        {label}
      </dt>
      <dd className={`v-num font-bold ${color}`}>{value}</dd>
    </div>
  );
}

function PurchaseHistory({ purchases }: { purchases: BoosterPurchaseDto[] }) {
  const t = useTranslations('boosters');
  return (
    <Panel hud className="p-5">
      <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-ink">{t('historyTitle')}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left">
              <th className="v-eyebrow pb-2 font-bold">{t('amount')}</th>
              <th className="v-eyebrow pb-2 font-bold">Status</th>
              <th className="v-eyebrow pb-2 font-bold">{t('txHash')}</th>
              <th className="v-eyebrow pb-2 text-right font-bold">Date</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-t border-line/15">
                <td className="v-num py-2.5 font-bold text-ink">
                  {p.amount} {p.tokenSymbol}
                  {p.failureReason && <span className="block text-xs font-medium text-heat">{p.failureReason}</span>}
                </td>
                <td className="py-2.5">
                  <StatusChip status={p.status} />
                </td>
                <td className="max-w-[10rem] truncate py-2.5 font-mono text-xs text-ink-3">{p.txHash ?? '—'}</td>
                <td className="v-num py-2.5 text-right text-xs text-ink-3">{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function StatusChip({ status }: { status: BoosterPurchaseDto['status'] }) {
  const tone = status === 'CONFIRMED' ? 'ok' : status === 'AWAITING_PAYMENT' ? 'warn' : 'heat';
  return (
    <Chip tone={tone} dot={status === 'AWAITING_PAYMENT'}>
      {status.replace('_', ' ')}
    </Chip>
  );
}

/** Loose shape check only — the server validates the address for real. */
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Booster checkout, in two steps.
 *
 * Step 1 binds the purchase to the wallet the miner will pay from, so a
 * stranger who spots the transaction on-chain cannot claim it. Step 2 is the
 * payment itself: exact amount, destination, and the hash to verify.
 */
function CheckoutModal({
  plan,
  minConfirmations,
  onClose,
  onDone,
}: {
  plan: BoosterPlanDto;
  minConfirmations: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('boosters');
  const [purchase, setPurchase] = useState<BoosterPurchaseDto | null>(null);
  const [fromAddress, setFromAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const style = KIND_STYLE[plan.kind];
  const step = purchase ? 2 : 1;

  async function createIntent(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setPurchase(await createBoosterIntent(plan.id, fromAddress.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('offline'));
    } finally {
      setBusy(false);
    }
  }

  const invalid = fromAddress.trim() !== '' && !ADDRESS_RE.test(fromAddress.trim());

  return (
    <Modal
      open
      onClose={onClose}
      className="max-h-[92dvh] overflow-y-auto"
      title={
        <span className="flex flex-col gap-1">
          <span>{purchase ? t('payTitle') : t('fromTitle')}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-3">
            <span className={`flex items-center gap-1 ${style.text}`}>
              <Icon name={style.icon} size={12} />
              {plan.name}
            </span>
            · <span className="v-num">${plan.priceUsd}</span> · {plan.durationDays} {t('days')}
          </span>
        </span>
      }
    >
      {/* Step indicator. */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <Eyebrow tone="charge">{t('step', { n: step })}</Eyebrow>
          <BnbBadge label={t('chainName')} />
        </div>
        <Progress value={step === 1 ? 50 : 100} charge className="mt-2 h-1.5" />
      </div>

      {purchase ? (
        <PayStep purchase={purchase} minConfirmations={minConfirmations} onClose={onClose} onDone={onDone} />
      ) : (
        <form onSubmit={createIntent}>
          <p className="text-sm leading-relaxed text-ink-2">{t('fromBody')}</p>

          <Field label={t('fromLabel')} error={invalid ? t('fromInvalid') : undefined} className="mt-4">
            <Input
              className="font-mono text-xs"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="0x…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              error={invalid}
            />
          </Field>

          {error && (
            <Notice tone="heat" className="mt-3">
              {error}
            </Notice>
          )}

          <div className="mt-5 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              {t('close')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              loading={busy}
              disabled={busy || !ADDRESS_RE.test(fromAddress.trim())}
            >
              {busy ? t('working') : t('continue')}
              {!busy && <Icon name="chevron-right" size={14} />}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Step 2: pay the exact amount, then hand over the hash to verify. */
function PayStep({
  purchase,
  minConfirmations,
  onClose,
  onDone,
}: {
  purchase: BoosterPurchaseDto;
  minConfirmations: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('boosters');
  const [txHash, setTxHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [web3Busy, setWeb3Busy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  // Plain recipient address in the QR for compatibility with every wallet scanner.
  useEffect(() => {
    if (purchase.payToAddress) {
      setQr(`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(purchase.payToAddress)}`);
    } else {
      setQr(null);
    }
  }, [purchase.payToAddress]);

  // 1-click direct Web3 wallet payment (MetaMask, TrustWallet, OKX, Binance Web3).
  async function handleWeb3Pay() {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setError('No Web3 wallet detected. Please scan the QR code or copy the payment address below.');
      return;
    }
    setWeb3Busy(true);
    setError(null);
    try {
      const provider = (window as any).ethereum;
      const accounts = await provider.request({ method: 'eth_requestAccounts' });

      // Switch to BNB Smart Chain (Chain ID: 56 / 0x38)
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
      } catch (switchErr: any) {
        // If BSC is not added to the wallet, add it.
        if (switchErr.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x38',
                chainName: 'BNB Smart Chain',
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                blockExplorerUrls: ['https://bscscan.com'],
              },
            ],
          });
        }
      }

      // BEP-20 USDT contract on BSC
      const usdtContract = '0x55d398326f99059fF775485246999027B3197955';
      const cleanTo = purchase.payToAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
      const parsedAmount = parseFloat(purchase.amount || '0');
      const amountWei = BigInt(Math.floor(parsedAmount * 1e6)) * BigInt(1e12); // 18 decimals
      const amountHex = amountWei.toString(16).padStart(64, '0');
      const callData = '0xa9059cbb' + cleanTo + amountHex; // transfer(address,uint256)

      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: accounts[0], to: usdtContract, data: callData }],
      });

      if (hash) {
        setTxHash(hash);
        // Auto submit verification
        await submitBoosterPayment(purchase.id, hash);
        onDone();
      }
    } catch (err: any) {
      setError(err.message || 'Web3 payment failed or was cancelled.');
    } finally {
      setWeb3Busy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitBoosterPayment(purchase.id, txHash.trim());
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('offline'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-sm leading-relaxed text-ink-2">{t('payBody')}</p>

      {/* 1-click Web3 payment. */}
      <div className="v-inset mt-4 p-3.5 text-center">
        <Button variant="charge" className="w-full" onClick={handleWeb3Pay} loading={web3Busy} disabled={web3Busy}>
          {!web3Busy && <Icon name="bolt" size={14} />}
          {web3Busy ? 'Opening Web3 wallet…' : `1-Click Pay ${purchase.amount} USDT`}
        </Button>
        <p className="mt-2 text-[11px] text-ink-3">MetaMask · Trust Wallet · OKX · Binance Web3 — fills the exact amount and submits for you.</p>
      </div>

      <div className="relative my-4 flex items-center gap-3">
        <div className="v-divider flex-1" />
        <Eyebrow>or send manually</Eyebrow>
        <div className="v-divider flex-1" />
      </div>

      <dl className="space-y-3">
        <CopyRow label={t('amount')} value={purchase.amount} bold>
          {purchase.amount} {purchase.tokenSymbol}
        </CopyRow>
        <CopyRow label={t('payTo')} value={purchase.payToAddress} mono>
          {purchase.payToAddress}
        </CopyRow>
      </dl>

      {qr && (
        <div className="v-inset mt-4 flex flex-col items-center gap-2.5 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="Payment address QR code"
            width={144}
            height={144}
            className="rounded-lg bg-white p-1.5 shadow-md"
          />
          <p className="text-center text-xs text-ink-3">{t('scanNote')}</p>
        </div>
      )}

      <div className="mt-3">
        <dt className="v-label">{t('payFrom')}</dt>
        <dd className="break-all font-mono text-xs text-ink-3">{purchase.fromAddress}</dd>
      </div>

      <Notice tone="brand" icon={<Icon name="clock" size={14} />} className="mt-3 text-xs">
        {t('payWarning', { confirmations: minConfirmations })}
      </Notice>

      <form onSubmit={submit} className="mt-4">
        <Field label={t('txHash')}>
          <Input
            className="font-mono text-xs"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </Field>

        {error && (
          <Notice tone="heat" className="mt-3">
            {error}
          </Notice>
        )}

        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {t('close')}
          </Button>
          <Button type="submit" variant="primary" className="flex-1" loading={busy} disabled={busy}>
            {busy ? t('verifying') : t('verify')}
            {!busy && <Icon name="check" size={14} />}
          </Button>
        </div>
      </form>
    </>
  );
}

/** A value the miner has to reproduce exactly, so it ships with a copy button. */
function CopyRow({
  label,
  value,
  mono,
  bold,
  children,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('boosters');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the value is still selectable */
    }
  }

  return (
    <div>
      <dt className="v-label">{label}</dt>
      <dd className="flex items-center gap-2">
        <code
          className={`v-inset flex-1 break-all px-3 py-2 ${mono ? 'font-mono text-xs' : 'v-num text-sm'} ${
            bold ? 'font-extrabold text-ink' : 'text-ink-2'
          }`}
        >
          {children}
        </code>
        <Button variant={copied ? 'charge' : 'ghost'} size="sm" className="shrink-0" onClick={copy}>
          <Icon name={copied ? 'check' : 'copy'} size={13} />
          {copied ? '' : t('copy')}
        </Button>
      </dd>
    </div>
  );
}
