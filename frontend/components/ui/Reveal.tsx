'use client';

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';

/**
 * Scroll reveal. Children start hidden (`.v-reveal`) and slide in when the
 * element enters the viewport. `index` staggers siblings by 70 ms each.
 */
export function Reveal({
  children,
  index = 0,
  className = '',
  as: Tag = 'div',
  scale = false,
  once = true,
  style,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: ElementType;
  scale?: boolean;
  once?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-in');
            if (once) io.unobserve(el);
          } else if (!once) {
            el.classList.remove('is-in');
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref}
      className={`v-reveal ${scale ? 'v-reveal--scale' : ''} ${className}`}
      style={{ ...style, ['--i' as string]: index }}
    >
      {children}
    </Tag>
  );
}
