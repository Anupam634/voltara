import React from 'react';
import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { useTheme } from '../../theme/ThemeProvider';
import { useFeedback } from '../../lib/feedback';

export type CardTone = 'default' | 'charge' | 'heat';

export interface CardProps {
  children: React.ReactNode;
  /** 0 flat, 1 resting, 2 lifted. */
  elevation?: 0 | 1 | 2;
  padded?: boolean;
  onPress?: () => void;
  /** Brand-coloured halo around the panel — the site's `.v-panel--lift` hover. */
  glow?: boolean;
  /** Border tint override, e.g. a lime ring on the popular plan. */
  accent?: string;
  /**
   * Corner brackets — the site's `.v-hud`. Two L-shaped ticks, top-left and
   * bottom-right, for the panels that matter (the mine hero, the rig gauge).
   */
  hud?: boolean;
  /**
   * `charge` = the lime edge for something live (a claim that is ready, a rig
   * at 100%). `heat` = over budget. Default is the plain violet hairline.
   */
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * The site's `.v-panel`: a flat obsidian plate — surface-2 fading to surface,
 * a violet hairline, and a single one-pixel highlight along the top edge.
 * No blur. On Substation it collapses to a white card with a grey hairline.
 */
export function Card({
  children,
  elevation: level = 1,
  padded = true,
  onPress,
  glow,
  accent,
  hud,
  tone = 'default',
  style,
  accessibilityLabel,
}: CardProps) {
  const { c, radius, spacing, elevation, glow: glowShadow, alpha } = useTheme();
  const feedback = useFeedback();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const toneBorder =
    tone === 'charge' ? alpha(c.gold, 0.4) : tone === 'heat' ? alpha(c.danger, 0.5) : null;
  const toneHalo = tone === 'charge' ? c.gold : tone === 'heat' ? c.danger : null;

  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: accent ?? toneBorder ?? (glow ? c.borderStrong : c.border),
    overflow: 'hidden',
    ...(padded ? { padding: spacing.lg } : null),
    ...(toneHalo
      ? glowShadow(toneHalo, c.dark ? 2 : 1)
      : glow
        ? glowShadow(accent ?? c.primaryGlow, level === 0 ? 1 : 2)
        : elevation(level)),
  };

  const bracketColor =
    tone === 'charge' ? c.gold : tone === 'heat' ? c.danger : alpha(c.primary, 0.75);

  const surface = (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[c.surfaceGradient[0], c.surfaceGradient[1]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: radius.xl - 1,
        }}
      />
      {/* Inner top highlight: lime-tinted on a charged panel. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: radius.md,
          right: radius.md,
          height: 1,
          backgroundColor:
            tone === 'charge'
              ? alpha(c.gold, 0.3)
              : c.dark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(255,255,255,0.9)',
        }}
      />
      {hud ? <HudBrackets color={bracketColor} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[base, style]}>
        {surface}
        {children}
      </View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          scale.value = withSpring(0.985, { damping: 20, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 16, stiffness: 260 });
        }}
        onPress={() => {
          feedback.select();
          onPress();
        }}
        style={[base, style]}
      >
        {surface}
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** The two corner ticks of `.v-hud`. */
export function HudBrackets({ color, size = 14, inset = 9 }: { color: string; size?: number; inset?: number }) {
  const tick: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    borderColor: color,
  };
  return (
    <>
      <View
        pointerEvents="none"
        style={[tick, { top: inset, left: inset, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 3 }]}
      />
      <View
        pointerEvents="none"
        style={[tick, { bottom: inset, right: inset, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 3 }]}
      />
    </>
  );
}

/** Card header: title, optional subtitle, optional trailing action. */
export function CardHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { c, spacing, radius } = useTheme();
  const feedback = useFeedback();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      {icon && (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.md,
            backgroundColor: c.primaryMuted,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color={c.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="headline">{title}</Text>
        {subtitle ? (
          <Text variant="footnote" tone="secondary" style={{ marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            feedback.select();
            onAction();
          }}
          style={{ minHeight: 32, justifyContent: 'center' }}
        >
          <Text variant="callout" tone="brand" weight="700">
            {actionLabel} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Section label above a group of cards — the site's `.v-eyebrow`. */
export function SectionLabel({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { spacing } = useTheme();
  return (
    <View style={[{ paddingHorizontal: spacing.xs, marginBottom: spacing.sm }, style]}>
      <Text variant="overline" tone="tertiary" mono uppercase style={{ letterSpacing: 2.4 }}>
        {children}
      </Text>
    </View>
  );
}
