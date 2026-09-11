'use client';

import { useLocale } from 'next-intl';

/**
 * Copy for the landing page's feature showcase.
 *
 * `en` is written without `as const`, so every leaf infers as `string` and
 * `zh` / `ko` typed as `Copy` fail to compile the moment a key is missing.
 *
 * Brand terms are never translated: VOLTARA, $VLTR, VOLTS, BNB Chain,
 * BEP-20, and the part codes (VC-1, CX-2, PS-3, OD-8).
 */
const en = {
  eyebrow: 'Beyond the rig',
  title: 'Ten systems that make a rig worth showing',
  subtitle:
    'A build is not just a number that goes up. It runs hot, it competes, it can be pooled, traded and gambled with.',
  cards: {
    events: {
      title: 'Grid events',
      body: 'Every few days the whole grid changes physics. A heatwave makes every core run 30% hotter; cheap power halves what your rig draws. The miners who built cooling headroom win the week.',
      detail: '5 event types · 4–8h each',
    },
    overclock: {
      title: 'Overclock',
      body: 'Push the cores for more hash and much more heat. Every hour it runs, one installed part can burn out and sit dead for two days. A decision, not a free boost.',
      detail: '+40% hash · +80% heat',
    },
    duels: {
      title: 'Rig duels',
      body: 'Send a link. The first miner who accepts races your rig for 24 hours, and the one who mines more VOLTS takes a cut of the loser’s haul.',
      detail: '24h race · 10% stake',
    },
    squads: {
      title: 'Squads',
      body: 'Five miners pool their spare cooling and power. One friend’s oversized cooler keeps the whole squad stable, so inviting people pays you back directly.',
      detail: 'Up to 5 miners',
    },
    market: {
      title: 'Player market',
      body: 'Sell a part you are not running to another miner for VOLTS, or buy the cooler you need without touching crypto. The grid keeps a small fee.',
      detail: '5% platform fee',
    },
    blueprint: {
      title: 'Weekly blueprint',
      body: 'Every week the grid sets a target: the cheapest rig that hits it at 100% stability wins. Builds are re-checked on the server, so the leaderboard is real engineering, not a screenshot.',
      detail: 'Top 3 win parts',
    },
    salvage: {
      title: 'Salvage & craft',
      body: 'A part near the end of its life is not dead weight. Break it down for scrap, and three scrap become a new random part.',
      detail: '3 scrap → 1 part',
    },
    skins: {
      title: 'Chassis skins',
      body: 'Cosmetic only, and earned with VOLTS rather than cash. Your skin shows on your rig and on the card people see when you share it.',
      detail: '6 skins',
    },
  },
  cta: 'Build your rig',
  ctaNote: 'Free chassis, six slots, no hardware.',
};

type Copy = typeof en;

const zh: Copy = {
  eyebrow: '不只是机架',
  title: '十个让机架值得炫耀的系统',
  subtitle: '一套配置不只是一个不断上涨的数字。它会发热、会比拼，还能共享、交易和下注。',
  cards: {
    events: {
      title: '电网事件',
      body: '每隔几天，整个电网的物理规则都会改变。热浪会让每个核心多发 30% 的热量；廉价电力则把功耗减半。留足散热余量的矿工赢下这一周。',
      detail: '5 种事件 · 每次 4–8 小时',
    },
    overclock: {
      title: '超频',
      body: '压榨核心换取更高算力，代价是高得多的热量。每运行一小时，就可能有一个已装部件烧毁并停摆两天。这是一个抉择，不是白送的加成。',
      detail: '算力 +40% · 热量 +80%',
    },
    duels: {
      title: '矿机对决',
      body: '发出一个链接。第一位接受的矿工将与你的机架比拼 24 小时，挖到更多 VOLTS 的一方从输家的收成中分走一部分。',
      detail: '24 小时 · 抽成 10%',
    },
    squads: {
      title: '战队',
      body: '五名矿工共享各自富余的散热与电力。一位队友的大号散热器能让整个战队保持稳定，所以邀请好友会直接回馈到你身上。',
      detail: '最多 5 名矿工',
    },
    market: {
      title: '玩家市场',
      body: '把闲置的部件卖给其他矿工换取 VOLTS，或者不动加密货币就买到你需要的散热器。平台只收取少量手续费。',
      detail: '平台手续费 5%',
    },
    blueprint: {
      title: '每周蓝图赛',
      body: '每周电网设定一个目标：以 100% 稳定度达标且成本最低的机架获胜。配置会在服务器端重新核算，所以排行榜比拼的是真本事，不是截图。',
      detail: '前三名赢得部件',
    },
    salvage: {
      title: '拆解与合成',
      body: '临近寿命的部件并非废物。拆解它换取废料，三份废料就能合成一个全新的随机部件。',
      detail: '3 废料 → 1 部件',
    },
    skins: {
      title: '机架皮肤',
      body: '纯外观，用 VOLTS 而非现金获得。皮肤会显示在你的机架上，也会出现在你分享时别人看到的卡片上。',
      detail: '6 款皮肤',
    },
  },
  cta: '搭建你的机架',
  ctaNote: '免费机架，六个插槽，无需硬件。',
};

const ko: Copy = {
  eyebrow: '리그 그 이상',
  title: '리그를 자랑할 만하게 만드는 열 가지 시스템',
  subtitle:
    '빌드는 그저 올라가는 숫자가 아닙니다. 뜨거워지고, 겨루고, 함께 묶고, 사고팔고, 걸 수도 있습니다.',
  cards: {
    events: {
      title: '그리드 이벤트',
      body: '며칠에 한 번 그리드 전체의 물리 법칙이 바뀝니다. 폭염에는 모든 코어가 30% 더 뜨거워지고, 저가 전력 때는 소비 전력이 절반이 됩니다. 냉각 여유를 확보해 둔 채굴자가 그 주를 가져갑니다.',
      detail: '이벤트 5종 · 회당 4~8시간',
    },
    overclock: {
      title: '오버클럭',
      body: '코어를 밀어붙여 해시를 얻고 발열은 훨씬 더 늘어납니다. 작동 한 시간마다 장착된 부품 하나가 타버려 이틀간 멈출 수 있습니다. 공짜 버프가 아니라 선택입니다.',
      detail: '해시 +40% · 발열 +80%',
    },
    duels: {
      title: '리그 대결',
      body: '링크를 보내세요. 가장 먼저 수락한 채굴자가 24시간 동안 당신의 리그와 겨루고, VOLTS를 더 캔 쪽이 진 쪽 수확의 일부를 가져갑니다.',
      detail: '24시간 · 지분 10%',
    },
    squads: {
      title: '스쿼드',
      body: '채굴자 다섯 명이 남는 냉각과 전력을 함께 씁니다. 친구 한 명의 넉넉한 쿨러가 스쿼드 전체를 안정시키니, 초대가 곧바로 내 이익이 됩니다.',
      detail: '최대 5명',
    },
    market: {
      title: '플레이어 마켓',
      body: '돌리지 않는 부품을 다른 채굴자에게 VOLTS로 팔거나, 암호화폐 없이 필요한 쿨러를 사세요. 그리드는 소액의 수수료만 가져갑니다.',
      detail: '플랫폼 수수료 5%',
    },
    blueprint: {
      title: '주간 블루프린트',
      body: '매주 그리드가 목표를 제시합니다. 안정도 100%로 목표를 달성한 가장 저렴한 리그가 이깁니다. 빌드는 서버에서 다시 계산되므로, 순위표는 스크린샷이 아니라 진짜 설계 실력입니다.',
      detail: '상위 3명 부품 획득',
    },
    salvage: {
      title: '해체와 제작',
      body: '수명이 다해가는 부품도 짐이 아닙니다. 해체해 스크랩을 얻고, 스크랩 3개면 새로운 무작위 부품 하나가 됩니다.',
      detail: '스크랩 3개 → 부품 1개',
    },
    skins: {
      title: '섀시 스킨',
      body: '외형 전용이며 현금이 아닌 VOLTS로 얻습니다. 내 리그에 표시되고, 공유했을 때 남들이 보는 카드에도 나타납니다.',
      detail: '스킨 6종',
    },
  },
  cta: '내 리그 만들기',
  ctaNote: '무료 섀시, 슬롯 6개, 하드웨어 불필요.',
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Landing feature copy for the active locale; falls back to English. */
export function useLanding(): Copy {
  const locale = useLocale();
  return BY_LOCALE[locale] ?? en;
}
