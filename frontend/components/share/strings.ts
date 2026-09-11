'use client';

import { useLocale } from 'next-intl';

/**
 * Copy for the rig card: the public share landing, and the text that goes
 * out with a shared link.
 *
 * `en` is written without `as const`, so every leaf infers as `string` and
 * `zh` / `ko` typed as `Copy` fail to compile the moment a key is missing.
 *
 * Brand terms are never translated: VOLTARA, $VLTR, VOLTS, BNB Chain,
 * BEP-20, and the part codes (VC-1, CX-2, PS-3, OD-8).
 */
const en = {
  landing: {
    eyebrow: 'Shared rig',
    titleOwned: 'This is {name}’s rig',
    subtitle:
      'Six slots, real running costs. Cores make heat, coolers cost watts, and GRID STABILITY multiplies everything the rig earns.',
    rate: 'Mining rate',
    stability: 'Grid stability',
    parts: 'Parts running',
    streak: 'Day streak',
    slotsTitle: 'The build',
    empty: 'Empty',
    cta: 'Beat this rig',
    ctaNote: 'Free chassis, six slots, no hardware. Their invite code is applied for you.',
    signedIn: 'You already mine on VOLTARA.',
    toDashboard: 'Go to my rig',
    loading: 'Reading the grid…',
    missingTitle: 'That rig is not on the grid',
    missingBody:
      'The link may be old, or the miner may have left. You can still start your own rig.',
    missingCta: 'Start mining',
    howTitle: 'How it works',
    how1: 'Socket cores, coolers and PSUs into six slots.',
    how2: 'Cooling that does not cover the heat throttles the whole rig.',
    how3: 'VOLTS convert to $VLTR on BNB Chain.',
  },
  share: {
    // {rate} and {stability} are filled from the miner's own rig.
    text: 'My VOLTARA rig is running at {rate} VOLTS/h at {stability}% grid stability. Beat it:',
    textNoRig: 'I am building a rig on VOLTARA. Come build yours:',
    copy: 'Copy rig link',
    copied: 'Rig link copied',
    title: 'Share your rig',
    hint: 'The link unfurls as a card showing your build, not a plain invite.',
    preview: 'Preview card',
  },
};

type Copy = typeof en;

const zh: Copy = {
  landing: {
    eyebrow: '分享的机架',
    titleOwned: '这是 {name} 的机架',
    subtitle:
      '六个插槽，真实的运行成本。核心产生热量，散热器消耗电力，而电网稳定度会成倍影响机架的全部收益。',
    rate: '挖矿速率',
    stability: '电网稳定度',
    parts: '运行中的部件',
    streak: '连续天数',
    slotsTitle: '这套配置',
    empty: '空置',
    cta: '挑战这台机架',
    ctaNote: '免费机架，六个插槽，无需硬件。已自动为你应用他的邀请码。',
    signedIn: '你已经在 VOLTARA 挖矿了。',
    toDashboard: '前往我的机架',
    loading: '正在读取电网…',
    missingTitle: '电网上找不到这台机架',
    missingBody: '链接可能已过期，或这位矿工已经离开。你仍然可以开始自己的机架。',
    missingCta: '开始挖矿',
    howTitle: '玩法说明',
    how1: '把核心、散热器和电源装进六个插槽。',
    how2: '散热跟不上热量，整台机架就会降速。',
    how3: 'VOLTS 可在 BNB Chain 上兑换为 $VLTR。',
  },
  share: {
    text: '我的 VOLTARA 机架正以 {rate} VOLTS/小时运行，电网稳定度 {stability}%。来挑战一下：',
    textNoRig: '我正在 VOLTARA 上搭建机架。你也来试试：',
    copy: '复制机架链接',
    copied: '机架链接已复制',
    title: '分享你的机架',
    hint: '这个链接展开后是一张显示你配置的卡片，而不是一条普通邀请。',
    preview: '预览卡片',
  },
};

const ko: Copy = {
  landing: {
    eyebrow: '공유된 리그',
    titleOwned: '{name} 님의 리그입니다',
    subtitle:
      '슬롯 여섯 개와 실제 운영 비용. 코어는 열을 만들고 쿨러는 전력을 먹으며, 그리드 안정도가 리그의 모든 수익에 곱해집니다.',
    rate: '채굴 속도',
    stability: '그리드 안정도',
    parts: '가동 중인 부품',
    streak: '연속 일수',
    slotsTitle: '이 빌드',
    empty: '빈 슬롯',
    cta: '이 리그를 이겨보세요',
    ctaNote: '무료 섀시, 슬롯 6개, 하드웨어 불필요. 초대 코드가 자동으로 적용됩니다.',
    signedIn: '이미 VOLTARA에서 채굴 중입니다.',
    toDashboard: '내 리그로 이동',
    loading: '그리드를 읽는 중…',
    missingTitle: '그리드에 없는 리그입니다',
    missingBody: '링크가 오래됐거나 채굴자가 떠났을 수 있습니다. 그래도 내 리그는 시작할 수 있습니다.',
    missingCta: '채굴 시작하기',
    howTitle: '작동 방식',
    how1: '코어와 쿨러, PSU를 슬롯 여섯 개에 장착합니다.',
    how2: '냉각이 발열을 감당하지 못하면 리그 전체가 느려집니다.',
    how3: 'VOLTS는 BNB Chain에서 $VLTR로 전환됩니다.',
  },
  share: {
    text: '제 VOLTARA 리그가 그리드 안정도 {stability}%로 시간당 {rate} VOLTS를 캐고 있습니다. 이겨보세요:',
    textNoRig: 'VOLTARA에서 리그를 만들고 있습니다. 같이 시작해요:',
    copy: '리그 링크 복사',
    copied: '리그 링크 복사됨',
    title: '내 리그 공유하기',
    hint: '이 링크는 평범한 초대가 아니라 내 빌드를 보여주는 카드로 펼쳐집니다.',
    preview: '카드 미리보기',
  },
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Share copy for the active locale; falls back to English. */
export function useShare(): Copy {
  const locale = useLocale();
  return BY_LOCALE[locale] ?? en;
}

/** English copy, for the few call sites that read it outside a component. */
export const SHARE_EN = en;

/** Replace `{name}`-style placeholders. This copy bypasses next-intl. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/**
 * The path a shared rig link points at.
 *
 * Kept here so the web share buttons, the mobile app and the metadata all
 * agree on one shape; `?ref=` on the sign-up link is what actually registers
 * the referral, and that still happens from the landing page's CTA.
 */
export function rigCardPath(locale: string, code: string): string {
  return `/${locale}/r/${encodeURIComponent(code)}`;
}
