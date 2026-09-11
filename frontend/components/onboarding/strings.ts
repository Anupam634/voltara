'use client';

import { useLocale } from 'next-intl';

/**
 * Copy for onboarding and retention: the starter checklist, the free
 * loaner core, and the claim streak.
 *
 * `en` is written without `as const`, so every leaf infers as `string` and
 * `zh` / `ko` typed as `Copy` fail to compile the moment a key is missing.
 *
 * Brand terms are never translated: VOLTARA, $VLTR, VOLTS, BNB Chain,
 * BEP-20, and the part codes (VC-1, CX-2, PS-3, OD-8).
 */
const en = {
  checklist: {
    eyebrow: 'Get started',
    title: 'Three steps to a live rig',
    progress: '{done} of 3 done',
    steps: {
      claim: {
        title: 'Claim your first VOLTS',
        body: 'The Mine button is ready now. Tap it and watch the counter move.',
        cta: 'Mine now',
      },
      rig: {
        title: 'Get a part running',
        body: 'A core in a slot is what turns 0.9 into 2.9 VOLTS an hour.',
        cta: 'Open the rig',
      },
      invite: {
        title: 'Invite one miner',
        body: 'One invite lifts your rate multiplier, and they start with a free core too.',
        cta: 'Get your link',
      },
    },
  },
  loaner: {
    eyebrow: 'Free starter core',
    running: 'Your {name} is running',
    endingSoon: 'Your {name} expires soon',
    body: 'It was installed free when you joined. When it lapses your rate drops back to 0.9 VOLTS an hour.',
    bodyUrgent: 'When it lapses your rate drops back to 0.9 VOLTS an hour. Your own VC-1 costs $1 and runs for 30 days.',
    timeLeft: 'Time left',
    cta: 'Buy your own VC-1 — $1',
    ctaCalm: 'See the parts shop',
  },
  streak: {
    eyebrow: 'Claim streak',
    days: 'day',
    daysPlural: 'days',
    bonus: '+{percent}% rate',
    noneTitle: 'Start a streak',
    noneBody: 'Claim on three days in a row and every rate goes up 3%. Keep going for more.',
    best: 'Best {days}',
    nextTier: '{days} more for +{percent}%',
    maxTier: 'Top tier reached',
    keepsUntil: 'Keeps until {time}',
    keepToday: 'Claim today to keep it',
    tierTitle: 'Streak tier unlocked',
    tierBody: '{days} days in a row. Every VOLTS you mine now earns {percent}% more.',
    tierNext: 'Next: {days} days for +{percent}%',
    tierTop: 'That is the top tier. Keep the run alive.',
    tierClose: 'Keep mining',
  },
};

type Copy = typeof en;

const zh: Copy = {
  checklist: {
    eyebrow: '新手上路',
    title: '三步让机架跑起来',
    progress: '已完成 {done} / 3',
    steps: {
      claim: {
        title: '领取你的第一笔 VOLTS',
        body: '挖矿按钮现在就可以按。点一下，看着计数器往上走。',
        cta: '立即挖矿',
      },
      rig: {
        title: '让一个部件运转起来',
        body: '插槽里装上核心，每小时就从 0.9 变成 2.9 VOLTS。',
        cta: '打开机架',
      },
      invite: {
        title: '邀请一位矿工',
        body: '一个邀请就能提升你的倍率，而且对方同样会获得一个免费核心。',
        cta: '获取邀请链接',
      },
    },
  },
  loaner: {
    eyebrow: '免费入门核心',
    running: '你的 {name} 正在运转',
    endingSoon: '你的 {name} 即将到期',
    body: '它是你注册时免费装上的。一旦到期，你的速率会回落到每小时 0.9 VOLTS。',
    bodyUrgent: '一旦到期，你的速率会回落到每小时 0.9 VOLTS。自己的 VC-1 只要 1 美元，可运行 30 天。',
    timeLeft: '剩余时间',
    cta: '购买你自己的 VC-1 — 1 美元',
    ctaCalm: '去部件商店看看',
  },
  streak: {
    eyebrow: '连续领取',
    days: '天',
    daysPlural: '天',
    bonus: '速率 +{percent}%',
    noneTitle: '开始连续领取',
    noneBody: '连续三天领取，所有速率提升 3%。坚持下去还能更高。',
    best: '最高 {days}',
    nextTier: '再 {days} 天可得 +{percent}%',
    maxTier: '已达最高档',
    keepsUntil: '保留至 {time}',
    keepToday: '今天领取才能保住',
    tierTitle: '解锁连续领取档位',
    tierBody: '已连续 {days} 天。现在你挖到的每一份 VOLTS 都多赚 {percent}%。',
    tierNext: '下一档：{days} 天可得 +{percent}%',
    tierTop: '这已是最高档。保持这个势头。',
    tierClose: '继续挖矿',
  },
};

const ko: Copy = {
  checklist: {
    eyebrow: '시작하기',
    title: '리그를 가동하는 세 단계',
    progress: '3단계 중 {done}단계 완료',
    steps: {
      claim: {
        title: '첫 VOLTS 수령하기',
        body: '채굴 버튼이 지금 바로 준비되어 있습니다. 눌러서 카운터가 올라가는 걸 보세요.',
        cta: '지금 채굴',
      },
      rig: {
        title: '부품 하나 가동하기',
        body: '슬롯에 코어를 꽂으면 시간당 0.9에서 2.9 VOLTS가 됩니다.',
        cta: '리그 열기',
      },
      invite: {
        title: '채굴자 한 명 초대하기',
        body: '초대 한 번으로 배율이 올라가고, 상대방도 무료 코어를 받습니다.',
        cta: '초대 링크 받기',
      },
    },
  },
  loaner: {
    eyebrow: '무료 스타터 코어',
    running: '{name} 가동 중',
    endingSoon: '{name} 곧 만료',
    body: '가입할 때 무료로 장착된 부품입니다. 만료되면 채굴 속도가 시간당 0.9 VOLTS로 돌아갑니다.',
    bodyUrgent: '만료되면 채굴 속도가 시간당 0.9 VOLTS로 돌아갑니다. 내 VC-1은 1달러이며 30일 동안 돌아갑니다.',
    timeLeft: '남은 시간',
    cta: '내 VC-1 구매 — $1',
    ctaCalm: '부품 상점 보기',
  },
  streak: {
    eyebrow: '연속 수령',
    days: '일',
    daysPlural: '일',
    bonus: '속도 +{percent}%',
    noneTitle: '연속 기록 시작하기',
    noneBody: '사흘 연속 수령하면 모든 속도가 3% 올라갑니다. 계속 이어가면 더 올라갑니다.',
    best: '최고 {days}',
    nextTier: '{days}일 더 하면 +{percent}%',
    maxTier: '최고 단계 도달',
    keepsUntil: '{time}까지 유지',
    keepToday: '오늘 수령해야 유지됩니다',
    tierTitle: '연속 수령 단계 달성',
    tierBody: '{days}일 연속입니다. 이제 캐는 VOLTS마다 {percent}% 더 받습니다.',
    tierNext: '다음 단계: {days}일에 +{percent}%',
    tierTop: '최고 단계입니다. 이 기록을 이어가세요.',
    tierClose: '계속 채굴하기',
  },
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Onboarding and retention copy for the active locale; falls back to English. */
export function useOnboarding(): Copy {
  const locale = useLocale();
  return BY_LOCALE[locale] ?? en;
}

/**
 * Fills `{name}` style placeholders.
 *
 * The catalogues in `messages/*.json` go through next-intl, but this copy
 * is plain objects, so it needs its own one-line interpolation.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}
