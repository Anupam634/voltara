'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './ui';

// q6 explains grid stability — the one question a new miner asks the moment
// their rate does not match the number on the part they bought.
const FAQ_KEYS = ['q1', 'q6', 'q2', 'q3', 'q4', 'q5'] as const;

export function FAQSection() {
  const t = useTranslations('landing.faq');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => setOpenIndex((prev) => (prev === idx ? null : idx));

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQ_KEYS.map((key, idx) => {
        const isOpen = openIndex === idx;
        const qKey = `q${idx + 1}` as const;
        const aKey = `a${idx + 1}` as const;

        return (
          <div
            key={key}
            className={`v-panel overflow-hidden transition-colors ${isOpen ? 'border-brand/40' : 'hover:border-line/40'}`}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <span className="font-display text-sm font-bold text-ink sm:text-base">{t(qKey)}</span>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300 ${
                  isOpen ? 'rotate-180 border-charge/50 bg-charge/15 text-charge' : 'border-line/25 text-ink-3'
                }`}
              >
                <Icon name="chevron-down" size={14} />
              </span>
            </button>

            {/* Height transition via a grid-rows trick: no JS measurement. */}
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="border-t border-line/15 bg-bg/40 p-5 text-sm leading-relaxed text-ink-2">{t(aKey)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
