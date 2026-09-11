import { useI18n } from '../../i18n';

/**
 * Copy for RIG DNA — the shareable build code.
 *
 * Typing `zh` and `ko` as `Copy` makes a missing translation a compile error
 * rather than a blank label on a phone.
 *
 * Brand terms stay untranslated: VOLTARA, $VLTR, VOLTS, and the part codes.
 */
const en = {
  label: 'Rig DNA',
  hint: 'One line that is your whole build. Post it, and anyone can load it.',
  empty: 'Add a part to get a code.',
  copy: 'Copy',
  copied: 'Code copied',
  share: 'Share',
  loadPlaceholder: 'Paste a code, e.g. VC10-CX6-PS12',
  load: 'Load',
  loaded: 'Build loaded',
  loadedFromLink: 'Loaded from a shared link',
  unknownOne: 'Not a part: {list}',
  unknownMany: 'Not parts: {list}',
  nothing: 'No parts found in that. Codes look like VC10-CX6-PS12.',
  yourBuild: 'Your rig, as a code',
  shareText: 'My VOLTARA rig: {code}',
};

/** Same keys as `en`, with plain strings so a translation may differ. */
type Copy = { [K in keyof typeof en]: string };

const zh: Copy = {
  label: '机架基因',
  hint: '一行代表你的整套配置。发出去，别人就能直接加载。',
  empty: '添加部件后即可生成代码。',
  copy: '复制',
  copied: '代码已复制',
  share: '分享',
  loadPlaceholder: '粘贴代码，例如 VC10-CX6-PS12',
  load: '加载',
  loaded: '配置已加载',
  loadedFromLink: '已从分享链接加载',
  unknownOne: '不是部件：{list}',
  unknownMany: '不是部件：{list}',
  nothing: '其中没有找到部件。代码格式类似 VC10-CX6-PS12。',
  yourBuild: '你的机架代码',
  shareText: '我的 VOLTARA 机架：{code}',
};

const ko: Copy = {
  label: '리그 DNA',
  hint: '빌드 전체가 한 줄입니다. 올리면 누구나 그대로 불러올 수 있습니다.',
  empty: '부품을 추가하면 코드가 생깁니다.',
  copy: '복사',
  copied: '코드를 복사했습니다',
  share: '공유',
  loadPlaceholder: '코드 붙여넣기, 예: VC10-CX6-PS12',
  load: '불러오기',
  loaded: '빌드를 불러왔습니다',
  loadedFromLink: '공유 링크에서 불러옴',
  unknownOne: '부품이 아닙니다: {list}',
  unknownMany: '부품이 아닙니다: {list}',
  nothing: '부품을 찾지 못했습니다. 코드는 VC10-CX6-PS12 형태입니다.',
  yourBuild: '내 리그 코드',
  shareText: '내 VOLTARA 리그: {code}',
};

const BY_LOCALE: Record<string, Copy> = { en, zh, ko };

/** Rig-code copy for the active locale; falls back to English. */
export function useRigCode(): Copy {
  const { locale } = useI18n();
  return BY_LOCALE[locale] ?? en;
}

/** Fill `{name}` placeholders — this copy bypasses the shared catalogue. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m));
}
