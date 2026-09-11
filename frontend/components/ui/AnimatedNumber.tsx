'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts to its value instead of snapping. Re-animates from
 * the previous value on every change, so a balance that grows by a claim
 * visibly rolls up rather than flickering.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frame = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = to;
      setValue(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (to - from) * eased;
      setValue(v);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return value;
}

export function AnimatedNumber({
  value,
  decimals = 2,
  duration = 900,
  className = '',
  prefix = '',
  suffix = '',
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const v = useCountUp(value, duration);
  return (
    <span className={`v-num ${className}`}>
      {prefix}
      {v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
