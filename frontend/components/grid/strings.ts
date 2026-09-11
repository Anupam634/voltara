'use client';

import { useLocale } from 'next-intl';

/**
 * UI copy for the grid features (events, live map, overclock, salvage,
 * craft, skins). Kept here rather than in messages/*.json so the three
 * locale catalogues are not edited by several features at once; fold these
 * into the catalogues when the copy settles.
 *
 * `en` is deliberately NOT `as const` — widening the values to `string` is
 * what lets `zh` and `ko` be typed as `Copy`, so TypeScript fails the build
 * on a key that was added to one locale and forgotten in another.
 */
const en = {
  event: {
    liveNow: 'Grid event live',
    endsIn: 'Ends in',
    nextIn: 'Next event in',
    heat: 'heat',
    draw: 'draw',
    hash: 'hash',
    recentTitle: 'Recent events',
  },
  map: {
    eyebrow: 'The grid, live',
    title: 'Every rig on the grid, right now',
    subtitle:
      'One dot per country. Size is how many miners are there, colour is how many of their rigs hold 100% stability.',
    totalRigs: 'Rigs',
    onlineNow: 'Online now',
    stable: 'Stable',
    activeWeek: 'Active this week',
    loading: 'Reading the grid…',
    offline: 'The grid feed is unreachable right now.',
    miners: 'miners',
    stableShort: 'stable',
    legendStable: '≥ 90% stable',
    legendWarm: '60–89%',
    legendHot: '< 60%',
  },
  overclock: {
    eyebrow: 'Overclock',
    title: 'Push the cores',
    body: 'Cores make 40% more hash and 80% more heat. Every hour it stays on, one installed part can burn and sit dead for 48 hours.',
    on: 'Overclock ON',
    off: 'Overclock is off',
    engage: 'Engage overclock',
    disengage: 'Stand down',
    needsCore: 'Install a core first',
    rate: 'Rate',
    stability: 'Stability',
    endsIn: 'Auto-off in',
    burnRisk: 'Burn risk: 15% per hour, per roll.',
    worthIt: 'Worth it — cooling headroom covers the extra heat.',
    notWorthIt: 'Not worth it — the extra heat throttles more than the hash gains.',
    hashTrade: 'hash',
    heatTrade: 'heat',
  },
  parts: {
    burned: 'Burned',
    burnedFor: 'Burned',
    salvage: 'Salvage',
    salvaging: 'Salvaging…',
    scrap: 'Scrap',
    craft: 'Craft',
    craftCost: '3 scrap',
    crafting: 'Forging…',
    craftedTitle: 'Fresh from the forge',
    craftedBody: 'A random 30-day part, built from your scrap.',
    craftedInstalled: 'Installed in slot',
    craftedInventory: 'Waiting in inventory — your rig is full.',
    close: 'Close',
    salvageHint: 'Expired, burned or nearly spent parts can be salvaged for scrap.',
  },
  skins: {
    eyebrow: 'Chassis skins',
    title: 'Dress the rig',
    body: 'Cosmetic only. Shows on your rig and on your rig card.',
    equipped: 'Equipped',
    equip: 'Equip',
    owned: 'Owned',
    buy: 'Buy',
    free: 'Free',
    volts: 'VOLTS',
    loading: 'Loading skins…',
  },
  pulse: {
    eyebrow: 'The grid, together',
    holding: 'The grid is holding',
    holdingBody: 'Enough rigs are at full stability, so every miner earns {bonus}% more hash right now.',
    slipping: 'The grid is slipping',
    slippingBody: 'When {threshold}% of active rigs hold 100% stability, every miner earns {bonus}% more hash. {gap} points to go.',
    stableNow: 'stable now',
    target: 'target',
    activeRigs: 'active rigs',
    bonusChip: '+{bonus}% for everyone',
    loading: 'Reading the grid…',
    offline: 'The grid feed is unreachable right now.',
  },
  weather: {
    label: 'Local weather',
    harder: 'coolers working {n}% harder',
    easier: 'coolers working {n}% easier',
    neutral: 'coolers running as specified',
  },
};

type Copy = typeof en;

const zh: Copy = {
  event: {
    liveNow: '电网事件进行中',
    endsIn: '剩余',
    nextIn: '下次事件',
    heat: '热量',
    draw: '功耗',
    hash: '算力',
    recentTitle: '近期事件',
  },
  map: {
    eyebrow: '实时电网',
    title: '此刻电网上的每一台矿机',
    subtitle:
      '每个国家一个光点。大小代表矿工数量，颜色代表其中有多少矿机保持 100% 稳定度。',
    totalRigs: '矿机',
    onlineNow: '在线',
    stable: '稳定',
    activeWeek: '本周活跃',
    loading: '正在读取电网…',
    offline: '暂时无法连接电网数据。',
    miners: '位矿工',
    stableShort: '稳定',
    legendStable: '≥ 90% 稳定',
    legendWarm: '60–89%',
    legendHot: '< 60%',
  },
  overclock: {
    eyebrow: '超频',
    title: '压榨核心',
    body: '核心算力 +40%，发热 +80%。每开启一小时，就有一个已安装部件可能烧毁并停摆 48 小时。',
    on: '超频已开启',
    off: '超频已关闭',
    engage: '开启超频',
    disengage: '关闭超频',
    needsCore: '请先安装核心',
    rate: '速率',
    stability: '稳定度',
    endsIn: '自动关闭',
    burnRisk: '烧毁风险：每小时判定一次，概率 15%。',
    worthIt: '值得开启 — 散热余量能吃下多出的热量。',
    notWorthIt: '不划算 — 多出的热量导致的降频超过了算力收益。',
    hashTrade: '算力',
    heatTrade: '热量',
  },
  parts: {
    burned: '已烧毁',
    burnedFor: '已烧毁',
    salvage: '拆解',
    salvaging: '拆解中…',
    scrap: '废料',
    craft: '合成',
    craftCost: '3 废料',
    crafting: '锻造中…',
    craftedTitle: '刚刚出炉',
    craftedBody: '用你的废料合成的随机 30 天部件。',
    craftedInstalled: '已装入插槽',
    craftedInventory: '已放入库存 — 矿机插槽已满。',
    close: '关闭',
    salvageHint: '已过期、已烧毁或即将到期的部件可拆解为废料。',
  },
  skins: {
    eyebrow: '机架皮肤',
    title: '装扮你的矿机',
    body: '仅外观。显示在你的矿机和矿机名片上。',
    equipped: '已装备',
    equip: '装备',
    owned: '已拥有',
    buy: '购买',
    free: '免费',
    volts: 'VOLTS',
    loading: '正在加载皮肤…',
  },
  pulse: {
    eyebrow: '整个电网',
    holding: '电网稳住了',
    holdingBody: '足够多的矿机处于满稳定度，现在每位矿工的算力都多 {bonus}%。',
    slipping: '电网正在下滑',
    slippingBody: '当 {threshold}% 的活跃矿机保持 100% 稳定度时，每位矿工算力 +{bonus}%。还差 {gap} 个百分点。',
    stableNow: '当前稳定',
    target: '目标',
    activeRigs: '活跃矿机',
    bonusChip: '全员 +{bonus}%',
    loading: '正在读取电网…',
    offline: '目前无法连接电网数据。',
  },
  weather: {
    label: '当地天气',
    harder: '散热器多费力 {n}%',
    easier: '散热器省力 {n}%',
    neutral: '散热器按标称运行',
  },
};

const ko: Copy = {
  event: {
    liveNow: '그리드 이벤트 진행 중',
    endsIn: '종료까지',
    nextIn: '다음 이벤트까지',
    heat: '발열',
    draw: '전력',
    hash: '해시',
    recentTitle: '최근 이벤트',
  },
  map: {
    eyebrow: '실시간 그리드',
    title: '지금 그리드 위의 모든 리그',
    subtitle:
      '국가당 점 하나. 크기는 채굴자 수, 색은 그중 100% 안정도를 유지하는 리그의 비율입니다.',
    totalRigs: '리그',
    onlineNow: '현재 접속',
    stable: '안정',
    activeWeek: '이번 주 활동',
    loading: '그리드를 읽는 중…',
    offline: '지금은 그리드 피드에 연결할 수 없습니다.',
    miners: '명',
    stableShort: '안정',
    legendStable: '≥ 90% 안정',
    legendWarm: '60–89%',
    legendHot: '< 60%',
  },
  overclock: {
    eyebrow: '오버클럭',
    title: '코어를 밀어붙이기',
    body: '코어 해시 +40%, 발열 +80%. 켜져 있는 매시간마다 장착된 부품 하나가 타서 48시간 동안 멈출 수 있습니다.',
    on: '오버클럭 ON',
    off: '오버클럭 꺼짐',
    engage: '오버클럭 시작',
    disengage: '중단하기',
    needsCore: '먼저 코어를 장착하세요',
    rate: '속도',
    stability: '안정도',
    endsIn: '자동 종료까지',
    burnRisk: '소손 위험: 매시간 판정, 15%.',
    worthIt: '해볼 만합니다 — 냉각 여유가 추가 발열을 감당합니다.',
    notWorthIt: '손해입니다 — 추가 발열로 인한 감속이 해시 이득보다 큽니다.',
    hashTrade: '해시',
    heatTrade: '발열',
  },
  parts: {
    burned: '소손',
    burnedFor: '소손',
    salvage: '해체',
    salvaging: '해체 중…',
    scrap: '고철',
    craft: '제작',
    craftCost: '고철 3',
    crafting: '제작 중…',
    craftedTitle: '방금 제작 완료',
    craftedBody: '고철로 만든 무작위 30일 부품입니다.',
    craftedInstalled: '장착된 슬롯',
    craftedInventory: '보관함에 대기 중 — 리그가 가득 찼습니다.',
    close: '닫기',
    salvageHint: '만료·소손되었거나 수명이 얼마 남지 않은 부품은 고철로 해체할 수 있습니다.',
  },
  skins: {
    eyebrow: '섀시 스킨',
    title: '리그 꾸미기',
    body: '외형 전용. 리그와 리그 카드에 표시됩니다.',
    equipped: '장착됨',
    equip: '장착',
    owned: '보유 중',
    buy: '구매',
    free: '무료',
    volts: 'VOLTS',
    loading: '스킨 불러오는 중…',
  },
  pulse: {
    eyebrow: '그리드 전체',
    holding: '그리드가 버티고 있습니다',
    holdingBody: '충분한 리그가 완전 안정 상태라, 지금 모든 채굴자의 해시가 {bonus}% 늘어납니다.',
    slipping: '그리드가 흔들립니다',
    slippingBody: '활성 리그의 {threshold}%가 안정도 100%를 유지하면 모두의 해시가 {bonus}% 늘어납니다. {gap}포인트 남았습니다.',
    stableNow: '현재 안정',
    target: '목표',
    activeRigs: '활성 리그',
    bonusChip: '모두 +{bonus}%',
    loading: '그리드 읽는 중…',
    offline: '지금은 그리드 데이터를 가져올 수 없습니다.',
  },
  weather: {
    label: '현지 날씨',
    harder: '쿨러가 {n}% 더 일하는 중',
    easier: '쿨러가 {n}% 덜 일하는 중',
    neutral: '쿨러가 사양대로 작동 중',
  },
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Fill `{name}` placeholders — this copy does not go through next-intl. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? String(values[k]) : m,
  );
}

/** Copy for the active locale; falls back to English. */
export function useS(): Copy {
  const locale = useLocale();
  return BY_LOCALE[locale] ?? en;
}

/** English copy, for anything that cannot call a hook. */
export const S = en;
