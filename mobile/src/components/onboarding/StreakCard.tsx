import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useTheme } from '../../theme/ThemeProvider';
import { useNow } from '../../lib/hooks';
import { countdownLabel } from '../../lib/format';
import type { StreakDto } from '../../api/endpoints';
import { fill, useOnboarding } from './strings';

/** Below this many hours left, keeping the streak becomes today's job. */
const URGENT_HOURS = 6;

/**
 * The claim streak.
 *
 * A streak is only worth showing if missing a day visibly costs something,
 * so the card leads with the run, states the bonus it is currently paying,
 * and turns urgent as the window closes. At zero it invites rather than
 * showing an empty slot — nobody needs to be told they have nothing.
 */
export function StreakCard({ streak }: { streak?: StreakDto | null }) {
  const { c, spacing, radius, alpha } = useTheme();
  const S = useOnboarding();
  const now = useNow(30_000);

  // Absent until the streak API ships.
  if (!streak) return null;

  const days = Math.max(0, streak.days);
  const started = days > 0;
  const left = started ? countdownLabel(streak.keepsUntil, now) : null;
  const hoursLeft = streak.keepsUntil
    ? (Date.parse(streak.keepsUntil) - now) / 3_600_000
    : Number.POSITIVE_INFINITY;
  const urgent = started && hoursLeft <= URGENT_HOURS;
  const tint = urgent ? c.danger : started ? c.gold : c.textTertiary;

  const next = streak.nextTier;
  const pct = next && next.days > 0 ? Math.min(100, (days / next.days) * 100) : 100;

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <Card padded tone={urgent ? 'heat' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(tint, 0.14),
              borderWidth: 1,
              borderColor: alpha(tint, 0.35),
            }}
          >
            <Ionicons name="flame" size={22} color={tint} />
          </View>

          <View style={{ flex: 1 }}>
            <Text variant="overline" tone="tertiary" uppercase>
              {S.streakTitle}
            </Text>

            {started ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text
                  variant="title1"
                  mono
                  weight="900"
                  style={{ color: tint, letterSpacing: -1 }}
                >
                  {days}
                </Text>
                <Text variant="footnote" tone="secondary" weight="700">
                  {days === 1 ? S.streakDayOne : S.streakDayMany}
                </Text>
                {streak.bestDays > days ? (
                  <Text variant="caption" tone="tertiary" style={{ marginLeft: 2 }}>
                    {fill(S.streakBest, { n: streak.bestDays })}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text variant="headline" weight="800" style={{ marginTop: 1 }}>
                {S.streakNone}
              </Text>
            )}
          </View>

          {started && streak.bonusPercent > 0 ? (
            <Badge
              label={fill(S.streakBonus, { n: streak.bonusPercent })}
              tone={urgent ? 'danger' : 'gold'}
            />
          ) : null}
        </View>

        {started ? (
          <>
            {next ? (
              <>
                <View
                  style={{
                    height: 6,
                    borderRadius: radius.pill,
                    backgroundColor: alpha(tint, 0.16),
                    overflow: 'hidden',
                    marginTop: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: radius.pill,
                      backgroundColor: tint,
                    }}
                  />
                </View>
                <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
                  {next.days - days === 1
                    ? fill(S.streakNextOne, { bonus: next.bonusPercent })
                    : fill(S.streakNext, {
                        n: next.days - days,
                        bonus: next.bonusPercent,
                      })}
                </Text>
              </>
            ) : (
              <Text variant="caption" tone="gold" weight="700" style={{ marginTop: spacing.md }}>
                {S.streakTop}
              </Text>
            )}

            {left ? (
              <Text
                variant="caption"
                weight={urgent ? '800' : '500'}
                style={{ marginTop: 6, color: urgent ? c.danger : c.textTertiary }}
              >
                {urgent ? S.streakUrgent : `${S.streakKeeps} ${left}`}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.sm }}>
            {S.streakNoneBody}
          </Text>
        )}
      </Card>
    </Animated.View>
  );
}
