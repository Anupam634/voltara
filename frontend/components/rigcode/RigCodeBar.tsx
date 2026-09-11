'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  decodeRigCode,
  encodeRigCode,
  rigCodeUrl,
  RIG_CODE_MAX_PARTS,
  type RigCodePart,
} from '../../lib/rig-code';
import { useMiningFX } from '../../lib/use-mining-fx';
import { Button, Icon, Notice } from '../ui';
import { fill, useRigCode } from './strings';

/**
 * The build code, with a way in and a way out.
 *
 * Read-only on the rig screen (this is your rig, here is its code); with a
 * paste field in a builder, where loading someone else's code is the whole
 * point of the feature.
 */
export function RigCodeBar({
  codes,
  catalog = [],
  onLoad,
  locale,
  className = '',
  note,
}: {
  /** Current slot contents, nulls included. */
  codes: (string | null)[];
  /** Catalogue to validate against. Without it, unknown parts cannot be named. */
  catalog?: RigCodePart[];
  /** Omit for a read-only bar. */
  onLoad?: (codes: string[]) => void;
  /** Needed only to build a share link. */
  locale?: string;
  className?: string;
  /** Shown in place of the hint, e.g. "loaded from a shared link". */
  note?: string | null;
}) {
  const S = useRigCode();
  const { playTick, playError } = useMiningFX();
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const code = useMemo(() => encodeRigCode(codes, catalog), [codes, catalog]);
  const empty = code.length === 0;

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => setLoaded(false), 2400);
    return () => clearTimeout(id);
  }, [loaded]);

  async function copy() {
    if (empty) return;
    playTick();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard permission can be refused; the code is on screen to select.
    }
  }

  async function share() {
    if (empty || !locale) return;
    playTick();
    const url = rigCodeUrl(window.location.origin, locale, code);
    const text = fill(S.shareText, { code });
    // `navigator.share` is not in the DOM lib this project targets, and an
    // `in` check narrows `navigator` to never in the fallback branch.
    const nav = navigator as Navigator & {
      share?: (data: { text: string; url: string }) => Promise<void>;
    };
    try {
      if (typeof nav.share === 'function') {
        await nav.share({ text, url });
        return;
      }
      await nav.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
    } catch {
      // A dismissed share sheet is not an error worth reporting.
    }
  }

  function load() {
    const parsed = decodeRigCode(input, catalog);
    if (!parsed || parsed.codes.length === 0) {
      playError();
      setProblem(
        parsed && parsed.unknown.length > 0
          ? fill(parsed.unknown.length === 1 ? S.unknownOne : S.unknownMany, {
              list: parsed.unknown.join(', '),
            })
          : S.nothing,
      );
      return;
    }
    playTick();
    onLoad?.(parsed.codes);
    setInput('');
    setLoaded(true);
    setProblem(
      parsed.unknown.length > 0
        ? fill(parsed.unknown.length === 1 ? S.unknownOne : S.unknownMany, {
            list: parsed.unknown.join(', '),
          })
        : null,
    );
  }

  return (
    <div className={`v-inset p-3 sm:p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="v-eyebrow">{onLoad ? S.label : S.yourBuild}</span>
        {note ? (
          <span className="v-chip v-chip--charge">
            <Icon name="check" size={11} />
            {note}
          </span>
        ) : loaded ? (
          <span className="v-chip v-chip--charge">
            <Icon name="check" size={11} />
            {S.loaded}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code
          className={`v-num min-w-0 flex-1 truncate rounded-lg border border-line/25 bg-bg/60 px-3 py-2 text-sm font-bold tracking-wide ${
            empty ? 'text-ink-3' : 'text-charge'
          }`}
          title={empty ? undefined : code}
        >
          {empty ? S.empty : code}
        </code>
        <Button variant="ghost" size="sm" onClick={copy} disabled={empty}>
          <Icon name={copied ? 'check' : 'copy'} size={13} />
          {copied ? S.copied : S.copy}
        </Button>
        {locale && (
          <Button variant="ghost" size="sm" onClick={share} disabled={empty}>
            <Icon name="share" size={13} />
            {S.share}
          </Button>
        )}
      </div>

      {onLoad && (
        <>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{S.hint}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className="v-input min-w-0 flex-1 py-2 font-mono text-xs"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setProblem(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  load();
                }
              }}
              placeholder={S.loadPlaceholder}
              aria-label={S.loadTitle}
              spellCheck={false}
              autoCapitalize="characters"
            />
            <Button variant="primary" size="sm" onClick={load} disabled={!input.trim()}>
              {S.load}
            </Button>
          </div>
          {problem && (
            <Notice tone="warn" className="mt-2 text-[11px]" icon={<Icon name="help" size={14} />}>
              {problem}
            </Notice>
          )}
        </>
      )}
    </div>
  );
}

export { RIG_CODE_MAX_PARTS };
