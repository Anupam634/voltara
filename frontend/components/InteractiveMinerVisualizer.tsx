'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMiningFX } from '../lib/use-mining-fx';
import { claimMining, getMiningStatus, getToken, type MiningStatus } from '../lib/api';
import { AnimatedNumber, Gauge, Icon, Tilt } from './ui';

/**
 * The hero terminal. For a visitor it is a simulator: tap, watch a rig come
 * alive slot by slot, watch VOLTS accrue. For a signed-in miner it reads
 * the real accrual from the server and the button becomes the real claim.
 *
 * Everything on screen is driven by one clock so the numbers move together:
 * hash ticks, heat breathes, stability follows heat, slot pips light in
 * sequence.
 */

const SIM_SLOTS = ['VC-1', 'CX-2', 'VC-5', 'PS-3', 'OD-8', 'CX-6'] as const;

export function InteractiveMinerVisualizer() {
  const t = useTranslations('landing.simulator');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params?.locale || 'en';

  const [isAuthed, setIsAuthed] = useState(false);
  const [liveStatus, setLiveStatus] = useState<MiningStatus | null>(null);
  const [isMining, setIsMining] = useState(false);
  const [points, setPoints] = useState(0);
  const [hashPower, setHashPower] = useState(0.9);
  const [heat, setHeat] = useState(6);
  const [litSlots, setLitSlots] = useState(0);
  const [tapEffect, setTapEffect] = useState(0);
  const [busy, setBusy] = useState(false);
  const [floaters, setFloaters] = useState<{ id: number; text: string }[]>([]);

  const anchorRef = useRef({ at: 0, base: 0 });
  const startRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { playMiningStrike, playClaimReward } = useMiningFX();

  // 1. Signed-in visitors get the real accrual instead of the simulator.
  const loadLiveSession = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const status = await getMiningStatus();
      setIsAuthed(true);
      setLiveStatus(status);
      setHashPower(status.ratePerHour);
      setPoints(status.pendingPoints);
      anchorRef.current = { at: Date.now(), base: status.pendingPoints };
      setIsMining(!status.canClaim || status.pendingPoints > 0);
      setLitSlots(6);
    } catch {
      setIsAuthed(false);
    }
  }, []);

  useEffect(() => {
    loadLiveSession();
  }, [loadLiveSession]);

  // 2. One clock for everything that moves.
  useEffect(() => {
    if (!isMining) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startRef.current;
      const breathe = Math.sin(now / 1800);

      if (isAuthed && liveStatus) {
        const perMs = liveStatus.ratePerHour / 3_600_000;
        const cap = liveStatus.maxPendingPoints || 21.6;
        const { at, base } = anchorRef.current;
        setPoints(Math.min(cap, base + (now - at) * perMs));
        setHeat(Math.round(52 + breathe * 3));
      } else {
        setPoints((prev) => +(prev + 0.00045).toFixed(5));
        // Slots come online one every 700 ms; hash and heat climb with them.
        const lit = Math.min(SIM_SLOTS.length, 1 + Math.floor(elapsed / 700));
        setLitSlots(lit);
        const HASH_BY_SLOTS = [0, 2, 2, 12, 12, 13.8, 13.8];
        setHashPower(+(0.9 + (HASH_BY_SLOTS[lit] ?? 0)).toFixed(1));
        setHeat(Math.round(38 + lit * 4 + breathe * 3));
      }
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMining, isAuthed, liveStatus]);

  const spawnFloater = (text: string) => {
    const id = Date.now();
    setFloaters((f) => [...f.slice(-3), { id, text }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1200);
  };

  // 3. Mine / claim / open the terminal.
  const handleToggleMine = async () => {
    setTapEffect((n) => n + 1);

    if (isAuthed && liveStatus) {
      if (liveStatus.canClaim) {
        setBusy(true);
        playMiningStrike();
        try {
          const res = await claimMining();
          playClaimReward();
          spawnFloater(`+${res.earnedPoints.toFixed(2)} VOLTS`);
          await loadLiveSession();
        } catch {
          router.push(`/${locale}/dashboard`);
        } finally {
          setBusy(false);
        }
      } else {
        router.push(`/${locale}/dashboard`);
      }
      return;
    }

    if (!isMining) {
      playMiningStrike();
      setIsMining(true);
      setHashPower(0.9);
      setLitSlots(1);
      spawnFloater('RIG ONLINE');
    } else {
      playClaimReward();
      spawnFloater(`+${points.toFixed(3)} VOLTS`);
      setIsMining(false);
      setLitSlots(0);
      setHashPower(0.9);
      setHeat(6);
    }
  };

  const cooling = 12 + (litSlots >= 2 ? 40 : 0) + (litSlots >= 6 ? 120 : 0);
  const stability = isMining
    ? isAuthed
      ? 100
      : Math.min(100, Math.round((cooling / Math.max(1, heat - 30)) * 100))
    : 0;
  const heatPct = Math.min(100, Math.round((heat / 80) * 100));

  return (
    <Tilt max={5} className="mx-auto w-full max-w-lg">
      <div className="v-panel v-hud v-scanlines relative overflow-hidden rounded-3xl p-5 shadow-panel sm:p-6">
        {/* Terminal chrome */}
        <div className="flex items-center justify-between border-b border-line/15 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-heat/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-ok/80" />
            <span className="ml-2 font-mono text-[11px] font-semibold text-ink-3">voltara://rig.grid</span>
          </div>
          <span className={`v-chip ${isMining ? 'v-chip--charge' : ''}`}>
            <span className={`v-dot ${isMining ? '' : 'v-dot--brand'}`} />
            {isAuthed && isMining ? 'NODE ONLINE' : t('networkStatus')}
          </span>
        </div>

        {/* Gauge + hash */}
        <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4">
          <Gauge value={stability} size={132} stroke={10} label="Stability" />
          <div className="min-w-0">
            <div className="v-eyebrow">{isAuthed ? 'LIVE HASHRATE' : t('baseSpeed')}</div>
            <div className="v-num mt-1 text-2xl font-extrabold text-charge sm:text-3xl">
              <AnimatedNumber value={isMining ? hashPower : 0} decimals={2} />
              <span className="ml-1 text-xs font-bold text-ink-3">VOLTS/h</span>
            </div>
            <div className="v-trace mt-2" />

            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-3">
                <span className="inline-flex items-center gap-1">
                  <Icon name="flame" size={11} className={heatPct > 60 ? 'text-heat' : ''} />
                  Heat
                </span>
                <span className="v-num">{isMining ? `${heat}°C` : '—'}</span>
              </div>
              <div className="v-track mt-1 h-1.5">
                <div
                  className="v-track__fill"
                  style={{
                    width: `${isMining ? heatPct : 0}%`,
                    background:
                      heatPct > 60
                        ? 'linear-gradient(90deg, rgb(var(--c-warn)), rgb(var(--c-heat)))'
                        : undefined,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Slot pips */}
        <div className="mt-4 grid grid-cols-6 gap-1.5">
          {SIM_SLOTS.map((name, i) => {
            const on = i < litSlots;
            return (
              <div
                key={name}
                className={`rounded-lg border px-1 py-1.5 text-center font-mono text-[9px] font-bold transition-all duration-500 ${
                  on
                    ? 'border-brand/50 bg-brand/15 text-brand-hi shadow-[0_0_14px_-4px_rgb(var(--c-brand)/0.9)]'
                    : 'border-line/15 bg-bg/40 text-ink-3'
                }`}
              >
                <span className={`mx-auto mb-1 block h-1 w-1 rounded-full ${on ? 'bg-charge' : 'bg-line/30'}`} />
                {on ? name : '—'}
              </div>
            );
          })}
        </div>

        {/* Accumulator */}
        <div className="relative mt-4 rounded-2xl border border-charge/25 bg-charge/[0.05] p-4 text-center">
          {floaters.map((f) => (
            <span key={f.id} className="v-float-up text-sm">
              {f.text}
            </span>
          ))}
          <div className="v-eyebrow v-eyebrow--charge">{t('pointsAccumulated')}</div>
          <div className="v-num mt-1 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {points.toFixed(5)} <span className="text-sm font-bold text-charge">VOLTS</span>
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-2 font-mono text-[11px] text-ink-3">
            <span className="font-semibold text-brand-hi">≈ {(points / 3).toFixed(5)} $VLTR</span>
            <span>·</span>
            <span className="text-ok">3 : 1</span>
          </div>
        </div>

        {/* Action */}
        <div className="relative mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={handleToggleMine}
            className={`v-btn v-btn--lg relative w-full ${isMining ? 'v-btn--primary' : 'v-btn--charge'}`}
          >
            {tapEffect > 0 && <span key={tapEffect} className="v-shock rounded-[1.1rem]" />}
            {busy ? (
              <span>Claiming…</span>
            ) : isAuthed ? (
              liveStatus?.canClaim ? (
                <>
                  <Icon name="bolt" size={16} />
                  <span>Claim accrued VOLTS</span>
                </>
              ) : (
                <>
                  <Icon name="rig" size={16} />
                  <span>Live · Open terminal</span>
                </>
              )
            ) : (
              <>
                <Icon name={isMining ? 'gauge' : 'bolt'} size={16} />
                <span>{isMining ? t('miningActive') : t('tapToMine')}</span>
              </>
            )}
          </button>
        </div>

        {/* Telemetry */}
        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="v-inset p-2.5 text-center">
            <div className="text-[9px] font-bold uppercase text-ink-3">Heat</div>
            <div className="v-num mt-0.5 font-bold text-ink">{isMining ? `${heat}°C` : '—'}</div>
          </div>
          <div className="v-inset p-2.5 text-center">
            <div className="text-[9px] font-bold uppercase text-ink-3">Cooling</div>
            <div className="v-num mt-0.5 font-bold text-ok">{isMining ? `${cooling} TU` : '—'}</div>
          </div>
          <div className="v-inset p-2.5 text-center">
            <div className="text-[9px] font-bold uppercase text-ink-3">Slots</div>
            <div className="v-num mt-0.5 font-bold text-brand-hi">{litSlots} / 6</div>
          </div>
        </div>

        <div className="mt-3 text-center font-mono text-[10px] text-ink-3">{t('hashAlgorithm')}</div>
      </div>
    </Tilt>
  );
}
