'use client';

import { useLocale } from 'next-intl';

/**
 * Copy for the referral reward ladder (GROWTH.md §3).
 *
 * `en` is written without `as const`, so every leaf infers as `string` and
 * `zh` / `ko` typed as `Copy` fail to compile the moment a key is missing.
 *
 * Brand terms are never translated: VOLTARA, $VLTR, VOLTS, BNB Chain,
 * BEP-20, and the part codes (VC-1, CX-2, PS-3, OD-8).
 */
const en = {
  eyebrow: 'Hardware rewards',
  title: 'Invites pay in parts, not just multipliers',
  subtitle:
    'A multiplier is a number you have to take on trust. A cooler sits in your rig and moves the gauge.',
  earned: 'Earned',
  unlocked: 'Unlocked',
  locked: 'Locked',
  pending: 'Landing shortly',
  invitesNeeded: 'invites to go',
  oneInvite: '1 invite',
  invites: 'invites',
  days: 'days',
  permanent: 'Permanent',
  rewards: {
    LOANER_24H: {
      name: '+24h starter core',
      body: 'The miner you invited keeps their free VC-1 for a day longer.',
    },
    CX2: {
      name: 'CX-2 Vapor Cooler',
      body: 'Removes 40 TU of heat. The part that stops a second core throttling.',
    },
    PS3: {
      name: 'PS-3 Feeder Unit',
      body: 'Supplies 260 W. Unlocks the power budget for a VC-5.',
    },
    SLOT_7: {
      name: 'A seventh slot',
      body: 'Permanent. The only rig on the grid wider than six, and it shows on your card.',
    },
    GRID_OPERATOR: {
      name: 'Grid Operator',
      body: 'Standing on the leaderboard and your profile. No rate change, all reputation.',
    },
  },
};

type Copy = typeof en;

const zh: Copy = {
  eyebrow: '硬件奖励',
  title: '邀请给的是部件，不只是倍率',
  subtitle: '倍率只是一个你得选择相信的数字。散热器则实实在在装在机架上，指针会动。',
  earned: '已到账',
  unlocked: '已解锁',
  locked: '未解锁',
  pending: '即将发放',
  invitesNeeded: '个邀请即可解锁',
  oneInvite: '1 个邀请',
  invites: '个邀请',
  days: '天',
  permanent: '永久',
  rewards: {
    LOANER_24H: {
      name: '启动核心 +24 小时',
      body: '你邀请的矿工可以多用一天免费的 VC-1。',
    },
    CX2: {
      name: 'CX-2 蒸汽散热器',
      body: '移除 40 TU 热量。让第二个核心不再降频的关键部件。',
    },
    PS3: {
      name: 'PS-3 供电单元',
      body: '提供 260 W。解锁 VC-5 所需的电力预算。',
    },
    SLOT_7: {
      name: '第七个插槽',
      body: '永久生效。全网唯一超过六槽的机架，并会显示在你的分享卡上。',
    },
    GRID_OPERATOR: {
      name: '电网操作员',
      body: '排行榜与个人资料上的身份标识。不改变速率，纯粹是声望。',
    },
  },
};

const ko: Copy = {
  eyebrow: '하드웨어 보상',
  title: '초대는 배율이 아니라 부품으로 돌아옵니다',
  subtitle: '배율은 그냥 믿어야 하는 숫자입니다. 쿨러는 리그에 실제로 꽂히고 게이지를 움직입니다.',
  earned: '지급 완료',
  unlocked: '해제됨',
  locked: '잠김',
  pending: '곧 지급',
  invitesNeeded: '명 더 초대하면 해제',
  oneInvite: '초대 1명',
  invites: '명 초대',
  days: '일',
  permanent: '영구',
  rewards: {
    LOANER_24H: {
      name: '스타터 코어 +24시간',
      body: '당신이 초대한 채굴자가 무료 VC-1을 하루 더 사용합니다.',
    },
    CX2: {
      name: 'CX-2 베이퍼 쿨러',
      body: '발열 40 TU를 제거합니다. 두 번째 코어가 스로틀링되지 않게 해주는 부품입니다.',
    },
    PS3: {
      name: 'PS-3 피더 유닛',
      body: '260 W를 공급합니다. VC-5를 돌릴 전력 예산이 열립니다.',
    },
    SLOT_7: {
      name: '일곱 번째 슬롯',
      body: '영구 적용. 그리드에서 6칸을 넘는 유일한 리그이며, 공유 카드에도 표시됩니다.',
    },
    GRID_OPERATOR: {
      name: '그리드 오퍼레이터',
      body: '순위표와 프로필에 표시되는 지위. 채굴 속도는 그대로, 순수한 명성입니다.',
    },
  },
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Referral reward copy for the active locale; falls back to English. */
export function useReferrals(): Copy {
  const locale = useLocale();
  return BY_LOCALE[locale] ?? en;
}
