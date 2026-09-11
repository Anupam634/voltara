import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { Badge, Divider } from '../src/components/ui/Badge';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { ConfirmSheet, Sheet } from '../src/components/ui/Sheet';
import { EmptyState, ErrorNote, NavBar, Screen, Skeleton } from '../src/components/ui/Chrome';
import { ProgressRing } from '../src/components/mining/Effects';
import { useSocial } from '../src/components/social/strings';
import { useTheme } from '../src/theme/ThemeProvider';
import { useToast } from '../src/components/ui/Toast';
import { useFeedback } from '../src/lib/feedback';
import { useAsyncData } from '../src/lib/hooks';
import { formatPoints } from '../src/lib/format';
import {
  acceptApprenticeship,
  declineApprenticeship,
  endApprenticeship,
  getApprentice,
  getRig,
  giftPart,
  offerApprenticeship,
  type ApprenticeOverviewDto,
  type ApprenticeshipDto,
  type RigPartDto,
} from '../src/api/endpoints';
import { errorMessage } from '../src/api/client';

/**
 * Mentorship.
 *
 * Leads with what a mentor gives rather than what they take, because the cut
 * is minted rather than deducted and a newcomer reading this needs to see
 * that before anything else.
 */
export default function ApprenticeScreen() {
  const { c, spacing, radius, alpha } = useTheme();
  const S = useSocial();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const feedback = useFeedback();

  const { data, error, loading, refreshing, reload } = useAsyncData<ApprenticeOverviewDto>(
    getApprentice,
    (e) => errorMessage(e, S.apprenticeOffline),
  );

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [giftFor, setGiftFor] = useState<ApprenticeshipDto | null>(null);
  const [spare, setSpare] = useState<RigPartDto[]>([]);
  const [endTarget, setEndTarget] = useState<ApprenticeshipDto | null>(null);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      feedback.success();
      if (ok) toast.show(ok);
      await reload({ silent: true });
    } catch (e) {
      feedback.error();
      toast.show(errorMessage(e, S.apprenticeOffline));
    } finally {
      setBusy(false);
    }
  };

  const openGift = async (a: ApprenticeshipDto) => {
    feedback.select();
    setGiftFor(a);
    try {
      const rig = await getRig();
      setSpare((rig.inventory ?? []).filter((p) => !p.burned));
    } catch {
      setSpare([]);
    }
  };

  const blockMessage = () => {
    switch (data?.eligible.reason) {
      case 'TOO_NEW':
        return S.apprenticeBlockTooNew;
      case 'RIG_UNSTABLE':
        return S.apprenticeBlockUnstable;
      case 'AT_CAPACITY':
        return S.apprenticeBlockCapacity;
      case 'IS_APPRENTICE':
        return S.apprenticeBlockIsApprentice;
      default:
        return '';
    }
  };

  return (
    <Screen>
      <NavBar
        title={S.apprenticeTitle}
        subtitle={S.apprenticeSubtitle}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.huge,
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => reload()} tintColor={c.primary} />
        }
      >
        {error && !data ? <ErrorNote message={error} onRetry={() => reload()} /> : null}
        {loading && !data ? <Skeleton height={200} /> : null}

        {data ? (
          <>
            {/* An offer waiting on this miner outranks everything else. */}
            {data.invitesOpen.map((a) => (
              <Animated.View key={a.id} entering={FadeInDown.springify()}>
                <Card padded hud tone="charge">
                  <Text variant="overline" uppercase style={{ color: c.gold }}>
                    {S.apprenticeInviteTitle}
                  </Text>
                  <Text variant="title3" weight="900" style={{ marginTop: 4 }}>
                    {a.other?.name ?? '—'}
                  </Text>
                  <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.xs }}>
                    {S.apprenticeInviteBody}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                    <Button
                      label={S.apprenticeAccept}
                      variant="charge"
                      loading={busy}
                      style={{ flex: 1 }}
                      onPress={() => act(() => acceptApprenticeship(a.id))}
                    />
                    <Button
                      label={S.apprenticeDecline}
                      variant="secondary"
                      loading={busy}
                      style={{ flex: 1 }}
                      onPress={() => act(() => declineApprenticeship(a.id))}
                    />
                  </View>
                </Card>
              </Animated.View>
            ))}

            <Card padded hud>
              <Text variant="title3" weight="900">
                {S.apprenticeHeroTitle}
              </Text>
              <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.xs }}>
                {S.apprenticeHeroBody}
              </Text>
              {data.mentorEarnedPoints > 0 ? (
                <>
                  <Divider />
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
                  >
                    <Text variant="overline" tone="tertiary" uppercase>
                      {S.apprenticeEarned}
                    </Text>
                    <Text variant="title3" mono weight="900" style={{ color: c.gold }}>
                      {formatPoints(data.mentorEarnedPoints)}
                    </Text>
                  </View>
                </>
              ) : null}
            </Card>

            {/* Take on an apprentice. */}
            <Card padded>
              <Text variant="overline" tone="tertiary" uppercase>
                {S.apprenticeOfferTitle}
              </Text>
              {data.eligible.canMentor ? (
                <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                  <Input
                    value={code}
                    onChangeText={setCode}
                    placeholder={S.apprenticeOfferPlaceholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text variant="caption" tone="tertiary">
                    {S.apprenticeOfferHint}
                  </Text>
                  <Button
                    label={S.apprenticeOfferCta}
                    variant="primary"
                    fullWidth
                    loading={busy}
                    disabled={!code.trim()}
                    onPress={async () => {
                      feedback.press();
                      await act(() => offerApprenticeship(code.trim()), S.apprenticeOfferSent);
                      setCode('');
                    }}
                  />
                </View>
              ) : (
                <View
                  style={{
                    marginTop: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: alpha(c.warning, 0.1),
                    borderWidth: 1,
                    borderColor: alpha(c.warning, 0.3),
                  }}
                >
                  <Text variant="caption" weight="800" style={{ color: c.warning }}>
                    {S.apprenticeCannot}
                  </Text>
                  <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                    {blockMessage()}
                  </Text>
                </View>
              )}
            </Card>

            {/* Offers sent, waiting. */}
            {data.pendingOffers.length > 0 ? (
              <Card padded>
                <Text variant="overline" tone="tertiary" uppercase>
                  {S.apprenticePending}
                </Text>
                {data.pendingOffers.map((a) => (
                  <View
                    key={a.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: spacing.md,
                      gap: spacing.sm,
                    }}
                  >
                    <Text variant="callout" weight="700" numberOfLines={1} style={{ flex: 1 }}>
                      {a.other?.name ?? '—'}
                    </Text>
                    <Button
                      label={S.apprenticeEnd}
                      variant="danger"
                      size="sm"
                      loading={busy}
                      onPress={() => act(() => endApprenticeship(a.id))}
                    />
                  </View>
                ))}
              </Card>
            ) : null}

            {/* Active apprentices. */}
            <Card padded>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="overline" tone="tertiary" uppercase>
                  {S.apprenticeActive}
                </Text>
                <Badge
                  tone="neutral"
                  label={`${data.eligible.activeCount} / ${data.maxApprentices}`}
                />
              </View>
              {data.asMentor.length === 0 ? (
                <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.md }}>
                  {S.apprenticeEmpty}
                </Text>
              ) : (
                data.asMentor.map((a) => (
                  <PeerRow key={a.id} a={a} onGift={() => openGift(a)} onEnd={() => setEndTarget(a)} />
                ))
              )}
            </Card>

            {/* This miner's own mentor. */}
            <Card padded>
              <Text variant="overline" tone="tertiary" uppercase>
                {S.apprenticeMyMentor}
              </Text>
              {data.asApprentice ? (
                <PeerRow a={data.asApprentice} onEnd={() => setEndTarget(data.asApprentice!)} />
              ) : (
                <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.md }}>
                  {S.apprenticeNoMentor}
                </Text>
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>

      <Sheet
        visible={giftFor !== null}
        onClose={() => setGiftFor(null)}
        title={S.apprenticeGift}
        subtitle={S.apprenticeGiftHint}
      >
        {spare.length === 0 ? (
          <EmptyState icon="cube-outline" title={S.apprenticeGiftEmpty} />
        ) : (
          <View style={{ gap: spacing.sm, paddingBottom: spacing.lg }}>
            {spare.map((p) => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: c.surfaceAlt,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="callout" weight="700" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {p.kind}
                  </Text>
                </View>
                <Button
                  label={S.apprenticeGiftCta}
                  variant="charge"
                  size="sm"
                  loading={busy}
                  onPress={async () => {
                    if (!giftFor) return;
                    feedback.strike();
                    await act(() => giftPart(giftFor.id, p.id), S.apprenticeGifted);
                    setGiftFor(null);
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </Sheet>

      <ConfirmSheet
        visible={endTarget !== null}
        onClose={() => setEndTarget(null)}
        title={S.apprenticeEnd}
        body={S.apprenticeEndConfirm}
        confirmLabel={S.apprenticeEnd}
        cancelLabel={S.apprenticeKeep}
        destructive
        onConfirm={async () => {
          const target = endTarget;
          setEndTarget(null);
          if (target) await act(() => endApprenticeship(target.id));
        }}
      />
    </Screen>
  );

  function PeerRow({
    a,
    onGift,
    onEnd,
  }: {
    a: ApprenticeshipDto;
    onGift?: () => void;
    onEnd: () => void;
  }) {
    const other = a.other;
    const cutOver = a.cutExpiresAt ? new Date(a.cutExpiresAt).getTime() < Date.now() : false;
    return (
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <ProgressRing size={44} stroke={5} progress={(other?.gridStability ?? 0) / 100} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="callout" weight="800" numberOfLines={1}>
              {other?.name ?? '—'}
            </Text>
            <Text variant="caption" mono tone="tertiary">
              {(other?.ratePerHour ?? 0).toFixed(2)} VOLTS/h
            </Text>
          </View>
          <Badge
            tone={cutOver ? 'neutral' : 'gold'}
            label={cutOver ? S.apprenticeCutEnded : `${a.cutPercent}%`}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {other ? (
            <Button
              label={S.watchCta}
              variant="secondary"
              size="sm"
              onPress={() => router.push({ pathname: '/watch/[code]', params: { code: other.watchCode } })}
            />
          ) : null}
          {onGift ? (
            <Button
              label={S.apprenticeGift}
              variant="primary"
              size="sm"
              loading={busy}
              onPress={onGift}
            />
          ) : null}
          <Button label={S.apprenticeEnd} variant="danger" size="sm" onPress={onEnd} />
        </View>
      </View>
    );
  }
}
