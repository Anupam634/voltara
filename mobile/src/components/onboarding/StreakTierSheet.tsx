import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { useTheme } from '../../theme/ThemeProvider';
import type { StreakDto } from '../../api/endpoints';
import { fill, useOnboarding } from './strings';

/**
 * The moment a claim pushes the run past a tier boundary.
 *
 * Shown once, dismissible, and only on the crossing — a streak that merely
 * got longer is already visible on the card, and celebrating every day
 * would teach the miner to dismiss the thing without reading it.
 */
export function StreakTierSheet({
  streak,
  visible,
  onClose,
}: {
  streak: StreakDto | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const S = useOnboarding();

  if (!streak) return null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={S.tierTitle}
      scrollable={false}
      footer={<Button label={S.tierClose} variant="charge" fullWidth onPress={onClose} />}
    >
      <View style={{ alignItems: 'center', gap: spacing.md, paddingBottom: spacing.lg }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(c.gold, 0.14),
            borderWidth: 1,
            borderColor: alpha(c.gold, 0.45),
          }}
        >
          <Ionicons name="flame" size={38} color={c.gold} />
        </View>

        <Text variant="display" mono weight="900" style={{ color: c.gold }}>
          {`+${streak.bonusPercent}%`}
        </Text>

        <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
          {fill(S.tierBody, { days: streak.days, bonus: streak.bonusPercent })}
        </Text>

        <Text variant="footnote" tone="tertiary" style={{ textAlign: 'center' }}>
          {streak.nextTier
            ? fill(S.tierNext, {
                days: streak.nextTier.days,
                bonus: streak.nextTier.bonusPercent,
              })
            : S.tierTop}
        </Text>
      </View>
    </Sheet>
  );
}
