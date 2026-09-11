'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  createSupportTicket,
  getSupportTickets,
  getToken,
  replyToSupportTicket,
  SUPPORT_MAX_OPEN,
  type SupportTicketDto,
} from '../../../lib/api';
import { AppShell } from '../../../components/AppShell';
import {
  Button,
  Chip,
  Eyebrow,
  Field,
  Icon,
  Input,
  Modal,
  Notice,
  Panel,
  Reveal,
  Skeleton,
  type ChipTone,
} from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';

const STATUS_TONE: Record<SupportTicketDto['status'], ChipTone> = {
  ANSWERED: 'ok',
  OPEN: 'warn',
  CLOSED: 'default',
};

export default function SupportClient() {
  const t = useTranslations('support');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const [tickets, setTickets] = useState<SupportTicketDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      setTickets(await getSupportTickets());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.replace(`/${locale}/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : t('offline'));
    }
  }, [router, locale, t]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${locale}/login`);
      return;
    }
    load();
  }, [load, router, locale]);

  const openCount = tickets?.filter((x) => x.status !== 'CLOSED').length ?? 0;
  const atCap = openCount >= SUPPORT_MAX_OPEN;

  return (
    <AppShell
      locale={locale}
      backLabel={t('backToDashboard')}
      width="max-w-4xl"
      eyebrow="Help desk"
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        tickets ? (
          <Button variant="primary" onClick={() => setComposing(true)} disabled={atCap}>
            <Icon name="help" size={16} />
            {t('newTicket')}
          </Button>
        ) : null
      }
    >
      {/* Most questions are already answered; send people there first. */}
      <Reveal index={0}>
        <Link href={`/${locale}/faq`} className="block">
          <Notice tone="brand" icon={<Icon name="search" size={16} />} className="transition hover:border-brand-hi/70">
            <span className="flex items-center justify-between gap-3">
              <span>{t('tryFaq')}</span>
              <span className="inline-flex shrink-0 items-center gap-1 font-bold">
                {t('readFaq')}
                <Icon name="chevron-right" size={14} />
              </span>
            </span>
          </Notice>
        </Link>
      </Reveal>

      {atCap && tickets && (
        <p className="mt-3 text-center text-xs text-ink-3">{t('atCap', { max: SUPPORT_MAX_OPEN })}</p>
      )}

      {error && (
        <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mt-5">
          {error}
        </Notice>
      )}

      {!tickets ? (
        <div className="mt-5 space-y-3">
          <Panel className="p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Panel>
          <Panel className="p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-28" />
          </Panel>
        </div>
      ) : tickets.length === 0 ? (
        <Reveal index={1}>
          <Panel hud className="mt-5 p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand-hi">
              <Icon name="help" size={26} />
            </span>
            <p className="mt-4 text-sm text-ink-2">{t('empty')}</p>
            <Button variant="primary" className="mt-5" onClick={() => setComposing(true)} disabled={atCap}>
              {t('newTicket')}
            </Button>
          </Panel>
        </Reveal>
      ) : (
        <ul className="v-stagger mt-5 space-y-3">
          {tickets.map((ticket) => (
            <Thread key={ticket.id} ticket={ticket} onReplied={load} />
          ))}
        </ul>
      )}

      <NewTicket
        open={composing}
        onCancel={() => setComposing(false)}
        onDone={async () => {
          setComposing(false);
          await load();
        }}
      />
    </AppShell>
  );
}

/* ──────────────────────────── New ticket ─────────────────────────── */

function NewTicket({ open, onCancel, onDone }: { open: boolean; onCancel: () => void; onDone: () => void }) {
  const t = useTranslations('support');
  const { playError, playTick } = useMiningFX();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Matches the server's DTO, so the button disables rather than round-trips.
  const valid = subject.trim().length >= 3 && body.trim().length >= 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createSupportTicket(subject.trim(), body.trim());
      playTick();
      setSubject('');
      setBody('');
      onDone();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : t('offline'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onCancel} title={t('newTicket')}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('subject')}>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder={t('subjectPlaceholder')}
            autoFocus
          />
        </Field>

        <Field
          label={t('message')}
          hint={<span className="v-num block text-right">{body.length}/4000</span>}
        >
          <textarea
            className="v-input min-h-[9rem] resize-y"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            placeholder={t('messagePlaceholder')}
          />
        </Field>

        {error && (
          <Notice tone="heat" icon={<Icon name="x" size={16} />}>
            {error}
          </Notice>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!valid} className="flex-1">
            {busy ? (
              t('sending')
            ) : (
              <>
                {t('send')}
                <Icon name="chevron-right" size={14} />
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────────── Thread ────────────────────────────── */

function Thread({ ticket, onReplied }: { ticket: SupportTicketDto; onReplied: () => void }) {
  const t = useTranslations('support');
  const { playError, playTick } = useMiningFX();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await replyToSupportTicket(ticket.id, body.trim());
      playTick();
      setBody('');
      onReplied();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : t('offline'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel as="li" hud lift={!open} className="overflow-hidden">
      <button
        type="button"
        onClick={() => {
          playTick();
          setOpen((v) => !v);
        }}
        className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block truncate font-display font-bold text-ink">{ticket.subject}</span>
          <span className="v-num mt-1 block text-xs text-ink-3">
            {t('messageCount', { n: ticket.messages.length })} · {new Date(ticket.updatedAt).toLocaleDateString()}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Chip tone={STATUS_TONE[ticket.status]} dot={ticket.status === 'ANSWERED'}>
            {t(`status.${ticket.status}`)}
          </Chip>
          <Icon
            name="chevron-down"
            size={16}
            className={`text-ink-3 transition-transform duration-300 ${open ? 'rotate-180 text-charge' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="animate-fade border-t border-line/15 p-4 sm:p-5">
          <ol className="space-y-3">
            {ticket.messages.map((m) => (
              <li key={m.id} className={`flex ${m.fromAdmin ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-sm sm:max-w-[75%] ${
                    m.fromAdmin
                      ? 'rounded-tl-md border border-brand/30 bg-brand/10 text-ink'
                      : 'rounded-tr-md bg-surface-3/80 text-ink'
                  }`}
                >
                  <div
                    className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                      m.fromAdmin ? 'text-brand-hi' : 'text-ink-3'
                    }`}
                  >
                    <Icon name={m.fromAdmin ? 'bolt' : 'user'} size={10} />
                    {m.fromAdmin ? t('fromSupport') : t('fromYou')}
                    <span className="v-num font-medium normal-case tracking-normal">
                      · {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {ticket.status === 'CLOSED' ? (
            <p className="mt-4 flex items-center gap-2 text-xs text-ink-3">
              <Icon name="lock" size={12} />
              {t('closedNote')}
            </p>
          ) : (
            <form onSubmit={reply} className="mt-4">
              <Eyebrow>{t('reply')}</Eyebrow>
              <textarea
                className="v-input mt-2 min-h-[5rem] resize-y"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={4000}
                placeholder={t('replyPlaceholder')}
              />
              {error && (
                <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mt-2">
                  {error}
                </Notice>
              )}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={busy}
                disabled={body.trim().length === 0}
                className="mt-2 w-full sm:w-auto"
              >
                {busy ? (
                  t('sending')
                ) : (
                  <>
                    {t('reply')}
                    <Icon name="chevron-right" size={14} />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      )}
    </Panel>
  );
}
