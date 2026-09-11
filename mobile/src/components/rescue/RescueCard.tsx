import React, { useCallback } from 'react';
import { Share, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { useFeedback } from '../../lib/feedback';
import { type RigTelemetryDto } from '../../api/endpoints';
import { WEB_URL } from '../../api/client';
import { useI18n } from '../../i18n';
import { fill, useRescue } from './strings';

/** Below this, a rig has stopped being a build and started being a problem. */
export const RESCUE_THRESHOLD = 60;

/**
 * The rescue moment.
 *
 * A throttled rig used to show a warning and nothing else. It is the single
 * clearest reason a miner has to buy a part, so it gets the loudest card on
 * the screen: what the throttle costs per hour, which budget actually broke,
 * and the one part that fixes it — plus the free fix, because a miner with no
 * money who pulls a core comes back tomorrow.
 */
export function RescueCard({
  telemetry,
  lostPerHour,
  referralCode,
  style,
}: {
  telemetry: RigTelemetryDto | null | undefined;
  /** VOLTS/h the throttle is eating. */
  lostPerHour: number;
  referralCode?: string | null;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  const { c, spacing, radius, alpha, monoFont } = useTheme();
  const S = useRescue();
  const feedback = useFeedback();
  const { locale } = useI18n();

  const t = telemetry;
  const critical = !!t && t.gridStability < RESCUE_THRESHOLD;

  const onShare = useCallback(async () => {
    if (!t) return;
    feedback.press();
    // The configured web origin, and the miner's own locale, so a shared
    // rig opens in the language they were reading it in.
    const url = referralCode ? `${WEB_URL}/${locale}/r/${referralCode}` : WEB_URL;
    const message = fill(
      t.brownout && !t.overheating ? S.shareTextPower : S.shareTextHeat,
      { n: t.gridStability },
    );
    try {
      await Share.share({ message: `${message} ${url}` });
    } catch {
      // A dismissed share sheet is not an error worth reporting.
    }
  }, [t, referralCode, S, feedback, locale]);

  if (!critical || !t) return null;

  const coolingCoverage =
    t.heatLoad > 0 ? Math.round(Math.min(1, t.coolingCapacity / t.heatLoad) * 100) : 100;
  const powerCoverage =
    t.powerDraw > 0 ? Math.round(Math.min(1, t.powerSupply / t.powerDraw) * 100) : 100;

  const both = t.overheating && t.brownout;
  // Cheaper first when both budgets broke: $2 of cooling opens better than $3
  // of supply, and lifting either penalty lifts the product.
  const fixCooler = t.overheating;

  const title = both ? S.titleBoth : t.brownout ? S.titlePower : S.titleHeat;
  const diagnosis = both
    ? fill(S.diagnosisBoth, { cool: coolingCoverage, pow: powerCoverage })
    : t.brownout
      ? fill(S.diagnosisPower, { n: powerCoverage })
      : fill(S.diagnosisHeat, { n: coolingCoverage });

  const lost = Math.max(0, lostPerHour);

  return (
    <Animated.View entering={FadeInDown.springify()} style={style}>
      <Card padded hud tone="heat">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="overline" uppercase style={{ color: c.danger }}>
              {S.eyebrow}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginTop: 2,
              }}
            >
              <Ionicons name="flame" size={18} color={c.danger} />
              <Text variant="headline" weight="900" style={{ flex: 1 }}>
                {title}
              </Text>
            </View>
          </View>
          <Badge label={`${S.stabilityLabel} ${t.gridStability}%`} tone="danger" dot />
        </View>

        <View
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: alpha(c.danger, 0.25),
            backgroundColor: alpha(c.danger, 0.08),
          }}
        >
          <Text variant="overline" uppercase tone="tertiary">
            {S.losingLabel}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <Text
              variant="title1"
              weight="900"
              style={{ color: c.danger, fontFamily: monoFont }}
            >
              −{lost.toFixed(2)}
            </Text>
            <Text variant="caption" mono tone="tertiary">
              {S.losingUnit}
            </Text>
          </View>
        </View>

        <Text variant="footnote" tone="secondary" style={{ marginTop: spacing.md }}>
          {diagnosis}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.md,
            marginTop: spacing.lg,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: alpha(c.gold, 0.35),
              backgroundColor: alpha(c.gold, 0.12),
            }}
          >
            <Ionicons name={fixCooler ? 'snow' : 'flash'} size={18} color={c.gold} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="overline" uppercase tone="tertiary">
              {S.fixLabel}
            </Text>
            <Text variant="footnote" tone="secondary" style={{ marginTop: 2 }}>
              {fixCooler ? S.fixCooler : S.fixPsu}
            </Text>
          </View>
        </View>

        <Button
          label={fixCooler ? S.ctaCooler : S.ctaPsu}
          variant="charge"
          icon={fixCooler ? 'snow' : 'flash'}
          fullWidth
          onPress={() => router.push('/(tabs)/boosters')}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          label={S.share}
          variant="ghost"
          icon="share-social-outline"
          fullWidth
          silent
          onPress={onShare}
          style={{ marginTop: spacing.sm }}
        />

        <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.md }}>
          {S.freeFix}
        </Text>
      </Card>
    </Animated.View>
  );
}
