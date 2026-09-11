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
import { Input } from '../src/components/ui/Input';
import { ConfirmSheet } from '../src/components/ui/Sheet';
import { ErrorNote, NavBar, Screen, Skeleton } from '../src/components/ui/Chrome';
import { ProgressRing } from '../src/components/mining/Effects';
import { useSocial } from '../src/components/social/strings';
import { useTheme } from '../src/theme/ThemeProvider';
import { useI18n, useT } from '../src/i18n';
import { useToast } from '../src/components/ui/Toast';
import { useFeedback } from '../src/lib/feedback';
import { useSession } from '../src/store/session';
import { useAsyncData } from '../src/lib/hooks';
import { formatPoints } from '../src/lib/format';
import {
  createSquad,
  getSquad,
  getSquadLeaderboard,
  joinSquad,
  leaveSquad,
  type SquadDto,
  type SquadMemberDto,
  type SquadRankDto,
} from '../src/api/endpoints';
import { errorMessage } from '../src/api/client';

/**
 * Squads.
 *
 * Five rigs sharing one pool of cooling and power: whatever a member is not
 * using is lent to whoever is over budget. The pool card is the whole point
 * of the screen, so it leads — how much is spare, how much is actually moving,
 * and which member is being carried.
 */

const POLL_MS = 30_000;
const NAME_MIN = 3;
const NAME_MAX = 24;

interface Board {
  squad: SquadDto | null;
  ranks: SquadRankDto[];
}

export default function SquadScreen() {
  const { c, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { locale } = useI18n();
  const s = useSocial();
  const toast = useToast();
  const feedback = useFeedback();
  const { profile } = useSession();

  const load = useCallback(async (): Promise<Board> => {
    // The rankings are public and the membership is not; a failure on the
    // board must not blank the squad the miner is actually in.
    const [mine, ranks] = await Promise.all([
      getSquad(),
      getSquadLeaderboard().catch(() => ({ squads: [] as SquadRankDto[] })),
    ]);
    return { squad: mine.squad, ranks: ranks.squads };
  }, []);

  const toMessage = useCallback(
    (err: unknown) => errorMessage(err, t('app.offline')),
    [t],
  );
  const { data, error, loading, refreshing, reload } = useAsyncData<Board>(load, toMessage);

  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

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

  const squad = data?.squad ?? null;
  const ranks = data?.ranks ?? [];

  const nameValid = name.trim().length >= NAME_MIN && name.trim().length <= NAME_MAX;
  const codeValid = code.trim().length > 0;

  // Only the owner is warned that leaving hands the squad on, so this has to
  // compare against the caller's own id, not merely find an owner in the list.
  const isOwner = !!squad && !!profile && squad.ownerId === profile.id;

  const copyCode = useCallback(async () => {
    if (!squad) return;
    await Clipboard.setStringAsync(squad.code);
    feedback.tick();
    toast.success(t('app.copied'));
  }, [squad, feedback, toast, t]);

  const shareCode = useCallback(async () => {
    if (!squad) return;
    feedback.press();
    try {
      await Share.share({
        title: s.squadShareTitle,
        message: s.squadShareMessage.replace('{code}', squad.code),
      });
    } catch {
      /* the user dismissed the share sheet */
    }
  }, [squad, feedback, s]);

  return (
    <Screen>
      <NavBar title={s.squadTitle} subtitle={s.squadSubtitle} large transparent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
              <Skeleton height={200} radius={radius.xl} />
              <Skeleton height={160} radius={radius.xl} />
            </>
          ) : null}

          {/* ── Not in a squad: create or join ── */}
          {!loading && !squad ? (
            <>
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
                    <Ionicons name="people" size={24} color={c.primary} />
                  </View>
                  <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.md }}>
                    {s.squadPitchBody}
                  </Text>
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(60).duration(260)}>
                <Card padded>
                  <Text variant="headline">{s.squadCreateTitle}</Text>
                  <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
                    {s.squadCreateHint}
                  </Text>
                  <Input
                    label={s.squadNameLabel}
                    placeholder={s.squadNamePlaceholder}
                    value={name}
                    onChangeText={setName}
                    maxLength={NAME_MAX}
                    autoCapitalize="words"
                    containerStyle={{ marginTop: spacing.md }}
                  />
                  <Button
                    label={s.squadCreate}
                    icon="add-circle-outline"
                    variant="charge"
                    fullWidth
                    disabled={!nameValid || busy}
                    loading={busy}
                    onPress={() => act(() => createSquad(name.trim()), 'win')}
                    style={{ marginTop: spacing.md }}
                    silent
                  />
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(120).duration(260)}>
                <Card padded>
                  <Text variant="headline">{s.squadJoinTitle}</Text>
                  <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
                    {s.squadJoinHint}
                  </Text>
                  <Input
                    label={s.squadCodeLabel}
                    placeholder={s.squadCodePlaceholder}
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="none"
                    autoCorrect={false}
                    mono
                    containerStyle={{ marginTop: spacing.md }}
                  />
                  <Button
                    label={s.squadJoin}
                    icon="enter-outline"
                    variant="primary"
                    fullWidth
                    disabled={!codeValid || busy}
                    loading={busy}
                    onPress={() => act(() => joinSquad(code.trim()), 'win')}
                    style={{ marginTop: spacing.md }}
                    silent
                  />
                </Card>
              </Animated.View>
            </>
          ) : null}

          {/* ── In a squad ── */}
          {squad ? (
            <>
              <Animated.View entering={FadeInDown.duration(260)}>
                <Card padded hud>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="title3" numberOfLines={1}>
                        {squad.name}
                      </Text>
                      <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
                        {squad.members.length}/{squad.maxMembers} {s.squadMembers}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="title3" mono weight="800" tone="gold">
                        {formatPoints(squad.earnedPoints7d, 2, locale)}
                      </Text>
                      <Text variant="caption" tone="tertiary" style={{ fontSize: 10 }}>
                        {s.squadEarned7d}
                      </Text>
                    </View>
                  </View>

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
                      {s.squadCode}
                    </Text>
                    <Text variant="callout" mono weight="700" style={{ marginTop: 4 }} numberOfLines={1}>
                      {squad.code}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                    <Button
                      label={s.duelCopy}
                      icon="copy-outline"
                      variant="secondary"
                      size="sm"
                      onPress={() => void copyCode()}
                      style={{ flex: 1 }}
                      silent
                    />
                    <Button
                      label={s.duelShare}
                      icon="share-social-outline"
                      variant="secondary"
                      size="sm"
                      onPress={() => void shareCode()}
                      style={{ flex: 1 }}
                      silent
                    />
                  </View>
                </Card>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(60).duration(260)}>
                <PoolCard squad={squad} />
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(120).duration(260)}>
                <Card padded>
                  <Text variant="overline" tone="tertiary" uppercase>
                    {s.squadMembers}
                  </Text>
                  <View style={{ marginTop: spacing.sm }}>
                    {squad.members.map((member, i) => (
                      <View key={member.id}>
                        {i > 0 ? <Divider /> : null}
                        <MemberRow member={member} />
                      </View>
                    ))}
                  </View>
                </Card>
              </Animated.View>

              <Button
                label={s.squadLeave}
                icon="exit-outline"
                variant="danger"
                size="sm"
                fullWidth
                disabled={busy}
                onPress={() => setConfirmLeave(true)}
              />
            </>
          ) : null}

          {/* ── Squad rankings ── */}
          {!loading ? (
            <Card padded>
              <Text variant="overline" tone="tertiary" uppercase>
                {s.squadRanksTitle}
              </Text>
              {ranks.length === 0 ? (
                <Text variant="footnote" tone="tertiary" style={{ marginTop: spacing.sm }}>
                  {s.squadRanksEmpty}
                </Text>
              ) : (
                <View style={{ marginTop: spacing.sm }}>
                  {ranks.map((row, i) => (
                    <View key={row.id}>
                      {i > 0 ? <Divider /> : null}
                      <RankRow row={row} mine={row.id === squad?.id} />
                    </View>
                  ))}
                </View>
              )}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          act(() => leaveSquad());
        }}
        title={s.squadLeaveTitle}
        body={isOwner ? s.squadLeaveOwnerBody : s.squadLeaveBody}
        confirmLabel={s.squadLeaveConfirm}
        cancelLabel={s.squadStay}
        destructive
        icon="exit-outline"
        loading={busy}
      />
    </Screen>
  );
}

/**
 * The shared pool.
 *
 * Two bars: how much spare capacity exists, and how much of it is actually
 * being lent. When nothing moves the card stays plain — a charged panel that
 * means nothing would spend the one accent colour on furniture.
 */
function PoolCard({ squad }: { squad: SquadDto }) {
  const { c, spacing } = useTheme();
  const s = useSocial();

  const lending = squad.pool.coolingLent > 0 || squad.pool.powerLent > 0;

  return (
    <Card padded tone={lending ? 'charge' : 'default'}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Text variant="overline" tone={lending ? 'gold' : 'tertiary'} uppercase>
          {s.squadPoolTitle}
        </Text>
        <Ionicons
          name={lending ? 'git-network' : 'git-network-outline'}
          size={16}
          color={lending ? c.gold : c.textTertiary}
        />
      </View>

      <Text variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
        {lending ? s.squadPoolHint : s.squadPoolIdle}
      </Text>

      <View style={{ marginTop: spacing.md, gap: spacing.md }}>
        <PoolBar
          label={s.squadCooling}
          icon="snow-outline"
          lent={squad.pool.coolingLent}
          spare={squad.pool.coolingSurplus}
          unit="TU"
        />
        <PoolBar
          label={s.squadPower}
          icon="flash-outline"
          lent={squad.pool.powerLent}
          spare={squad.pool.powerSurplus}
          unit="W"
        />
      </View>
    </Card>
  );
}

/** One capacity bar: the lent share in lime, the spare remainder behind it. */
function PoolBar({
  label,
  icon,
  lent,
  spare,
  unit,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  lent: number;
  spare: number;
  unit: string;
}) {
  const { c, spacing, radius } = useTheme();
  const s = useSocial();

  const total = lent + spare;
  const share = total > 0 ? lent / total : 0;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={icon} size={13} color={c.textTertiary} />
          <Text variant="caption" tone="secondary" weight="600">
            {label}
          </Text>
        </View>
        <Text variant="caption" tone="tertiary" mono>
          {lent} {unit} {s.squadLent} · {spare} {unit} {s.squadSpare}
        </Text>
      </View>

      <View
        style={{
          marginTop: 6,
          height: 8,
          borderRadius: radius.pill,
          overflow: 'hidden',
          flexDirection: 'row',
          backgroundColor: c.surfaceAlt,
        }}
      >
        <View style={{ flex: Math.max(0.0001, share), backgroundColor: c.gold }} />
        <View style={{ flex: Math.max(0.0001, 1 - share) }} />
      </View>
    </View>
  );
}

/** One squad mate: stability ring, rate, and what the pool is doing for them. */
function MemberRow({ member }: { member: SquadMemberDto }) {
  const { spacing } = useTheme();
  const s = useSocial();

  const receiving = member.lent.cooling > 0 || member.lent.power > 0;
  const spare = member.coolingSurplus > 0 || member.powerSurplus > 0;

  const chip = receiving
    ? `${s.squadReceiving} ${[
        member.lent.cooling > 0 ? `${member.lent.cooling} TU` : null,
        member.lent.power > 0 ? `${member.lent.power} W` : null,
      ]
        .filter(Boolean)
        .join(' · ')}`
    : spare
      ? `${s.squadSparePrefix} ${[
          member.coolingSurplus > 0 ? `${member.coolingSurplus} TU` : null,
          member.powerSurplus > 0 ? `${member.powerSurplus} W` : null,
        ]
          .filter(Boolean)
          .join(' · ')}`
      : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <ProgressRing size={44} stroke={4} progress={member.gridStability / 100}>
        <Text variant="caption" mono weight="800" style={{ fontSize: 10 }}>
          {member.gridStability}
        </Text>
      </ProgressRing>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="callout" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
            {member.name}
          </Text>
          {member.isOwner ? <Badge label={s.squadOwner} tone="brand" /> : null}
        </View>
        {chip ? (
          <Text variant="caption" tone={receiving ? 'gold' : 'tertiary'} style={{ fontSize: 10 }}>
            {chip}
          </Text>
        ) : null}
      </View>

      <Text variant="callout" mono weight="700" tone="secondary">
        {member.ratePerHour.toFixed(2)}
        {s.perHour}
      </Text>
    </View>
  );
}

/** A row of the public squad board. */
function RankRow({ row, mine }: { row: SquadRankDto; mine: boolean }) {
  const { c, spacing, radius, alpha } = useTheme();
  const s = useSocial();
  const { locale } = useI18n();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: mine ? spacing.sm : 0,
        marginHorizontal: mine ? -spacing.sm : 0,
        borderRadius: radius.md,
        backgroundColor: mine ? alpha(c.gold, c.dark ? 0.1 : 0.08) : 'transparent',
      }}
    >
      <Text
        variant="callout"
        mono
        weight="800"
        tone={row.rank <= 3 ? 'gold' : 'tertiary'}
        style={{ width: 26 }}
      >
        {row.rank}
      </Text>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="callout" weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
            {row.name}
          </Text>
          {mine ? <Badge label={s.squadYours} tone="gold" /> : null}
        </View>
        <Text variant="caption" tone="tertiary" style={{ fontSize: 10 }}>
          {row.members} {s.squadMembers}
        </Text>
      </View>

      <Text variant="callout" mono weight="700" tone={mine ? 'gold' : 'secondary'}>
        {formatPoints(row.earnedPoints, 0, locale)}
      </Text>
    </View>
  );
}
