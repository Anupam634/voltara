'use client';

import Link from 'next/link';
import type { OnboardingDto } from '../../lib/api';
import { Eyebrow, Icon, Panel, Progress } from '../ui';
import { fill, useOnboarding } from './strings';

/**
 * The launch ramp: claim once, get a part running, invite one miner.
 *
 * Deliberately temporary furniture. It vanishes the moment all three are
 * done, and renders nothing at all when the API has not shipped the field
 * yet, so an older server degrades to the dashboard as it was.
 */
export function StarterChecklist({
  onboarding,
  locale,
  className = '',
}: {
  onboarding: OnboardingDto | undefined;
  locale: string;
  className?: string;
}) {
  const S = useOnboarding();

  if (!onboarding || onboarding.done) return null;

  const steps = [
    {
      key: 'claim' as const,
      done: onboarding.claimedFirst,
      href: '#mine',
      copy: S.checklist.steps.claim,
    },
    {
      key: 'rig' as const,
      done: onboarding.rigRunning,
      href: `/${locale}/rig`,
      copy: S.checklist.steps.rig,
    },
    {
      key: 'invite' as const,
      done: onboarding.invited,
      href: `/${locale}/referrals`,
      copy: S.checklist.steps.invite,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  // The first step still open is the one worth pointing at.
  const activeIndex = steps.findIndex((s) => !s.done);

  return (
    <Panel hud tone="charge" className={`p-5 animate-rise sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow tone="charge">{S.checklist.eyebrow}</Eyebrow>
          <h2 className="mt-1.5 font-display text-lg font-bold text-ink sm:text-xl">
            {S.checklist.title}
          </h2>
        </div>
        <span className="v-num text-xs font-bold text-ink-2">
          {fill(S.checklist.progress, { done: doneCount })}
        </span>
      </div>

      <Progress value={(doneCount / steps.length) * 100} charge className="mt-4" />

      <ol className="mt-5 flex flex-col gap-2">
        {steps.map((step, i) => {
          const isActive = i === activeIndex;
          const isAnchor = step.href.startsWith('#');
          const inner = (
            <>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-extrabold transition ${
                  step.done
                    ? 'border-charge/50 bg-charge/15 text-charge'
                    : isActive
                      ? 'border-brand-hi/60 bg-brand/15 text-brand-hi'
                      : 'border-line/30 bg-surface-2/60 text-ink-3'
                }`}
              >
                {step.done ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-extrabold ${
                    step.done ? 'text-ink-3 line-through' : 'text-ink'
                  }`}
                >
                  {step.copy.title}
                </span>
                {!step.done && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">
                    {step.copy.body}
                  </span>
                )}
              </span>

              {!step.done && (
                <span className="inline-flex shrink-0 items-center gap-1 self-center whitespace-nowrap text-xs font-extrabold text-charge">
                  {step.copy.cta}
                  <Icon name="chevron-right" size={12} />
                </span>
              )}
            </>
          );

          const rowClass = `flex gap-3 rounded-2xl border p-3 transition ${
            step.done
              ? 'border-transparent bg-transparent'
              : 'border-line/20 bg-surface-2/40 hover:border-brand-hi/50 hover:bg-surface-3/50'
          }`;

          return (
            <li key={step.key}>
              {step.done ? (
                <div className={rowClass}>{inner}</div>
              ) : isAnchor ? (
                <a href={step.href} className={rowClass}>
                  {inner}
                </a>
              ) : (
                <Link href={step.href} className={rowClass}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
