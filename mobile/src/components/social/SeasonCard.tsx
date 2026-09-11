import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Chrome';
import { useTheme } from '../../theme/ThemeProvider';
import { useI18n } from '../../i18n';
import { useSocial } from './strings';
import { getSeason, type SeasonDto, type SeasonStandingDto } from '../../api/endpoints';
import { coarseCountdown, countryFlag, formatPoints } from '../../lib/format';

/**
 * The weekly season, on the leaderboard tab — the web's `SeasonPanel`.
 *
 * The boards around it are rolling windows that never end, so nobody wins
 * one. This is the fixed Monday-to-Monday block that closes and pays, so it
 * leads with the two things a miner acts on: time left, and what their
 * current place is worth.
 *
 * Every prize shown while the season runs is a projection, and the card says
 * so rather than implying the VOLTS are banked.
 */
export function SeasonCard() {
  const { c, spacing, radius, alpha } = useTheme();
  const { locale } = useI18n();
  const s = useSocial();

  const [data, setData] = useState<{ current: SeasonDto; previous: SeasonDto | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    getSeason()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, []);

  const volts = useCallback((n: number) => formatPoints(n, 2, locale), [locale]);

  // One card among many on this tab; if the API misses, showing nothing
  // beats a table of zeroes that reads as real.
  if (failed && !data) return null;
  if (!data) return <Skeleton height={180} />;

  const { current, previous } = data;
  const closesIn = coarseCountdown(current.endsAt, now);

  return (
    <View style={{ gap: spacing.md }}>
      <Card hud glow accent={alpha(c.gold, c.dark ? 0.4 : 0.6)}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="overline" tone="tertiary" uppercase>
              {s.seasonEyebrow} · {current.weekKey}
            </Text>
            <Text variant="title2" style={{ marginTop: 2 }}>
              {s.seasonTitle}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: alpha(c.gold, 0.4),
                backgroundColor: alpha(c.gold, 0.15),
              }}
            >
              <Text variant="caption" mono weight="700" tone="gold" style={{ fontSize: 10 }}>
                {volts(current.poolVolts)} {s.seasonVolts}
              </Text>
            </View>
            <Text variant="caption" tone="tertiary" style={{ marginTop: 2, fontSize: 10 }}>
              {s.seasonPool}
            </Text>
            {closesIn ? (
              <Text variant="caption" mono tone="tertiary" style={{ marginTop: 2 }}>
                {s.seasonClosesIn} {closesIn}
              </Text>
            ) : null}
          </View>
        </View>

        <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
          {s.seasonBody}
        </Text>

        <YourPlace season={current} volts={volts} />

        {current.standings.length === 0 ? (
          <Text variant="caption" tone="tertiary" center style={{ marginTop: spacing.md }}>
            {s.seasonEmpty}
          </Text>
        ) : (
          <Standings standings={current.standings} volts={volts} projected />
        )}
      </Card>

      {previous && previous.standings.length > 0 ? (
        <Card>
          <Text variant="overline" tone="tertiary" uppercase>
            {s.seasonLast}
          </Text>
          <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
            {previous.weekKey} {s.seasonLastBody}
          </Text>
          {previous.me.prize > 0 ? (
            <Text variant="caption" mono tone="gold" weight="700" style={{ marginTop: 4 }}>
              {s.seasonYouWon} {volts(previous.me.prize)} {s.seasonVolts}
            </Text>
          ) : null}
          <Standings standings={previous.standings} volts={volts} />
        </Card>
      ) : null}
    </View>
  );
}

/**
 * The caller's own row, whether or not they made the table. An unranked
 * miner is told what to do about it — the gap between "not on the board"
 * and "mine anything this week" is the reason to show this at zero.
 */
function YourPlace({ season, volts }: { season: SeasonDto; volts: (n: number) => string }) {
  const { c, spacing, radius, alpha } = useTheme();
  const s = useSocial();
  const { rank, earned, prize, totalRanked } = season.me;

  const shell = {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(c.gold, 0.25),
    backgroundColor: alpha(c.gold, 0.07),
  } as const;

  if (rank == null) {
    return (
      <View style={shell}>
        <Text variant="body" weight="700">
          {s.seasonUnranked}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
          {s.seasonUnrankedHint}
        </Text>
      </View>
    );
  }

  return (
    <View style={[shell, { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }]}>
      <View>
        <Text variant="overline" tone="tertiary" uppercase>
          {s.seasonYourPlace}
        </Text>
        <Text variant="title2" mono tone="gold">
          #{rank}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ fontSize: 10 }}>
          {totalRanked} {s.seasonOutOf}
        </Text>
      </View>
      <View>
        <Text variant="overline" tone="tertiary" uppercase>
          {s.seasonEarned}
        </Text>
        <Text variant="body" mono weight="700">
          {volts(earned)}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ fontSize: 10 }}>
          {s.seasonVolts}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
        <Text variant="overline" tone="tertiary" uppercase>
          {prize > 0 ? s.seasonPrizeIfHolds : s.seasonPrize}
        </Text>
        {prize > 0 ? (
          <>
            <Text variant="body" mono weight="700" tone="gold">
              +{volts(prize)}
            </Text>
            <Text variant="caption" tone="tertiary" style={{ fontSize: 10 }}>
              {s.seasonProjected}
            </Text>
          </>
        ) : (
          <Text variant="caption" tone="tertiary" style={{ textAlign: 'right' }}>
            {s.seasonNoPrizeYet}
          </Text>
        )}
      </View>
    </View>
  );
}

function Standings({
  standings,
  volts,
  projected = false,
}: {
  standings: SeasonStandingDto[];
  volts: (n: number) => string;
  projected?: boolean;
}) {
  const { c, spacing, radius, alpha } = useTheme();
  const s = useSocial();

  return (
    <View style={{ marginTop: spacing.md, gap: 2 }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.xs, gap: spacing.xs }}>
        <Text variant="overline" tone="tertiary" uppercase style={{ width: 26 }}>
          {s.seasonPlace}
        </Text>
        <Text variant="overline" tone="tertiary" uppercase style={{ flex: 1 }}>
          {s.seasonVolts}
        </Text>
        <Text variant="overline" tone="tertiary" uppercase style={{ width: 62, textAlign: 'right' }}>
          {s.seasonEarned}
        </Text>
        <Text variant="overline" tone="tertiary" uppercase style={{ width: 62, textAlign: 'right' }}>
          {projected ? s.seasonProjected : s.seasonPrize}
        </Text>
      </View>

      {standings.map((row) => {
        const body = (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.xs,
              paddingVertical: 6,
              borderRadius: radius.sm,
              backgroundColor: row.isCurrentUser ? alpha(c.gold, 0.12) : 'transparent',
            }}
          >
            <Text
              variant="caption"
              mono
              weight="700"
              tone={row.rank <= 3 ? 'gold' : 'tertiary'}
              style={{ width: 26 }}
            >
              {row.rank}
            </Text>
            <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {countryFlag(row.countryCode)} {row.displayName}
              {row.isCurrentUser ? ` · ${s.seasonYou}` : ''}
            </Text>
            <Text variant="caption" mono tone="secondary" style={{ width: 62, textAlign: 'right' }}>
              {volts(row.earned)}
            </Text>
            <Text
              variant="caption"
              mono
              weight="700"
              tone="gold"
              style={{ width: 62, textAlign: 'right' }}
            >
              {row.prize > 0 ? `+${volts(row.prize)}` : '—'}
            </Text>
          </View>
        );

        return row.watchCode ? (
          <Pressable key={row.id} onPress={() => router.push(`/watch/${row.watchCode}`)}>
            {body}
          </Pressable>
        ) : (
          <View key={row.id}>{body}</View>
        );
      })}
    </View>
  );
}
