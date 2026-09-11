import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { Chips } from '../src/components/ui/Segmented';
import { Sheet, ConfirmSheet } from '../src/components/ui/Sheet';
import {
  EmptyState,
  ErrorNote,
  NavBar,
  Screen,
  Skeleton,
} from '../src/components/ui/Chrome';
import { useMarket, fill } from '../src/components/market/strings';
import { useTheme } from '../src/theme/ThemeProvider';
import { useI18n, useT } from '../src/i18n';
import { useToast } from '../src/components/ui/Toast';
import { useFeedback } from '../src/lib/feedback';
import { useAsyncData } from '../src/lib/hooks';
import { formatPoints } from '../src/lib/format';
import {
  buyListing,
  cancelListing,
  getListings,
  getMyListings,
  getProfile,
  getRig,
  listPart,
  type ListingDto,
  type RigPartDto,
  type RigPartKind,
} from '../src/api/endpoints';
import { errorMessage } from '../src/api/client';

/** Kind → icon, the same glyphs the rig and parts shop use. */
const KIND_ICON: Record<RigPartKind, keyof typeof Ionicons.glyphMap> = {
  CORE: 'hardware-chip',
  COOLER: 'snow',
  PSU: 'flash',
  MODULE: 'sparkles',
};

type Filter = 'ALL' | RigPartKind;

/** A part this old cannot be listed — the server refuses it too. */
const THREE_DAYS_MS = 3 * 24 * 3_600_000;
const FEE_BP = 500;

/**
 * The player market.
 *
 * Parts miners are selling to each other for VOLTS. Every card quotes the
 * running cost next to the gain, exactly as the parts shop does: a listing
 * that showed only hash would be selling someone a throttle they cannot see
 * coming. The platform keeps 5%, and the sell sheet says so before the
 * miner commits.
 */
export default function MarketScreen() {
  const { c, spacing, radius } = useTheme();
  const t = useT();
  const m = useMarket();
  const toast = useToast();
  const feedback = useFeedback();

  const [filter, setFilter] = useState<Filter>('ALL');

  const toMessage = useCallback(
    (err: unknown) => errorMessage(err, t('app.offline')),
    [t],
  );

  const loadBoard = useCallback(
    () => getListings(filter === 'ALL' ? undefined : filter),
    [filter],
  );
  const { data, error, loading, refreshing, reload } = useAsyncData(
    loadBoard,
    toMessage,
  );

  const loadMine = useCallback(() => getMyListings(), []);
  const { data: mine, reload: reloadMine } = useAsyncData(loadMine, toMessage);

  // The filter is part of the loader's identity, so a change has to refetch.
  useEffect(() => {
    void reload({ silent: true });
  }, [filter, reload]);

  // Poll while the screen is on top. 30s is slow enough to be cheap and fast
  // enough that a part someone else just bought stops being offered.
  useEffect(() => {
    const id = setInterval(() => {
      void reload({ silent: true });
      void reloadMine({ silent: true });
    }, 30_000);
    return () => clearInterval(id);
  }, [reload, reloadMine]);

  const refreshAll = useCallback(async () => {
    await Promise.all([reload(), reloadMine({ silent: true })]);
  }, [reload, reloadMine]);

  const [buying, setBuying] = useState<ListingDto | null>(null);
  const [selling, setSelling] = useState(false);
  const [busy, setBusy] = useState(false);

  const listings = data?.listings ?? [];

  return (
    <Screen sunken>
      <NavBar title={m.marketTitle} subtitle={m.marketSubtitle} large />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshAll()}
            tintColor={c.primary}
            colors={[c.primary]}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.huge,
          gap: spacing.md,
        }}
      >
        {error ? (
          <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('app.retry')} />
        ) : null}

        <Chips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: m.filterAll },
            { value: 'CORE', label: m.filterCores },
            { value: 'COOLER', label: m.filterCooling },
            { value: 'PSU', label: m.filterPower },
            { value: 'MODULE', label: m.filterModules },
          ]}
          style={{ marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg }}
        />

        <Button
          label={m.sellCta}
          icon="pricetag-outline"
          variant="secondary"
          fullWidth
          onPress={() => setSelling(true)}
        />

        {loading && !data ? (
          <>
            <Skeleton height={170} radius={radius.xl} />
            <Skeleton height={170} radius={radius.xl} />
          </>
        ) : listings.length === 0 ? (
          <EmptyState
            icon="storefront-outline"
            title={m.listingsEmpty}
            body={m.listingsEmptyBody}
          />
        ) : (
          listings.map((listing, i) => (
            <Animated.View
              key={listing.id}
              entering={FadeInDown.delay(i * 40).duration(260)}
              layout={Layout.springify()}
            >
              <ListingCard listing={listing} onBuy={() => setBuying(listing)} />
            </Animated.View>
          ))
        )}

        <MyListings
          mine={mine}
          busy={busy}
          onCancel={async (id) => {
            setBusy(true);
            try {
              await cancelListing(id);
              feedback.tick();
              toast.success(m.cancelledListing);
              await refreshAll();
            } catch (err) {
              feedback.error();
              toast.error(toMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        />
      </ScrollView>

      <BuySheet
        listing={buying}
        busy={busy}
        onClose={() => setBuying(null)}
        onDone={async (slot) => {
          feedback.win();
          toast.success(
            slot === null
              ? m.boughtInventory
              : fill(m.boughtInstalled, { slot: slot + 1 }),
          );
          setBuying(null);
          await refreshAll();
        }}
        onError={(err) => {
          feedback.error();
          toast.error(toMessage(err));
        }}
        setBusy={setBusy}
      />

      <SellSheet
        visible={selling}
        onClose={() => setSelling(false)}
        onDone={async () => {
          feedback.success();
          toast.success(m.listed);
          setSelling(false);
          await refreshAll();
        }}
        onError={(err) => {
          feedback.error();
          toast.error(toMessage(err));
        }}
      />
    </Screen>
  );
}

/* ──────────────────────────── Listing card ─────────────────────────── */

function ListingCard({
  listing,
  onBuy,
}: {
  listing: ListingDto;
  onBuy: () => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const { locale } = useI18n();
  const m = useMarket();
  const part = listing.part;
  const tint = kindTint(part.kind, c);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {/* Kind stripe — a build is legible at a glance on the rig, and a
            listing should read the same way. */}
        <View
          style={{
            width: 3,
            alignSelf: 'stretch',
            borderRadius: 2,
            backgroundColor: tint,
          }}
        />
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(tint, 0.14),
            borderWidth: 1,
            borderColor: alpha(tint, 0.3),
          }}
        >
          <Ionicons name={KIND_ICON[part.kind]} size={18} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline" weight="700">
            {part.name}
          </Text>
          <Text variant="caption" tone="tertiary">
            {m.seller} {listing.seller.name}
          </Text>
        </View>
        <View style={{ gap: 4, alignItems: 'flex-end' }}>
          <Badge label={fill(m.tier, { tier: part.tier })} tone="brand" />
          <Badge
            label={fill(m.daysLeft, { days: Math.max(0, part.daysLeft) })}
            tone={part.daysLeft <= 7 ? 'warning' : 'neutral'}
          />
        </View>
      </View>

      <PartPhysics part={part} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          marginTop: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="title2" mono tone="gold">
            {formatPoints(listing.priceVolts, 0, locale)}
          </Text>
          <Text variant="caption" tone="tertiary" weight="700">
            {m.volts}
          </Text>
        </View>
        {listing.mine ? null : (
          <Button label={m.buy} size="sm" variant="charge" onPress={onBuy} />
        )}
      </View>
    </Card>
  );
}

/**
 * What the part gives and what it costs to run. Both halves, always — the
 * whole mechanic turns on the running cost.
 */
function PartPhysics({ part }: { part: RigPartDto }) {
  const { c, spacing, radius, alpha } = useTheme();

  const items: { text: string; good: boolean }[] = [];
  if (part.hashPerHour > 0) items.push({ text: `+${part.hashPerHour} VOLTS/h`, good: true });
  if (part.hashBoostPercent > 0) items.push({ text: `+${part.hashBoostPercent}% hash`, good: true });
  if (part.cooling > 0) items.push({ text: `−${part.cooling} TU`, good: true });
  if (part.wattsSupplied > 0) items.push({ text: `+${part.wattsSupplied} W`, good: true });
  if (part.heat > 0) items.push({ text: `+${part.heat} TU`, good: false });
  if (part.watts > 0) items.push({ text: `−${part.watts} W`, good: false });

  if (items.length === 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: spacing.sm,
      }}
    >
      {items.map((item) => (
        <View
          key={item.text}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radius.sm,
            backgroundColor: alpha(item.good ? c.success : c.warning, 0.12),
            borderWidth: 1,
            borderColor: alpha(item.good ? c.success : c.warning, 0.24),
          }}
        >
          <Text
            variant="caption"
            mono
            weight="700"
            style={{ color: item.good ? c.success : c.warning }}
          >
            {item.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────────── Buy sheet ───────────────────────────── */

function BuySheet({
  listing,
  busy,
  onClose,
  onDone,
  onError,
  setBusy,
}: {
  listing: ListingDto | null;
  busy: boolean;
  onClose: () => void;
  onDone: (slot: number | null) => Promise<void>;
  onError: (err: unknown) => void;
  setBusy: (next: boolean) => void;
}) {
  const { c, spacing } = useTheme();
  const { locale } = useI18n();
  const m = useMarket();
  const [balance, setBalance] = useState<number | null>(null);

  // Read the balance when the sheet opens rather than holding a stale figure:
  // a purchase elsewhere between screens would otherwise quote the wrong
  // "after" number at the exact moment it matters.
  useEffect(() => {
    let alive = true;
    if (!listing) {
      setBalance(null);
      return;
    }
    void getProfile()
      .then((p) => {
        if (alive) setBalance(p.pointsBalance);
      })
      .catch(() => {
        if (alive) setBalance(null);
      });
    return () => {
      alive = false;
    };
  }, [listing]);

  if (!listing) return null;

  const price = listing.priceVolts;
  const after = balance === null ? null : balance - price;
  const short = balance === null ? 0 : Math.max(0, price - balance);
  const blocked = balance !== null && short > 0;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={m.buyTitle}
      subtitle={fill(m.buyBody, {
        name: listing.part.name,
        price: formatPoints(price, 0, locale),
      })}
      scrollable={false}
      footer={
        <Button
          label={m.confirm}
          variant="charge"
          fullWidth
          loading={busy}
          disabled={busy || blocked}
          silent
          onPress={async () => {
            setBusy(true);
            try {
              const res = await buyListing(listing.id);
              await onDone(res.slot);
            } catch (err) {
              onError(err);
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <View style={{ gap: spacing.sm }}>
        <Row label={m.balance} value={balance === null ? '—' : formatPoints(balance, 0, locale)} />
        <Row
          label={m.buy}
          value={`− ${formatPoints(price, 0, locale)}`}
          tone="warning"
        />
        <Row
          label={m.balanceAfter}
          value={after === null ? '—' : formatPoints(Math.max(0, after), 0, locale)}
          strong
        />
        {blocked ? (
          <Text variant="footnote" style={{ color: c.danger, marginTop: spacing.xs }}>
            {fill(m.notEnough, { short: formatPoints(short, 0, locale) })}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: 'warning';
  strong?: boolean;
}) {
  const { c, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Text variant="callout" tone="secondary">
        {label}
      </Text>
      <Text
        variant={strong ? 'headline' : 'callout'}
        mono
        weight="700"
        style={tone === 'warning' ? { color: c.warning } : undefined}
      >
        {value}
      </Text>
    </View>
  );
}

/* ──────────────────────────── Sell sheet ───────────────────────────── */

function SellSheet({
  visible,
  onClose,
  onDone,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const { locale } = useI18n();
  const m = useMarket();
  const [inventory, setInventory] = useState<RigPartDto[] | null>(null);
  const [picked, setPicked] = useState<RigPartDto | null>(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPicked(null);
      setPrice('');
      return;
    }
    let alive = true;
    void getRig()
      .then((rig) => {
        if (!alive) return;
        // Only what the server will actually accept: owned, not installed,
        // and more than three days from burning out.
        const sellable = rig.inventory.filter(
          (p) =>
            !p.burned &&
            new Date(p.expiresAt).getTime() - Date.now() > THREE_DAYS_MS,
        );
        setInventory(sellable);
      })
      .catch(() => {
        if (alive) setInventory([]);
      });
    return () => {
      alive = false;
    };
  }, [visible]);

  const priceNum = Number(price.replace(/[^\d]/g, ''));
  const valid = !!picked && Number.isFinite(priceNum) && priceNum >= 1 && priceNum <= 100_000;
  const fee = valid ? Math.floor((priceNum * FEE_BP) / 10_000) : 0;
  const net = valid ? priceNum - fee : 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={m.sellTitle}
      subtitle={m.sellHint}
      footer={
        picked ? (
          <Button
            label={m.listIt}
            variant="charge"
            fullWidth
            loading={busy}
            disabled={!valid || busy}
            silent
            onPress={async () => {
              if (!picked) return;
              setBusy(true);
              try {
                await listPart(picked.id, priceNum);
                await onDone();
              } catch (err) {
                onError(err);
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : undefined
      }
    >
      {inventory === null ? (
        <Skeleton height={120} radius={radius.lg} />
      ) : inventory.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title={m.sellEmpty}
          body={m.sellEmptyBody}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {inventory.map((part) => {
            const active = picked?.id === part.id;
            const tint = kindTint(part.kind, c);
            return (
              <Card
                key={part.id}
                padded={false}
                accent={active ? c.gold : undefined}
                onPress={() => setPicked(active ? null : part)}
                style={{ padding: spacing.md }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Ionicons name={KIND_ICON[part.kind]} size={18} color={tint} />
                  <View style={{ flex: 1 }}>
                    <Text variant="callout" weight="700">
                      {part.name}
                    </Text>
                    <Text variant="caption" tone="tertiary" mono>
                      {fill(m.daysLeft, {
                        days: Math.max(
                          0,
                          Math.floor(
                            (new Date(part.expiresAt).getTime() - Date.now()) / 86_400_000,
                          ),
                        ),
                      })}
                    </Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={20} color={c.gold} />
                  ) : null}
                </View>
              </Card>
            );
          })}

          {picked ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Input
                label={m.priceLabel}
                value={price}
                onChangeText={setPrice}
                keyboardType="number-pad"
                placeholder={m.pricePlaceholder}
              />
              <View
                style={{
                  gap: 6,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: alpha(c.primary, 0.08),
                  borderWidth: 1,
                  borderColor: alpha(c.primary, 0.2),
                }}
              >
                <Row label={m.fee} value={`− ${formatPoints(fee, 0, locale)}`} tone="warning" />
                <Row label={m.net} value={formatPoints(net, 0, locale)} strong />
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

/* ─────────────────────────── My listings ───────────────────────────── */

function MyListings({
  mine,
  busy,
  onCancel,
}: {
  mine: { selling: ListingDto[]; sold: ListingDto[]; bought: ListingDto[] } | null;
  busy: boolean;
  onCancel: (id: string) => Promise<void>;
}) {
  const { spacing } = useTheme();
  const { locale } = useI18n();
  const m = useMarket();
  const [confirm, setConfirm] = useState<ListingDto | null>(null);

  if (!mine) return null;
  const total = mine.selling.length + mine.sold.length + mine.bought.length;
  if (total === 0) return null;

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      <Text variant="overline" tone="secondary" uppercase>
        {m.myListings}
      </Text>

      {mine.selling.length > 0 ? (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="caption" tone="tertiary" uppercase>
            {m.selling}
          </Text>
          {mine.selling.map((l) => (
            <View
              key={l.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="callout" weight="700">
                  {l.part.name}
                </Text>
                <Text variant="caption" tone="gold" mono>
                  {formatPoints(l.priceVolts, 0, locale)} {m.volts}
                </Text>
              </View>
              <Button
                label={m.cancelListing}
                size="sm"
                variant="secondary"
                disabled={busy}
                onPress={() => setConfirm(l)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {mine.sold.length > 0 ? (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="caption" tone="tertiary" uppercase>
            {m.sold}
          </Text>
          {mine.sold.map((l) => (
            <Text key={l.id} variant="footnote" tone="secondary">
              {l.part.name} ·{' '}
              {fill(m.soldFor, { price: formatPoints(l.priceVolts, 0, locale) })}
            </Text>
          ))}
        </Card>
      ) : null}

      {mine.bought.length > 0 ? (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="caption" tone="tertiary" uppercase>
            {m.bought}
          </Text>
          {mine.bought.map((l) => (
            <Text key={l.id} variant="footnote" tone="secondary">
              {l.part.name} ·{' '}
              {fill(m.boughtFor, { price: formatPoints(l.priceVolts, 0, locale) })}
            </Text>
          ))}
        </Card>
      ) : null}

      <ConfirmSheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const target = confirm;
          setConfirm(null);
          if (target) await onCancel(target.id);
        }}
        title={m.cancelListing}
        body={confirm?.part.name}
        confirmLabel={m.cancelListing}
        cancelLabel={m.cancel}
        destructive
        icon="close-circle"
        loading={busy}
      />
    </View>
  );
}

/** Kind → semantic colour. Never a raw hex, so skins and themes still hold. */
function kindTint(
  kind: RigPartKind,
  c: ReturnType<typeof useTheme>['c'],
): string {
  switch (kind) {
    case 'COOLER':
      return c.info;
    case 'PSU':
      return c.gold;
    case 'MODULE':
      return c.warning;
    default:
      return c.primary;
  }
}
