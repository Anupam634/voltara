'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  getKyc,
  getToken,
  submitKyc,
  type KycImage,
  type KycStatusDto,
} from '../../../lib/api';
import { CountrySelect } from '../../../components/CountrySelect';
import { AppShell } from '../../../components/AppShell';
import {
  Button,
  Chip,
  Eyebrow,
  Field,
  Icon,
  Input,
  Notice,
  Panel,
  Reveal,
  Skeleton,
  Spinner,
  type ChipTone,
  type IconName,
} from '../../../components/ui';
import { countryFlag, countryName } from '../../../lib/countries';
import { useMiningFX } from '../../../lib/use-mining-fx';

const DOC_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'] as const;

/** Longest edge, in px, an uploaded photo is scaled down to before encoding. */
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

/**
 * Downscale and re-encode a photo in the browser.
 *
 * A modern phone camera file is several MB, which is both slow to upload and
 * far more resolution than a human reviewer needs. Re-encoding here keeps the
 * request comfortably inside the API's size cap.
 */
async function toScaledImage(file: File): Promise<KycImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] };
}

const STATUS_META: Record<KycStatusDto['status'], { tone: ChipTone; notice: 'ok' | 'warn' | 'heat' | 'brand'; icon: IconName }> = {
  APPROVED: { tone: 'ok', notice: 'ok', icon: 'check' },
  PENDING: { tone: 'warn', notice: 'warn', icon: 'clock' },
  REJECTED: { tone: 'heat', notice: 'heat', icon: 'x' },
  NONE: { tone: 'brand', notice: 'brand', icon: 'shield' },
};

export default function KycClient() {
  const t = useTranslations('kyc');
  const router = useRouter();
  const params = useParams<{ locale: string }>();

  const [state, setState] = useState<KycStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await getKyc());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.replace(`/${params.locale}/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : t('offline'));
    }
  }, [router, params.locale, t]);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/${params.locale}/login`);
      return;
    }
    load();
  }, [load, router, params.locale]);

  return (
    <AppShell
      locale={params.locale}
      backLabel={t('backToDashboard')}
      width="max-w-4xl"
      eyebrow="Identity"
      title={t('title')}
      subtitle={t('why')}
    >
      {error && (
        <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mb-5">
          {error}
        </Notice>
      )}

      {!state ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Panel className="p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-12 w-full" />
            <Skeleton className="mt-3 h-12 w-full" />
            <Skeleton className="mt-5 h-32 w-full" />
          </Panel>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Closed is the normal state before launch, not an error: KYC gates
              only the withdrawal path, and that path refuses everyone while
              payouts are shut. Say so plainly rather than showing a form with
              no submit button and no reason. */}
          {!state.open && (
            <Notice tone="default" icon={<Icon name="lock" size={16} />}>
              <div className="text-xs font-extrabold text-ink">{t('closedTitle')}</div>
              <p className="mt-1 text-[11px] leading-relaxed">{t('closedBody')}</p>
              {state.opensAt && (
                <p className="v-num mt-2 text-[11px] font-bold text-ink-2">
                  {t('closedWhen', {
                    date: new Date(state.opensAt).toLocaleDateString(params.locale, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }),
                  })}
                </p>
              )}
            </Notice>
          )}
          {state.status !== 'NONE' && <StatusCard state={state} locale={params.locale} />}
          {state.canSubmit && <SubmitForm onDone={load} locale={params.locale} />}
        </div>
      )}
    </AppShell>
  );
}

function StatusCard({ state, locale }: { state: KycStatusDto; locale: string }) {
  const t = useTranslations('kyc');
  const meta = STATUS_META[state.status];

  return (
    <Reveal index={0}>
      <Notice tone={meta.notice} icon={<Icon name={meta.icon} size={18} />} className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-base font-bold">{t(`status.${state.status}`)}</span>
          <Chip tone={meta.tone} dot={state.status === 'PENDING'}>
            {state.status}
          </Chip>
        </div>

        {state.status === 'PENDING' && <p className="mt-1.5 text-ink-2">{t('pendingBody')}</p>}
        {state.status === 'APPROVED' && <p className="mt-1.5 text-ink-2">{t('approvedBody')}</p>}
        {state.status === 'REJECTED' && state.reviewerNote && (
          <p className="mt-1.5">
            <span className="font-bold">{t('reason')}:</span> {state.reviewerNote}
          </p>
        )}

        {state.fullName && (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-current/10 pt-4 text-ink sm:grid-cols-3">
            <Row label={t('fullName')} value={state.fullName} />
            {state.documentType && <Row label={t('documentType')} value={t(`docType.${state.documentType}`)} />}
            {state.countryCode && (
              <Row
                label={t('country')}
                value={`${countryFlag(state.countryCode)} ${countryName(state.countryCode, locale)}`}
              />
            )}
          </dl>
        )}
      </Notice>
    </Reveal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="v-eyebrow">{label}</dt>
      <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}

function SubmitForm({ onDone, locale }: { onDone: () => void; locale: string }) {
  const t = useTranslations('kyc');
  const { playError, playClaimReward } = useMiningFX();
  const [fullName, setFullName] = useState('');
  const [documentType, setDocumentType] = useState<(typeof DOC_TYPES)[number]>('PASSPORT');
  const [documentNumber, setDocumentNumber] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [front, setFront] = useState<KycImage | null>(null);
  const [back, setBack] = useState<KycImage | null>(null);
  const [selfie, setSelfie] = useState<KycImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploaded = [front, back, selfie].filter(Boolean).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!front || !selfie) {
      playError();
      setError(t('needImages'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitKyc({
        fullName,
        documentType,
        documentNumber,
        countryCode,
        front,
        back: back ?? undefined,
        selfie,
      });
      playClaimReward();
      onDone();
    } catch (err) {
      playError();
      setError(err instanceof ApiError ? err.message : t('offline'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Reveal index={1}>
      <Panel hud className="p-5 sm:p-7">
        <form onSubmit={submit}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Eyebrow tone="brand">Step 1 / 2</Eyebrow>
              <h2 className="mt-1.5 font-display text-lg font-bold text-ink">{t('formTitle')}</h2>
              <p className="mt-1 text-sm text-ink-2">{t('formHint')}</p>
            </div>
            <Chip tone={uploaded >= 2 ? 'charge' : 'default'}>
              <Icon name="shield" size={12} />
              {uploaded}/3
            </Chip>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label={t('fullName')} className="sm:col-span-2">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
              />
            </Field>

            <Field label={t('documentType')}>
              <div className="relative">
                <select
                  className="v-input appearance-none pr-10"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as (typeof DOC_TYPES)[number])}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {t(`docType.${d}`)}
                    </option>
                  ))}
                </select>
                <Icon
                  name="chevron-down"
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3"
                />
              </div>
            </Field>

            <Field label={t('documentNumber')}>
              <Input
                className="v-num"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                required
                minLength={3}
                maxLength={60}
                autoCapitalize="characters"
              />
            </Field>

            <div className="sm:col-span-2">
              <CountrySelect
                id="kyc-country"
                locale={locale}
                value={countryCode}
                onChange={setCountryCode}
                label={t('country')}
                placeholder={t('countryPlaceholder')}
                required
              />
            </div>
          </div>

          <div className="mt-6">
            <Eyebrow tone="brand">Step 2 / 2</Eyebrow>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <ImagePicker label={t('front')} value={front} onChange={setFront} required icon="chip" />
              <ImagePicker label={t('back')} value={back} onChange={setBack} icon="copy" />
              <ImagePicker label={t('selfie')} value={selfie} onChange={setSelfie} required icon="user" />
            </div>
          </div>

          {error && (
            <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mt-4">
              {error}
            </Notice>
          )}

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-3">
            <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
            {t('privacy')}
          </p>

          <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-5 w-full">
            {busy ? (
              t('submitting')
            ) : (
              <>
                <Icon name="shield" size={16} />
                {t('submit')}
              </>
            )}
          </Button>
        </form>
      </Panel>
    </Reveal>
  );
}

function ImagePicker({
  label,
  value,
  onChange,
  required,
  icon,
}: {
  label: string;
  value: KycImage | null;
  onChange: (v: KycImage | null) => void;
  required?: boolean;
  icon: IconName;
}) {
  const t = useTranslations('kyc');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      onChange(await toScaledImage(file));
    } catch {
      setError(true);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      className="block cursor-pointer"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files?.[0]);
      }}
    >
      <span className="v-label">
        {label}
        {!required && <span className="ml-1 font-medium normal-case tracking-normal text-ink-3">({t('optional')})</span>}
      </span>
      <div
        className={`v-inset relative grid h-32 place-items-center overflow-hidden border-2 border-dashed text-center text-xs transition ${
          value
            ? 'border-charge/60'
            : dragging
              ? 'border-charge/70 bg-charge/[0.06] text-charge'
              : error
                ? 'border-heat/60 text-heat'
                : 'border-line/30 text-ink-3 hover:border-brand-hi/60 hover:text-ink-2'
        }`}
      >
        {busy ? (
          <Spinner className="h-5 w-5 text-brand-hi" />
        ) : value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${value.mimeType};base64,${value.data}`}
              alt={label}
              className="h-full w-full object-cover"
            />
            <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-charge text-[#0b1204] shadow-charge">
              <Icon name="check" size={12} strokeWidth={3} />
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 px-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand-hi">
              <Icon name={error ? 'x' : icon} size={18} />
            </span>
            <span className="font-semibold">{error ? t('imageError') : t('tapToUpload')}</span>
          </span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </label>
  );
}
