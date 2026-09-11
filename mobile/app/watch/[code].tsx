import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { ErrorNote, NavBar, Screen, Skeleton } from '../../src/components/ui/Chrome';
import { ProgressRing } from '../../src/components/mining/Effects';
import { useSocial } from '../../src/components/social/strings';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAsyncData } from '../../src/lib/hooks';
import { useSession } from '../../src/store/session';
import { getRigWatch, type RigWatchDto, type WatchSlotDto } from '../../src/api/endpoints';
import { errorMessage } from '../../src/api/client';

const POLL_MS = 10_000;

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  CORE: 'hardware-chip-outline',
  COOLER: 'snow-outline',
  PSU: 'flash-outline',
  MODULE: 'sparkles-outline',
};

/**
 * Spectator mode.
 *
 * Read-only by construction: it renders the public watch payload and offers
 * exactly one action, which is to challenge the rig you are looking at.
 */
export default function WatchScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { c, spacing, radius, alpha, monoFont } = useTheme();
  const S = useSocial();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();

  const { data, error, loading, refreshing, reload } = useAsyncData<RigWatchDto>(
    () => getRigWatch(String(code)),
    (e) => errorMessage(e, S.watchOffline),
  );

  useFocusEffect(
    useCallback(() => {
      reload();
      const id = setInterval(() => reload({ silent: true }), POLL_MS);
      return () => clearInterval(id);
    }, [reload]),
  );

  const t = data?.telemetry;
  const tone = !t ? 'default' : t.gridStability >= 95 ? 'charge' : t.gridStability < 60 ? 'heat' : 'default';

  return (
    <Screen>
      <NavBar title={S.watchTitle} subtitle={S.watchSubtitle} onBack={() => router.back()} />
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

        {loading && !data ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={120} />
            <Skeleton height={220} />
          </View>
        ) : null}

        {data && t ? (
          <>
            <Animated.View entering={FadeInDown.springify()}>
              <Card padded hud tone={tone}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                  <ProgressRing size={78} stroke={7} progress={t.gridStability / 100} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="title3" weight="900" numberOfLines={1}>
                      {data.name}
                    </Text>
                    <Text
                      variant="caption"
                      mono
                      weight="800"
                      style={{ color: c.gold, marginTop: 2 }}
                    >
                      {data.ratePerHour.toFixed(2)} VOLTS/h
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: spacing.xs,
                        marginTop: spacing.sm,
                      }}
                    >
                      {data.overclocking ? (
                        <Badge tone="danger" label={S.watchOverclocking} />
                      ) : null}
                      {data.event ? <Badge tone="info" label={data.event.title} /> : null}
                      {data.streakDays > 0 ? (
                        <Badge
                          tone="gold"
                          label={`${S.watchStreak} ${data.streakDays} ${S.watchDays}`}
                        />
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                  <Meter
                    label={S.watchThermal}
                    used={t.heatLoad}
                    cap={t.coolingCapacity}
                    over={t.overheating}
                    unit="TU"
                  />
                  <Meter
                    label={S.watchPower}
                    used={t.powerDraw}
                    cap={t.powerSupply}
                    over={t.brownout}
                    unit="W"
                  />
                </View>
              </Card>
            </Animated.View>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.sm,
              }}
            >
              {data.slotsDetail.map((slot, i) => (
                <Socket key={i} slot={slot} S={S} />
              ))}
            </View>

            <Button
              label={S.watchChallenge}
              variant="charge"
              fullWidth
              onPress={() => router.push(profile ? '/duels' : '/(auth)/sign-up')}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );

  function Meter({
    label,
    used,
    cap,
    over,
    unit,
  }: {
    label: string;
    used: number;
    cap: number;
    over: boolean;
    unit: string;
  }) {
    const pct = cap > 0 ? Math.min(1, used / cap) : 0;
    return (
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="overline" tone="tertiary" uppercase>
            {label}
          </Text>
          <Text
            variant="caption"
            mono
            weight="800"
            style={{ color: over ? c.danger : c.textSecondary }}
          >
            {used} / {cap} {unit}
          </Text>
        </View>
        <View
          style={{
            height: 7,
            borderRadius: radius.pill,
            backgroundColor: alpha(c.border, 0.9),
            overflow: 'hidden',
            marginTop: spacing.xs,
          }}
        >
          <View
            style={{
              width: `${Math.max(4, pct * 100)}%`,
              height: '100%',
              borderRadius: radius.pill,
              backgroundColor: over ? c.danger : pct >= 0.8 ? c.warning : c.gold,
            }}
          />
        </View>
      </View>
    );
  }

  function Socket({ slot, S: s }: { slot: WatchSlotDto | null; S: typeof S }) {
    const width = '48%' as const;
    if (!slot) {
      return (
        <View
          style={{
            width,
            minHeight: 92,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: c.border,
            padding: spacing.md,
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" tone="tertiary">
            {s.watchEmpty}
          </Text>
        </View>
      );
    }
    const accent = slot.burned ? c.textTertiary : slot.hot ? c.danger : c.primary;
    return (
      <View
        style={{
          width,
          minHeight: 92,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: alpha(accent, 0.5),
          backgroundColor: alpha(accent, 0.08),
          padding: spacing.md,
          opacity: slot.burned ? 0.6 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Ionicons name={KIND_ICON[slot.kind] ?? 'cube-outline'} size={16} color={accent} />
          {slot.burned ? (
            <Badge tone="danger" label={s.watchBurned} />
          ) : slot.hot ? (
            <Badge tone="danger" label={s.watchHot} />
          ) : null}
        </View>
        <Text variant="caption" weight="800" numberOfLines={1} style={{ marginTop: spacing.sm }}>
          {slot.name}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ fontFamily: monoFont, fontSize: 10 }}>
          {slot.heat > 0 ? `${slot.heat} TU ` : ''}
          {slot.cooling > 0 ? `−${slot.cooling} TU ` : ''}
          {slot.watts > 0 ? `${slot.watts} W` : ''}
          {slot.wattsSupplied > 0 ? `+${slot.wattsSupplied} W` : ''}
        </Text>
      </View>
    );
  }
}
