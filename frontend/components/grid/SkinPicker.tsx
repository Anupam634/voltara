'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { buySkin, equipSkin, getSkins, type SkinDto, type SkinsDto } from '../../lib/api-grid';
import { Button, Chip, Eyebrow, Icon, Notice, Panel, Skeleton } from '../ui';
import { useS } from './strings';

/**
 * Chassis skins: a row of swatches, buy in VOLTS, equip in one tap.
 * Calls `onChange` with the equipped id so the rig grid can recolour
 * without a full reload.
 */
export function SkinPicker({
  onChange,
  onError,
  className = '',
}: {
  onChange?: (skinId: string) => void;
  onError?: (message: string) => void;
  className?: string;
}) {
  const S = useS();
  const [data, setData] = useState<SkinsDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getSkins();
      setData(d);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(skin: SkinDto) {
    if (busy) return;
    setBusy(skin.id);
    try {
      const next = skin.owned ? await equipSkin(skin.id) : await buySkin(skin.id);
      setData(next);
      onChange?.(next.equipped);
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : S.map.offline);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel hud className={`p-5 ${className}`} as="section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow tone="brand">{S.skins.eyebrow}</Eyebrow>
          <h2 className="mt-1 font-display text-lg font-bold text-ink">{S.skins.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">{S.skins.body}</p>
        </div>
        {data && (
          <Chip tone="brand">
            {S.skins.equipped}: {data.catalog.find((s) => s.id === data.equipped)?.name ?? data.equipped}
          </Chip>
        )}
      </div>

      {!data && !failed && (
        <div className="mt-4 flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-36 shrink-0" />
          ))}
        </div>
      )}
      {failed && !data && (
        <Notice tone="warn" className="mt-4 text-xs">
          {S.skins.loading}
        </Notice>
      )}

      {data && (
        <div className="-mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {data.catalog.map((skin) => {
            const on = skin.equipped;
            return (
              <div
                key={skin.id}
                className={`v-inset flex w-40 shrink-0 snap-start flex-col gap-2 p-3 transition ${
                  on ? 'ring-1 ring-charge/60' : ''
                }`}
              >
                <div
                  className="h-12 w-full rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, rgb(var(--c-surface-3)) 0%, ${skin.accent} 100%)`,
                    boxShadow: `0 0 24px -8px ${skin.accent}`,
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-extrabold text-ink">{skin.name}</span>
                  {on && <Icon name="check" size={12} className="shrink-0 text-charge" />}
                </div>
                <p className="line-clamp-2 text-[10px] leading-snug text-ink-3">{skin.description}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="v-num text-[11px] font-bold text-ink-2">
                    {skin.priceVolts === 0 ? S.skins.free : `${skin.priceVolts} ${S.skins.volts}`}
                  </span>
                  <Button
                    size="sm"
                    variant={on ? 'ghost' : skin.owned ? 'primary' : 'charge'}
                    disabled={on || busy !== null}
                    loading={busy === skin.id}
                    onClick={() => act(skin)}
                  >
                    {on ? S.skins.equipped : skin.owned ? S.skins.equip : S.skins.buy}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
