import { useI18n } from '../../i18n';

/**
 * Copy for the daily rig puzzle.
 *
 * Same shape as the other feature catalogues: `en` is the source, `zh` and
 * `ko` are typed against it so a missing translation is a compile error
 * rather than a blank label on a phone.
 *
 * Brand terms stay untranslated: VOLTARA, $VLTR, VOLTS, and the part codes.
 */
const en = {
  navTitle: 'Daily puzzle',
  navSubtitle: 'The same problem for everyone, every day',
  offline: 'The grid is unreachable right now.',

  puzzleNo: 'Puzzle',
  budget: 'Budget',
  target: 'Target',
  perHour: '/h',
  solvers: '{n} solved it',
  endsIn: 'Resets in',
  ended: 'Resetting…',

  builderTitle: 'Your build',
  builderHint: 'Tap a socket to fit a part, tap a fitted part to pull it out.',
  clear: 'Clear',
  emptySlot: 'Empty',
  pickPart: 'Choose a part',
  kindCores: 'Cores',
  kindCooling: 'Cooling',
  kindPower: 'Power',
  kindModules: 'Modules',

  cost: 'Cost',
  hash: 'Hash',
  stability: 'Stability',
  heatVsCooling: 'Heat vs cooling',
  drawVsSupply: 'Draw vs supply',

  addParts: 'Fit a core to begin',
  overBudget: 'Over budget',
  unstable: 'Throttling — needs 100%',
  belowTarget: 'Below target',
  meets: 'This one solves it',

  submit: 'Submit build',
  update: 'Submit a better build',
  solved: 'Solved',
  yourResult: 'Your result',
  attempts: '{n} attempts',
  rankLabel: 'Rank #{n}',
  copy: 'Copy result',
  copied: 'Copied',
  share: 'Share',
  beat: 'You beat {n}% of today’s solvers',
  beatAlone: 'First one home today',

  boardTitle: 'Today’s cheapest builds',
  boardEmpty: 'No solutions yet',
  boardEmptyBody: 'Nobody has cracked today’s puzzle. Go first.',
  you: 'You',
  yesterday: 'Yesterday',
  yesterdayEmpty: 'Yesterday had no solvers.',

  linkTitle: 'Daily puzzle',
  linkBody: 'A fresh budget and target every day.',
};

/** Same keys as `en`, with plain strings so a translation may differ. */
type Copy = { [K in keyof typeof en]: string };

const zh: Copy = {
  navTitle: '每日谜题',
  navSubtitle: '每天一道题，所有人都一样',
  offline: '暂时连不上电网。',

  puzzleNo: '第',
  budget: '预算',
  target: '目标',
  perHour: '/小时',
  solvers: '{n} 人已解出',
  endsIn: '重置于',
  ended: '正在重置…',

  builderTitle: '你的配置',
  builderHint: '点击插槽装入部件，点击已装部件将其取出。',
  clear: '清空',
  emptySlot: '空槽',
  pickPart: '选择部件',
  kindCores: '核心',
  kindCooling: '散热',
  kindPower: '电源',
  kindModules: '模块',

  cost: '成本',
  hash: '算力',
  stability: '稳定度',
  heatVsCooling: '热量 / 散热',
  drawVsSupply: '功耗 / 供电',

  addParts: '先装一个核心',
  overBudget: '超出预算',
  unstable: '正在降频，需要 100%',
  belowTarget: '未达目标',
  meets: '这套配置能解出',

  submit: '提交配置',
  update: '提交更优配置',
  solved: '已解出',
  yourResult: '你的结果',
  attempts: '{n} 次尝试',
  rankLabel: '排名 #{n}',
  copy: '复制结果',
  copied: '已复制',
  share: '分享',
  beat: '你胜过了今天 {n}% 的解题者',
  beatAlone: '今天第一个解出的人',

  boardTitle: '今日最省配置',
  boardEmpty: '还没有解法',
  boardEmptyBody: '今天还没有人解出，你可以拿第一。',
  you: '你',
  yesterday: '昨天',
  yesterdayEmpty: '昨天无人解出。',

  linkTitle: '每日谜题',
  linkBody: '每天全新的预算与目标。',
};

const ko: Copy = {
  navTitle: '데일리 퍼즐',
  navSubtitle: '매일 모두에게 같은 문제',
  offline: '지금은 그리드에 연결할 수 없습니다.',

  puzzleNo: '퍼즐',
  budget: '예산',
  target: '목표',
  perHour: '/시간',
  solvers: '{n}명이 해결',
  endsIn: '초기화까지',
  ended: '초기화 중…',

  builderTitle: '내 빌드',
  builderHint: '소켓을 눌러 부품을 장착하고, 장착된 부품을 누르면 빠집니다.',
  clear: '비우기',
  emptySlot: '빈 소켓',
  pickPart: '부품 선택',
  kindCores: '코어',
  kindCooling: '냉각',
  kindPower: '전원',
  kindModules: '모듈',

  cost: '비용',
  hash: '해시',
  stability: '안정도',
  heatVsCooling: '발열 대비 냉각',
  drawVsSupply: '소비 대비 공급',

  addParts: '먼저 코어를 장착하세요',
  overBudget: '예산 초과',
  unstable: '스로틀링 중 — 100% 필요',
  belowTarget: '목표 미달',
  meets: '이 빌드면 해결됩니다',

  submit: '빌드 제출',
  update: '더 나은 빌드 제출',
  solved: '해결',
  yourResult: '내 결과',
  attempts: '{n}회 시도',
  rankLabel: '{n}위',
  copy: '결과 복사',
  copied: '복사됨',
  share: '공유',
  beat: '오늘 해결한 사람 중 {n}%를 이겼습니다',
  beatAlone: '오늘 가장 먼저 해결했습니다',

  boardTitle: '오늘의 최저 비용 빌드',
  boardEmpty: '아직 해답이 없습니다',
  boardEmptyBody: '오늘 퍼즐을 푼 사람이 없습니다. 1등이 되어 보세요.',
  you: '나',
  yesterday: '어제',
  yesterdayEmpty: '어제는 해결한 사람이 없습니다.',

  linkTitle: '데일리 퍼즐',
  linkBody: '매일 새로운 예산과 목표.',
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Daily puzzle copy for the active locale; falls back to English. */
export function useDaily(): Copy {
  const { locale } = useI18n();
  return BY_LOCALE[locale] ?? en;
}

/** Fill `{name}` placeholders, matching the shared catalogue's behaviour. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
