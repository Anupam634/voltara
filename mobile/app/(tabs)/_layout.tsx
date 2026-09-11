import React from 'react';
import { Platform, Pressable, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useT } from '../../src/i18n';
import { useFeedback } from '../../src/lib/feedback';
import { useSession } from '../../src/store/session';
import { TAB_BAR_HEIGHT } from '../../src/lib/layout';
import { Text } from '../../src/components/ui/Text';

/**
 * The four tabs — Rig, ⚡ Mine, Ranks, Account — the same destinations
 * as the web app's phone bar, with Mine raised in the centre exactly as the
 * site does it. The Mine disc wears lime only while a claim is ready; the
 * rest of the time it is violet, so the one lime thing on screen means
 * "tap me now". The parts shop is not a tab: it is where the rig sends you,
 * and it lights the Rig tab while you are in it. The bar floats over the
 * content (translucent blur on iOS, solid on Android where blur is
 * inconsistent across OEM skins) and sizes itself from the real safe-area
 * inset.
 */
export default function TabsLayout() {
  const { c, scheme, alpha } = useTheme();
  const t = useT();
  const feedback = useFeedback();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 0 : 8);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
        tabBarActiveTintColor: c.tabActive,
        tabBarInactiveTintColor: c.textTertiary,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : c.chrome,
          borderTopWidth: 1,
          borderTopColor: c.border,
          elevation: 0,
          height: TAB_BAR_HEIGHT + bottom,
          paddingTop: 6,
          paddingBottom: bottom,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0,
        },
        tabBarBackground:
          Platform.OS === 'ios'
            ? () => (
                <BlurView
                  intensity={80}
                  tint={scheme === 'dark' ? 'dark' : 'light'}
                  style={{ flex: 1, backgroundColor: alpha(c.bg, 0.72) }}
                />
              )
            : undefined,
      }}
      screenListeners={{
        tabPress: () => feedback.select(),
      }}
    >
      <Tabs.Screen
        name="rig"
        options={{
          title: t('tabs.rig'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'hardware-chip' : 'hardware-chip-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="boosters"
        options={{
          // Reachable from the rig, and from the dashboard's plan rail — but
          // it does not earn a tab slot of its own.
          href: null,
          title: t('tabs.boost'),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.mine'),
          tabBarButton: (props) => <MineTabButton {...props} label={t('tabs.mine')} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t('tabs.ranks'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'trophy' : 'trophy-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'person-circle' : 'person-circle-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  focused?: boolean;
}) {
  const { c, alpha } = useTheme();
  return (
    <View
      style={{
        width: 34,
        height: 28,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? alpha(c.primary, 0.18) : 'transparent',
      }}
    >
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

/**
 * The raised centre disc. Violet gradient at rest; lime, breathing, with the
 * site's expanding ring while a claim is ready.
 */
function MineTabButton({
  onPress,
  accessibilityState,
  label,
}: BottomTabBarButtonProps & { label: string }) {
  const { c, glow } = useTheme();
  const { mining } = useSession();
  const ready = !!mining?.canClaim;
  const focused = !!accessibilityState?.selected;
  const scale = useSharedValue(1);
  const breathe = useSharedValue(0);

  React.useEffect(() => {
    if (ready) {
      breathe.value = withRepeat(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(breathe);
      breathe.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(breathe);
  }, [ready, breathe]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * (1 + breathe.value * 0.04) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ready ? 0.7 * (1 - breathe.value) : 0,
    transform: [{ scale: 1 + breathe.value * 0.55 }],
  }));

  const SIZE = 60;
  const gradient = ready ? c.goldGradient : c.primaryGradient;
  const fg = ready ? c.onGold : c.onPrimary;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginTop: -26 }}>
      <Animated.View style={[{ borderRadius: SIZE / 2, ...glow(ready ? c.gold : c.primaryGlow, ready ? 3 : 2) }, pressStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: SIZE,
              height: SIZE,
              borderRadius: SIZE / 2,
              borderWidth: 2,
              borderColor: c.gold,
            },
            ringStyle,
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={accessibilityState}
          onPressIn={() => {
            scale.value = withSpring(0.94, { damping: 18, stiffness: 340 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 12, stiffness: 220 });
          }}
          onPress={onPress}
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: c.bg,
          }}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[...gradient] as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Ionicons name="flash" size={26} color={fg} />
        </Pressable>
      </Animated.View>
      <Text
        variant="overline"
        weight="800"
        style={{ fontSize: 10, marginTop: 3, color: ready ? c.gold : focused ? c.tabActive : c.textTertiary }}
      >
        {label}
      </Text>
    </View>
  );
}
