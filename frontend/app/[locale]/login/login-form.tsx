'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  login,
  register,
  sendOtp,
  forgotPassword,
  resetPassword,
  getToken,
  ApiError,
} from '../../../lib/api';
import { CountrySelect } from '../../../components/CountrySelect';
import { LogoLockup, LogoMark } from '../../../components/Logo';
import { LocaleSwitcher } from '../../../components/LocaleSwitcher';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { Button, Chip, Eyebrow, Icon, Notice, Panel, Segmented, type IconName } from '../../../components/ui';
import { useMiningFX } from '../../../lib/use-mining-fx';

type Mode = 'login' | 'register' | 'forgot';
type Step = 'form' | 'otp';

const STAT_KEYS = ['baseRate', 'conversion', 'minWithdrawal', 'boosterDuration'] as const;
const STAT_VALUES: Record<(typeof STAT_KEYS)[number], string> = {
  baseRate: '0.90 /h',
  conversion: '3 : 1',
  minWithdrawal: '100 VOLTS',
  boosterDuration: '30 Days',
};

/** The three things a new miner is promised, keyed to landing.rig.points. */
const VALUE_POINTS: { key: 'cores' | 'cooling' | 'stability'; icon: IconName }[] = [
  { key: 'cores', icon: 'chip' },
  { key: 'cooling', icon: 'snow' },
  { key: 'stability', icon: 'gauge' },
];

// useSearchParams() needs a Suspense boundary for this route to prerender.
export default function LoginForm() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const t = useTranslations('auth');
  const tLanding = useTranslations('landing');
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const search = useSearchParams();
  const { playError, playTick } = useMiningFX();

  const [mode, setMode] = useState<Mode>(
    search.get('ref') || search.get('mode') === 'register' ? 'register' : 'login',
  );
  const [step, setStep] = useState<Step>('form');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState(search.get('ref') ?? '');
  const [countryCode, setCountryCode] = useState('');

  // OTP & Reset Password fields
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setErrorState] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Every error also gets the error cue, so the sound stays in one place.
  function setError(msg: string | null) {
    setErrorState(msg);
    if (msg) playError();
  }


  /**
   * Where to land after a successful sign-in. A `?next=` on the login URL
   * wins (only same-site, locale-prefixed paths), then the path a public
   * share page stashed before sending the visitor here, else the dashboard.
   */
  function afterAuthPath(): string {
    const fallback = `/${params.locale}/dashboard`;
    const ok = (v: string | null) => !!v && v.startsWith(`/${params.locale}/`) && !v.startsWith('//');
    const fromQuery = search.get('next');
    if (ok(fromQuery)) return fromQuery as string;
    try {
      const stashed = localStorage.getItem('voltara_return_path');
      if (ok(stashed)) {
        localStorage.removeItem('voltara_return_path');
        return stashed as string;
      }
    } catch {
      /* private mode */
    }
    return fallback;
  }

  useEffect(() => {
    if (getToken() && !search.get('ref')) {
      router.replace(afterAuthPath());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, params.locale, search]);

  function switchMode(next: Mode) {
    playTick();
    setMode(next);
    setStep('form');
    setErrorState(null);
    setInfoMsg(null);
  }

  // 1. Initial Submit (Form Phase)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorState(null);
    setInfoMsg(null);

    if (mode === 'login') {
      if (!email.trim() || !password.trim()) {
        setError('Please enter your email and password.');
        return;
      }
      setBusy(true);
      try {
        await login({
          email: email.trim().toLowerCase(),
          password,
        });
        router.push(afterAuthPath());
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Invalid email or password.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'register') {
      if (!email.trim() || !password.trim()) {
        setError('Please enter your email and password.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (!countryCode) {
        setError(t('countryRequired'));
        return;
      }
      // Check if email already exists before sending OTP!
      setBusy(true);
      try {
        const res = await sendOtp(email.trim().toLowerCase(), 'signup');
        setStep('otp');
        setInfoMsg(res.message || 'Verification code sent to your email. Please check your inbox.');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to send verification code.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'forgot') {
      // Initiate forgot password recovery
      if (!email.trim()) {
        setError('Please enter your account email address.');
        return;
      }
      setBusy(true);
      try {
        const res = await forgotPassword(email.trim().toLowerCase());
        setStep('otp');
        setInfoMsg(res.message || 'Password reset OTP sent to your email. Please check your inbox.');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No account found with this email address.');
      } finally {
        setBusy(false);
      }
    }
  }

  // 2. Finalize with real dynamic OTP (OTP Phase)
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorState(null);
    setInfoMsg(null);

    if (!otp.trim()) {
      setError('Please enter the verification code sent to your email.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        const res = await register({
          email,
          password,
          referralCode,
          countryCode,
          otp: otp.trim(),
        });
        if (res.referralRejected) {
          alert(t('referralRejected'));
        }
        router.push(afterAuthPath());
      } else if (mode === 'login') {
        await login({
          email,
          password,
          otp: otp.trim(),
        });
        router.push(afterAuthPath());
      } else if (mode === 'forgot') {
        if (!newPassword || newPassword.length < 8) {
          setError('New password must be at least 8 characters long.');
          setBusy(false);
          return;
        }
        const res = await resetPassword({
          email,
          otp: otp.trim(),
          newPassword,
        });
        setInfoMsg(res.message || 'Password reset successfully! Please sign in.');
        setMode('login');
        setStep('form');
        setPassword('');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const res = await (mode === 'forgot' ? forgotPassword(email) : sendOtp(email));
      setInfoMsg(res.message || 'A new verification code has been sent to your email.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resend code.');
    } finally {
      setBusy(false);
    }
  }

  const heading =
    mode === 'forgot'
      ? 'Reset Password'
      : step === 'otp'
        ? 'Verify Code'
        : mode === 'login'
          ? t('signIn')
          : t('createAccount');
  const lede =
    mode === 'forgot'
      ? 'Enter your email to receive a recovery code & set a new password.'
      : step === 'otp'
        ? 'Enter the verification code sent to your email.'
        : mode === 'login'
          ? 'Access your rig, your grid and your daily yield.'
          : 'Start earning VOLTS with zero hardware cost.';

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      {/* ───────────── Top bar ───────────── */}
      <header
        className="v-glass sticky top-0 z-40 border-b"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
          <Link
            href={`/${params.locale}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line/25 px-2.5 py-1 text-[11px] font-bold text-ink-2 transition hover:border-brand-hi/60 hover:text-ink"
          >
            <Icon name="chevron-left" size={12} />
            {t('backHome')}
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LocaleSwitcher locale={params.locale} />
            <span className="lg:hidden">
              <LogoMark size={30} />
            </span>
          </div>
        </div>
      </header>

      <main
        className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-6 sm:px-6 lg:min-h-0 lg:grid-cols-12 lg:gap-12 lg:py-4"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* ───────────── Brand column (desktop) ───────────── */}
        <aside className="order-2 hidden lg:order-1 lg:col-span-6 lg:block">
          <div className="animate-rise">
            <LogoLockup width={220} />
            <Chip tone="charge" dot className="mt-6">
              BNB Chain · BEP-20 payouts
            </Chip>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink xl:text-4xl">
              {tLanding('hero.title')} <span className="v-text-brand">{tLanding('hero.titleAccent')}</span>
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-2">{tLanding('hero.subtitle')}</p>
          </div>

          <ul className="v-stagger mt-6 grid grid-cols-2 gap-3">
            {VALUE_POINTS.map(({ key, icon }) => (
              <li key={key} className="v-inset flex gap-3 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/30 bg-brand/10 text-brand-hi">
                  <Icon name={icon} size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink">{tLanding(`rig.points.${key}.title`)}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-2">
                    {tLanding(`rig.points.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            {STAT_KEYS.map((key) => (
              <span key={key} className="v-chip">
                <span className="v-num text-charge">{STAT_VALUES[key]}</span>
                <span className="text-ink-3">{tLanding(`figures.${key}`)}</span>
              </span>
            ))}
          </div>
        </aside>

        {/* ───────────── Auth panel ───────────── */}
        <div className="order-1 w-full lg:order-2 lg:col-span-6 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto">
          <Panel hud className="mx-auto w-full max-w-md animate-pop p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <LogoMark size={34} />
              <div className="leading-none">
                <div className="font-display text-sm font-bold tracking-[0.2em] text-ink">VOLTARA</div>
                <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-charge">The Grid</div>
              </div>
            </div>

            <Eyebrow tone="charge">{step === 'otp' ? 'Step 2 / 2' : mode === 'forgot' ? 'Recovery' : 'Step 1 / 2'}</Eyebrow>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">{heading}</h1>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2 sm:text-sm lg:hidden">{lede}</p>

            {step === 'form' && mode !== 'forgot' && (
              <Segmented
                className="mt-4 grid w-full grid-cols-2"
                value={mode}
                onChange={(m) => switchMode(m)}
                options={[
                  { value: 'login', label: t('signIn') },
                  { value: 'register', label: t('signUp') },
                ]}
              />
            )}

            {infoMsg && (
              <Notice tone="brand" icon={<Icon name="bell" size={16} />} className="mt-4 text-xs">
                {infoMsg}
              </Notice>
            )}
            {error && (
              <Notice tone="heat" icon={<Icon name="x" size={16} />} className="mt-4 text-xs">
                {error}
              </Notice>
            )}

            {step === 'form' ? (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
                <AuthField
                  label={t('email')}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  inputMode="email"
                  enterKeyHint="next"
                  icon="bell"
                  iconOverride={<IconMail />}
                />

                {mode !== 'forgot' && (
                  <div>
                    <AuthField
                      label={t('password')}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={setPassword}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      enterKeyHint={mode === 'register' ? 'next' : 'done'}
                      icon="lock"
                      endAdornment={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                          className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 transition hover:bg-brand/10 hover:text-brand-hi"
                        >
                          {showPassword ? <IconEyeOff /> : <IconEye />}
                        </button>
                      }
                    />
                    {mode === 'login' && (
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          className="text-xs font-bold text-brand-hi underline-offset-2 transition hover:text-charge hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {mode === 'register' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CountrySelect
                      id="signup-country"
                      locale={params.locale}
                      value={countryCode}
                      onChange={setCountryCode}
                      label={t('country')}
                      placeholder={t('countryPlaceholder')}
                      required
                    />
                    <AuthField
                      label={t('referralCode')}
                      type="text"
                      value={referralCode}
                      onChange={setReferralCode}
                      enterKeyHint="done"
                      icon="gift"
                      optional
                    />
                  </div>
                )}

                {mode === 'register' && <p className="text-[11px] leading-snug text-ink-3">{t('passwordHint')}</p>}

                <Button type="submit" variant="primary" size="md" loading={busy} className="w-full">
                  {busy ? (
                    <span>{t('working')}</span>
                  ) : (
                    <>
                      <span>
                        {mode === 'forgot' ? 'Send reset code' : mode === 'login' ? t('signIn') : 'Continue to verify'}
                      </span>
                      <Icon name="chevron-right" size={16} />
                    </>
                  )}
                </Button>

                {mode === 'forgot' && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-ink-2 transition hover:text-ink"
                    >
                      <Icon name="chevron-left" size={12} />
                      Back to sign in
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3" noValidate>
                <label className="block">
                  <span className="v-label">Verification code (OTP)</span>
                  <input
                    className="v-input v-num py-3.5 text-center text-2xl font-extrabold tracking-[0.5em] text-charge placeholder:tracking-[0.3em] placeholder:text-ink-3"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    autoFocus
                    required
                  />
                  <span className="mt-2 block text-center text-[11px] text-ink-3">
                    Enter the security code sent to <span className="font-semibold text-ink-2">{email}</span>
                  </span>
                </label>

                {mode === 'forgot' && (
                  <AuthField
                    label="New Password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                    enterKeyHint="done"
                    icon="lock"
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={showNewPassword ? t('hidePassword') : t('showPassword')}
                        className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 transition hover:bg-brand/10 hover:text-brand-hi"
                      >
                        {showNewPassword ? <IconEyeOff /> : <IconEye />}
                      </button>
                    }
                  />
                )}

                <Button type="submit" variant="charge" size="lg" loading={busy} className="mt-1 w-full">
                  {busy ? (
                    <span>Verifying…</span>
                  ) : (
                    <>
                      <Icon name="check" size={16} />
                      <span>
                        {mode === 'forgot'
                          ? 'Set new password'
                          : mode === 'login'
                            ? 'Verify & sign in'
                            : 'Verify & create account'}
                      </span>
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="inline-flex items-center gap-1 font-bold text-ink-2 transition hover:text-ink"
                  >
                    <Icon name="chevron-left" size={12} />
                    Back to edit
                  </button>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={busy}
                    className="font-bold text-brand-hi transition hover:text-charge disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
              </form>
            )}
          </Panel>

          <p className="mx-auto mt-5 max-w-sm text-center text-[11px] leading-relaxed text-ink-3 lg:hidden">
            {tLanding('hero.honesty')}
          </p>
        </div>
      </main>
    </div>
  );
}

function AuthField({
  label,
  type,
  value,
  onChange,
  autoComplete,
  inputMode,
  enterKeyHint,
  icon,
  iconOverride,
  endAdornment,
  optional,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  enterKeyHint?: React.HTMLAttributes<HTMLInputElement>['enterKeyHint'];
  icon: IconName;
  iconOverride?: React.ReactNode;
  endAdornment?: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="v-label">
        {label}
        {optional && <span className="ml-1 font-medium normal-case tracking-normal text-ink-3">(optional)</span>}
      </span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
          {iconOverride ?? <Icon name={icon} size={16} />}
        </span>
        <input
          className={`v-input py-2.5 pl-10 text-sm ${endAdornment ? 'pr-11' : 'pr-4'}`}
          type={type}
          value={value}
          required={!optional}
          autoComplete={autoComplete}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          autoCapitalize={type === 'email' ? 'none' : undefined}
          autoCorrect={type === 'email' ? 'off' : undefined}
          spellCheck={type === 'email' ? false : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {endAdornment && <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{endAdornment}</span>}
      </div>
    </label>
  );
}

/* The icon set has no envelope or eye glyphs; these three stay local. */
function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="m3.5 7 8.5 6 8.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.6 6.8C4 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.5 4.6-1.2M9.9 5.2C10.6 5.1 11.3 5 12 5c6.5 0 10 7 10 7-.5.9-1.2 1.9-2.1 2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
