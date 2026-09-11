import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
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
import { useDaily, fill } from '../src/components/daily/strings';
import { useTheme } from '../src/theme/ThemeProvider';
import { useI18n, useT } from '../src/i18n';
import { useToast } from '../src/components/ui/Toast';
import { useFeedback } from '../src/lib/feedback';
import { useAsyncData, useNow } from '../src/lib/hooks';
import { countdownLabel, formatPoints, formatUsd } from '../src/lib/format';
import {
  getDaily,
  submitDaily,
  type BlueprintPartDto,
  type DailyBoard,
  type DailySubmissionDto,
  type RigPartKind,
} from '../src/api/endpoints';
import { errorMessage, WEB_URL } from '../src/api/client';

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
 * Mirrors `rig.engine.ts` on a stock chassis with no modifiers. The hash
 * submitted is the UNTHROTTLED figure: the puzzle demands 100% stability, so
 * a throttling build is rejected outright rather than quietly scored lower.
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
 * The daily rig puzzle.
 *
 * One budget, one target, the same for every miner until midnight UTC. The
 * readout runs on the phone so the numbers move as parts go in; the server
 * re-scores every submission and owns the shareable block.
 */
export default function DailyScreen() {
  const { c, spacing, radius } = useTheme();
  const t = useT();
  const d = useDaily();
  const toast = useToast();
  const feedback = useFeedback();
  const { locale } = useI18n();
  const now = useNow(30_000);

  const toMessage = useCallback(
    (err: unknown) => errorMessage(err, d.offline),
    [d.offline],
  );
  const { data, error, loading, refreshing, reload } = useAsyncData<DailyBoard>(
    getDaily,
    toMessage,
  );

  useEffect(() => {
    const id = setInterval(() => void reload({ silent: true }), 30_000);
    return () => clearInterval(id);
  }, [reload]);

  const [build, setBuild] = useState<(string | null)[]>(() => Array(SLOTS).fill(null));
  const [seeded, setSeeded] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);

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

  const puzzle = data?.puzzle;
  const budget = puzzle?.budgetUsd ?? 0;
  const target = puzzle?.targetHashPerHour ?? 0;
  const withinBudget = readout.costUsd <= budget;
  const meetsHash = readout.hashPerHour >= target && target > 0;
  const stable = readout.stability === 100;
  const canSubmit = readout.hasCore && withinBudget && meetsHash && stable && !busy;

  // The verdict names the first rule broken, in the order a miner fixes them:
  // afford it, stabilise it, then reach the number.
  const verdict = !readout.hasCore
    ? { label: d.addParts, tone: 'neutral' as const }
    : !withinBudget
      ? { label: d.overBudget, tone: 'danger' as const }
      : !stable
        ? { label: d.unstable, tone: 'danger' as const }
        : !meetsHash
          ? { label: d.belowTarget, tone: 'warning' as const }
          : { label: d.meets, tone: 'gold' as const };

  const submit = async () => {
    const codes = build.filter((x): x is string => !!x);
    setBusy(true);
    try {
      const res = await submitDaily(codes);
      feedback.win();
      setBeat(res.beatPercent);
      await reload({ silent: true });
    } catch (err) {
      feedback.error();
      toast.error(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const shareUrl = `${WEB_URL}/${locale}/daily`;

  const copyResult = async (text: string) => {
    await Clipboard.setStringAsync(`${text}\n${shareUrl}`);
    feedback.tick();
    toast.success(d.copied);
  };

  const shareResult = async (text: string) => {
    feedback.press();
    try {
      await Share.share({ message: `${text}\n${shareUrl}` });
    } catch {
      // A dismissed share sheet is not an error worth reporting.
    }
  };

  return (
    <Screen sunken>
      <NavBar title={d.navTitle} subtitle={d.navSubtitle} large />

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
            <Skeleton height={150} radius={radius.xl} />
            <Skeleton height={220} radius={radius.xl} />
          </>
        ) : data && puzzle ? (
          <>
            <HeaderCard puzzle={puzzle} solved={data.solvedCount} now={now} />

            <SectionHead title={d.builderTitle} hint={d.builderHint} />

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
                label={d.clear}
                variant="secondary"
                size="sm"
                icon="trash-outline"
                onPress={() => setBuild(Array(SLOTS).fill(null))}
              />
            ) : null}

            <ReadoutCard readout={readout} budget={budget} target={target} verdict={verdict} />

            <Button
              label={data.mine ? d.update : d.submit}
              variant="charge"
              fullWidth
              loading={busy}
              disabled={!canSubmit}
              silent
              onPress={() => void submit()}
            />

            {data.mine ? (
              <ResultCard
                submission={data.mine}
                beat={beat}
                alone={data.solvedCount <= 1}
                onCopy={() => void copyResult(data.mine!.shareText)}
                onShare={() => void shareResult(data.mine!.shareText)}
              />
            ) : null}

            <SectionHead
              title={d.boardTitle}
              hint={fill(d.solvers, { n: data.solvedCount })}
            />
            {data.top.length === 0 ? (
              <EmptyState icon="trophy-outline" title={d.boardEmpty} body={d.boardEmptyBody} />
            ) : (
              <Card style={{ gap: spacing.sm }}>
                {data.top.map((row) => (
                  <BoardRow key={row.id} row={row} />
                ))}
              </Card>
            )}

            {data.yesterday ? (
              <>
                <SectionHead title={d.yesterday} hint={`#${data.yesterday.number}`} />
                <Card style={{ gap: spacing.sm }}>
                  {data.yesterday.best.length === 0 ? (
                    <Text variant="footnote" tone="tertiary">
                      {d.yesterdayEmpty}
                    </Text>
                  ) : (
                    data.yesterday.best.map((row) => <BoardRow key={row.id} row={row} />)
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
  puzzle,
  solved,
  now,
}: {
  puzzle: DailyBoard['puzzle'];
  solved: number;
  now: number;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const { locale } = useI18n();
  const d = useDaily();
  const left = countdownLabel(puzzle.endsAt, now);

  return (
    <Card hud tone="charge">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="overline" tone="tertiary" uppercase>
          {d.puzzleNo} #{puzzle.number}
        </Text>
        <View style={{ flex: 1 }} />
        <Badge
          label={`${d.endsIn} ${left ?? d.ended}`}
          tone="gold"
          icon="time-outline"
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="tertiary" uppercase>
            {d.budget}
          </Text>
          <Text variant="title1" mono weight="900">
            {formatUsd(puzzle.budgetUsd, locale)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="tertiary" uppercase>
            {d.target}
          </Text>
          <Text variant="title1" mono weight="900" tone="gold">
            {formatPoints(puzzle.targetHashPerHour, 1, locale)}
            <Text variant="caption" tone="tertiary">
              {d.perHour}
            </Text>
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: spacing.md,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: radius.pill,
          backgroundColor: alpha(c.primary, 0.12),
          borderWidth: 1,
          borderColor: alpha(c.primary, 0.28),
        }}
      >
        <Text variant="caption" tone="secondary" weight="700">
          {fill(d.solvers, { n: solved })}
        </Text>
      </View>
    </Card>
  );
}

/* ──────────────────────────── Builder ──────────────────────────────── */

function SlotCard({
  index,
  part,
  onPress,
}: {
  index: number;
  part: BlueprintPartDto | null;
  onPress: () => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const d = useDaily();
  const tint = part ? kindTint(part.kind, c) : c.textTertiary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={part ? part.name : d.emptySlot}
      onPress={onPress}
      style={{
        minHeight: 120,
        padding: spacing.md,
        borderRadius: radius.lg,
        justifyContent: 'space-between',
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
        <Ionicons
          name={part ? 'close-circle' : 'add-circle-outline'}
          size={16}
          color={c.textTertiary}
        />
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
          {d.emptySlot}
        </Text>
      )}
    </Pressable>
  );
}

function ReadoutCard({
  readout,
  budget,
  target,
  verdict,
}: {
  readout: Readout;
  budget: number;
  target: number;
  verdict: { label: string; tone: 'neutral' | 'gold' | 'warning' | 'danger' };
}) {
  const { c, spacing } = useTheme();
  const { locale } = useI18n();
  const d = useDaily();
  const tint =
    readout.stability === 100 ? c.gold : readout.stability >= 60 ? c.warning : c.danger;
  const overBudget = readout.costUsd > budget;

  return (
    <Card tone={verdict.tone === 'gold' ? 'charge' : verdict.tone === 'danger' ? 'heat' : 'default'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <ProgressRing size={104} stroke={6} progress={readout.stability / 100}>
          <Text variant="title2" mono weight="800" style={{ color: tint }}>
            {readout.stability}%
          </Text>
          <Text variant="caption" tone="tertiary" uppercase>
            {d.stability}
          </Text>
        </ProgressRing>

        <View style={{ flex: 1, gap: 6 }}>
          <Figure
            label={d.cost}
            value={`${formatUsd(readout.costUsd, locale)} / ${formatUsd(budget, locale)}`}
            tone={overBudget ? 'danger' : undefined}
          />
          <Figure
            label={d.hash}
            value={`${formatPoints(readout.hashPerHour, 1, locale)} / ${formatPoints(target, 1, locale)}`}
            tone={readout.hashPerHour >= target && target > 0 ? 'gold' : undefined}
          />
        </View>
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Meter label={d.heatVsCooling} used={readout.heat} capacity={readout.cooling} unit="TU" />
        <Meter label={d.drawVsSupply} used={readout.draw} capacity={readout.supply} unit="W" />
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

/* ──────────────────────── The shareable result ─────────────────────── */

function ResultCard({
  submission,
  beat,
  alone,
  onCopy,
  onShare,
}: {
  submission: DailySubmissionDto;
  beat: number | null;
  alone: boolean;
  onCopy: () => void;
  onShare: () => void;
}) {
  const { c, spacing, radius } = useTheme();
  const d = useDaily();

  return (
    <Card hud tone="charge" style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="overline" tone="tertiary" uppercase>
          {d.solved}
        </Text>
        <View style={{ flex: 1 }} />
        <Badge label={fill(d.rankLabel, { n: submission.rank })} tone="gold" />
        <Badge label={fill(d.attempts, { n: submission.attempts })} tone="neutral" />
      </View>

      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: c.bgSunken,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <Text variant="callout" mono weight="700" selectable>
          {submission.shareText}
        </Text>
      </View>

      {beat !== null ? (
        <Text variant="footnote" weight="700" tone="gold">
          {beat === 100 && alone ? d.beatAlone : fill(d.beat, { n: beat })}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          label={d.copy}
          variant="charge"
          size="sm"
          icon="copy-outline"
          style={{ flex: 1 }}
          onPress={onCopy}
        />
        <Button
          label={d.share}
          variant="secondary"
          size="sm"
          icon="share-social-outline"
          style={{ flex: 1 }}
          onPress={onShare}
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
  tone?: 'gold' | 'danger';
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
      <Text variant="callout" mono weight="700" tone={tone}>
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
  const d = useDaily();

  const groups: { title: string; kind: RigPartKind }[] = [
    { title: d.kindCores, kind: 'CORE' },
    { title: d.kindCooling, kind: 'COOLER' },
    { title: d.kindPower, kind: 'PSU' },
    { title: d.kindModules, kind: 'MODULE' },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title={d.pickPart}>
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

function BoardRow({ row }: { row: DailySubmissionDto }) {
  const { c, spacing, radius, alpha } = useTheme();
  const { locale } = useI18n();
  const d = useDaily();

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
          {row.mine ? d.you : row.user.name}
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
          {d.perHour}
        </Text>
      </View>
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
