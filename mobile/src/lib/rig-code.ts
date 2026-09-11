/**
 * RIG DNA — a six-slot build as a short, human-readable string.
 *
 *   VC10-CX6-PS12-OD8
 *
 * The point is that a build stops being a screenshot and becomes something
 * you can play with: a miner posts their code, anyone pastes it, and the
 * builder fills in. So the format has to survive a trip through a chat app —
 * lowercase, spaces, a stray `+`, a whole URL pasted around it.
 *
 * Canonical ordering (CORE, MODULE, COOLER, PSU, then by code) means the
 * same build always produces the same string no matter which slot each part
 * happened to sit in. Two miners who built the same rig post the same code,
 * which is what makes the codes comparable at a glance.
 *
 * Mirrored byte-for-byte in `frontend/lib/rig-code.ts`. Change one, change
 * the other, or web and mobile will disagree about what a code means.
 */

/** The shape the codec needs from a catalogue entry. Nothing more. */
export interface RigCodePart {
  code: string;
  kind: string;
}

/** Slots on a stock chassis — the most parts a code can carry. */
export const RIG_CODE_MAX_PARTS = 6;

/**
 * Kind order for the canonical form. Cores first because they are what the
 * build is *for*; the rest follow in the order a miner adds them when
 * fixing a rig that overheats and then browns out.
 */
const KIND_RANK: Record<string, number> = {
  CORE: 0,
  MODULE: 1,
  COOLER: 2,
  PSU: 3,
};

/** Anything that is not part of a code: separators, URL noise, punctuation. */
const SEPARATORS = /[\s,;/|]+|\+|-/g;

export interface DecodedRigCode {
  /** Catalogue codes, canonical order, capped at six. */
  codes: string[];
  /** Tokens that looked like parts but are not in the catalogue. */
  unknown: string[];
}

function rank(kind: string | undefined): number {
  return KIND_RANK[kind ?? ''] ?? 99;
}

/**
 * Sort into the canonical order: by kind, then by code so two cores always
 * land the same way round.
 */
function canonical(codes: string[], byCode: Map<string, RigCodePart>): string[] {
  return [...codes].sort((a, b) => {
    const byKind = rank(byCode.get(a)?.kind) - rank(byCode.get(b)?.kind);
    if (byKind !== 0) return byKind;
    return a.localeCompare(b);
  });
}

function indexCatalog(catalog: RigCodePart[]): Map<string, RigCodePart> {
  const m = new Map<string, RigCodePart>();
  for (const p of catalog) {
    if (p?.code) m.set(p.code.toUpperCase(), { code: p.code.toUpperCase(), kind: p.kind });
  }
  return m;
}

/**
 * A build as a code. Empty slots simply vanish — a code describes what is
 * installed, not where, because slot position has no effect on the maths.
 */
export function encodeRigCode(
  codes: (string | null | undefined)[],
  catalog: RigCodePart[] = [],
): string {
  const byCode = indexCatalog(catalog);
  const present = codes
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map((c) => c.trim().toUpperCase())
    .slice(0, RIG_CODE_MAX_PARTS);
  return canonical(present, byCode).join('-');
}

/** Convenience for the shape the rig and challenge screens already hold. */
export function rigCodeFromParts(
  parts: ({ code: string | null } | null | undefined)[],
  catalog: RigCodePart[] = [],
): string {
  return encodeRigCode(
    parts.map((p) => p?.code ?? null),
    catalog,
  );
}

/**
 * Read a code a miner pasted from anywhere.
 *
 * Deliberately forgiving about the wrapper and strict about the parts: a
 * token that is not in the catalogue comes back in `unknown` so the UI can
 * say "CX99 isn't a part" instead of quietly building something else.
 *
 * Returns null when there is nothing usable at all, so a caller can tell
 * "this isn't a build code" from "this code has a typo in it".
 */
export function decodeRigCode(
  input: string,
  catalog: RigCodePart[] = [],
): DecodedRigCode | null {
  if (typeof input !== 'string') return null;
  const byCode = indexCatalog(catalog);

  let text = input.trim();
  if (!text) return null;

  // A pasted share link carries the code in `?build=`; a pasted chat message
  // may carry the whole URL. Take the query parameter when it is there, and
  // otherwise drop everything up to the last slash so a bare path cannot
  // contribute stray tokens.
  const buildParam = /[?&]build=([^&\s]+)/i.exec(text);
  if (buildParam) {
    text = decodeURIComponent(buildParam[1]);
  } else if (/https?:\/\//i.test(text)) {
    text = text.replace(/https?:\/\/\S*?([^/\s?#]*)(?:[?#]\S*)?$/i, '$1');
  }

  // An optional label, so "VOLTARA: VC10-CX6" pastes cleanly.
  text = text.replace(/^\s*voltara\s*[:\-]?\s*/i, '');

  const tokens = text
    .split(SEPARATORS)
    .map((t) => t.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return null;

  const codes: string[] = [];
  const unknown: string[] = [];
  for (const token of tokens) {
    if (byCode.has(token)) {
      if (codes.length < RIG_CODE_MAX_PARTS) codes.push(token);
    } else if (!unknown.includes(token)) {
      unknown.push(token);
    }
  }

  if (codes.length === 0 && unknown.length === 0) return null;
  return { codes: canonical(codes, byCode), unknown };
}

/** Fill a fixed-length slot array from a decoded code. */
export function slotsFromCodes(
  codes: string[],
  slots = RIG_CODE_MAX_PARTS,
): (string | null)[] {
  const next: (string | null)[] = Array(slots).fill(null);
  codes.slice(0, slots).forEach((c, i) => {
    next[i] = c;
  });
  return next;
}

/** The share URL that opens the builder with this build already loaded. */
export function rigCodeUrl(origin: string, locale: string, code: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/${locale}/challenge?build=${encodeURIComponent(code)}`;
}
