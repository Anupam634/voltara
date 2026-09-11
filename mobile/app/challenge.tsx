import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Sheet } from '../src/components/ui/Sheet';
import {
  EmptyState,
  ErrorNote,
  NavBar,
  Screen,
  Skeleton,
} from '../src/components/ui/Chrome';
import { ProgressRing } from '../src/components/mining/Effects';
import { useMarket, fill } from '../src/components/market/strings';
import { useDaily } from '../src/components/daily/strings';
import { useTheme } from '../src/theme/ThemeProvider';
import { useI18n, useT } from '../src/i18n';
import { useToast } from '../src/components/ui/Toast';
import { useFeedback } from '../src/lib/feedback';
import { useAsyncData, useNow } from '../src/lib/hooks';
import { countdownLabel, formatPoints, formatUsd } from '../src/lib/format';
import {
  getChallenge,
  submitBlueprint,
  type BlueprintPartDto,
  type ChallengeBoard,
  type RigPartKind,
  type SubmissionDto,
} from '../src/api/endpoints';
import { errorMessage } from '../src/api/client';
import { RigCodeBar } from '../src/components/rigcode/RigCodeBar';
import { slotsFromCodes } from '../src/lib/rig-code';

const KIND_ICON: Record<RigPartKind, keyof typeof Ionicons.glyphMap> = {
  CORE: 'hardware-chip',
  COOLER: 'snow',
  PSU: 'flash',
  MODULE: 'sparkles',
};

const SLOTS = 6;

/** The free chassis every miner runs on — the same figures as rig.engine.ts. */
const CHASSIS_COOLING = 12;
const CHASSIS_WATTS = 120;
const THERMAL_FLOOR = 0.25;
const POWER_FLOOR = 0.1;

interface Readout {
  costUsd: number;
  hashPerHour: number;
  heat: number;
  cooling: number;
  draw: number;
  supply: number;
  stability: number;
  filled: number;
  hasCore: boolean;
}

/**
 * Score a build the way the server will.
 *
 * Mirrors `rig.engine.ts`: modules add their percent additively to total core
 * hash, and the two efficiencies are straight ratios with a floor. The hash
 * that gets submitted is the UNTHROTTLED figure — the contest requires 100%
 * stability, so a build that throttles is rejected outright rather than
 * quietly scored lower.
 */
function scoreBuild(parts: (BlueprintPartDto | null)[]): Readout {
  let costUsd = 0;
  let coreHash = 0;
  let boostPercent = 0;
  let heat = 0;
  let cooling = CHASSIS_COOLING;
  let draw = 0;
  let supply = CHASSIS_WATTS;
  let filled = 0;
  let hasCore = false;

  for (const part of parts) {
    if (!part) continue;
    filled += 1;
    costUsd += part.priceUsd;
    coreHash += Math.max(0, part.hashPerHour);
    boostPercent += Math.max(0, part.hashBoostPercent);
    heat += Math.max(0, part.heat);
    cooling += Math.max(0, part.cooling);
    draw += Math.max(0, part.watts);
    supply += Math.max(0, part.wattsSupplied);
    if (part.kind === 'CORE') hasCore = true;
  }

  const thermal = heat <= cooling ? 1 : Math.max(THERMAL_FLOOR, cooling / heat);
  const power = draw <= supply ? 1 : Math.max(POWER_FLOOR, supply / draw);

  return {
    costUsd,
    hashPerHour: Math.floor(coreHash * (1 + boostPercent / 100) * 1000) / 1000,
    heat,
    cooling,
    draw,
    supply,
    stability: Math.round(thermal * power * 100),
    filled,
    hasCore,
  };
}

/**
 * The weekly blueprint challenge.
 *
 * Build the cheapest rig that hits the target at full stability. The readout
 * is computed on the phone so the numbers move as parts go in, but the server
 * recomputes every submission from the part codes — the client figure is a
 * preview, never the score.
 */
export default function ChallengeScreen() {
  const { c, spacing, radius } = useTheme();
  const t = useT();
  const m = useMarket();
  const toast = useToast();
  const feedback = useFeedback();
  const now = useNow(30_000);

  const toMessage = useCallback(
    (err: unknown) => errorMessage(err, t('app.offline')),
    [t],
  );
  const { data, error, loading, refreshing, reload } = useAsyncData<ChallengeBoard>(
    getChallenge,
    toMessage,
  );

  useEffect(() => {
    const id = setInterval(() => void reload({ silent: true }), 30_000);
    return () => clearInterval(id);
  }, [reload]);

  /** Six sockets of part codes. Seeded from an existing submission. */
  const [build, setBuild] = useState<(string | null)[]>(() => Array(SLOTS).fill(null));
  const [seeded, setSeeded] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seeded || !data) return;
    const codes = data.mine?.partCodes ?? [];
    if (codes.length > 0) {
      const next: (string | null)[] = Array(SLOTS).fill(null);
      codes.slice(0, SLOTS).forEach((code, i) => {
        next[i] = code;
      });
      setBuild(next);
    }
    setSeeded(true);
  }, [data, seeded]);

  const byCode = useMemo(() => {
    const map = new Map<string, BlueprintPartDto>();
    for (const part of data?.catalog ?? []) map.set(part.code, part);
    return map;
  }, [data]);

  const parts = useMemo(
    () => build.map((code) => (code ? byCode.get(code) ?? null : null)),
    [build, byCode],
  );
  const readout = useMemo(() => scoreBuild(parts), [parts]);

  const challenge = data?.challenge;
  const closed = challenge ? new Date(challenge.endsAt).getTime() <= now : false;
  const target = challenge?.targetHashPerHour ?? 0;
  const meetsHash = readout.hashPerHour >= target && target > 0;
  const stable = readout.stability === 100;
  const canSubmit = readout.hasCore && meetsHash && stable && !closed && !busy;

  const verdict = !readout.hasCore
    ? { label: m.addParts, tone: 'neutral' as const }
    : !stable
      ? { label: m.unstable, tone: 'danger' as const }
      : !meetsHash
        ? { label: m.belowTarget, tone: 'warning' as const }
        : { label: m.meets, tone: 'gold' as const };

  const submit = async () => {
    const codes = build.filter((x): x is string => !!x);
    setBusy(true);
    try {
      const res = await submitBlueprint(codes);
      feedback.win();
      toast.success(fill(m.submitted, { rank: res.rank }));
      await reload({ silent: true });
    } catch (err) {
      feedback.error();
      toast.error(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen sunken>
      <NavBar title={m.challengeTitle} subtitle={m.challengeSubtitle} large />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload()}
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

        {loading && !data ? (
          <>
            <Skeleton height={180} radius={radius.xl} />
            <Skeleton height={220} radius={radius.xl} />
          </>
        ) : data && challenge ? (
          <>
            <DailyLink />

            <HeaderCard challenge={challenge} closed={closed} now={now} />

            <SectionHead title={m.builderTitle} hint={m.builderHint} />

            <RigCodeBar
              codes={build}
              catalog={(data?.catalog ?? []).map((p) => ({ code: p.code, kind: p.kind }))}
              onLoad={(codes) => setBuild(slotsFromCodes(codes, SLOTS))}
              style={{ marginBottom: spacing.md }}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {parts.map((part, i) => (
                <Animated.View
                  key={i}
                  entering={FadeInDown.delay(i * 40).duration(240)}
                  layout={Layout.springify()}
                  style={{ width: '47.5%' }}
                >
                  <SlotCard
                    index={i}
                    part={part}
                    disabled={closed}
                    onPress={() => {
                      feedback.select();
                      if (part) {
                        setBuild((prev) => {
                          const next = [...prev];
                          next[i] = null;
                          return next;
                        });
                      } else {
                        setPicking(i);
                      }
                    }}
                  />
                </Animated.View>
              ))}
            </View>

            {readout.filled > 0 ? (
              <Button
                label={m.clear}
                variant="secondary"
                size="sm"
                icon="trash-outline"
                onPress={() => setBuild(Array(SLOTS).fill(null))}
              />
            ) : null}

            <ReadoutCard readout={readout} target={target} verdict={verdict} />

            <Button
              label={data.mine ? m.update : m.submit}
              variant="charge"
              fullWidth
              loading={busy}
              disabled={!canSubmit}
              silent
              onPress={() => void submit()}
            />
            {closed ? (
              <Text variant="footnote" tone="tertiary" style={{ textAlign: 'center' }}>
                {m.closed}
              </Text>
            ) : null}

            <SectionHead
              title={m.boardTitle}
              hint={fill(m.submissions, { n: challenge.submissions })}
            />
            {data.top.length === 0 ? (
              <EmptyState icon="trophy-outline" title={m.boardEmpty} body={m.boardEmptyBody} />
            ) : (
              <Card style={{ gap: spacing.sm }}>
                {data.top.map((row) => (
                  <BoardRow key={row.id} row={row} />
                ))}
              </Card>
            )}

            {data.previous ? (
              <>
                <SectionHead title={m.lastWeek} hint={data.previous.challenge.weekKey} />
                <Card style={{ gap: spacing.sm }}>
                  {data.previous.winners.length === 0 ? (
                    <Text variant="footnote" tone="tertiary">
                      {m.noWinners}
                    </Text>
                  ) : (
                    data.previous.winners.map((row, i) => (
                      <BoardRow
                        key={row.id}
                        row={row}
                        reward={data.previous?.challenge.rewards[i]}
                      />
                    ))
                  )}
                </Card>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <PartPicker
        visible={picking !== null}
        catalog={data?.catalog ?? []}
        onClose={() => setPicking(null)}
        onPick={(code) => {
          const slot = picking;
          setPicking(null);
          if (slot === null) return;
          feedback.tick();
          setBuild((prev) => {
            const next = [...prev];
            next[slot] = code;
            return next;
          });
        }}
      />
    </Screen>
  );
}

/* ─────────────────────────── Header card ───────────────────────────── */

function HeaderCard({
  challenge,
  closed,
  now,
}: {
  challenge: ChallengeBoard['challenge'];
  closed: boolean;
  now: number;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const { locale } = useI18n();
  const m = useMarket();
  const left = countdownLabel(challenge.endsAt, now);

  return (
    <Card hud tone={closed ? 'default' : 'charge'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="overline" tone="tertiary" uppercase>
          {challenge.weekKey}
        </Text>
        <View style={{ flex: 1 }} />
        <Badge
          label={closed ? m.closed : `${m.endsIn} ${left ?? '—'}`}
          tone={closed ? 'neutral' : 'gold'}
          icon="time-outline"
        />
      </View>

      <Text variant="title2" weight="800" style={{ marginTop: spacing.sm }}>
        {challenge.title}
      </Text>
      <Text variant="footnote" tone="secondary" style={{ marginTop: 4 }}>
        {challenge.body}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: radius.pill,
            backgroundColor: alpha(c.gold, 0.12),
            borderWidth: 1,
            borderColor: alpha(c.gold, 0.28),
          }}
        >
          <Text variant="caption" tone="tertiary" uppercase weight="700">
            {m.target}
          </Text>
          <Text variant="callout" mono tone="gold" weight="800">
            {formatPoints(challenge.targetHashPerHour, 1, locale)}
            {m.perHour}
          </Text>
        </View>
        <Badge label={fill(m.submissions, { n: challenge.submissions })} tone="neutral" />
      </View>

      <Text variant="overline" tone="tertiary" uppercase style={{ marginTop: spacing.md }}>
        {m.rewards}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 6 }}>
        {[m.first, m.second, m.third].map((place, i) => (
          <View
            key={place}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 2,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: c.surfaceAlt,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text variant="caption" tone="tertiary" weight="700">
              {place}
            </Text>
            <Text variant="callout" mono weight="800" tone={i === 0 ? 'gold' : 'primary'}>
              {challenge.rewards[i] ?? '—'}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/* ──────────────────────────── Builder ──────────────────────────────── */

function SlotCard({
  index,
  part,
  disabled,
  onPress,
}: {
  index: number;
  part: BlueprintPartDto | null;
  disabled: boolean;
  onPress: () => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const m = useMarket();
  const tint = part ? kindTint(part.kind, c) : c.textTertiary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={part ? part.name : m.emptySlot}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 120,
        padding: spacing.md,
        borderRadius: radius.lg,
        justifyContent: 'space-between',
        opacity: disabled ? 0.6 : 1,
        backgroundColor: part ? alpha(tint, 0.1) : c.surfaceAlt,
        borderWidth: 1,
        borderStyle: part ? 'solid' : 'dashed',
        borderColor: part ? alpha(tint, 0.45) : c.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="tertiary" mono>
          {String(index + 1).padStart(2, '0')}
        </Text>
        {part ? (
          <Ionicons name="close-circle" size={16} color={c.textTertiary} />
        ) : (
          <Ionicons name="add-circle-outline" size={16} color={c.textTertiary} />
        )}
      </View>

      {part ? (
        <View style={{ gap: 4 }}>
          <Ionicons name={KIND_ICON[part.kind]} size={20} color={tint} />
          <Text variant="footnote" weight="700" numberOfLines={2}>
            {part.name}
          </Text>
          <Text variant="caption" tone="tertiary" mono>
            ${part.priceUsd}
          </Text>
        </View>
      ) : (
        <Text variant="caption" tone="tertiary">
          {m.emptySlot}
        </Text>
      )}
    </Pressable>
  );
}

function ReadoutCard({
  readout,
  target,
  verdict,
}: {
  readout: Readout;
  target: number;
  verdict: { label: string; tone: 'neutral' | 'gold' | 'warning' | 'danger' };
}) {
  const { c, spacing } = useTheme();
  const { locale } = useI18n();
  const m = useMarket();
  const tint =
    readout.stability === 100 ? c.gold : readout.stability >= 60 ? c.warning : c.danger;

  return (
    <Card tone={verdict.tone === 'gold' ? 'charge' : verdict.tone === 'danger' ? 'heat' : 'default'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <ProgressRing size={104} stroke={6} progress={readout.stability / 100}>
          <Text variant="title2" mono weight="800" style={{ color: tint }}>
            {readout.stability}%
          </Text>
          <Text variant="caption" tone="tertiary" uppercase>
            {m.stability}
          </Text>
        </ProgressRing>

        <View style={{ flex: 1, gap: 6 }}>
          <Figure label={m.cost} value={formatUsd(readout.costUsd, locale)} />
          <Figure
            label={m.hash}
            value={`${formatPoints(readout.hashPerHour, 1, locale)}${m.perHour}`}
            tone={readout.hashPerHour >= target && target > 0 ? 'gold' : undefined}
          />
          <Figure
            label={m.target}
            value={`${formatPoints(target, 1, locale)}${m.perHour}`}
          />
        </View>
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Meter
          label={m.heatVsCooling}
          used={readout.heat}
          capacity={readout.cooling}
          unit="TU"
        />
        <Meter
          label={m.drawVsSupply}
          used={readout.draw}
          capacity={readout.supply}
          unit="W"
        />
      </View>

      <View style={{ marginTop: spacing.md, alignItems: 'flex-start' }}>
        <Badge
          label={verdict.label}
          tone={verdict.tone}
          icon={verdict.tone === 'gold' ? 'checkmark-circle' : 'alert-circle-outline'}
        />
      </View>
    </Card>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'gold';
}) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
      }}
    >
      <Text variant="caption" tone="tertiary" uppercase>
        {label}
      </Text>
      <Text variant="callout" mono weight="700" tone={tone === 'gold' ? 'gold' : undefined}>
        {value}
      </Text>
    </View>
  );
}

/** A bar that fills toward its ceiling and turns as it goes over. */
function Meter({
  label,
  used,
  capacity,
  unit,
}: {
  label: string;
  used: number;
  capacity: number;
  unit: string;
}) {
  const { c, radius, alpha } = useTheme();
  const ratio = capacity <= 0 ? 0 : used / capacity;
  const over = used > capacity;
  const tint = over ? c.danger : ratio >= 0.8 ? c.warning : c.gold;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="tertiary" uppercase>
          {label}
        </Text>
        <Text variant="caption" mono weight="700" style={{ color: tint }}>
          {used} / {capacity} {unit}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: radius.pill,
          overflow: 'hidden',
          backgroundColor: alpha(c.textTertiary, 0.18),
        }}
      >
        <View
          style={{
            width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: tint,
          }}
        />
      </View>
    </View>
  );
}

/* ───────────────────────────── Picker ──────────────────────────────── */

function PartPicker({
  visible,
  catalog,
  onClose,
  onPick,
}: {
  visible: boolean;
  catalog: BlueprintPartDto[];
  onClose: () => void;
  onPick: (code: string) => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const m = useMarket();

  const groups: { title: string; kind: RigPartKind }[] = [
    { title: m.kindCores, kind: 'CORE' },
    { title: m.kindCooling, kind: 'COOLER' },
    { title: m.kindPower, kind: 'PSU' },
    { title: m.kindModules, kind: 'MODULE' },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title={m.pickPart}>
      <View style={{ gap: spacing.md }}>
        {groups.map((group) => {
          const rows = catalog.filter((p) => p.kind === group.kind);
          if (rows.length === 0) return null;
          const tint = kindTint(group.kind, c);
          return (
            <View key={group.kind} style={{ gap: spacing.sm }}>
              <Text variant="overline" tone="secondary" uppercase>
                {group.title}
              </Text>
              {rows.map((part) => (
                <Pressable
                  key={part.code}
                  accessibilityRole="button"
                  onPress={() => onPick(part.code)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: c.surfaceAlt,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(tint, 0.14),
                    }}
                  >
                    <Ionicons name={KIND_ICON[part.kind]} size={16} color={tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="callout" weight="700">
                      {part.name}
                    </Text>
                    <Text variant="caption" tone="tertiary" mono>
                      {physicsLine(part)}
                    </Text>
                  </View>
                  <Text variant="callout" mono weight="800" tone="gold">
                    ${part.priceUsd}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

/** "+2 VOLTS/h · +10 TU · −45 W" — gain first, running cost after. */
function physicsLine(part: BlueprintPartDto): string {
  const bits: string[] = [];
  if (part.hashPerHour > 0) bits.push(`+${part.hashPerHour} VOLTS/h`);
  if (part.hashBoostPercent > 0) bits.push(`+${part.hashBoostPercent}%`);
  if (part.cooling > 0) bits.push(`−${part.cooling} TU`);
  if (part.wattsSupplied > 0) bits.push(`+${part.wattsSupplied} W`);
  if (part.heat > 0) bits.push(`+${part.heat} TU`);
  if (part.watts > 0) bits.push(`−${part.watts} W`);
  return bits.join(' · ');
}

/* ──────────────────────────── Board row ────────────────────────────── */

function BoardRow({ row, reward }: { row: SubmissionDto; reward?: string }) {
  const { c, spacing, radius, alpha } = useTheme();
  const { locale } = useI18n();
  const m = useMarket();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: row.mine ? spacing.sm : 0,
        borderRadius: radius.md,
        backgroundColor: row.mine ? alpha(c.gold, 0.1) : undefined,
      }}
    >
      <Text
        variant="callout"
        mono
        weight="800"
        tone={row.rank <= 3 ? 'gold' : undefined}
        style={{ width: 26 }}
      >
        {row.rank}
      </Text>
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="700" numberOfLines={1}>
          {row.mine ? m.you : row.user.name}
        </Text>
        <Text variant="caption" tone="tertiary" mono numberOfLines={1}>
          {row.partCodes.join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="callout" mono weight="700">
          {formatUsd(row.costUsd, locale)}
        </Text>
        <Text variant="caption" tone="tertiary" mono>
          {formatPoints(row.hashPerHour, 1, locale)}
          {m.perHour}
        </Text>
      </View>
      {reward ? <Badge label={reward} tone="gold" /> : null}
    </View>
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

function kindTint(kind: RigPartKind, c: ReturnType<typeof useTheme>['c']): string {
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

/* ────────────────────── Link to the daily puzzle ───────────────────── */

function DailyLink() {
  const { c, spacing, radius, alpha } = useTheme();
  const d = useDaily();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={d.linkTitle}
      onPress={() => router.push('/daily')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: c.surfaceAlt,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: alpha(c.gold, 0.14),
        }}
      >
        <Ionicons name="today-outline" size={16} color={c.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="700">
          {d.linkTitle}
        </Text>
        <Text variant="caption" tone="tertiary">
          {d.linkBody}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
    </Pressable>
  );
}
