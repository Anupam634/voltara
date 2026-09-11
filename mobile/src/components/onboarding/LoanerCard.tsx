import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useT } from '../../i18n';
import { useAsyncData, useNow } from '../../lib/hooks';
import { countdownLabel } from '../../lib/format';
import { errorMessage } from '../../api/client';
import { getRig, type RigOverview, type RigPartDto } from '../../api/endpoints';
import { useOnboarding } from './strings';

/** Hours left before the card starts shouting about the lapse. */
const URGENT_HOURS = 12;

/** The free starter core on a rig, if one is still running. */
export function findLoaner(rig: RigOverview | null | undefined): RigPartDto | null {
  if (!rig) return null;
  const parts = [
    ...rig.grid.map((slot) => slot.part).filter((p): p is RigPartDto => !!p),
    ...rig.inventory,
  ];
  const live = parts.filter(
    (p) => p.source === 'LOANER' && Date.parse(p.expiresAt) > Date.now(),
  );
  // Soonest to lapse is the one worth warning about.
  return live.sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))[0] ?? null;
}

/**
 * The 72h starter core, and the moment it becomes a purchase.
 *
 * Charge-toned while there is time, heat-toned under twelve hours with the
 * $1 replacement one tap away — that lapse is the first purchase decision a
 * miner ever makes, so it gets stated plainly rather than sprung on them.
 *
 * Renders nothing when there is no loaner, which is every miner past their
 * first three days.
 */
export function LoanerCard({ rig }: { rig: RigOverview | null | undefined }) {
  const { c, spacing, radius, alpha } = useTheme();
  const S = useOnboarding();
  const now = useNow(30_000);

  const part = findLoaner(rig);
  if (!part) return null;

  const left = countdownLabel(part.expiresAt, now);
  const hoursLeft = (Date.parse(part.expiresAt) - now) / 3_600_000;
  const urgent = hoursLeft <= URGENT_HOURS;
  const tint = urgent ? c.danger : c.gold;

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <Card padded hud tone={urgent ? 'heat' : 'charge'}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(tint, 0.14),
              borderWidth: 1,
              borderColor: alpha(tint, 0.4),
            }}
          >
            <Ionicons name={urgent ? 'alert' : 'gift'} size={20} color={tint} />
          </View>

          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.sm,
              }}
            >
              <Text variant="overline" uppercase style={{ color: tint }}>
                {S.loanerTitle}
              </Text>
              {left ? (
                <Text variant="caption" mono weight="800" style={{ color: tint }}>
                  {S.loanerEndsIn} {left}
                </Text>
              ) : null}
            </View>

            <Text variant="headline" weight="900" style={{ marginTop: 2 }}>
              {part.name}
            </Text>
            <Text variant="footnote" tone="secondary" style={{ marginTop: 2 }}>
              {urgent ? S.loanerUrgent : S.loanerBody}
            </Text>
            <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
              {S.loanerLapse}
            </Text>
          </View>
        </View>

        {urgent ? (
          <Button
            label={S.loanerBuy}
            variant="charge"
            size="md"
            fullWidth
            icon="cart"
            onPress={() => router.push('/(tabs)/boosters')}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </Card>
    </Animated.View>
  );
}

/**
 * The same card on a screen that has no rig data of its own.
 *
 * One small GET, and only worth it because the countdown has to be honest —
 * the Mine screen's status poll carries telemetry but not the parts.
 */
export function LoanerCardStandalone() {
  const t = useT();
  const toMessage = useCallback(
    (err: unknown) => errorMessage(err, t('app.offline')),
    [t],
  );
  const { data } = useAsyncData<RigOverview>(getRig, toMessage);
  return <LoanerCard rig={data} />;
}
