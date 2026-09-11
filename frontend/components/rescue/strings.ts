'use client';

import { useLocale } from 'next-intl';

/**
 * Copy for the overheat rescue flow.
 *
 * `en` is written without `as const`, so every leaf infers as `string` and
 * `zh` / `ko` typed as `Copy` fail to compile the moment a key is missing.
 *
 * Brand terms are never translated: VOLTARA, $VLTR, VOLTS, BNB Chain,
 * BEP-20, and the part codes (VC-1, CX-2, PS-3, OD-8).
 */
const en = {
  eyebrow: 'Rig in trouble',
  titleHeat: 'Your rig is cooking',
  titlePower: 'Your rig is starved',
  titleBoth: 'Your rig is cooking and starved',
  losingLabel: 'Bleeding right now',
  losingUnit: 'VOLTS / h',
  stabilityLabel: 'Grid stability',
  /** {n} = percent of the heat the cooling actually covers. */
  diagnosisHeat: 'Your cooling covers only {n}% of the heat your parts make, so every core is throttled to match.',
  diagnosisPower: 'Your supply covers only {n}% of the watts your parts draw, and a brownout cuts output harder than heat does.',
  /** {cool} and {pow} are the two coverage percentages. */
  diagnosisBoth: 'Cooling covers {cool}% of the heat and supply covers {pow}% of the draw. The two penalties multiply.',
  fixLabel: 'The fix',
  fixCooler: 'A CX-2 Vapor Cooler adds 40 TU of cooling and draws 18 W.',
  fixPsu: 'A PS-3 Feeder Unit supplies 260 W and runs almost cold.',
  ctaCooler: 'Cool it down — CX-2, $2',
  ctaPsu: 'Power it up — PS-3, $3',
  share: 'Share the damage',
  shareCopied: 'Link copied',
  /** {n} = current grid stability percent. */
  shareTextHeat: 'My VOLTARA rig is melting — {n}% grid stability and falling. Think you can build better?',
  shareTextPower: 'My VOLTARA rig just browned out at {n}% grid stability. Think you can build better?',
  freeFix: 'No budget? Pull a core out of a slot. A smaller rig at 100% beats a big one at 40%.',
};

type Copy = typeof en;

const zh: Copy = {
  eyebrow: '机架告急',
  titleHeat: '你的机架正在过热',
  titlePower: '你的机架供电不足',
  titleBoth: '你的机架又热又缺电',
  losingLabel: '正在流失',
  losingUnit: 'VOLTS / h',
  stabilityLabel: '电网稳定度',
  diagnosisHeat: '散热只覆盖了部件产生热量的 {n}%，所以每个核心都被相应地降频了。',
  diagnosisPower: '供电只覆盖了部件功耗的 {n}%，而掉电对产出的打击比过热更狠。',
  diagnosisBoth: '散热覆盖热量的 {cool}%，供电覆盖功耗的 {pow}%。两个惩罚会相乘。',
  fixLabel: '解决办法',
  fixCooler: 'CX-2 蒸汽散热器提供 40 TU 散热，功耗 18 W。',
  fixPsu: 'PS-3 供电单元提供 260 W，几乎不发热。',
  ctaCooler: '降降温 — CX-2，$2',
  ctaPsu: '补上电力 — PS-3，$3',
  share: '晒一晒惨状',
  shareCopied: '链接已复制',
  shareTextHeat: '我的 VOLTARA 机架要烧了 — 电网稳定度只剩 {n}% 还在往下掉。你能配得更好吗？',
  shareTextPower: '我的 VOLTARA 机架刚刚掉电了，电网稳定度 {n}%。你能配得更好吗？',
  freeFix: '不想花钱？从插槽里拔掉一个核心。100% 稳定的小机架，胜过 40% 稳定的大机架。',
};

const ko: Copy = {
  eyebrow: '리그 비상',
  titleHeat: '리그가 과열되고 있습니다',
  titlePower: '리그에 전력이 모자랍니다',
  titleBoth: '리그가 과열되고 전력도 모자랍니다',
  losingLabel: '지금 새어나가는 양',
  losingUnit: 'VOLTS / h',
  stabilityLabel: '그리드 안정도',
  diagnosisHeat: '냉각이 부품이 내는 발열의 {n}%만 감당하고 있어, 모든 코어가 그만큼 제한됩니다.',
  diagnosisPower: '공급이 부품 소비 전력의 {n}%만 감당하고 있습니다. 전력 부족은 발열보다 더 크게 출력을 깎습니다.',
  diagnosisBoth: '냉각은 발열의 {cool}%, 공급은 소비 전력의 {pow}%를 감당합니다. 두 페널티는 곱해집니다.',
  fixLabel: '해결책',
  fixCooler: 'CX-2 베이퍼 쿨러는 냉각 40 TU를 더하고 18 W를 씁니다.',
  fixPsu: 'PS-3 피더 유닛은 260 W를 공급하고 거의 열을 내지 않습니다.',
  ctaCooler: '식히기 — CX-2, $2',
  ctaPsu: '전력 보충 — PS-3, $3',
  share: '이 참사 공유하기',
  shareCopied: '링크 복사됨',
  shareTextHeat: '내 VOLTARA 리그가 녹고 있습니다 — 그리드 안정도 {n}%, 계속 떨어지는 중. 더 잘 만들 수 있나요?',
  shareTextPower: '내 VOLTARA 리그가 방금 전력 부족으로 주저앉았습니다. 그리드 안정도 {n}%. 더 잘 만들 수 있나요?',
  freeFix: '예산이 없다면 슬롯에서 코어를 하나 빼세요. 100%로 도는 작은 리그가 40%짜리 큰 리그를 이깁니다.',
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Rescue copy for the active locale; falls back to English. */
export function useRescue(): Copy {
  const locale = useLocale();
  return BY_LOCALE[locale] ?? en;
}

/**
 * Substitutes `{name}` placeholders. This copy bypasses next-intl, so it
 * needs its own one-line interpolation.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}
