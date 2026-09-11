'use client';

import { LogoMark } from './Logo';

/**
 * The $VLTR token: a spinning 3D coin with an edge, two orbit rings each
 * carrying a charge node, and an ambient bloom. Entirely CSS-driven, so it
 * costs nothing on the main thread.
 */
export function Coin3D({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const stage = size === 'sm' ? 'h-[14rem]' : 'h-[20rem] sm:h-[22rem]';
  const scale = size === 'sm' ? 'scale-[0.7]' : '';
  return (
    <div className={`coin-stage relative grid w-full place-items-center ${stage}`}>
      <div className="pointer-events-none absolute h-56 w-56 rounded-full bg-brand/30 blur-3xl" />
      <div className={`relative grid place-items-center ${scale}`}>
        <div className="orbit h-[18rem] w-[18rem]" aria-hidden>
          <span className="orbit__node" />
        </div>
        <div className="orbit orbit--wide h-[22rem] w-[22rem]" aria-hidden>
          <span className="orbit__node" />
        </div>

        <div className="animate-float">
          <div className="coin">
            <div className="coin-edge" style={{ transform: 'translateZ(-2px)' }} />
            <div className="coin-edge" style={{ transform: 'translateZ(-4px)' }} />
            <div className="coin-edge" style={{ transform: 'translateZ(-6px)' }} />
            <div className="coin-edge" style={{ transform: 'translateZ(-8px)' }} />

            <div className="coin-face">
              <div className="flex flex-col items-center gap-1">
                <LogoMark size={104} />
                <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.3em] text-charge">$VLTR</span>
              </div>
            </div>
            <div className="coin-face coin-face--back">
              <div className="flex flex-col items-center gap-1">
                <LogoMark size={104} />
                <span className="font-mono text-[9px] font-extrabold uppercase tracking-[0.25em] text-brand-hi">
                  BNB · BEP-20
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
