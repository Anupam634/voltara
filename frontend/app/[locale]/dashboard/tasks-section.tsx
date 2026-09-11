'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SpinWheelModal } from '../../../components/SpinWheelModal';
import { QuizModal } from '../../../components/QuizModal';
import { YouTubeTaskModal } from '../../../components/YouTubeTaskModal';
import { Button, Chip, Eyebrow, Icon, Notice, Panel, Reveal, Skeleton, type IconName } from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';
import { ApiError, claimTask, getTasks, type TaskDto } from '../../../lib/api';

/** i18n key per task type — the labels already exist under `tasks.*`. */
const LABEL_KEY: Record<TaskDto['type'], string> = {
  TWEET: 'tweet',
  FOLLOW: 'follow',
  REPOST: 'repost',
  YOUTUBE: 'youtube',
  QUIZ: 'quiz',
  SPIN_WHEEL: 'spin',
};

const ICON: Record<TaskDto['type'], IconName> = {
  TWEET: 'share',
  FOLLOW: 'star',
  REPOST: 'swap',
  YOUTUBE: 'play',
  QUIZ: 'help',
  SPIN_WHEEL: 'gift',
};

export default function TasksSection({
  onClaimed,
}: {
  /** Lets the dashboard re-pull the balance after a task pays out. */
  onClaimed: () => void;
}) {
  const t = useTranslations('dashboard');
  const taskLabels = useTranslations('tasks');
  const { playTick, playError } = useMiningFX();

  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [wheelTask, setWheelTask] = useState<TaskDto | null>(null);
  const [quizTask, setQuizTask] = useState<TaskDto | null>(null);
  const [youtubeTask, setYoutubeTask] = useState<TaskDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [won, setWon] = useState<{ id: string; points: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await getTasks());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('offline'));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(task: TaskDto) {
    playTick();
    if (task.type === 'SPIN_WHEEL' && task.wheelSegments) {
      setWheelTask(task);
      return;
    }
    if (task.type === 'QUIZ') {
      setQuizTask(task);
      return;
    }
    if (task.type === 'YOUTUBE') {
      setYoutubeTask(task);
      return;
    }
    if (task.actionUrl) {
      window.open(task.actionUrl, '_blank', 'noopener,noreferrer');
    }

    setBusyId(task.id);
    setError(null);
    try {
      const res = await claimTask(task.id);
      setWon({ id: task.id, points: res.earnedPoints });
      setTimeout(() => setWon(null), 2000);
      await load();
      onClaimed();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : t('offline'));
    } finally {
      setBusyId(null);
    }
  }

  /** Runs the real claim for the wheel and hands back where it must stop. */
  async function spinFor(task: TaskDto) {
    const res = await claimTask(task.id);
    // The list and balance refresh behind the modal while it is still
    // spinning, so closing it reveals an already-settled dashboard.
    void load().then(onClaimed);
    return { index: res.spinIndex ?? 0, earned: res.earnedPoints };
  }

  if (!tasks) {
    return (
      <Panel className="mt-4 p-5 sm:p-6">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </Panel>
    );
  }

  const openCount = tasks.filter((x) => x.canClaim).length;

  return (
    <Reveal className="mt-4">
      <Panel hud className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/15 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/12 text-brand-hi">
              <Icon name="gift" size={18} />
            </span>
            <div>
              <Eyebrow tone="brand">{t('tasksTitle')}</Eyebrow>
              <p className="mt-0.5 text-sm text-ink-2">{t('tasksSubtitle')}</p>
            </div>
          </div>
          <Chip tone={openCount > 0 ? 'charge' : 'default'} dot={openCount > 0}>
            <span className="v-num">{openCount}</span> / {tasks.length}
          </Chip>
        </div>

        {error && (
          <Notice tone="heat" className="mt-4" icon={<Icon name="flame" size={16} />}>
            {error}
          </Notice>
        )}

        <div className="v-stagger mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              label={taskLabels(LABEL_KEY[task.type])}
              busy={busyId === task.id}
              won={won?.id === task.id ? won.points : null}
              onClaim={() => claim(task)}
              pointsShort={t('pointsShort')}
              claimLabel={t('claim')}
              workingLabel={t('working')}
              cooldownLabel={t('cooldownShort')}
            />
          ))}
        </div>

        {wheelTask?.wheelSegments && (
          <SpinWheelModal
            segments={wheelTask.wheelSegments}
            onSpin={() => spinFor(wheelTask)}
            onClose={() => setWheelTask(null)}
          />
        )}

        {quizTask && (
          <QuizModal
            rewardPoints={quizTask.rewardPoints}
            customQuestions={quizTask.quizQuestions}
            onSubmit={async (answers) => {
              // The modal keeps itself open to show the marking, so refresh
              // the list and the balance behind it rather than on close.
              const res = await claimTask(quizTask.id, answers);
              if (res.earnedPoints > 0) {
                setWon({ id: quizTask.id, points: res.earnedPoints });
                setTimeout(() => setWon(null), 2000);
              }
              await load();
              onClaimed();
              return res;
            }}
            onClose={() => setQuizTask(null)}
          />
        )}

        {youtubeTask && (
          <YouTubeTaskModal
            rewardPoints={youtubeTask.rewardPoints}
            videoUrl={youtubeTask.actionUrl}
            onComplete={async () => {
              const res = await claimTask(youtubeTask.id);
              setWon({ id: youtubeTask.id, points: res.earnedPoints });
              setTimeout(() => setWon(null), 2000);
              await load();
              onClaimed();
            }}
            onClose={() => setYoutubeTask(null)}
          />
        )}
      </Panel>
    </Reveal>
  );
}

function TaskCard({
  task,
  label,
  busy,
  won,
  onClaim,
  pointsShort,
  claimLabel,
  workingLabel,
  cooldownLabel,
}: {
  task: TaskDto;
  label: string;
  busy: boolean;
  won: number | null;
  onClaim: () => void;
  pointsShort: string;
  claimLabel: string;
  workingLabel: string;
  cooldownLabel: string;
}) {
  const reward = task.wheelSegments
    ? `${Math.min(...task.wheelSegments)}–${Math.max(...task.wheelSegments)}`
    : `+${task.rewardPoints}`;

  return (
    <Panel
      lift
      trace
      className={`group relative flex h-full flex-col justify-between overflow-hidden p-4 sm:p-5 ${
        task.canClaim ? '' : 'opacity-80'
      }`}
    >
      {won !== null && (
        <span className="v-float-up top-3 z-20 text-base">
          +{won.toFixed(2)} {pointsShort}
        </span>
      )}

      <div className="flex items-start gap-3">
        {task.type === 'SPIN_WHEEL' ? (
          <WheelIcon />
        ) : (
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105 ${
            task.canClaim ? 'bg-brand/12 text-brand-hi' : 'bg-surface-3/70 text-ink-3'
          }`}>
            <Icon name={ICON[task.type]} size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 min-h-[2.5rem] text-sm font-extrabold leading-snug text-ink">{label}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span className={`v-num font-extrabold ${task.canClaim ? 'text-charge' : 'text-ink-2'}`}>{reward}</span>
            <span className="text-ink-3">{pointsShort}</span>
          </div>
        </div>
        <Chip tone={task.canClaim ? 'charge' : 'default'} dot={task.canClaim} className="shrink-0">
          {task.canClaim ? claimLabel : <Icon name="clock" size={11} />}
        </Chip>
      </div>

      <div className="mt-4 border-t border-line/15 pt-3">
        <Button
          variant={task.canClaim ? 'primary' : 'ghost'}
          size="sm"
          className="w-full"
          onClick={onClaim}
          disabled={!task.canClaim || busy}
          loading={busy}
        >
          {busy ? (
            workingLabel
          ) : task.canClaim ? (
            <>
              <Icon name="sparkle" size={13} />
              {claimLabel}
            </>
          ) : (
            <Cooldown iso={task.nextAvailableAt} label={cooldownLabel} />
          )}
        </Button>
      </div>
    </Panel>
  );
}

/** A wheel that reads as a wheel — the reward itself is server-set. */
function WheelIcon() {
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl animate-spin-slow"
      style={{
        background:
          'conic-gradient(rgb(var(--c-brand)) 0 60deg, rgb(var(--c-charge)) 60deg 120deg, rgb(var(--c-brand-hi)) 120deg 180deg, rgb(var(--c-ok)) 180deg 240deg, rgb(var(--c-brand-lo)) 240deg 300deg, rgb(var(--c-warn)) 300deg 360deg)',
      }}
      aria-hidden
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-bg" />
    </span>
  );
}

/** Live "4h 12m" until a task's cooldown lifts. */
function Cooldown({ iso, label }: { iso: string | null; label: string }) {
  const [left, setLeft] = useState('');

  useEffect(() => {
    if (!iso) return;
    const target = new Date(iso).getTime();
    const render = () => {
      const ms = target - Date.now();
      if (ms <= 0) return setLeft('');
      const m = Math.floor(ms / 60_000);
      setLeft(m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
    };
    render();
    const id = setInterval(render, 30_000);
    return () => clearInterval(id);
  }, [iso]);

  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name="clock" size={12} />
      <span className="v-num">{left ? `${label} ${left}` : label}</span>
    </span>
  );
}
