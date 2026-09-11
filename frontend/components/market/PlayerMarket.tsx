'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  getProfile,
  getRig,
  type RigPartDto,
  type RigPartKind,
} from '../../lib/api';
import {
  buyListing,
  cancelListing,
  getListings,
  getMyListings,
  listPart,
  MARKET_FEE_BP,
  type ListingDto,
} from '../../lib/api-market';
import { useMiningFX } from '../../lib/use-mining-fx';
import {
  Button,
  Chip,
  Eyebrow,
  Field,
  Icon,
  Input,
  Modal,
  Notice,
  Panel,
  Reveal,
  Segmented,
  Skeleton,
  type IconName,
} from '../ui';
import { useMarket } from './strings';

type KindFilter = 'ALL' | RigPartKind;

const KIND_ORDER: RigPartKind[] = ['CORE', 'COOLER', 'PSU', 'MODULE'];

const KIND_STYLE: Record<RigPartKind, { stripe: string; icon: IconName; text: string; label: string }> = {
  CORE: { stripe: 'rig-slot__kind--core', icon: 'chip', text: 'text-brand-hi', label: 'Cores' },
  COOLER: { stripe: 'rig-slot__kind--cooler', icon: 'snow', text: 'text-[#67e8f9]', label: 'Cooling' },
  PSU: { stripe: 'rig-slot__kind--psu', icon: 'plug', text: 'text-charge', label: 'Power' },
  MODULE: { stripe: 'rig-slot__kind--module', icon: 'sparkle', text: 'text-[#f9a8d4]', label: 'Modules' },
};


function fmt(n: number, d = 0) {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function daysLeftOf(part: RigPartDto): number {
  return Math.max(0, Math.ceil((new Date(part.expiresAt).getTime() - Date.now()) / 86_400_000));
}

/**
 * Player-to-player part market: buy other miners' spare parts for VOLTS,
 * sell your own uninstalled ones. Sits behind the "Player market" segment on
 * the parts-shop page so the two ways of getting a part live side by side.
 */
export function PlayerMarket() {
  const s = useMarket().market;
  const { playTick, playInstall, playError } = useMiningFX();
  const [filter, setFilter] = useState<KindFilter>('ALL');
  const [listings, setListings] = useState<ListingDto[] | null>(null);
  const [mine, setMine] = useState<{ selling: ListingDto[]; sold: ListingDto[]; bought: ListingDto[] } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [buying, setBuying] = useState<ListingDto | null>(null);
  const [selling, setSelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, m, p] = await Promise.all([
        getListings(filter === 'ALL' ? undefined : filter),
        getMyListings(),
        getProfile(),
      ]);
      setListings(l.listings);
      setMine(m);
      setBalance(p.pointsBalance);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : s.offline);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => listings ?? [], [listings]);

  async function cancel(id: string) {
    playTick();
    try {
      await cancelListing(id);
      setFlash(s.cancelled);
      await load();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : s.offline);
    }
  }

  return (
    <div>
      <Reveal className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{s.title}</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-2">{s.subtitle}</p>
        </div>
        <Button
          variant="charge"
          size="sm"
          onClick={() => {
            playTick();
            setSelling(true);
          }}
        >
          <Icon name="arrow-up-right" size={14} />
          {s.sell}
        </Button>
      </Reveal>

      {error && (
        <Notice tone="heat" icon={<Icon name="flame" size={16} />} className="mb-4 animate-rise">
          {error}
        </Notice>
      )}
      {flash && (
        <Notice tone="ok" icon={<Icon name="check" size={16} />} className="mb-4 animate-rise">
          {flash}
        </Notice>
      )}

      <Reveal index={1} className="mb-4 overflow-x-auto pb-1">
        <Segmented<KindFilter>
          value={filter}
          onChange={(v) => {
            playTick();
            setListings(null);
            setFilter(v);
          }}
          options={[
            { value: 'ALL', label: s.filterAll },
            ...KIND_ORDER.map((k) => ({
              value: k,
              label: (
                <span className="flex items-center gap-1.5">
                  <Icon name={KIND_STYLE[k].icon} size={12} />
                  {KIND_STYLE[k].label}
                </span>
              ),
            })),
          ]}
        />
      </Reveal>

      {listings === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Notice tone="default" icon={<Icon name="market" size={16} />}>
          {filter === 'ALL' ? s.empty : s.emptyFiltered}
        </Notice>
      ) : (
        <div className="v-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              onBuy={() => {
                playTick();
                setBuying(l);
              }}
              onCancel={() => cancel(l.id)}
            />
          ))}
        </div>
      )}

      {mine && (mine.selling.length > 0 || mine.sold.length > 0 || mine.bought.length > 0) && (
        <Reveal as="section" index={2} className="mt-10">
          <h3 className="font-display text-lg font-bold text-ink">{s.myTitle}</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <MyList title={s.selling} items={mine.selling} onCancel={cancel} />
            <MyList title={s.sold} items={mine.sold} />
            <MyList title={s.bought} items={mine.bought} />
          </div>
        </Reveal>
      )}

      {buying && (
        <BuyModal
          listing={buying}
          balance={balance ?? 0}
          onClose={() => setBuying(null)}
          onDone={async (msg) => {
            playInstall();
            setBuying(null);
            setFlash(msg);
            await load();
          }}
        />
      )}
      {selling && (
        <SellModal
          onClose={() => setSelling(false)}
          onDone={async () => {
            setSelling(false);
            setFlash(s.listed);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ListingCard({
  listing,
  onBuy,
  onCancel,
}: {
  listing: ListingDto;
  onBuy: () => void;
  onCancel: () => void;
}) {
  const s = useMarket().market;
  const style = KIND_STYLE[listing.part.kind];
  const days = listing.part.daysLeft ?? daysLeftOf(listing.part);
  return (
    <Panel lift trace className="relative overflow-hidden p-5">
      <span className={`rig-slot__kind ${style.stripe}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${style.text}`}>
            <Icon name={style.icon} size={13} />
            {listing.part.code ?? style.label}
          </div>
          <h3 className="mt-1 truncate font-display text-base font-bold text-ink">{listing.part.name}</h3>
        </div>
        <Chip tone={days <= 7 ? 'warn' : 'default'}>
          <Icon name="clock" size={11} />
          {days}d {s.daysLeft}
        </Chip>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {listing.part.hashPerHour > 0 && <Stat icon="bolt" label="Hash" value={`+${fmt(listing.part.hashPerHour, 1)}/h`} tone="ok" />}
        {listing.part.hashBoostPercent > 0 && <Stat icon="sparkle" label="Boost" value={`+${listing.part.hashBoostPercent}%`} tone="ok" />}
        {listing.part.cooling > 0 && <Stat icon="snow" label="Cooling" value={`${listing.part.cooling} TU`} tone="ok" />}
        {listing.part.wattsSupplied > 0 && <Stat icon="plug" label="Supply" value={`${listing.part.wattsSupplied} W`} tone="ok" />}
        {listing.part.heat > 0 && <Stat icon="flame" label="Heat" value={`${listing.part.heat} TU`} tone="cost" />}
        {listing.part.watts > 0 && <Stat icon="plug" label="Draw" value={`${listing.part.watts} W`} tone="cost" />}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line/15 pt-4">
        <div>
          <Eyebrow>{s.seller}</Eyebrow>
          <div className="mt-0.5 text-xs font-semibold text-ink-2">{listing.mine ? s.yours : listing.seller.name}</div>
        </div>
        <div className="text-right">
          <div className="v-num text-xl font-extrabold text-charge">{fmt(listing.priceVolts)}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">VOLTS</div>
        </div>
      </div>

      <div className="mt-3">
        {listing.mine ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={onCancel}>
            <Icon name="x" size={13} />
            {s.cancelListing}
          </Button>
        ) : (
          <Button variant="primary" size="sm" className="w-full" onClick={onBuy}>
            <Icon name="wallet" size={13} />
            {s.buy}
          </Button>
        )}
      </div>
    </Panel>
  );
}

function Stat({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone: 'ok' | 'cost' }) {
  return (
    <div className="v-inset flex items-center justify-between gap-2 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-ink-3">
        <Icon name={icon} size={12} />
        {label}
      </span>
      <span className={`v-num font-bold ${tone === 'ok' ? 'text-ok' : 'text-warn'}`}>{value}</span>
    </div>
  );
}

function MyList({
  title,
  items,
  onCancel,
}: {
  title: string;
  items: ListingDto[];
  onCancel?: (id: string) => void;
}) {
  const s = useMarket().market;
  return (
    <Panel className="p-4">
      <Eyebrow>{title}</Eyebrow>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-ink-3">{s.none}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((l) => (
            <li key={l.id} className="v-inset flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <div className="min-w-0">
                <div className="truncate font-bold text-ink">{l.part.name}</div>
                <div className="text-[10px] text-ink-3">
                  {l.status === 'SOLD' && l.buyer ? `→ ${l.buyer.name}` : l.status === 'ACTIVE' ? l.seller.name : l.seller.name}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="v-num font-extrabold text-charge">{fmt(l.priceVolts)}</span>
                {onCancel && l.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => onCancel(l.id)}
                    aria-label={s.cancelListing}
                    className="grid h-6 w-6 place-items-center rounded-full border border-line/25 text-ink-3 transition hover:border-heat/60 hover:text-heat"
                  >
                    <Icon name="x" size={11} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function BuyModal({
  listing,
  balance,
  onClose,
  onDone,
}: {
  listing: ListingDto;
  balance: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const s = useMarket().market;
  const { playError } = useMiningFX();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const after = balance - listing.priceVolts;
  const ok = after >= 0;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await buyListing(listing.id);
      onDone(res.slot !== null && res.slot !== undefined ? s.boughtInstalled(res.slot + 1) : s.boughtInventory);
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : s.offline);
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={s.confirmTitle}>
      <p className="text-sm text-ink-2">{s.confirmBody}</p>
      <div className="v-inset mt-4 space-y-2 p-4 text-sm">
        <Row label={listing.part.name} value={`${fmt(listing.priceVolts)} VOLTS`} strong />
        <Row label={s.balance} value={`${fmt(balance, 2)} VOLTS`} />
        <Row label={s.after} value={`${fmt(after, 2)} VOLTS`} tone={ok ? 'ok' : 'heat'} />
      </div>
      {!ok && (
        <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mt-4 text-xs">
          {s.insufficient}
        </Notice>
      )}
      {error && (
        <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mt-4 text-xs">
          {error}
        </Notice>
      )}
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
          {s.cancel}
        </Button>
        <Button variant="charge" className="flex-1" onClick={confirm} disabled={!ok} loading={busy}>
          <Icon name="bolt" size={14} />
          {s.confirm}
        </Button>
      </div>
    </Modal>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'ok' | 'heat' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? 'font-bold text-ink' : 'text-ink-3'}>{label}</span>
      <span className={`v-num font-bold ${tone === 'ok' ? 'text-ok' : tone === 'heat' ? 'text-heat' : 'text-ink'}`}>{value}</span>
    </div>
  );
}

function SellModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const s = useMarket().market;
  const { playTick, playError } = useMiningFX();
  const [inventory, setInventory] = useState<RigPartDto[] | null>(null);
  const [picked, setPicked] = useState<RigPartDto | null>(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRig()
      .then((r) => setInventory(r.inventory.filter((p) => daysLeftOf(p) > 3)))
      .catch((err) => {
        setInventory([]);
        setError(err instanceof ApiError ? err.message : s.offline);
      });
  }, []);

  const priceN = Number(price);
  const valid = picked !== null && Number.isFinite(priceN) && priceN >= 1 && priceN <= 100_000;
  const fee = valid ? Math.floor((priceN * MARKET_FEE_BP) / 10_000) : 0;
  const net = valid ? priceN - fee : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !picked) return;
    setBusy(true);
    setError(null);
    try {
      await listPart(picked.id, priceN);
      onDone();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : s.offline);
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={s.sellTitle} wide>
      <p className="text-sm text-ink-2">{s.sellBody}</p>
      {inventory === null ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : inventory.length === 0 ? (
        <Notice tone="default" icon={<Icon name="rig" size={16} />} className="mt-4 text-xs">
          {s.sellNone}
        </Notice>
      ) : (
        <form onSubmit={submit}>
          <div className="mt-4">
            <span className="v-label">{s.sellPick}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {inventory.map((p) => {
                const style = KIND_STYLE[p.kind];
                const on = picked?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      playTick();
                      setPicked(p);
                    }}
                    className={`relative overflow-hidden rounded-xl border p-3 text-left transition ${
                      on ? 'border-charge/60 bg-charge/[0.08]' : 'border-line/25 bg-surface-2/50 hover:border-brand-hi/50'
                    }`}
                  >
                    <span className={`rig-slot__kind ${style.stripe}`} />
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${style.text}`}>
                      <Icon name={style.icon} size={12} />
                      {p.code ?? style.label}
                    </div>
                    <div className="mt-0.5 text-sm font-bold text-ink">{p.name}</div>
                    <div className="mt-0.5 text-[11px] text-ink-3">
                      {daysLeftOf(p)}d {s.daysLeft}
                    </div>
                    {on && <Icon name="check" size={14} className="absolute right-3 top-3 text-charge" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={s.sellPrice}>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="250"
              />
            </Field>
            <div className="v-inset space-y-1.5 p-3 text-xs">
              <Row label={s.fee} value={`−${fmt(fee)} VOLTS`} />
              <Row label={s.net} value={`${fmt(net)} VOLTS`} tone="ok" strong />
            </div>
          </div>

          {error && (
            <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mt-4 text-xs">
              {error}
            </Notice>
          )}

          <div className="mt-5 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
              {s.cancel}
            </Button>
            <Button type="submit" variant="charge" className="flex-1" disabled={!valid} loading={busy}>
              <Icon name="arrow-up-right" size={14} />
              {s.list}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
