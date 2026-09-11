'use client';

import { useLocale } from 'next-intl';

/**
 * Copy for the daily rig puzzle.
 *
 * `en` is written without `as const`, so every leaf infers as `string` and
 * `zh` / `ko` typed as `Copy` fail to compile the moment a key is missing.
 *
 * Brand terms are never translated: VOLTARA, $VLTR, VOLTS, BNB Chain,
 * BEP-20, and the part codes (VC-1, CX-2, PS-3, OD-8).
 */
const en = {
  eyebrow: 'Daily puzzle',
  title: 'One rig. One budget. Everyone gets the same problem.',
  subtitle:
    'A new constraint every day at midnight UTC. Build inside the budget, hold 100% stability, hit the target — then paste your result wherever you like.',
  offline: 'The grid is unreachable right now.',

  budget: 'Budget',
  target: 'Target',
  perHour: '/h',
  solvers: 'solved it',
  solversOne: 'solved it',
  endsIn: 'Resets in',
  ended: 'Resetting…',
  puzzleNo: 'Puzzle',

  builderTitle: 'Your build',
  builderHint: 'Tap a socket to fit a part. Tap a fitted part to pull it out.',
  clear: 'Clear',
  slotAdd: 'Fit a part',
  pickerTitle: 'Choose a part',
  kinds: {
    CORE: 'Cores',
    COOLER: 'Cooling',
    PSU: 'Power',
    MODULE: 'Modules',
  },

  cost: 'Cost',
  hash: 'Hash',
  stability: 'Stability',
  heat: 'Heat',
  cooling: 'Cooling',
  draw: 'Draw',
  supply: 'Supply',

  overBudget: 'Over budget',
  unstable: 'Throttling — this needs 100%',
  belowTarget: 'Below target',
  meets: 'This one solves it',
  addParts: 'Fit a core to begin',

  submit: 'Submit build',
  resubmit: 'Submit a better build',
  solvedTitle: 'Solved',
  yourResult: 'Your result',
  attempts: 'attempts',
  copy: 'Copy result',
  copied: 'Copied',
  share: 'Share',
  shareX: 'Post on X',
  shareTelegram: 'Telegram',
  shareWhatsApp: 'WhatsApp',
  beat: 'You beat {n}% of today’s solvers',
  beatAlone: 'First one home today',
  rankLabel: 'Rank',

  distributionTitle: 'What it cost everyone else',
  distributionEmpty: 'Nobody has solved today’s puzzle yet. Go first.',
  atCost: '${n}',

  boardTitle: 'Today’s cheapest builds',
  boardEmpty: 'No solutions yet today.',
  rank: '#',
  miner: 'Miner',
  build: 'Build',
  you: 'You',

  yesterdayTitle: 'Yesterday',
  yesterdayEmpty: 'Yesterday’s puzzle had no solvers.',

  challengeLinkTitle: 'Daily puzzle',
  challengeLinkBody: 'A fresh budget and target every day, the same for everyone.',
  challengeLinkCta: 'Play today’s',
  navLabel: 'Daily',
  navHint: 'One shared build problem a day',
};

type Copy = typeof en;

const zh: Copy = {
  eyebrow: '每日谜题',
  title: '一台机架，一个预算，所有人同一道题。',
  subtitle:
    '每天 UTC 零点换一道新约束。在预算内搭建，保持 100% 稳定度，达到目标算力，然后把结果粘到任何你想发的地方。',
  offline: '暂时连不上电网。',

  budget: '预算',
  target: '目标',
  perHour: '/小时',
  solvers: '人已解出',
  solversOne: '人已解出',
  endsIn: '重置于',
  ended: '正在重置…',
  puzzleNo: '第',

  builderTitle: '你的配置',
  builderHint: '点击插槽装入部件，点击已装部件将其取出。',
  clear: '清空',
  slotAdd: '装入部件',
  pickerTitle: '选择部件',
  kinds: {
    CORE: '核心',
    COOLER: '散热',
    PSU: '电源',
    MODULE: '模块',
  },

  cost: '成本',
  hash: '算力',
  stability: '稳定度',
  heat: '热量',
  cooling: '散热',
  draw: '功耗',
  supply: '供电',

  overBudget: '超出预算',
  unstable: '正在降频，需要 100%',
  belowTarget: '未达目标',
  meets: '这套配置能解出',
  addParts: '先装一个核心',

  submit: '提交配置',
  resubmit: '提交更优配置',
  solvedTitle: '已解出',
  yourResult: '你的结果',
  attempts: '次尝试',
  copy: '复制结果',
  copied: '已复制',
  share: '分享',
  shareX: '发到 X',
  shareTelegram: 'Telegram',
  shareWhatsApp: 'WhatsApp',
  beat: '你胜过了今天 {n}% 的解题者',
  beatAlone: '今天第一个解出的人',
  rankLabel: '排名',

  distributionTitle: '别人花了多少',
  distributionEmpty: '今天还没有人解出，你可以拿第一。',
  atCost: '${n}',

  boardTitle: '今日最省配置',
  boardEmpty: '今天还没有解法。',
  rank: '#',
  miner: '矿工',
  build: '配置',
  you: '你',

  yesterdayTitle: '昨天',
  yesterdayEmpty: '昨天的谜题无人解出。',

  challengeLinkTitle: '每日谜题',
  challengeLinkBody: '每天一个全新的预算与目标，所有人题目相同。',
  challengeLinkCta: '去玩今天的',
  navLabel: '每日',
  navHint: '每天一道共同的搭建题',
};

const ko: Copy = {
  eyebrow: '데일리 퍼즐',
  title: '리그 하나, 예산 하나, 모두에게 같은 문제.',
  subtitle:
    '매일 UTC 자정에 새 제약이 걸립니다. 예산 안에서 조립하고, 안정도 100%를 유지하고, 목표 해시를 달성한 다음 결과를 원하는 곳에 붙여넣으세요.',
  offline: '지금은 그리드에 연결할 수 없습니다.',

  budget: '예산',
  target: '목표',
  perHour: '/시간',
  solvers: '명이 해결',
  solversOne: '명이 해결',
  endsIn: '초기화까지',
  ended: '초기화 중…',
  puzzleNo: '퍼즐',

  builderTitle: '내 빌드',
  builderHint: '소켓을 눌러 부품을 장착하고, 장착된 부품을 누르면 빠집니다.',
  clear: '비우기',
  slotAdd: '부품 장착',
  pickerTitle: '부품 선택',
  kinds: {
    CORE: '코어',
    COOLER: '냉각',
    PSU: '전원',
    MODULE: '모듈',
  },

  cost: '비용',
  hash: '해시',
  stability: '안정도',
  heat: '발열',
  cooling: '냉각',
  draw: '소비 전력',
  supply: '공급 전력',

  overBudget: '예산 초과',
  unstable: '스로틀링 중 — 100%가 필요합니다',
  belowTarget: '목표 미달',
  meets: '이 빌드면 해결됩니다',
  addParts: '먼저 코어를 장착하세요',

  submit: '빌드 제출',
  resubmit: '더 나은 빌드 제출',
  solvedTitle: '해결',
  yourResult: '내 결과',
  attempts: '회 시도',
  copy: '결과 복사',
  copied: '복사됨',
  share: '공유',
  shareX: 'X에 올리기',
  shareTelegram: '텔레그램',
  shareWhatsApp: '왓츠앱',
  beat: '오늘 해결한 사람 중 {n}%를 이겼습니다',
  beatAlone: '오늘 가장 먼저 해결했습니다',
  rankLabel: '순위',

  distributionTitle: '다른 사람들이 쓴 비용',
  distributionEmpty: '오늘은 아직 아무도 못 풀었습니다. 1등이 되어 보세요.',
  atCost: '${n}',

  boardTitle: '오늘의 최저 비용 빌드',
  boardEmpty: '오늘은 아직 해답이 없습니다.',
  rank: '#',
  miner: '채굴자',
  build: '빌드',
  you: '나',

  yesterdayTitle: '어제',
  yesterdayEmpty: '어제 퍼즐은 해결한 사람이 없습니다.',

  challengeLinkTitle: '데일리 퍼즐',
  challengeLinkBody: '매일 새로운 예산과 목표, 모두에게 같은 문제.',
  challengeLinkCta: '오늘 퍼즐 풀기',
  navLabel: '데일리',
  navHint: '매일 하나의 공통 빌드 문제',
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Daily puzzle copy for the active locale; falls back to English. */
export function useDaily(): Copy {
  const locale = useLocale();
  return BY_LOCALE[locale] ?? en;
}

/** Fill `{name}` placeholders; this copy bypasses next-intl's interpolation. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? String(values[k]) : m,
  );
}
