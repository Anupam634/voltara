import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useSession } from '../../store/session';
import { useSettings } from '../../store/settings';
import { useNotifications } from '../../store/notifications';
import { useI18n } from '../../i18n';
import {
  cancel,
  cancelAll,
  configureChannels,
  getPermissionState,
  scheduleAt,
  setBadge,
} from '../../lib/push';
import {
  getBoosters,
  getRig,
  getSupportTickets,
  getTasks,
  getWithdrawals,
  type BoosterOverview,
  type RigOverview,
  type SupportTicketDto,
  type TaskDto,
  type WithdrawalDto,
} from '../../api/endpoints';
import { findLoaner } from '../onboarding/LoanerCard';
import { fill, useOnboarding } from '../onboarding/strings';

/**
 * Keeps the OS notification schedule in step with the account, and feeds the
 * in-app notification centre.
 *
 * Renders nothing. Two jobs:
 *  1. schedule "your node is ready" for the exact moment the cooldown lifts,
 *     and a nudge for the next bounty coming off cooldown;
 *  2. poll the routes the dashboard does not (withdrawals, tickets, boosters)
 *     and hand them to the notification store, which reports what changed.
 */

const IDS = {
  miningReady: 'voltara.mining-ready',
  tasksReady: 'voltara.tasks-ready',
  boosterExpiring: 'voltara.booster-expiring',
  loanerExpiring: 'voltara.loaner-expiring',
  streakLapsing: 'voltara.streak-lapsing',
};

/** How long before the free core lapses to warn — GROWTH.md §2b. */
const LOANER_WARN_MS = 12 * 3_600_000;
/** How long before a streak resets to warn. */
const STREAK_WARN_MS = 3 * 3_600_000;
/** Below this run length a streak is not yet worth interrupting someone for. */
const STREAK_MIN_DAYS = 3;

/** Secondary poll — slower than the dashboard's, since none of it ticks. */
const SLOW_POLL_MS = 90_000;

export function NotificationScheduler() {
  const { t, locale } = useI18n();
  const S = useOnboarding();
  const router = useRouter();
  const { state, mining, profile } = useSession();
  const { settings } = useSettings();
  const { sync } = useNotifications();
  const lastScheduledClaim = useRef<string | null>(null);
  const lastScheduledStreak = useRef<string | null>(null);
  const lastScheduledLoaner = useRef<string | null>(null);

  // The onboarding copy is read inside the slow poll's closure, which is not
  // re-created on a language change; a ref keeps it current without making
  // the poll restart.
  const copy = useRef(S);
  copy.current = S;

  // The dashboard hands back new profile/mining objects on every poll. Holding
  // them in refs keeps the slow poll below on a fixed 90s cadence instead of
  // restarting — and re-firing four requests — every 20 seconds.
  const latest = useRef({ profile, mining });
  latest.current = { profile, mining };

  /* Android notification channels — re-run on a language change, since the
   * channel names are what the system settings app shows. */
  useEffect(() => {
    void configureChannels(t);
  }, [t]);

  /* Signed out by any route (menu, app lock, a 401): nothing armed in the OS
   * may outlive the account it was scheduled for. */
  useEffect(() => {
    if (state !== 'signedOut') return;
    void cancelAll().then(() => setBadge(0));
  }, [state]);

  /* Tapping a notification should land on the screen it is about. */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const href = response.notification.request.content.data?.href;
        if (typeof href === 'string' && href.startsWith('/')) {
          router.push(href as never);
        }
      },
    );
    return () => sub.remove();
  }, [router]);

  /* Schedule the mining-ready reminder whenever the cooldown moves. */
  useEffect(() => {
    if (state !== 'signedIn') return;
    const prefs = settings.notifications;

    (async () => {
      if (!prefs.enabled || !prefs.miningReady) {
        await cancel(IDS.miningReady);
        lastScheduledClaim.current = null;
        return;
      }
      if ((await getPermissionState()) !== 'granted') return;

      const nextClaimAt = mining?.nextClaimAt ?? null;
      if (!nextClaimAt || mining?.canClaim) {
        await cancel(IDS.miningReady);
        lastScheduledClaim.current = null;
        return;
      }
      // Rescheduling the same instant on every poll would be wasted work —
      // but a language change must re-arm it with translated copy.
      const scheduleKey = `${nextClaimAt}|${locale}`;
      if (lastScheduledClaim.current === scheduleKey) return;
      lastScheduledClaim.current = scheduleKey;

      await scheduleAt({
        id: IDS.miningReady,
        title: t('notify.miningReadyTitle'),
        body: t('notify.miningReadyMessage'),
        at: new Date(nextClaimAt),
        channel: 'mining',
        data: { href: '/' },
        quiet: settings.quietHours,
      });
    })();
  }, [state, mining?.nextClaimAt, mining?.canClaim, settings.notifications, settings.quietHours, t, locale]);

  /* A streak about to reset. Rides the same preference as the mining
   * reminder — both are "come and tap" — and stays quiet below a run long
   * enough to be worth protecting. */
  useEffect(() => {
    if (state !== 'signedIn') return;
    const prefs = settings.notifications;
    const streak = mining?.streak;

    (async () => {
      if (!prefs.enabled || !prefs.miningReady || !streak) {
        await cancel(IDS.streakLapsing);
        lastScheduledStreak.current = null;
        return;
      }
      if ((await getPermissionState()) !== 'granted') return;

      const keepsUntil = streak.keepsUntil;
      // Nothing to protect: too short a run, no deadline, or the miner has
      // already claimed inside this window.
      if (!keepsUntil || streak.days < STREAK_MIN_DAYS || mining?.canClaim) {
        await cancel(IDS.streakLapsing);
        lastScheduledStreak.current = null;
        return;
      }

      const at = new Date(Date.parse(keepsUntil) - STREAK_WARN_MS);
      const scheduleKey = `${keepsUntil}|${streak.days}|${locale}`;
      if (lastScheduledStreak.current === scheduleKey) return;
      lastScheduledStreak.current = scheduleKey;

      await scheduleAt({
        id: IDS.streakLapsing,
        title: S.notifyStreakTitle,
        body: fill(S.notifyStreakBody, { n: streak.days }),
        at,
        channel: 'mining',
        data: { href: '/' },
        quiet: settings.quietHours,
      });
    })();
  }, [
    state,
    mining?.streak,
    mining?.canClaim,
    settings.notifications,
    settings.quietHours,
    S,
    locale,
  ]);

  /* Slow poll: the routes the dashboard does not fetch. */
  useEffect(() => {
    if (state !== 'signedIn') return;

    let alive = true;

    const run = async () => {
      // Each call is independent: a failure in one must not blank the others.
      const [withdrawals, tickets, boosters, tasks, rig] = await Promise.all([
        getWithdrawals().catch(() => null),
        getSupportTickets().catch(() => null),
        getBoosters().catch(() => null),
        getTasks().catch(() => null),
        getRig().catch(() => null),
      ]);
      if (!alive) return;

      sync({
        t,
        profile: latest.current.profile,
        mining: latest.current.mining,
        withdrawals: withdrawals as WithdrawalDto[] | null,
        tickets: tickets as SupportTicketDto[] | null,
        boosters: boosters as BoosterOverview | null,
        tasks: tasks as TaskDto[] | null,
      });

      await scheduleTaskReminder(tasks as TaskDto[] | null);
      await scheduleBoosterReminder(boosters as BoosterOverview | null);
      await scheduleLoanerReminder(rig as RigOverview | null);
    };

    /* The free starter core lapsing — the first purchase decision a miner
     * ever makes, so it gets its own warning rather than being folded into
     * the generic booster one. Shares the booster preference. */
    const scheduleLoanerReminder = async (rig: RigOverview | null) => {
      const prefs = settings.notifications;
      const loaner = prefs.enabled && prefs.boosters ? findLoaner(rig) : null;
      if (!loaner) {
        await cancel(IDS.loanerExpiring);
        lastScheduledLoaner.current = null;
        return;
      }

      const scheduleKey = `${loaner.expiresAt}|${locale}`;
      if (lastScheduledLoaner.current === scheduleKey) return;
      lastScheduledLoaner.current = scheduleKey;

      await scheduleAt({
        id: IDS.loanerExpiring,
        title: copy.current.notifyLoanerTitle,
        body: copy.current.notifyLoanerBody,
        at: new Date(Date.parse(loaner.expiresAt) - LOANER_WARN_MS),
        channel: 'rewards',
        data: { href: '/boosters' },
        quiet: settings.quietHours,
      });
    };

    const scheduleTaskReminder = async (tasks: TaskDto[] | null) => {
      const prefs = settings.notifications;
      if (!prefs.enabled || !prefs.tasks || !tasks) {
        await cancel(IDS.tasksReady);
        return;
      }
      // The soonest cooldown to lift is the only one worth an alert: by then
      // the screen will show every other task that came back with it.
      const upcoming = tasks
        .filter((task) => !task.canClaim && task.nextAvailableAt)
        .map((task) => new Date(task.nextAvailableAt!).getTime())
        .filter((time) => time > Date.now())
        .sort((a, b) => a - b)[0];

      if (!upcoming) {
        await cancel(IDS.tasksReady);
        return;
      }
      const readyCount = tasks.filter(
        (task) =>
          task.nextAvailableAt &&
          new Date(task.nextAvailableAt).getTime() <= upcoming + 60_000,
      ).length;

      await scheduleAt({
        id: IDS.tasksReady,
        title: t('notify.taskReadyTitle'),
        body: t('notify.taskReadyMessage', { n: Math.max(1, readyCount) }),
        at: new Date(upcoming),
        channel: 'rewards',
        data: { href: '/tasks' },
        quiet: settings.quietHours,
      });
    };

    const scheduleBoosterReminder = async (boosters: BoosterOverview | null) => {
      const prefs = settings.notifications;
      if (!prefs.enabled || !prefs.boosters || !boosters) {
        await cancel(IDS.boosterExpiring);
        return;
      }
      const soonest = boosters.activeBoosters
        .map((b) => new Date(b.expiresAt).getTime())
        .filter((time) => time > Date.now())
        .sort((a, b) => a - b)[0];

      if (!soonest) {
        await cancel(IDS.boosterExpiring);
        return;
      }
      const price =
        boosters.activeBoosters.find(
          (b) => new Date(b.expiresAt).getTime() === soonest,
        )?.priceUsd ?? 0;

      await scheduleAt({
        id: IDS.boosterExpiring,
        title: t('notify.boosterExpiringTitle'),
        body: t('notify.boosterExpiringMessage', { price }),
        // A day's warning is enough to renew before the rate drops.
        at: new Date(soonest - 86_400_000),
        channel: 'rewards',
        data: { href: '/boosters' },
        quiet: settings.quietHours,
      });
    };

    void run();
    // Backgrounded, the poll would only spend battery and radio on results
    // nobody is looking at; the next foreground tick catches up.
    const id = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void run();
    }, SLOW_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [state, settings.notifications, settings.quietHours, sync, t, locale]);

  return null;
}
