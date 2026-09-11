import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { useFeedback } from '../../lib/feedback';
import type { OnboardingDto } from '../../api/endpoints';
import { fill, useOnboarding } from './strings';

/**
 * The launch ramp: claim once, get a part running, invite one miner.
 *
 * Deliberately not furniture — the whole card unmounts the moment all three
 * are done, so a miner who is past onboarding never sees it again. Each row
 * is a tap target that lands on the screen where the step actually happens;
 * the first one fires this screen's own Mine control rather than navigating,
 * because the button is already right there.
 */
export function StarterChecklist({
  onboarding,
  onClaim,
}: {
  onboarding?: OnboardingDto | null;
  /** Fires the Mine control on the host screen. */
  onClaim?: () => void;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const S = useOnboarding();
  const feedback = useFeedback();

  // Absent until the API ships, and gone for good once the ramp is climbed.
  if (!onboarding || onboarding.done) return null;

  const steps: {
    key: string;
    done: boolean;
    title: string;
    hint: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }[] = [
    {
      key: 'claim',
      done: onboarding.claimedFirst,
      title: S.stepClaim,
      hint: S.stepClaimHint,
      icon: 'flash',
      onPress: () => onClaim?.(),
    },
    {
      key: 'rig',
      done: onboarding.rigRunning,
      title: S.stepRig,
      hint: S.stepRigHint,
      icon: 'hardware-chip',
      onPress: () => router.push('/(tabs)/rig'),
    },
    {
      key: 'invite',
      done: onboarding.invited,
      title: S.stepInvite,
      hint: S.stepInviteHint,
      icon: 'person-add',
      onPress: () => router.push('/referrals'),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = (doneCount / steps.length) * 100;

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <Card padded hud>
        <View style={{ gap: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <Text variant="headline" weight="900" style={{ flex: 1 }}>
              {S.checklistTitle}
            </Text>
            <Text variant="caption" mono weight="700" tone="gold">
              {fill(S.checklistProgress, { done: doneCount, total: steps.length })}
            </Text>
          </View>
          <Text variant="footnote" tone="secondary">
            {S.checklistBody}
          </Text>
        </View>

        {/* Progress across the top, so the ramp reads as nearly finished
            rather than as three more chores. */}
        <View
          style={{
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: alpha(c.gold, 0.16),
            overflow: 'hidden',
            marginTop: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: radius.pill,
              backgroundColor: c.gold,
            }}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          {steps.map((step, i) => (
            <Pressable
              key={step.key}
              accessibilityRole="button"
              accessibilityState={{ checked: step.done }}
              accessibilityLabel={`${step.title}. ${step.hint}`}
              disabled={step.done}
              onPress={() => {
                feedback.select();
                step.onPress();
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: step.done ? alpha(c.success, 0.3) : c.border,
                backgroundColor: step.done
                  ? alpha(c.success, 0.07)
                  : pressed
                    ? c.surfaceAlt
                    : 'transparent',
                opacity: step.done ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: step.done
                    ? alpha(c.success, 0.16)
                    : alpha(c.gold, 0.12),
                }}
              >
                {step.done ? (
                  <Ionicons name="checkmark" size={17} color={c.success} />
                ) : (
                  <Ionicons name={step.icon} size={15} color={c.gold} />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  variant="callout"
                  weight="800"
                  style={step.done ? { textDecorationLine: 'line-through' } : undefined}
                >
                  {step.title}
                </Text>
                {!step.done ? (
                  <Text variant="caption" tone="tertiary" style={{ marginTop: 1 }}>
                    {step.hint}
                  </Text>
                ) : null}
              </View>

              {!step.done ? (
                <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}
