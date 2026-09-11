import { useI18n } from '../../i18n';

/**
 * Copy for onboarding and retention: the starter checklist, the free loaner
 * core, the claim streak and its tier celebration.
 *
 * Kept out of the shared catalogues so these three features can settle
 * without dragging all three locale files with them. Typing `zh` and `ko`
 * as `Copy` makes a missing translation a compile error rather than a blank
 * label on a phone.
 *
 * Brand terms stay untranslated: VOLTARA, $VLTR, VOLTS, and the part codes.
 */
const en = {
  // ── Starter checklist ──
  checklistTitle: 'Get your rig running',
  checklistBody: 'Three steps, about a minute.',
  checklistProgress: '{done} of {total} done',
  stepClaim: 'Claim your first VOLTS',
  stepClaimHint: 'Ready right now — tap MINE.',
  stepRig: 'Get a part running',
  stepRigHint: 'A core in a slot lifts your rate.',
  stepInvite: 'Invite one miner',
  stepInviteHint: 'Every invite multiplies what you earn.',

  // ── Loaner core ──
  loanerTitle: 'Free starter core',
  loanerBody: 'Running on your rig at no cost.',
  loanerEndsIn: 'Ends in',
  loanerLapse: 'When it lapses your rate drops back to 0.9/h.',
  loanerUrgent: 'Your free core is about to lapse.',
  loanerBuy: 'Buy your own VC-1 — $1',

  // ── Streak ──
  streakTitle: 'Claim streak',
  streakDayOne: 'day',
  streakDayMany: 'days',
  streakBonus: '+{n}% rate',
  streakNone: 'No streak yet',
  streakNoneBody: 'Claim today, then again tomorrow, and the bonus starts.',
  streakNext: '{n} more days for +{bonus}%',
  streakNextOne: '1 more day for +{bonus}%',
  streakTop: 'Top tier reached',
  streakKeeps: 'Keeps until',
  streakUrgent: 'Claim today to keep it',
  streakBest: 'Best {n}',

  // ── Tier celebration ──
  tierTitle: 'Streak bonus unlocked',
  tierBody: '{days} days in a row. Your rate is now +{bonus}%.',
  tierNext: 'Next: {days} days for +{bonus}%',
  tierTop: 'That is the top tier. Keep it alive.',
  tierClose: 'Nice',

  // ── Notifications ──
  notifyLoanerTitle: 'Your free core lapses soon',
  notifyLoanerBody: '12 hours left. A VC-1 of your own costs $1.',
  notifyStreakTitle: 'Your streak is about to break',
  notifyStreakBody: 'Claim in the next few hours to keep your {n}-day streak.',
};

/** Same keys as `en`, but each value is a plain string so a translation
 *  may differ from the English literal. */
type Copy = { [K in keyof typeof en]: string };

const zh: Copy = {
  checklistTitle: '让你的机架跑起来',
  checklistBody: '三个步骤，大约一分钟。',
  checklistProgress: '已完成 {done} / {total}',
  stepClaim: '领取你的第一笔 VOLTS',
  stepClaimHint: '现在就能领 — 点击「挖矿」。',
  stepRig: '让一个部件运转',
  stepRigHint: '插槽里装上核心就能提升速率。',
  stepInvite: '邀请一位矿工',
  stepInviteHint: '每一次邀请都会让收益翻倍。',

  loanerTitle: '免费入门核心',
  loanerBody: '正在你的机架上免费运转。',
  loanerEndsIn: '结束于',
  loanerLapse: '到期后你的速率会回落到 0.9/小时。',
  loanerUrgent: '你的免费核心即将到期。',
  loanerBuy: '买一个自己的 VC-1 — $1',

  streakTitle: '连续签到',
  streakDayOne: '天',
  streakDayMany: '天',
  streakBonus: '速率 +{n}%',
  streakNone: '还没有连续记录',
  streakNoneBody: '今天领一次，明天再领一次，加成就开始了。',
  streakNext: '再坚持 {n} 天可得 +{bonus}%',
  streakNextOne: '再坚持 1 天可得 +{bonus}%',
  streakTop: '已达最高档',
  streakKeeps: '保持至',
  streakUrgent: '今天领取才能保住',
  streakBest: '最佳 {n}',

  tierTitle: '连续签到加成已解锁',
  tierBody: '连续 {days} 天。你的速率现在是 +{bonus}%。',
  tierNext: '下一档：{days} 天可得 +{bonus}%',
  tierTop: '这已是最高档，继续保持。',
  tierClose: '好的',

  notifyLoanerTitle: '免费核心即将到期',
  notifyLoanerBody: '还剩 12 小时。买一个自己的 VC-1 只要 $1。',
  notifyStreakTitle: '你的连续记录快断了',
  notifyStreakBody: '在接下来几小时内领取，保住你的 {n} 天连续记录。',
};

const ko: Copy = {
  checklistTitle: '리그를 가동하세요',
  checklistBody: '세 단계, 약 1분이면 됩니다.',
  checklistProgress: '{total}개 중 {done}개 완료',
  stepClaim: '첫 VOLTS 받기',
  stepClaimHint: '지금 바로 가능 — MINE을 누르세요.',
  stepRig: '부품 가동하기',
  stepRigHint: '슬롯에 코어를 넣으면 채굴 속도가 올라갑니다.',
  stepInvite: '채굴자 한 명 초대하기',
  stepInviteHint: '초대할 때마다 수익이 배로 늘어납니다.',

  loanerTitle: '무료 스타터 코어',
  loanerBody: '내 리그에서 무료로 작동 중입니다.',
  loanerEndsIn: '종료까지',
  loanerLapse: '만료되면 채굴 속도가 시간당 0.9로 돌아갑니다.',
  loanerUrgent: '무료 코어가 곧 만료됩니다.',
  loanerBuy: '내 VC-1 구매 — $1',

  streakTitle: '연속 수령',
  streakDayOne: '일',
  streakDayMany: '일',
  streakBonus: '속도 +{n}%',
  streakNone: '아직 연속 기록이 없습니다',
  streakNoneBody: '오늘 받고 내일 또 받으면 보너스가 시작됩니다.',
  streakNext: '{n}일 더 모으면 +{bonus}%',
  streakNextOne: '1일 더 모으면 +{bonus}%',
  streakTop: '최고 등급 도달',
  streakKeeps: '유지 기한',
  streakUrgent: '오늘 받아야 유지됩니다',
  streakBest: '최고 {n}',

  tierTitle: '연속 보너스 해금',
  tierBody: '{days}일 연속. 이제 채굴 속도가 +{bonus}%입니다.',
  tierNext: '다음: {days}일이면 +{bonus}%',
  tierTop: '최고 등급입니다. 계속 이어가세요.',
  tierClose: '좋아요',

  notifyLoanerTitle: '무료 코어가 곧 만료됩니다',
  notifyLoanerBody: '12시간 남았습니다. 내 VC-1은 $1입니다.',
  notifyStreakTitle: '연속 기록이 끊기려 합니다',
  notifyStreakBody: '몇 시간 안에 받아서 {n}일 연속 기록을 지키세요.',
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Onboarding copy for the active locale; falls back to English. */
export function useOnboarding(): Copy {
  const { locale } = useI18n();
  return BY_LOCALE[locale] ?? en;
}

/**
 * Substitute `{name}` placeholders, the same way the shared catalogue's
 * `t()` does — these strings never reach it, so they need their own.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/**
 * English copy, for the rare call site outside a component. Prefer
 * `useOnboarding()` anywhere a hook is allowed.
 */
export const ONBOARDING = en;
