import { useI18n } from '../../i18n';

/**
 * Copy for the grid features (events, overclock, salvage, craft, skins).
 *
 * Kept out of the shared catalogues so the three locale files do not have
 * to move in step with a feature that is still settling. Typing `zh` and
 * `ko` as `Copy` makes a missing translation a compile error rather than a
 * blank label on a phone.
 *
 * Brand terms stay untranslated: VOLTARA, $VLTR, VOLTS, and the part codes.
 */
const en = {
  eventActive: 'Grid event',
  eventUpcoming: 'Next event',
  eventEndsIn: 'ends in',
  eventStartsIn: 'starts in',
  heat: 'heat',
  draw: 'draw',
  hash: 'hash',

  overclockTitle: 'Overclock',
  overclockBody: '+40% hash, +80% core heat. Every hour it runs, one part may burn for 48h.',
  overclockOn: 'Engage overclock',
  overclockOff: 'Stop overclock',
  overclockRunning: 'Overclock running',
  overclockNeedsCore: 'Install a core first.',
  overclockRate: 'Rate',
  overclockStability: 'Stability',
  overclockRisk: 'Burn risk: 15% per hour',

  burned: 'BURNED',
  burnedFor: 'burned',

  scrap: 'Scrap',
  craft: 'Craft (3 scrap)',
  craftTitle: 'Part crafted',
  craftBody: 'Three scrap became one random part.',
  craftInstalled: 'Installed in slot',
  craftInventory: 'Sent to inventory',
  salvage: 'Salvage',
  salvaged: 'Salvaged',

  skinsTitle: 'Chassis skin',
  skinsHint: 'Cosmetic. Shows on your rig and rig card.',
  equip: 'Equip',
  equipped: 'Equipped',
  buy: 'Buy',
  volts: 'VOLTS',
  gridHolding: 'Grid holding',
  gridBonus: 'for everyone',
  weatherHarder: 'coolers working {n}% harder',
  weatherEasier: 'coolers working {n}% easier',
} as const;

/** Same keys as `en`, but each value is a plain string so a translation
 *  may differ from the English literal. */
type Copy = { [K in keyof typeof en]: string };

const zh: Copy = {
  eventActive: '电网事件',
  eventUpcoming: '下次事件',
  eventEndsIn: '结束于',
  eventStartsIn: '开始于',
  heat: '热量',
  draw: '功耗',
  hash: '算力',

  overclockTitle: '超频',
  overclockBody: '算力 +40%，核心热量 +80%。每运行一小时，可能有一个部件烧毁 48 小时。',
  overclockOn: '启动超频',
  overclockOff: '停止超频',
  overclockRunning: '超频运行中',
  overclockNeedsCore: '请先安装一个核心。',
  overclockRate: '速率',
  overclockStability: '稳定度',
  overclockRisk: '烧毁风险：每小时 15%',

  burned: '已烧毁',
  burnedFor: '烧毁',

  scrap: '零件废料',
  craft: '合成（3 废料）',
  craftTitle: '合成完成',
  craftBody: '三份废料合成了一个随机部件。',
  craftInstalled: '已装入插槽',
  craftInventory: '已存入仓库',
  salvage: '拆解',
  salvaged: '已拆解',

  skinsTitle: '机架皮肤',
  skinsHint: '仅外观。会显示在你的机架和分享卡上。',
  equip: '装备',
  equipped: '已装备',
  buy: '购买',
  volts: 'VOLTS',
  gridHolding: '电网稳住了',
  gridBonus: '全员共享',
  weatherHarder: '散热器多费力 {n}%',
  weatherEasier: '散热器省力 {n}%',
};

const ko: Copy = {
  eventActive: '그리드 이벤트',
  eventUpcoming: '다음 이벤트',
  eventEndsIn: '종료까지',
  eventStartsIn: '시작까지',
  heat: '발열',
  draw: '소비 전력',
  hash: '해시',

  overclockTitle: '오버클럭',
  overclockBody: '해시 +40%, 코어 발열 +80%. 한 시간마다 부품 하나가 48시간 동안 타버릴 수 있습니다.',
  overclockOn: '오버클럭 시작',
  overclockOff: '오버클럭 중지',
  overclockRunning: '오버클럭 작동 중',
  overclockNeedsCore: '먼저 코어를 장착하세요.',
  overclockRate: '채굴 속도',
  overclockStability: '안정도',
  overclockRisk: '소손 위험: 시간당 15%',

  burned: '소손',
  burnedFor: '소손',

  scrap: '스크랩',
  craft: '제작 (스크랩 3)',
  craftTitle: '부품 제작 완료',
  craftBody: '스크랩 3개가 무작위 부품 하나가 되었습니다.',
  craftInstalled: '슬롯에 장착됨',
  craftInventory: '보관함으로 이동',
  salvage: '해체',
  salvaged: '해체 완료',

  skinsTitle: '섀시 스킨',
  skinsHint: '외형 전용. 내 리그와 공유 카드에 표시됩니다.',
  equip: '장착',
  equipped: '장착됨',
  buy: '구매',
  volts: 'VOLTS',
  gridHolding: '그리드 유지 중',
  gridBonus: '모두에게',
  weatherHarder: '쿨러가 {n}% 더 일하는 중',
  weatherEasier: '쿨러가 {n}% 덜 일하는 중',
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Fill `{name}` placeholders — this copy bypasses the shared catalogue. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in values ? String(values[k]) : m,
  );
}

/** Grid copy for the active locale; falls back to English. */
export function useGrid(): Copy {
  const { locale } = useI18n();
  return BY_LOCALE[locale] ?? en;
}

/**
 * English copy, for the handful of call sites that read it outside a
 * component. Prefer `useGrid()` anywhere a hook is allowed.
 */
export const GRID = en;
