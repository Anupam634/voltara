import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { useNow } from '../../lib/hooks';
import { countdownLabel } from '../../lib/format';
import { getGridEvent, type GridEventBoard, type GridEventDto } from '../../api/endpoints';
import { useGrid } from './strings';

/** Events that hurt the rig wear the heat edge; the rest are a gift. */
const HOT = new Set(['HEATWAVE', 'GRID_STRAIN']);

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  HEATWAVE: 'flame',
  COLD_SNAP: 'snow',
  CHEAP_POWER: 'flash',
  GRID_STRAIN: 'warning',
  SOLAR_SURGE: 'sunny',
};

const POLL_MS = 60_000;

/**
 * The grid event strip: what the whole grid is living through right now.
 *
 * Active → a full card in heat or charge tone with a live countdown and the
 * effect chips. Upcoming only → one quiet row. Nothing → renders nothing at
 * all, so the screen keeps its rhythm when the grid is calm.
 */
export function EventBanner() {
  const [board, setBoard] = useState<GridEventBoard | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getGridEvent()
        .then((b) => alive && setBoard(b))
        .catch(() => {
          /* the banner is decoration — never an error state */
        });
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!board) return null;
  if (board.active) return <ActiveEvent event={board.active} />;
  if (board.upcoming) return <UpcomingEvent event={board.upcoming} />;
  return null;
}

function effects(
  e: GridEventDto,
  g: { heat: string; draw: string; hash: string },
): { label: string; hot: boolean }[] {
  const out: { label: string; hot: boolean }[] = [];
  if (e.heatPercent !== 0) out.push({ label: `${sign(e.heatPercent)} ${g.heat}`, hot: e.heatPercent > 0 });
  if (e.drawPercent !== 0) out.push({ label: `${sign(e.drawPercent)} ${g.draw}`, hot: e.drawPercent > 0 });
  if (e.hashPercent !== 0) out.push({ label: `${sign(e.hashPercent)} ${g.hash}`, hot: e.hashPercent < 0 });
  return out;
}

function sign(n: number): string {
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;
}

function ActiveEvent({ event }: { event: GridEventDto }) {
  const { c, spacing, radius, alpha } = useTheme();
  const GRID = useGrid();
  const now = useNow();
  const hot = HOT.has(event.code);
  const tint = hot ? c.danger : c.gold;
  const left = countdownLabel(event.endsAt, now);
  const chips = useMemo(() => effects(event, GRID), [event, GRID]);

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <Card padded hud tone={hot ? 'heat' : 'charge'}>
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
            <Ionicons name={ICON[event.code] ?? 'pulse'} size={20} color={tint} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="overline" uppercase style={{ color: tint }}>
                {GRID.eventActive}
              </Text>
              {left ? (
                <Text variant="caption" mono weight="800" style={{ color: tint }}>
                  {GRID.eventEndsIn} {left}
                </Text>
              ) : null}
            </View>
            <Text variant="headline" weight="900" style={{ marginTop: 2 }}>
              {event.title}
            </Text>
            <Text variant="footnote" tone="secondary" style={{ marginTop: 2 }}>
              {event.body}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
              {chips.map((chip) => (
                <View
                  key={chip.label}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: alpha(chip.hot ? c.danger : c.gold, 0.45),
                    backgroundColor: alpha(chip.hot ? c.danger : c.gold, 0.1),
                  }}
                >
                  <Text
                    variant="caption"
                    mono
                    weight="800"
                    style={{ fontSize: 10, color: chip.hot ? c.danger : c.gold }}
                  >
                    {chip.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

function UpcomingEvent({ event }: { event: GridEventDto }) {
  const { c, spacing, radius } = useTheme();
  const GRID = useGrid();
  const now = useNow(30_000);
  const until = countdownLabel(event.startsAt, now);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surfaceAlt,
      }}
    >
      <Ionicons name={ICON[event.code] ?? 'pulse'} size={14} color={c.textTertiary} />
      <Text variant="caption" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
        {GRID.eventUpcoming}: <Text variant="caption" weight="800">{event.title}</Text>
      </Text>
      {until ? (
        <Text variant="caption" mono tone="tertiary">
          {GRID.eventStartsIn} {until}
        </Text>
      ) : null}
    </View>
  );
}
