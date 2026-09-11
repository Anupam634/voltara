import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';

import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Sheet } from '../../src/components/ui/Sheet';
import { Body, ErrorNote, NavBar, Screen, Skeleton } from '../../src/components/ui/Chrome';
import { EventBanner } from '../../src/components/grid/EventBanner';
import { LoanerCard } from '../../src/components/onboarding/LoanerCard';
import { RigCodeBar } from '../../src/components/rigcode/RigCodeBar';
import { RescueCard } from '../../src/components/rescue/RescueCard';
import { useGrid, fill } from '../../src/components/grid/strings';
import { useMarket } from '../../src/components/market/strings';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useT } from '../../src/i18n';
import { useToast } from '../../src/components/ui/Toast';
import { useFeedback } from '../../src/lib/feedback';
import { useAsyncData, useNow } from '../../src/lib/hooks';
import { countdownLabel } from '../../src/lib/format';
import {
  buySkin,
  craftPart,
  equipSkin,
  getRig,
  getSkins,
  installPart,
  salvagePart,
  setOverclock,
  uninstallPart,
  type RigOverview,
  type RigPartDto,
  type RigPartKind,
  type SkinDto,
  type SkinsDto,
} from '../../src/api/endpoints';
import { errorMessage } from '../../src/api/client';

/**
 * The rig.
 *
 * The same screen as the web app's `/rig`, native: one gauge that explains
 * every other number, a six-socket grid, and the parts that are owned but not
 * running. Tap an empty socket, then tap a part — two taps, no drag, because
 * a drag target this small is a fight on a phone.
 *
 * Around the build sit the things that bend it: the grid event in force,
 * the overclock switch, burned parts, scrap and crafting, and the chassis
 * skin that recolours the sockets.
 */

const KIND_GLYPH: Record<RigPartKind, string> = {
  CORE: '◈',
  COOLER: '❄',
  PSU: '⚡',
  MODULE: '✦',
};

const KIND_ICON: Record<RigPartKind, keyof typeof Ionicons.glyphMap> = {
  CORE: 'hardware-chip',
  COOLER: 'snow',
  PSU: 'flash',
  MODULE: 'sparkles',
};

const THREE_DAYS_MS = 3 * 24 * 3_600_000;

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

/** "6d 4h" / "4h 12m" / "12m" — a part's remaining life. */
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

/** Salvage is for parts that are done: expired, burned, or about to expire. */
function canSalvage(part: RigPartDto): boolean {
  if (part.burned) return true;
  const left = new Date(part.expiresAt).getTime() - Date.now();
  return left <= THREE_DAYS_MS;
}

export default function RigScreen() {
  const { c, spacing, radius, alpha } = useTheme();
  const t = useT();
  const GRID = useGrid();
  const market = useMarket();
  const toast = useToast();
  const feedback = useFeedback();

  const toMessage = useCallback(
    (err: unknown) => errorMessage(err, t('rig.offline')),
    [t],
  );
  const { data, error, loading, refreshing, reload } = useAsyncData<RigOverview>(
    getRig,
    toMessage,
  );

  const [busy, setBusy] = useState(false);
  /** Socket the miner is filling. Drives the inventory highlight. */
  const [targetSlot, setTargetSlot] = useState<number | null>(null);
  /** The part that just came out of the forge. */
  const [crafted, setCrafted] = useState<{ part: RigPartDto; slot: number | null } | null>(null);

  // Skins: read once, re-read after a buy or equip. Their accent recolours
  // the socket edges, which is the whole point of owning one.
  const [skins, setSkins] = useState<SkinsDto | null>(null);
  useEffect(() => {
    getSkins()
      .then(setSkins)
      .catch(() => setSkins(null));
  }, []);
  const skinAccent = useMemo(() => {
    const id = skins?.equipped ?? data?.chassis.skin ?? 'stock';
    const hit = skins?.catalog.find((s) => s.id === id);
    return hit && hit.id !== 'stock' ? hit.accent : null;
  }, [skins, data]);

  const firstFreeSlot = useMemo(
    () => data?.grid.find((s) => !s.part)?.index ?? null,
    [data],
  );

  const act = useCallback(
    async (fn: () => Promise<unknown>, cue: 'success' | 'strike' | 'win' = 'success') => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
        feedback[cue]();
        // Re-read rather than patching locally: one install moves the rate,
        // the gauge and both headroom figures, and re-deriving those on the
        // client would be a second copy of the engine that can disagree with
        // the one that actually pays.
        await reload({ silent: true });
      } catch (err) {
        feedback.error();
        toast.show(toMessage(err), 'error');
      } finally {
        setBusy(false);
      }
    },
    [busy, feedback, reload, toast, toMessage],
  );

  const handleInstall = useCallback(
    (part: RigPartDto) => {
      const slot = targetSlot ?? firstFreeSlot;
      if (slot === null) {
        toast.show(t('rig.rigFull'), 'error');
        return;
      }
      setTargetSlot(null);
      act(() => installPart(part.id, slot));
    },
    [act, firstFreeSlot, t, targetSlot, toast],
  );

  const handleCraft = useCallback(() => {
    act(async () => {
      const res = await craftPart();
      setCrafted({ part: res.part, slot: res.slot });
    }, 'win');
  }, [act]);

  const handleSkin = useCallback(
    async (skin: SkinDto) => {
      if (busy) return;
      setBusy(true);
      try {
        const next = skin.owned ? await equipSkin(skin.id) : await buySkin(skin.id);
        setSkins(next);
        feedback.success();
        await reload({ silent: true });
      } catch (err) {
        feedback.error();
        toast.show(toMessage(err), 'error');
      } finally {
        setBusy(false);
      }
    },
    [busy, feedback, reload, toast, toMessage],
  );

  const overclockOn = !!data?.overclock?.active;

  return (
    <Screen>
      <NavBar
        title={t('rig.title')}
        onBack={null}
        right={
          <Pressable
            onPress={() => router.push('/(tabs)/boosters')}
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: alpha(c.gold, 0.4),
              backgroundColor: alpha(c.gold, 0.12),
            }}
          >
            <Ionicons name="cart" size={13} color={c.gold} />
            <Text variant="caption" weight="800" style={{ color: c.gold }}>
              {t('rig.shopCta')}
            </Text>
          </Pressable>
        }
      />

      <Body
        bottomInset={110}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload()}
            tintColor={c.primary}
          />
        }
      >
        <EventBanner />

        {error ? <ErrorNote message={error} onRetry={() => reload()} /> : null}

        {loading && !data ? (
          <>
            <Skeleton height={190} radius={radius.xl} />
            <Skeleton height={240} radius={radius.xl} />
          </>
        ) : data ? (
          <>
            {/* A rig under 60% stability outranks the readout that explains it. */}
            <RescueCard
              telemetry={data.telemetry}
              lostPerHour={data.rate.throttledAwayPerHour}
            />

            <StabilityPanel data={data} />

            {data.overclock ? (
              <OverclockCard
                data={data}
                busy={busy}
                onToggle={() => {
                  feedback.strike();
                  act(() => setOverclock(!overclockOn), 'strike');
                }}
              />
            ) : null}

            {/* The free core sits above the grid it is running in, so the
                countdown is next to the slot it will empty. */}
            <LoanerCard rig={data} />

            <SectionHead
              title={t('rig.gridTitle')}
              hint={t('rig.gridHint', {
                used: String(data.telemetry.installedCount),
                total: String(data.chassis.slots),
              })}
            />

            {/* The same six sockets, but as a puzzle: cheapest build that
                hits this week's target at full stability. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/challenge')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: alpha(c.gold, 0.08),
                borderWidth: 1,
                borderColor: alpha(c.gold, 0.22),
              }}
            >
              <Ionicons name="ribbon-outline" size={16} color={c.gold} />
              <Text variant="footnote" weight="700" tone="gold" style={{ flex: 1 }}>
                {market.challengeLink}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={c.gold} />
            </Pressable>

            {/* This build, as one line a miner can paste anywhere. Read-only:
                the rig is changed by socketing parts, not by typing a code. */}
            <RigCodeBar
              codes={data.grid.map((sl) => sl.part?.code ?? null)}
              catalog={data.grid
                .map((sl) => sl.part)
                .filter((part): part is NonNullable<typeof part> => part !== null)
                .map((part) => ({ code: part.code ?? '', kind: part.kind }))}
            />

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.md,
              }}
            >
              {data.grid.map((slot, i) => (
                <Animated.View
                  key={slot.index}
                  entering={FadeInDown.delay(i * 40).springify()}
                  layout={Layout.springify()}
                  style={{ width: '47.5%' }}
                >
                  <SlotCard
                    index={slot.index}
                    part={slot.part}
                    targeted={targetSlot === slot.index}
                    overheating={data.telemetry.overheating}
                    overclock={overclockOn}
                    skinAccent={skinAccent}
                    busy={busy}
                    onTarget={() => {
                      feedback.select();
                      setTargetSlot(targetSlot === slot.index ? null : slot.index);
                    }}
                    onRemove={() => act(() => uninstallPart(slot.index))}
                  />
                </Animated.View>
              ))}
            </View>

            <SectionHead
              title={t('rig.inventoryTitle')}
              hint={
                targetSlot !== null
                  ? t('rig.inventoryPickFor', { slot: String(targetSlot + 1) })
                  : t('rig.inventoryHint')
              }
            />

            <ScrapRow scrap={data.scrap ?? 0} busy={busy} onCraft={handleCraft} />

            {data.inventory.length === 0 ? (
              <Card padded>
                <Text variant="callout" tone="secondary" center>
                  {t('rig.inventoryEmpty')}
                </Text>
                <Button
                  label={t('rig.shopCta')}
                  variant="secondary"
                  onPress={() => router.push('/(tabs)/boosters')}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ) : (
              data.inventory.map((part) => (
                <InventoryRow
                  key={part.id}
                  part={part}
                  busy={busy}
                  full={targetSlot === null && firstFreeSlot === null}
                  onInstall={() => handleInstall(part)}
                  onSalvage={() => act(() => salvagePart(part.id))}
                />
              ))
            )}

            {skins ? (
              <SkinsRow skins={skins} busy={busy} onPick={(s) => void handleSkin(s)} />
            ) : null}

            <Text
              variant="caption"
              tone="tertiary"
              style={{ marginTop: spacing.sm }}
            >
              {t('rig.footnote')}
            </Text>
          </>
        ) : null}
      </Body>

      <Sheet
        visible={crafted !== null}
        onClose={() => setCrafted(null)}
        title={GRID.craftTitle}
        subtitle={GRID.craftBody}
        scrollable={false}
      >
        {crafted ? (
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <Card padded tone="charge" hud>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: alpha(c.gold, 0.14),
                  }}
                >
                  <Ionicons name={KIND_ICON[crafted.part.kind]} size={22} color={c.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="headline" weight="900">
                    {crafted.part.name}
                  </Text>
                  <PartStats part={crafted.part} />
                </View>
              </View>
              <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
                {crafted.slot !== null
                  ? `${GRID.craftInstalled} ${crafted.slot + 1}`
                  : GRID.craftInventory}
              </Text>
            </Card>
            <Button label={t('app.done')} variant="charge" onPress={() => setCrafted(null)} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginTop: spacing.sm,
      }}
    >
      <Text variant="overline" tone="secondary" uppercase>
        {title}
      </Text>
      <Text variant="caption" tone="tertiary" mono style={{ flexShrink: 1 }}>
        {hint}
      </Text>
    </View>
  );
}

/** The gauge: stability, the live rate, and the two ceilings under them. */
function StabilityPanel({ data }: { data: RigOverview }) {
  const { c, spacing, radius, alpha } = useTheme();
  const t = useT();
  const GRID = useGrid();
  const { telemetry: rig, rate } = data;
  const s = rig.gridStability;
  const tint = s >= 100 ? c.gold : s >= 60 ? c.warning : c.danger;
  const overclock = !!rig.modifiers?.overclock;
  const burned = rig.disabledCount ?? 0;
  const tone = overclock || rig.overheating || rig.brownout ? 'heat' : s >= 100 && rig.installedCount > 0 ? 'charge' : 'default';

  return (
    <Card padded hud tone={tone} glow={tone === 'default'}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View>
          <Text variant="overline" tone="brand" uppercase>
            {t('rig.stabilityLabel')}
          </Text>
          <Text
            variant="display"
            mono
            weight="900"
            style={{ color: tint, fontSize: 46, lineHeight: 50 }}
          >
            {s}
            <Text variant="title2" style={{ color: tint }}>
              %
            </Text>
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="overline" tone="tertiary" uppercase>
            {t('rig.liveRate')}
          </Text>
          <Text variant="title1" mono weight="900">
            {fmt(rate.ratePerHour, 2)}
          </Text>
          <Text variant="caption" tone="tertiary">
            {t('rig.voltsPerHour')}
          </Text>
          {rate.throttledAwayPerHour > 0.005 ? (
            <Animated.View entering={FadeIn}>
              <Text variant="caption" weight="800" style={{ color: c.danger }}>
                {t('rig.throttledAway', {
                  amount: fmt(rate.throttledAwayPerHour, 2),
                })}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </View>

      {/* Modifier chips: what is bending the physics right now. */}
      {overclock ||
      burned > 0 ||
      (rig.modifiers?.squadCooling ?? 0) > 0 ||
      (rig.modifiers?.squadPower ?? 0) > 0 ||
      !!data.weather ||
      !!data.collective?.holding ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
          {overclock ? <ModChip label={GRID.overclockRunning} color={c.danger} icon="flash" /> : null}
          {burned > 0 ? <ModChip label={`${burned} ${GRID.burnedFor}`} color={c.danger} icon="skull" /> : null}
          {(rig.modifiers?.squadCooling ?? 0) > 0 ? (
            <ModChip label={`+${rig.modifiers?.squadCooling}TU squad`} color={c.info} icon="people" />
          ) : null}
          {(rig.modifiers?.squadPower ?? 0) > 0 ? (
            <ModChip label={`+${rig.modifiers?.squadPower}W squad`} color={c.gold} icon="people" />
          ) : null}
          {data.weather ? (
            <ModChip
              label={`${data.weather.city} ${Math.round(data.weather.tempC)}°C · ${fill(
                data.weather.heatPercent >= 0 ? GRID.weatherHarder : GRID.weatherEasier,
                { n: Math.abs(data.weather.heatPercent) },
              )}`}
              color={data.weather.heatPercent >= 0 ? c.danger : c.info}
              icon={data.weather.heatPercent >= 0 ? 'flame' : 'snow'}
            />
          ) : null}
          {data.collective?.holding ? (
            <ModChip
              label={`${GRID.gridHolding} +${data.collective.bonusPercent}% ${GRID.gridBonus}`}
              color={c.gold}
              icon="sparkles"
            />
          ) : null}
        </View>
      ) : null}

      {/* Stability bar. */}
      <View
        style={{
          height: 10,
          borderRadius: radius.pill,
          backgroundColor: alpha(c.primary, 0.14),
          overflow: 'hidden',
          marginTop: spacing.lg,
        }}
      >
        <LinearGradient
          colors={[alpha(tint, 0.75), tint]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${s}%`, height: '100%', borderRadius: radius.pill }}
        />
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        <Meter
          label={t('rig.thermal')}
          used={rig.heatLoad}
          capacity={rig.coolingCapacity}
          unit="TU"
          bad={rig.overheating}
          badLabel={t('rig.overheating')}
          goodLabel={t('rig.headroom', {
            amount: String(rig.coolingCapacity - rig.heatLoad),
          })}
        />
        <Meter
          label={t('rig.power')}
          used={rig.powerDraw}
          capacity={rig.powerSupply}
          unit="W"
          bad={rig.brownout}
          badLabel={t('rig.brownout')}
          goodLabel={t('rig.headroom', {
            amount: String(rig.powerSupply - rig.powerDraw),
          })}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.lg,
          marginTop: spacing.lg,
        }}
      >
        <Stat label={t('rig.hash')} value={fmt(rig.hashPerHour, 1)} tone={c.primary} />
        <Stat
          label={t('rig.multiplier')}
          value={`×${rate.referralTier.multiplier}`}
          tone={c.gold}
        />
        <Stat
          label={t('rig.chassis')}
          value={`${data.chassis.slots} ${t('rig.slots')}`}
          tone={c.textSecondary}
        />
      </View>
    </Card>
  );
}

function ModChip({
  label,
  color,
  icon,
}: {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const { radius, alpha } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: alpha(color, 0.45),
        backgroundColor: alpha(color, 0.1),
      }}
    >
      <Ionicons name={icon} size={11} color={color} />
      <Text variant="caption" mono weight="800" style={{ fontSize: 10, color }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The risk button. Shows both sides of the trade — rate and stability with
 * the overclock off and on — so the miner decides with the numbers in front
 * of them, and a countdown while it runs.
 */
function OverclockCard({
  data,
  busy,
  onToggle,
}: {
  data: RigOverview;
  busy: boolean;
  onToggle: () => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const GRID = useGrid();
  const now = useNow();
  const oc = data.overclock!;
  const on = oc.active;
  const hasCore = data.grid.some((s) => s.part?.kind === 'CORE' && !s.part.burned);
  const left = on && oc.until ? countdownLabel(oc.until, now) : null;
  const tint = on ? c.danger : c.gold;

  return (
    <Card padded hud tone={on ? 'heat' : 'default'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="flash" size={16} color={tint} />
          <Text variant="headline" weight="900">
            {GRID.overclockTitle}
          </Text>
        </View>
        {on && left ? (
          <Text variant="caption" mono weight="800" style={{ color: c.danger }}>
            {left}
          </Text>
        ) : null}
      </View>
      <Text variant="footnote" tone="secondary" style={{ marginTop: 4 }}>
        {GRID.overclockBody}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Delta
          label={GRID.overclockRate}
          from={fmt(oc.rateOff, 2)}
          to={fmt(oc.rateOn, 2)}
          good={oc.rateOn >= oc.rateOff}
        />
        <Delta
          label={GRID.overclockStability}
          from={`${oc.stabilityOff}%`}
          to={`${oc.stabilityOn}%`}
          good={oc.stabilityOn >= oc.stabilityOff}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: spacing.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: 6,
          borderRadius: radius.sm,
          backgroundColor: alpha(c.warning, 0.1),
        }}
      >
        <Ionicons name="warning" size={12} color={c.warning} />
        <Text variant="caption" weight="700" style={{ color: c.warning }}>
          {GRID.overclockRisk}
        </Text>
      </View>

      <Button
        label={on ? GRID.overclockOff : hasCore ? GRID.overclockOn : GRID.overclockNeedsCore}
        variant={on ? 'danger' : 'charge'}
        icon={on ? 'stop-circle' : 'flash'}
        disabled={busy || (!on && !hasCore)}
        silent
        onPress={onToggle}
        style={{ marginTop: spacing.md }}
      />
    </Card>
  );
}

function Delta({ label, from, to, good }: { label: string; from: string; to: string; good: boolean }) {
  const { c, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surfaceAlt,
      }}
    >
      <Text variant="overline" tone="tertiary" uppercase>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
        <Text variant="callout" mono tone="tertiary">
          {from}
        </Text>
        <Ionicons name="arrow-forward" size={11} color={c.textTertiary} />
        <Text variant="headline" mono weight="900" style={{ color: good ? c.gold : c.danger }}>
          {to}
        </Text>
      </View>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View>
      <Text variant="overline" tone="tertiary" uppercase>
        {label}
      </Text>
      <Text variant="headline" mono weight="800" style={{ color: tone }}>
        {value}
      </Text>
    </View>
  );
}

/** One capacity bar: demand against the capacity that serves it. */
function Meter({
  label,
  used,
  capacity,
  unit,
  bad,
  badLabel,
  goodLabel,
}: {
  label: string;
  used: number;
  capacity: number;
  unit: string;
  bad: boolean;
  badLabel: string;
  goodLabel: string;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  // Over capacity the bar pins full and turns — the overflow is the point, so
  // it must not quietly run off the end of the track.
  const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
  const tint = bad ? c.danger : c.primary;

  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: bad ? alpha(c.danger, 0.4) : c.border,
        backgroundColor: bad ? alpha(c.danger, 0.08) : c.surfaceAlt,
        padding: spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="overline" tone="tertiary" uppercase>
          {label}
        </Text>
        <Text variant="caption" mono weight="700" tone="secondary">
          {used} / {capacity} {unit}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: radius.pill,
          backgroundColor: alpha(tint, 0.16),
          overflow: 'hidden',
          marginTop: spacing.sm,
        }}
      >
        <View
          style={{
            width: `${bad ? 100 : pct}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: tint,
          }}
        />
      </View>
      <Text
        variant="caption"
        weight={bad ? '800' : '500'}
        style={{ marginTop: 6, color: bad ? c.danger : c.textTertiary }}
      >
        {bad ? badLabel : goodLabel}
      </Text>
    </View>
  );
}

function BurnedChip({ part }: { part: RigPartDto }) {
  const { c, radius, alpha } = useTheme();
  const GRID = useGrid();
  const left = part.disabledUntil ? untilBurnout(part.disabledUntil) : null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: alpha(c.danger, 0.5),
        backgroundColor: alpha(c.danger, 0.12),
      }}
    >
      <Ionicons name="skull" size={10} color={c.danger} />
      <Text variant="caption" mono weight="900" style={{ fontSize: 9, color: c.danger }}>
        {GRID.burned}
        {left ? ` · ${left}` : ''}
      </Text>
    </View>
  );
}

function SlotCard({
  index,
  part,
  targeted,
  overheating,
  overclock,
  skinAccent,
  busy,
  onTarget,
  onRemove,
}: {
  index: number;
  part: RigPartDto | null;
  targeted: boolean;
  overheating: boolean;
  overclock: boolean;
  skinAccent: string | null;
  busy: boolean;
  onTarget: () => void;
  onRemove: () => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const t = useT();
  const structure = skinAccent ?? c.primary;

  if (!part) {
    return (
      <Pressable
        onPress={onTarget}
        style={{
          minHeight: 126,
          padding: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: targeted ? c.gold : alpha(structure, 0.28),
          backgroundColor: targeted ? alpha(c.gold, 0.08) : alpha(structure, 0.04),
          justifyContent: 'space-between',
        }}
      >
        <Text variant="overline" tone="tertiary">
          {String(index + 1).padStart(2, '0')}
        </Text>
        <Text
          variant="callout"
          weight="700"
          style={{ color: targeted ? c.gold : c.textTertiary }}
        >
          {targeted ? t('rig.slotTapToFill') : t('rig.slotEmpty')}
        </Text>
      </Pressable>
    );
  }

  // Only cores are blamed for the heat: flagging the cooler that is solving
  // the problem would send the miner to remove exactly the wrong part.
  const hot = (overheating || overclock) && part.kind === 'CORE' && part.heat > 0;
  const burned = !!part.burned;
  const edge = burned ? alpha(c.danger, 0.35) : hot ? c.danger : alpha(structure, 0.5);

  return (
    <View
      style={{
        minHeight: 126,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: edge,
        backgroundColor: c.surface,
        justifyContent: 'space-between',
        overflow: 'hidden',
        opacity: burned ? 0.6 : 1,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: spacing.lg,
          bottom: spacing.lg,
          width: 3,
          borderTopRightRadius: 2,
          borderBottomRightRadius: 2,
          backgroundColor: burned ? c.textTertiary : hot ? c.danger : structure,
        }}
      />
      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Ionicons
            name={KIND_ICON[part.kind]}
            size={15}
            color={burned ? c.textTertiary : hot ? c.danger : structure}
          />
          <Text variant="overline" tone="tertiary">
            {String(index + 1).padStart(2, '0')}
          </Text>
        </View>
        <Text variant="callout" weight="900" numberOfLines={2} style={{ marginTop: 6 }}>
          {part.name}
        </Text>
        {burned ? (
          <View style={{ marginTop: 6 }}>
            <BurnedChip part={part} />
          </View>
        ) : (
          <PartStats part={part} hot={hot} />
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
        }}
      >
        <Text variant="caption" tone="tertiary" mono style={{ fontSize: 10 }}>
          {untilBurnout(part.expiresAt)}
        </Text>
        <Pressable
          onPress={onRemove}
          disabled={busy}
          hitSlop={8}
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 3,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: c.border,
            opacity: busy ? 0.4 : 1,
          }}
        >
          <Text variant="caption" weight="800" tone="tertiary" style={{ fontSize: 10 }}>
            {t('rig.remove')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** What a part gives and what it costs, in one wrapping row of figures. */
function PartStats({ part, hot }: { part: RigPartDto; hot?: boolean }) {
  const { c } = useTheme();
  const items: { text: string; color: string }[] = [];
  if (part.hashPerHour > 0) {
    items.push({ text: `+${fmt(part.hashPerHour)}/h`, color: c.primary });
  }
  if (part.hashBoostPercent > 0) {
    items.push({ text: `+${part.hashBoostPercent}%`, color: c.primary });
  }
  if (part.cooling > 0) items.push({ text: `−${part.cooling}TU`, color: c.info });
  if (part.heat > 0) {
    items.push({ text: `+${part.heat}TU`, color: hot ? c.danger : c.textTertiary });
  }
  if (part.wattsSupplied > 0) {
    items.push({ text: `+${part.wattsSupplied}W`, color: c.gold });
  }
  if (part.watts > 0) items.push({ text: `−${part.watts}W`, color: c.textTertiary });

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {items.map((it) => (
        <Text
          key={it.text}
          variant="caption"
          mono
          weight="700"
          style={{ fontSize: 10, color: it.color }}
        >
          {it.text}
        </Text>
      ))}
    </View>
  );
}

/** Scrap on hand and the forge. Three scrap become one random part. */
function ScrapRow({ scrap, busy, onCraft }: { scrap: number; busy: boolean; onCraft: () => void }) {
  const { c, spacing, radius, alpha } = useTheme();
  const GRID = useGrid();
  const ready = scrap >= 3;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: ready ? alpha(c.gold, 0.4) : c.border,
        backgroundColor: ready ? alpha(c.gold, 0.06) : c.surfaceAlt,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="construct" size={14} color={ready ? c.gold : c.textTertiary} />
        <Text variant="overline" tone="tertiary" uppercase>
          {GRID.scrap}
        </Text>
        <Text variant="headline" mono weight="900" style={{ color: ready ? c.gold : c.textPrimary }}>
          {scrap}
        </Text>
      </View>
      <Button
        label={GRID.craft}
        variant={ready ? 'charge' : 'secondary'}
        size="sm"
        icon="hammer"
        disabled={busy || !ready}
        onPress={onCraft}
      />
    </View>
  );
}

function InventoryRow({
  part,
  busy,
  full,
  onInstall,
  onSalvage,
}: {
  part: RigPartDto;
  busy: boolean;
  full: boolean;
  onInstall: () => void;
  onSalvage: () => void;
}) {
  const { c, spacing } = useTheme();
  const t = useT();
  const GRID = useGrid();
  const salvageable = canSalvage(part);
  return (
    <Card padded>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1, opacity: part.burned ? 0.7 : 1 }}>
          <Text variant="headline" weight="900" numberOfLines={1}>
            {KIND_GLYPH[part.kind]} {part.name}
          </Text>
          {part.burned ? (
            <View style={{ marginTop: 6 }}>
              <BurnedChip part={part} />
            </View>
          ) : (
            <PartStats part={part} />
          )}
          <Text variant="caption" tone="tertiary" mono style={{ marginTop: 4 }}>
            {t('rig.burnsIn')} {untilBurnout(part.expiresAt)}
          </Text>
        </View>
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <Button
            label={full ? t('rig.rigFull') : t('rig.install')}
            variant="charge"
            size="sm"
            disabled={busy || full || !!part.burned}
            onPress={onInstall}
          />
          {salvageable ? (
            <Button
              label={GRID.salvage}
              variant="secondary"
              size="sm"
              icon="construct"
              disabled={busy}
              onPress={onSalvage}
            />
          ) : null}
        </View>
      </View>
      <View style={{ height: 0, borderColor: c.border }} />
    </Card>
  );
}

/** Chassis skins: a horizontal strip of swatches; tap to buy or equip. */
function SkinsRow({
  skins,
  busy,
  onPick,
}: {
  skins: SkinsDto;
  busy: boolean;
  onPick: (skin: SkinDto) => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const GRID = useGrid();
  return (
    <Card padded>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text variant="overline" tone="secondary" uppercase>
          {GRID.skinsTitle}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ flexShrink: 1 }} numberOfLines={1}>
          {GRID.skinsHint}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}
      >
        {skins.catalog.map((skin) => {
          const on = skin.equipped;
          return (
            <Pressable
              key={skin.id}
              onPress={() => onPick(skin)}
              disabled={busy || on}
              style={{
                width: 118,
                padding: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: on ? skin.accent : alpha(skin.accent, 0.35),
                backgroundColor: on ? alpha(skin.accent, 0.12) : c.surfaceAlt,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <View
                style={{
                  height: 34,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: alpha(skin.accent, 0.6),
                  backgroundColor: alpha(skin.accent, 0.18),
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 6,
                    bottom: 6,
                    width: 3,
                    backgroundColor: skin.accent,
                  }}
                />
              </View>
              <Text variant="caption" weight="900" numberOfLines={1} style={{ marginTop: 6 }}>
                {skin.name}
              </Text>
              <Text
                variant="caption"
                mono
                weight="800"
                style={{ fontSize: 10, color: on ? skin.accent : skin.owned ? c.textSecondary : c.gold }}
              >
                {on
                  ? GRID.equipped
                  : skin.owned
                    ? GRID.equip
                    : skin.priceVolts === 0
                      ? GRID.equip
                      : `${GRID.buy} · ${skin.priceVolts} ${GRID.volts}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Card>
  );
}
