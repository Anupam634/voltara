'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Icon, Reveal, type IconName } from './ui';

interface TaskItem {
  id: string;
  nameKey: 'tweet' | 'follow' | 'repost' | 'youtube' | 'quiz' | 'spin';
  reward: number;
  icon: IconName;
  category: 'Social' | 'Community' | 'Daily' | 'Knowledge';
}

const TASKS: TaskItem[] = [
  { id: 't1', nameKey: 'spin', reward: 500, icon: 'gift', category: 'Daily' },
  { id: 't2', nameKey: 'youtube', reward: 100, icon: 'play', category: 'Community' },
  { id: 't3', nameKey: 'quiz', reward: 75, icon: 'help', category: 'Knowledge' },
  { id: 't4', nameKey: 'follow', reward: 50, icon: 'star', category: 'Social' },
  { id: 't5', nameKey: 'tweet', reward: 50, icon: 'share', category: 'Social' },
  { id: 't6', nameKey: 'repost', reward: 50, icon: 'swap', category: 'Social' },
];

export function TasksBountySection({ locale }: { locale: string }) {
  const t = useTranslations('landing.tasksSection');
  const tTasks = useTranslations('tasks');
  const registerLink = `/${locale}/login?mode=register`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TASKS.map((task, i) => (
        <Reveal key={task.id} index={i}>
          <div className="v-panel v-panel--lift v-hud group flex h-full flex-col justify-between p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand/30 bg-brand/12 text-brand-hi transition-transform group-hover:scale-105">
                  <Icon name={task.icon} size={20} />
                </span>
                <div className="min-w-0">
                  <span className="v-eyebrow">{task.category}</span>
                  <h4 className="mt-0.5 truncate font-display text-sm font-bold text-ink">{tTasks(task.nameKey)}</h4>
                </div>
              </div>
              <span className="v-chip v-chip--charge v-num whitespace-nowrap">{t('rewardBadge', { amount: task.reward })}</span>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-line/15 pt-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-ink-3">
                <Icon name="bolt" size={12} className="text-charge" />
                {t('instantCredit')}
              </span>
              <Link href={registerLink} className="v-btn v-btn--primary v-btn--sm">
                {t('actionButton')}
              </Link>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
