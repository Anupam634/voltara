import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge, Divider } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { ConfirmSheet } from '../src/components/ui/Sheet';
import { ErrorNote, NavBar, Screen, Skeleton } from '../src/components/ui/Chrome';
import { ProgressRing } from '../src/components/mining/Effects';
import { useSocial } from '../src/components/social/strings';
import { useTheme } from '../src/theme/ThemeProvider';
import { useI18n, useT } from '../src/i18n';
import { useToast } from '../src/components/ui/Toast';
import { useFeedback } from '../src/lib/feedback';
import { useAsyncData, useNow } from '../src/lib/hooks';
import { countdownLabel, formatDate, formatPoints } from '../src/lib/format';
import {
  cancelDuel,
  createDuel,
  getDuels,
  type DuelBoard,
  type DuelDto,
  type DuelSide,
} from '../src/api/endpoints';
import { errorMessage, WEB_URL } from '../src/api/client';

/**
 * Rig duels.
 *
 * A duel is a 24-hour output race between two builds: whatever each rig mines
 * inside the window is the score, and the loser hands over a tenth of theirs.
 * An open duel is nothing but a link waiting to be accepted, so that state is
 * all share affordances; an active duel is a scoreboard that has to move on
 * its own, so it polls every 20 seconds and the split bar reads at a glance.
 */

/** An open duel stops accepting after 48h — the server's own rule. */
const OPEN_WINDOW_MS = 48 * 3_600_000;

/** How often the live board is re-read while the screen is in front. */
const POLL_MS = 20_000;

export default function DuelsScreen() {
  const { c, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { locale } = useI18n();
  const s = useSocial();
  const toast = useToast();
  const feedback = useFeedback();
  const now = useNow();

  const toMessage = useCallback(
    (err: unknown) => errorMessage(err, t('app.offline')),
    [t],
  );
  const { data, error, loading, refreshing, reload } = useAsyncData<DuelBoard>(
    getDuels,
    toMessage,
  );

  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Poll only while the screen is in front: a duel scoreboard behind another
  // route is a request every 20 seconds that nobody is looking at.
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => void reload({ silent: true }), POLL_MS);
      return () => clearInterval(id);
    }, [reload]),
  );

  const act = useCallback(
    async (fn: () => Promise<unknown>, cue: 'success' | 'win' = 'success') => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
        feedback[cue]();
        await reload({ silent: true });
      } catch (err) {
        feedback.error();
        toast.error(toMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [busy, feedback, reload, toast, toMessage],
  );

  const open = data?.open ?? null;
  const active = data?.active ?? null;
  const history = data?.history ?? [];

  const link = open ? `${WEB_URL}/${locale}/duel/${open.code}` : '';

  const copyLink = useCallback(async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    feedback.tick();
    toast.success(t('app.copied'));
  }, [link, feedback, toast, t]);

  const shareLink = useCallback(async () => {
    if (!link) return;
    feedback.press();
    try {
      await Share.share({
        title: s.duelShareTitle,
        message: s.duelShareMessage.replace('{link}', link),
      });
    } catch {
      /* the user dismissed the share sheet */
    }
  }, [link, feedback, s]);

  return (
    <Screen>
      <NavBar title={s.duelsTitle} subtitle={s.duelsSubtitle} large transparent />

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
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.md,
        }}
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {error ? (
            <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('app.retry')} />
          ) : null}

          {loading && !data ? (
            <>
              <Skeleton height={230} radius={radius.xl} />
              <Skeleton height={120} radius={radius.xl} />
            </>
          ) : null}

          {active ? (
            <Animated.View entering={FadeInDown.duration(260)}>
              <ActiveDuel duel={active} now={now} />
            </Animated.View>
          ) : null}

          {open ? (
            <Animated.View entering={FadeInDown.duration(260)}>
              <Card padded tone="charge" hud>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: spacing.sm,
                  }}
                >
                  <Text variant="overline" tone="gold" uppercase>
                    {s.duelOpenTitle}
                  </Text>
                  <Badge
                    label={`${s.duelOpenExpires} ${
                      countdownLabel(
                        new Date(new Date(open.createdAt).getTime() + OPEN_WINDOW_MS).toISOString(),
                        now,
                      ) ?? '00:00:00'
                    }`}
                    tone="gold"
                    icon="time-outline"
                  />
                </View>

                <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.sm }}>
                  {s.duelOpenBody}
                </Text>

                <View
                  style={{
                    marginTop: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: c.bgSunken,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  <Text variant="overline" tone="tertiary" uppercase>
                    {s.duelLink}
                  </Text>
                  <Text
                    variant="footnote"
                    mono
                    tone="secondary"
                    numberOfLines={2}
                    style={{ marginTop: 4 }}
                  >
                    {link}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <Button
                    label={s.duelCopy}
                    icon="copy-outline"
                    variant="secondary"
                    size="md"
                    onPress={() => void copyLink()}
                    style={{ flex: 1 }}
                    silent
                  />
                  <Button
                    label={s.duelShare}
                    icon="share-social-outline"
                    variant="charge"
                    size="md"
                    onPress={() => void shareLink()}
                    style={{ flex: 1 }}
                    silent
                  />
                </View>

                <Button
                  label={s.duelCancel}
                  variant="danger"
                  size="sm"
                  fullWidth
                  disabled={busy}
                  onPress={() => setConfirmCancel(true)}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>
            </Animated.View>
          ) : null}

          {!loading && !open && !active ? (
            <Animated.View entering={FadeInDown.duration(260)}>
              <Card padded hud>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: radius.lg,
                    backgroundColor: c.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="flash" size={24} color={c.primary} />
                </View>

                <Text variant="title3" style={{ marginTop: spacing.md }}>
                  {s.duelsPitchTitle}
                </Text>
                <Text variant="footnote" tone="secondary" style={{ marginTop: 6 }}>
                  {s.duelsPitchBody}
                </Text>

                <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                  <PitchRow
                    icon="time-outline"
                    title={s.duelsPoint1Title}
                    body={s.duelsPoint1Body}
                  />
                  <PitchRow
                    icon="trending-up-outline"
                    title={s.duelsPoint2Title}
                    body={s.duelsPoint2Body}
                  />
                  <PitchRow
                    icon="hardware-chip-outline"
                    title={s.duelsPoint3Title}
                    body={s.duelsPoint3Body}
                  />
                </View>

                <Button
                  label={busy ? s.duelCreating : s.duelCreate}
                  icon="flash"
                  variant="charge"
                  size="lg"
                  fullWidth
                  loading={busy}
                  onPress={() => act(() => createDuel(), 'win')}
                  style={{ marginTop: spacing.xl }}
                  silent
                />
              </Card>
            </Animated.View>
          ) : null}

          {/* ── Past duels ── */}
          {!loading ? (
            <Card padded>
              <Text variant="overline" tone="tertiary" uppercase>
                {s.duelHistoryTitle}
              </Text>
              {history.length === 0 ? (
                <Text variant="footnote" tone="tertiary" style={{ marginTop: spacing.sm }}>
                  {s.duelHistoryEmpty}
                </Text>
              ) : (
                <View style={{ marginTop: spacing.sm }}>
                  {history.map((duel, i) => (
                    <View key={duel.id}>
                      {i > 0 ? <Divider /> : null}
                      <HistoryRow duel={duel} />
                    </View>
                  ))}
                </View>
              )}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          if (open) act(() => cancelDuel(open.code));
        }}
        title={s.duelCancelTitle}
        body={s.duelCancelBody}
        confirmLabel={s.duelCancelConfirm}
        cancelLabel={s.duelKeep}
        destructive
        icon="close-circle"
        loading={busy}
      />
    </Screen>
  );
}

/** One value proposition on the empty-state hero. */
function PitchRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const { c, spacing, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.md,
          backgroundColor: c.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={16} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="700">
          {title}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}

/**
 * The versus board.
 *
 * Two rigs, two live scores, and one bar showing the split. The panel tone
 * follows the caller's standing so the screen answers "am I winning?" before
 * any number is read.
 */
function ActiveDuel({ duel, now }: { duel: DuelDto; now: number }) {
  const { c, spacing, radius, alpha } = useTheme();
  const s = useSocial();
  const { locale } = useI18n();

  const mineIsChallenger = duel.mine !== 'opponent';
  const mySide = mineIsChallenger ? duel.challenger : duel.opponent;
  const theirSide = mineIsChallenger ? duel.opponent : duel.challenger;
  const myScore = mineIsChallenger ? duel.liveScore.challenger : duel.liveScore.opponent;
  const theirScore = mineIsChallenger ? duel.liveScore.opponent : duel.liveScore.challenger;

  const total = myScore + theirScore;
  const myShare = total > 0 ? myScore / total : 0.5;

  const standing: 'lead' | 'trail' | 'tied' =
    myScore > theirScore ? 'lead' : myScore < theirScore ? 'trail' : 'tied';
  const countdown = countdownLabel(duel.endsAt, now);

  return (
    <Card padded hud tone={standing === 'lead' ? 'charge' : standing === 'trail' ? 'heat' : 'default'}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Text variant="overline" tone="tertiary" uppercase>
          {s.duelActiveTitle}
        </Text>
        <Badge
          label={
            standing === 'lead' ? s.duelLeading : standing === 'trail' ? s.duelTrailing : s.duelTied
          }
          tone={standing === 'lead' ? 'gold' : standing === 'trail' ? 'danger' : 'neutral'}
          dot
        />
      </View>

      {/* ── The two rigs ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginTop: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <SideTile side={mySide} label={s.duelYou} score={myScore} highlight />
        <View style={{ alignItems: 'center', paddingTop: 34, gap: 4 }}>
          <Text variant="caption" tone="tertiary" mono weight="800">
            VS
          </Text>
        </View>
        <SideTile side={theirSide} label={s.duelOpponent} score={theirScore} />
      </View>

      {/* ── Split bar ── */}
      <View
        style={{
          marginTop: spacing.lg,
          height: 10,
          borderRadius: radius.pill,
          overflow: 'hidden',
          flexDirection: 'row',
          backgroundColor: c.surfaceAlt,
        }}
      >
        <View style={{ flex: Math.max(0.001, myShare), backgroundColor: c.gold }} />
        <View style={{ flex: Math.max(0.001, 1 - myShare), backgroundColor: alpha(c.primary, 0.8) }} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <Text variant="caption" tone="gold" mono weight="700">
          {Math.round(myShare * 100)}%
        </Text>
        <Text variant="caption" tone="brand" mono weight="700">
          {Math.round((1 - myShare) * 100)}%
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          marginTop: spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="time-outline" size={14} color={c.textTertiary} />
          <Text variant="caption" tone="tertiary">
            {s.duelEndsIn}
          </Text>
          <Text variant="caption" mono weight="800">
            {countdown ?? '00:00:00'}
          </Text>
        </View>
        <Text variant="caption" tone="tertiary">
          {s.duelStake} {duel.stakePercent}%
        </Text>
      </View>

      <Text variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
        {formatDate(duel.startsAt ?? duel.createdAt, locale)}
      </Text>
    </Card>
  );
}

/** One rig in the versus board: stability ring, masked name, rate, score. */
function SideTile({
  side,
  label,
  score,
  highlight,
}: {
  side: DuelSide | null;
  label: string;
  score: number;
  highlight?: boolean;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const s = useSocial();
  const { locale } = useI18n();

  const stability = side?.gridStability ?? 0;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: highlight ? alpha(c.gold, c.dark ? 0.08 : 0.06) : c.bgSunken,
        borderWidth: 1,
        borderColor: highlight ? alpha(c.gold, 0.35) : c.border,
        gap: 4,
      }}
    >
      <Text variant="overline" tone={highlight ? 'gold' : 'tertiary'} uppercase>
        {label}
      </Text>

      <ProgressRing size={64} stroke={5} progress={stability / 100}>
        <Text variant="caption" mono weight="800">
          {stability}%
        </Text>
      </ProgressRing>

      <Text variant="caption" tone="secondary" numberOfLines={1} style={{ maxWidth: '100%' }}>
        {side?.name ?? '—'}
      </Text>

      <Text variant="title3" mono weight="800" tone={highlight ? 'gold' : 'primary'}>
        {formatPoints(score, 2, locale)}
      </Text>
      <Text variant="caption" tone="tertiary" style={{ fontSize: 10 }}>
        {s.duelScore}
      </Text>

      <Text variant="caption" tone="tertiary" mono style={{ fontSize: 10 }}>
        {side ? `${side.ratePerHour.toFixed(2)}${s.perHour}` : '—'}
      </Text>
    </View>
  );
}

/** A settled, expired or cancelled duel, one line each. */
function HistoryRow({ duel }: { duel: DuelDto }) {
  const { spacing } = useTheme();
  const s = useSocial();
  const { locale } = useI18n();

  const mineIsChallenger = duel.mine !== 'opponent';
  const myId = mineIsChallenger ? duel.challenger.id : duel.opponent?.id;
  const them = mineIsChallenger ? duel.opponent : duel.challenger;

  const outcome: { label: string; tone: 'success' | 'danger' | 'neutral' } =
    duel.status === 'CANCELLED'
      ? { label: s.duelCancelled, tone: 'neutral' }
      : duel.status === 'EXPIRED'
        ? { label: s.duelExpired, tone: 'neutral' }
        : !duel.winnerId
          ? { label: s.duelDraw, tone: 'neutral' }
          : duel.winnerId === myId
            ? { label: s.duelWon, tone: 'success' }
            : { label: s.duelLost, tone: 'danger' };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="600" numberOfLines={1}>
          {them?.name ?? '—'}
        </Text>
        <Text variant="caption" tone="tertiary">
          {formatDate(duel.createdAt, locale)}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Badge label={outcome.label} tone={outcome.tone} />
        <Text variant="caption" tone="tertiary" mono style={{ fontSize: 10 }}>
          {duel.transferPoints > 0
            ? `${formatPoints(duel.transferPoints, 2, locale)} ${s.volts} ${s.duelTransferred}`
            : s.duelNothingMoved}
        </Text>
      </View>
    </View>
  );
}
