import { useI18n } from '../../i18n';

/**
 * Copy for the player part market and the weekly blueprint challenge.
 *
 * Kept out of the shared catalogues so the three locale files do not have to
 * move in step with a feature that is still settling. Typing `zh` and `ko` as
 * `Copy` makes a missing translation a compile error rather than a blank
 * label on a phone.
 *
 * Brand terms stay untranslated: VOLTARA, $VLTR, VOLTS, and the part codes.
 */
const en = {
  /* ── Player market ── */
  marketTitle: 'Player market',
  marketSubtitle: 'Parts other miners are selling, priced in VOLTS.',
  marketLinkTitle: 'Player market',
  marketLinkBody: 'Buy parts from other miners',

  filterAll: 'All',
  filterCores: 'Cores',
  filterCooling: 'Cooling',
  filterPower: 'Power',
  filterModules: 'Modules',

  listingsEmpty: 'Nothing listed',
  listingsEmptyBody: 'No miner is selling this kind of part right now.',

  seller: 'Seller',
  daysLeft: '{days}d left',
  tier: 'Tier {tier}',
  buy: 'Buy',
  volts: 'VOLTS',

  buyTitle: 'Buy this part?',
  buyBody: '{name} for {price} VOLTS.',
  balance: 'Your balance',
  balanceAfter: 'After purchase',
  notEnough: 'You need {short} more VOLTS.',
  confirm: 'Buy',
  cancel: 'Cancel',
  boughtInstalled: 'Installed in slot {slot}',
  boughtInventory: 'Sent to inventory',

  sellCta: 'Sell a part',
  sellTitle: 'Sell a part',
  sellHint: 'Only uninstalled parts with more than 3 days left can be listed.',
  sellEmpty: 'Nothing to sell',
  sellEmptyBody: 'Uninstall a part with more than 3 days left to list it.',
  priceLabel: 'Price in VOLTS',
  pricePlaceholder: '250',
  fee: 'Market fee (5%)',
  net: 'You receive',
  listIt: 'List for sale',
  listed: 'Listed for sale',

  myListings: 'My listings',
  selling: 'Selling',
  sold: 'Sold',
  bought: 'Bought',
  cancelListing: 'Cancel',
  cancelledListing: 'Listing cancelled',
  soldFor: 'Sold for {price} VOLTS',
  boughtFor: 'Bought for {price} VOLTS',

  /* ── Weekly blueprint ── */
  challengeTitle: 'Weekly blueprint',
  challengeSubtitle: 'Cheapest rig that hits the target at 100% stability.',
  challengeLink: 'Weekly blueprint challenge',

  target: 'Target',
  perHour: '/h',
  submissions: '{n} builds',
  endsIn: 'Ends in',
  closed: 'This week has closed.',
  rewards: 'Rewards',
  first: '1st',
  second: '2nd',
  third: '3rd',

  builderTitle: 'Your build',
  builderHint: 'Tap a socket to fit a part.',
  emptySlot: 'Empty',
  pickPart: 'Choose a part',
  clear: 'Clear',

  readout: 'Readout',
  cost: 'Cost',
  hash: 'Hash',
  stability: 'Stability',
  heatVsCooling: 'Heat vs cooling',
  drawVsSupply: 'Draw vs supply',
  meets: 'Meets the target',
  belowTarget: 'Below the target hash',
  unstable: 'Not stable at 100%',
  addParts: 'Add at least one core',

  submit: 'Submit build',
  update: 'Update build',
  submitted: 'Submitted — rank {rank}',

  boardTitle: 'This week',
  boardEmpty: 'No builds yet',
  boardEmptyBody: 'Be the first to submit one.',
  you: 'You',
  lastWeek: 'Last week',
  noWinners: 'No winners last week.',

  kindCores: 'Cores',
  kindCooling: 'Cooling',
  kindPower: 'Power',
  kindModules: 'Modules',
} as const;

type Copy = { [K in keyof typeof en]: string };

const zh: Copy = {
  marketTitle: '玩家交易市场',
  marketSubtitle: '其他矿工出售的部件，以 VOLTS 计价。',
  marketLinkTitle: '玩家交易市场',
  marketLinkBody: '从其他矿工手中购买部件',

  filterAll: '全部',
  filterCores: '核心',
  filterCooling: '散热',
  filterPower: '供电',
  filterModules: '模块',

  listingsEmpty: '暂无挂单',
  listingsEmptyBody: '目前没有矿工出售这类部件。',

  seller: '卖家',
  daysLeft: '剩余 {days} 天',
  tier: '{tier} 级',
  buy: '购买',
  volts: 'VOLTS',

  buyTitle: '确认购买该部件？',
  buyBody: '{name}，售价 {price} VOLTS。',
  balance: '你的余额',
  balanceAfter: '购买后余额',
  notEnough: '还差 {short} VOLTS。',
  confirm: '购买',
  cancel: '取消',
  boughtInstalled: '已装入插槽 {slot}',
  boughtInventory: '已存入仓库',

  sellCta: '出售部件',
  sellTitle: '出售部件',
  sellHint: '仅未安装且剩余超过 3 天的部件可以挂单。',
  sellEmpty: '没有可出售的部件',
  sellEmptyBody: '先卸下一个剩余超过 3 天的部件再挂单。',
  priceLabel: '价格（VOLTS）',
  pricePlaceholder: '250',
  fee: '市场手续费（5%）',
  net: '你将收到',
  listIt: '挂单出售',
  listed: '已挂单出售',

  myListings: '我的挂单',
  selling: '出售中',
  sold: '已售出',
  bought: '已购买',
  cancelListing: '撤单',
  cancelledListing: '挂单已撤销',
  soldFor: '以 {price} VOLTS 售出',
  boughtFor: '以 {price} VOLTS 购入',

  challengeTitle: '每周蓝图挑战',
  challengeSubtitle: '在 100% 稳定度下达成目标的最便宜机架。',
  challengeLink: '每周蓝图挑战',

  target: '目标',
  perHour: '/小时',
  submissions: '{n} 份方案',
  endsIn: '结束于',
  closed: '本周已结束。',
  rewards: '奖励',
  first: '第 1 名',
  second: '第 2 名',
  third: '第 3 名',

  builderTitle: '你的方案',
  builderHint: '点击插槽装入部件。',
  emptySlot: '空',
  pickPart: '选择部件',
  clear: '清空',

  readout: '读数',
  cost: '成本',
  hash: '算力',
  stability: '稳定度',
  heatVsCooling: '热量 / 散热',
  drawVsSupply: '功耗 / 供电',
  meets: '已达成目标',
  belowTarget: '算力低于目标',
  unstable: '稳定度未达 100%',
  addParts: '至少装入一个核心',

  submit: '提交方案',
  update: '更新方案',
  submitted: '已提交 — 第 {rank} 名',

  boardTitle: '本周排行',
  boardEmpty: '暂无方案',
  boardEmptyBody: '成为第一个提交的人。',
  you: '你',
  lastWeek: '上周',
  noWinners: '上周没有获胜者。',

  kindCores: '核心',
  kindCooling: '散热',
  kindPower: '供电',
  kindModules: '模块',
};

const ko: Copy = {
  marketTitle: '플레이어 마켓',
  marketSubtitle: '다른 채굴자가 VOLTS로 판매 중인 부품입니다.',
  marketLinkTitle: '플레이어 마켓',
  marketLinkBody: '다른 채굴자에게서 부품 구매',

  filterAll: '전체',
  filterCores: '코어',
  filterCooling: '냉각',
  filterPower: '전원',
  filterModules: '모듈',

  listingsEmpty: '등록된 매물 없음',
  listingsEmptyBody: '지금 이 종류의 부품을 파는 채굴자가 없습니다.',

  seller: '판매자',
  daysLeft: '{days}일 남음',
  tier: '{tier}등급',
  buy: '구매',
  volts: 'VOLTS',

  buyTitle: '이 부품을 구매할까요?',
  buyBody: '{name} · {price} VOLTS.',
  balance: '내 잔액',
  balanceAfter: '구매 후 잔액',
  notEnough: '{short} VOLTS가 더 필요합니다.',
  confirm: '구매',
  cancel: '취소',
  boughtInstalled: '{slot}번 슬롯에 장착됨',
  boughtInventory: '보관함으로 이동',

  sellCta: '부품 판매',
  sellTitle: '부품 판매',
  sellHint: '장착하지 않았고 3일 넘게 남은 부품만 등록할 수 있습니다.',
  sellEmpty: '판매할 부품 없음',
  sellEmptyBody: '3일 넘게 남은 부품을 해제한 뒤 등록하세요.',
  priceLabel: '가격 (VOLTS)',
  pricePlaceholder: '250',
  fee: '마켓 수수료 (5%)',
  net: '받는 금액',
  listIt: '판매 등록',
  listed: '판매 등록 완료',

  myListings: '내 매물',
  selling: '판매 중',
  sold: '판매 완료',
  bought: '구매함',
  cancelListing: '등록 취소',
  cancelledListing: '등록이 취소되었습니다',
  soldFor: '{price} VOLTS에 판매',
  boughtFor: '{price} VOLTS에 구매',

  challengeTitle: '주간 블루프린트',
  challengeSubtitle: '안정도 100%로 목표를 달성하는 가장 저렴한 리그.',
  challengeLink: '주간 블루프린트 챌린지',

  target: '목표',
  perHour: '/시간',
  submissions: '빌드 {n}개',
  endsIn: '종료까지',
  closed: '이번 주는 마감되었습니다.',
  rewards: '보상',
  first: '1위',
  second: '2위',
  third: '3위',

  builderTitle: '내 빌드',
  builderHint: '소켓을 눌러 부품을 장착하세요.',
  emptySlot: '비어 있음',
  pickPart: '부품 선택',
  clear: '비우기',

  readout: '수치',
  cost: '비용',
  hash: '해시',
  stability: '안정도',
  heatVsCooling: '발열 / 냉각',
  drawVsSupply: '소비 / 공급',
  meets: '목표 달성',
  belowTarget: '해시가 목표에 못 미침',
  unstable: '안정도가 100%가 아님',
  addParts: '코어를 최소 하나 장착하세요',

  submit: '빌드 제출',
  update: '빌드 수정',
  submitted: '제출 완료 — {rank}위',

  boardTitle: '이번 주',
  boardEmpty: '아직 빌드가 없습니다',
  boardEmptyBody: '가장 먼저 제출해 보세요.',
  you: '나',
  lastWeek: '지난주',
  noWinners: '지난주 수상자가 없습니다.',

  kindCores: '코어',
  kindCooling: '냉각',
  kindPower: '전원',
  kindModules: '모듈',
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Market and challenge copy for the active locale; falls back to English. */
export function useMarket(): Copy {
  const { locale } = useI18n();
  return BY_LOCALE[locale] ?? en;
}

/** Replaces `{name}` placeholders, matching the shared catalogue's behaviour. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** English copy, for the rare call site outside a component. */
export const MARKET = en;
