'use client';

import { Icon } from '../ui';
import { fill, useS } from './strings';

/** What the rig overview reports about the miner's local weather. */
export interface RigWeatherDto {
  countryCode: string;
  city: string;
  tempC: number;
  /** Signed: +13 means coolers are working 13% harder today. */
  heatPercent: number;
}

/**
 * "Delhi 42 °C · coolers working 13% harder".
 *
 * The one line that ties the game to where the miner actually is. It sits in
 * the telemetry panel next to the other modifier chips, and renders nothing
 * at all when there is no reading — a weather API being down must never show
 * up as an empty box on someone's rig.
 */
export function WeatherChip({ weather }: { weather?: RigWeatherDto | null }) {
  const S = useS();
  if (!weather) return null;

  const n = Math.abs(weather.heatPercent);
  const hot = weather.heatPercent > 0;
  const cold = weather.heatPercent < 0;
  const tone = hot ? 'border-heat/40 bg-heat/10 text-heat' : cold ? 'border-brand/40 bg-brand/10 text-brand-hi' : 'border-line/30 bg-surface-2/70 text-ink-2';

  const effect = hot
    ? fill(S.weather.harder, { n })
    : cold
      ? fill(S.weather.easier, { n })
      : S.weather.neutral;

  return (
    <span
      className={`v-chip ${tone}`}
      title={`${S.weather.label}: ${weather.city}`}
    >
      <Icon name={hot ? 'flame' : 'snow'} size={12} />
      <span className="v-num">{weather.city} {Math.round(weather.tempC)}°C</span>
      <span className="opacity-80">· {effect}</span>
    </span>
  );
}
