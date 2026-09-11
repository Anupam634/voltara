'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * Pointer-tracking 3D tilt. Sets --rx/--ry on the host; `.v-tilt` turns
 * them into a perspective rotation. Touch devices get no tilt, only the
 * hover-less resting state, so nothing wobbles under a thumb.
 */
export function Tilt({
  children,
  max = 7,
  className = '',
  style,
}: {
  children: ReactNode;
  max?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
  };

  return (
    <div
      ref={ref}
      className={`v-tilt ${className}`}
      style={style}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
    </div>
  );
}
