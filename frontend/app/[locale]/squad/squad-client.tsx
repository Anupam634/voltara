'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError, getToken } from '../../../lib/api';
import {
  createSquad,
  getMySquad,
  getSquadLeaderboard,
  joinSquad,
  leaveSquad,
  type SquadDto,
  type SquadMember,
  type SquadRankRow,
} from '../../../lib/api-social';
import { useSocial } from '../../../components/social/strings';
import { AppShell } from '../../../components/AppShell';
import {
  AnimatedNumber,
  Button,
  Chip,
  Eyebrow,
  Field,
  Gauge,
  Icon,
  Input,
  Notice,
  Panel,
  Progress,
  Reveal,
  Skeleton,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';
import { usePolling } from '../../../lib/use-polling';

const REFRESH_MS = 30_000;

function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function SquadClient() {
  const S = useSocial().SQUAD;
  const t = useTranslations('dashboard');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const { playTick, playInstall, playError } = useMiningFX();

  const [squad, setSquad] = useState<SquadDto | null | undefined>(undefined);
  const [board, setBoard] = useState<SquadRankRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, lb] = await Promise.all([getMySquad(), getSquadLeaderboard()]);
      setSquad(mine.squad);
      setBoard(lb.squads);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.replace(`/${locale}/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : S.offline);
    }
  }, [router, locale]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${locale}/login`);
      return;
    }
    load();
  }, [load, router, locale]);

  usePolling(load, REFRESH_MS);

  const run = async (fn: () => Promise<unknown>, success?: () => void) => {
    setBusy(true);
    try {
      await fn();
      success?.();
      await load();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : S.offline);
    } finally {
      setBusy(false);
    }
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) return;
    run(() => createSquad(name.trim()), playInstall);
  };
  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    run(() => joinSquad(code.trim()), playInstall);
  };
  const onLeave = () => {
    if (!window.confirm(S.leaveConfirm)) return;
    run(() => leaveSquad(), playTick);
  };

  const copyCode = async () => {
    if (!squad) return;
    try {
      await navigator.clipboard.writeText(squad.code);
      playTick();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const share = async () => {
    if (!squad) return;
    const text = `${S.shareText(squad.name)} ${squad.code}`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'VOLTARA squad', text, url: `${window.location.origin}/${locale}/squad` });
        return;
      } catch {
        /* dismissed */
      }
    }
    copyCode();
  };

  return (
    <AppShell
      locale={locale}
      backLabel={t('navDashboard')}
      eyebrow={S.eyebrow}
      title={S.title}
      subtitle={S.subtitle}
      actions={
        squad ? (
          <Button variant="danger" size="sm" loading={busy} onClick={onLeave}>
            <Icon name="logout" size={13} />
            {S.leave}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {error && (
          <Notice tone="heat" icon={<Icon name="x" size={16} />}>
            {error}
          </Notice>
        )}

        {squad === undefined ? (
          <div className="space-y-6">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : squad === null ? (
          /* ─── No squad: create or join ─── */
          <div className="grid gap-5 lg:grid-cols-2">
            <Reveal>
              <Panel hud className="h-full p-5 sm:p-7">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-charge/35 bg-charge/10 text-charge">
                  <Icon name="sparkle" size={18} />
                </span>
                <h2 className="mt-4 font-display text-xl font-bold text-ink">{S.createTitle}</h2>
                <p className="mt-1.5 text-sm text-ink-2">{S.createBody}</p>
                <form onSubmit={onCreate} className="mt-5 space-y-3">
                  <Field>
                    <Input
                      id="squad-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={S.namePlaceholder}
                      minLength={3}
                      maxLength={24}
                      required
                    />
                  </Field>
                  <Button type="submit" variant="charge" loading={busy} disabled={name.trim().length < 3} className="w-full">
                    <Icon name="bolt" size={14} />
                    {busy ? S.working : S.create}
                  </Button>
                </form>
              </Panel>
            </Reveal>
            <Reveal index={1}>
              <Panel hud className="h-full p-5 sm:p-7">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/35 bg-brand/10 text-brand-hi">
                  <Icon name="users" size={18} />
                </span>
                <h2 className="mt-4 font-display text-xl font-bold text-ink">{S.joinTitle}</h2>
                <p className="mt-1.5 text-sm text-ink-2">{S.joinBody}</p>
                <form onSubmit={onJoin} className="mt-5 space-y-3">
                  <Field>
                    <Input
                      id="squad-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder={S.codePlaceholder}
                      className="v-num"
                      required
                    />
                  </Field>
                  <Button type="submit" variant="primary" loading={busy} disabled={!code.trim()} className="w-full">
                    <Icon name="chevron-right" size={14} />
                    {busy ? S.working : S.join}
                  </Button>
                </form>
              </Panel>
            </Reveal>
          </div>
        ) : (
          /* ─── In a squad ─── */
          <>
            <Reveal>
              <Panel hud className="p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Eyebrow tone="charge">{S.full(squad.members.length, squad.maxMembers)}</Eyebrow>
                    <h2 className="mt-2 truncate font-display text-2xl font-bold text-ink sm:text-3xl">{squad.name}</h2>
                    <p className="mt-1 text-xs text-ink-3">
                      {S.earned7d}:{' '}
                      <span className="v-num font-bold text-charge">
                        <AnimatedNumber value={squad.earnedPoints7d} decimals={2} />
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    <span className="v-label mb-0">{S.code}</span>
                    <div className="flex gap-2">
                      <span className="v-inset v-num px-3 py-2 text-xs text-ink-2">{squad.code}</span>
                      <Button variant="ghost" size="sm" onClick={copyCode}>
                        <Icon name={copied ? 'check' : 'copy'} size={13} />
                        {copied ? S.copied : S.copy}
                      </Button>
                      <Button variant="primary" size="sm" onClick={share}>
                        <Icon name="share" size={13} />
                        {S.share}
                      </Button>
                    </div>
                  </div>
                </div>
              </Panel>
            </Reveal>

            <div className="grid gap-5 lg:grid-cols-12">
              <Reveal index={1} className="lg:col-span-5">
                <PoolPanel squad={squad} />
              </Reveal>
              <Reveal index={2} className="lg:col-span-7">
                <Panel className="h-full p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-ink">{S.members}</h3>
                    <Chip>{S.full(squad.members.length, squad.maxMembers)}</Chip>
                  </div>
                  <ul className="v-stagger mt-4 space-y-2.5">
                    {squad.members.map((m) => (
                      <MemberRow key={m.id} member={m} />
                    ))}
                  </ul>
                </Panel>
              </Reveal>
            </div>
          </>
        )}

        {/* ─── Squad leaderboard ─── */}
        <Reveal index={3}>
          <Panel className="p-5 sm:p-6">
            <h3 className="font-display text-base font-bold text-ink">{S.boardTitle}</h3>
            <p className="mt-1 text-xs text-ink-3">{S.boardBody}</p>
            {!board ? (
              <Skeleton className="mt-4 h-40 w-full" />
            ) : board.length === 0 ? (
              <p className="mt-4 text-sm text-ink-3">{S.boardEmpty}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-line/15">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-surface-2/70 text-left">
                    <tr>
                      <th className="v-eyebrow px-3 py-2.5">{S.rank}</th>
                      <th className="v-eyebrow px-3 py-2.5">{S.squadCol}</th>
                      <th className="v-eyebrow px-3 py-2.5 text-right">{S.membersCol}</th>
                      <th className="v-eyebrow px-3 py-2.5 text-right">{S.earnedCol}</th>
                    </tr>
                  </thead>
                  <tbody className="v-stagger">
                    {board.map((row) => {
                      const mine = squad?.id === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={`border-t border-line/10 ${mine ? 'bg-charge/[0.07]' : ''}`}
                        >
                          <td className="v-num px-3 py-2.5 font-bold text-ink-2">
                            {row.rank <= 3 ? (
                              <span className={row.rank === 1 ? 'text-charge' : 'text-brand-hi'}>
                                <Icon name="trophy" size={13} className="mr-1 inline" />
                                {row.rank}
                              </span>
                            ) : (
                              row.rank
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-ink">
                            {row.name}
                            {mine && (
                              <Chip tone="charge" className="ml-2">
                                {S.yours}
                              </Chip>
                            )}
                          </td>
                          <td className="v-num px-3 py-2.5 text-right text-ink-2">{row.members}</td>
                          <td className="v-num px-3 py-2.5 text-right font-bold text-charge">{fmt(row.earnedPoints, 2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </Reveal>
      </div>
    </AppShell>
  );
}

/* ───────────────────────── Pool ───────────────────────── */

function PoolPanel({ squad }: { squad: SquadDto }) {
  const S = useSocial().SQUAD;
  const { pool } = squad;
  const coolingPct = pool.coolingSurplus > 0 ? Math.min(100, (pool.coolingLent / pool.coolingSurplus) * 100) : 0;
  const powerPct = pool.powerSurplus > 0 ? Math.min(100, (pool.powerLent / pool.powerSurplus) * 100) : 0;
  const active = pool.coolingLent > 0 || pool.powerLent > 0;
  return (
    <Panel hud tone={active ? 'charge' : 'default'} className="v-scanlines h-full p-5 sm:p-6">
      <Eyebrow tone="charge">{S.poolEyebrow}</Eyebrow>
      <h3 className="mt-1.5 font-display text-lg font-bold text-ink">{S.poolTitle}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">{S.poolBody}</p>

      <div className="mt-5 space-y-4">
        <PoolMeter
          icon="snow"
          label={S.cooling}
          unit={S.unit.cooling}
          surplus={pool.coolingSurplus}
          lent={pool.coolingLent}
          pct={coolingPct}
        />
        <PoolMeter
          icon="plug"
          label={S.power}
          unit={S.unit.power}
          surplus={pool.powerSurplus}
          lent={pool.powerLent}
          pct={powerPct}
        />
      </div>
      <div className="v-trace mt-5" />
    </Panel>
  );
}

function PoolMeter({
  icon,
  label,
  unit,
  surplus,
  lent,
  pct,
}: {
  icon: 'snow' | 'plug';
  label: string;
  unit: string;
  surplus: number;
  lent: number;
  pct: number;
}) {
  const S = useSocial().SQUAD;
  return (
    <div className="v-inset p-3.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-bold text-ink">
          <Icon name={icon} size={13} className="text-brand-hi" />
          {label}
        </span>
        <span className="v-num text-ink-2">
          <span className="font-bold text-charge">{lent}</span> {unit} {S.lent} · {surplus} {unit} {S.spare}
        </span>
      </div>
      <Progress value={pct} charge className="mt-2.5" />
    </div>
  );
}

/* ───────────────────────── Members ───────────────────────── */

function MemberRow({ member }: { member: SquadMember }) {
  const S = useSocial().SQUAD;
  const receiving = member.lent.cooling > 0 || member.lent.power > 0;
  return (
    <li className="v-inset flex items-center gap-3.5 p-3">
      <Gauge value={member.gridStability} size={56} stroke={6} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-extrabold text-ink">{member.name}</p>
          {member.isOwner && (
            <Chip tone="brand">
              <Icon name="star" size={11} />
              {S.owner}
            </Chip>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-ink-3">
          {S.memberRate} <span className="v-num font-bold text-charge">{fmt(member.ratePerHour, 2)}</span>
          <span className="mx-1.5 text-ink-3">·</span>
          {S.memberStability} <span className="v-num font-bold text-ink-2">{member.gridStability}%</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {receiving ? (
          <Chip tone="charge" dot>
            {S.receiving} {member.lent.cooling > 0 ? `${member.lent.cooling} ${S.unit.cooling}` : ''}
            {member.lent.cooling > 0 && member.lent.power > 0 ? ' · ' : ''}
            {member.lent.power > 0 ? `${member.lent.power} ${S.unit.power}` : ''}
          </Chip>
        ) : (
          <Chip>
            {S.giving} {member.coolingSurplus} {S.unit.cooling} · {member.powerSurplus} {S.unit.power}
          </Chip>
        )}
      </div>
    </li>
  );
}
