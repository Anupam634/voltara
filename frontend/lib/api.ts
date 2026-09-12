'use client';

/**
 * Thin client for the Voltara API.
 *
 * Holds the JWT and the browser's device id, and attaches both to every
 * request — the backend uses the device id for its anti-abuse checks
 * (SPEC §7).
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'voltara_token';
const DEVICE_KEY = 'voltara_device';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function logout() {
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Stable per-browser id. A placeholder for a real fingerprinting library —
 * clearing storage resets it, so treat it as a signal, not proof of identity.
 */
export function deviceFingerprint(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    // Nest error bodies are { message: string | string[], statusCode }.
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message)
        ? body.message.join(', ')
        : (body.message ?? message);
    } catch {
      /* non-JSON error body — keep the status text */
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────── Auth ───────────────────────────

export interface SessionUser {
  id: string;
  email: string | null;
  referralCode: string;
}

interface AuthResponse {
  accessToken: string;
  user: SessionUser;
  referralRejected?: boolean;
}

export async function register(params: {
  email: string;
  password: string;
  referralCode?: string;
  countryCode?: string;
  otp?: string;
}): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      referralCode: params.referralCode || undefined,
      countryCode: params.countryCode || undefined,
      otp: params.otp || undefined,
      deviceFingerprint: deviceFingerprint(),
    }),
  });
  setToken(data.accessToken);
  return data;
}

export async function login(params: {
  email: string;
  password: string;
  otp?: string;
}): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      otp: params.otp || undefined,
      deviceFingerprint: deviceFingerprint(),
    }),
  });
  setToken(data.accessToken);
  return data;
}

export async function sendOtp(
  email: string,
  purpose: 'signup' | 'login' | 'forgot_password' = 'signup',
): Promise<{ success: boolean; message: string }> {
  return apiFetch('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email, purpose }),
  });
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(params: {
  email: string;
  otp: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface Profile {
  id: string;
  email: string | null;
  walletAddress: string | null;
  countryCode: string | null;
  pointsBalance: number;
  referralCode: string;
  referralCount: number;
  referralTier: { level: number; multiplier: number };
  kycStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  /** False while verification is not being collected at all. */
  kycOpen: boolean;
  createdAt: string;
}

export const getProfile = () => apiFetch<Profile>('/auth/me');

// ────────────────────────── Referrals ──────────────────────────

export interface ReferralMember {
  id: string;
  maskedEmail: string;
  countryCode: string;
  joinedAt: string;
  lastMineAt: string | null;
  isMiningActive: boolean;
  reminder: ReferralReminderState;
}

/** Whether the inviter may email this referral a "come back and mine" nudge. */
export interface ReferralReminderState {
  canSend: boolean;
  /** Why not, when `canSend` is false. */
  reason: 'ACTIVE' | 'NO_EMAIL' | 'COOLDOWN' | 'BLOCKED' | null;
  sentAt: string | null;
  /** When the per-referral cooldown lifts. */
  availableAt: string | null;
}

export interface ReferralRemindResponse {
  sentAt: string;
  availableAt: string;
}

export interface ReferralTierInfo {
  minInvites: number;
  maxInvites: number;
  level: number;
  multiplier: number;
}

/** What a rung of the hardware ladder hands over (GROWTH.md §3). */
export type ReferralRewardKind = 'LOANER_EXTENSION' | 'PART' | 'SLOT' | 'BADGE';

export interface ReferralRewardTierDto {
  tier: number;
  invites: number;
  kind: ReferralRewardKind;
  /** Machine name: LOANER_24H, CX2, PS3, SLOT_7, GRID_OPERATOR. */
  reward: string;
  /** English fallback; the UI renders its own translated copy. */
  label: string;
  partCode: string | null;
  durationDays: number | null;
  unlocked: boolean;
  /** Whether the grant has actually landed in the miner's ledger. */
  granted: boolean;
  invitesNeeded: number;
}

export interface ReferralStatsResponse {
  referralCode: string;
  totalInvited: number;
  activeMinersCount: number;
  currentTier: ReferralTierInfo;
  nextTier: ReferralTierInfo | null;
  progressToNextPercent: number;
  invitesNeededForNext: number;
  allTiers: ReferralTierInfo[];
  referralsList: ReferralMember[];
  /** Optional so the UI keeps rendering against an API that predates it. */
  rewardTiers?: ReferralRewardTierDto[];
  nextRewardTier?: { tier: number; invites: number; reward: string; label: string } | null;
}

export const getReferralStats = () =>
  apiFetch<ReferralStatsResponse>('/referrals/stats');

/** Email one idle referral a reminder to mine. Once per referral per cooldown. */
export const remindReferral = (referralId: string) =>
  apiFetch<ReferralRemindResponse>(
    `/referrals/${encodeURIComponent(referralId)}/remind`,
    { method: 'POST' },
  );

// ───────────────────────── Leaderboard ─────────────────────────

export type LeaderboardCategory = 'EARNINGS' | 'BALANCE' | 'REFERRALS';
export type LeaderboardPeriod = 'ALL_TIME' | 'MONTH' | 'WEEK';

export interface RankBadge {
  label: string;
  /** Podium medal, or an empty string outside the top 3. */
  medal: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  /** Privacy-masked — the API never returns another miner's full email. */
  displayName: string;
  countryCode: string;
  value: number;
  badge: RankBadge;
  isCurrentUser: boolean;
  isMiningActive: boolean;
  joinedAt: string | null;
  /**
   * The miner's referral code, which is already public — it is the key in
   * every share link. Present so a row can link through to /watch/:code.
   * Optional so the UI survives an API that predates spectator mode.
   */
  watchCode?: string | null;
}

export interface LeaderboardResponse {
  category: LeaderboardCategory;
  /** The period actually used — BALANCE always reports ALL_TIME. */
  period: LeaderboardPeriod;
  periodSupported: boolean;
  unit: 'points' | 'miners';
  totalRanked: number;
  generatedAt: string;
  entries: LeaderboardEntry[];
  me: {
    /** Null until the miner has a non-zero score in this category. */
    rank: number | null;
    value: number;
    percentile: number | null;
    badge: RankBadge;
    inTopList: boolean;
  };
}

export const getLeaderboard = (params: {
  category?: LeaderboardCategory;
  period?: LeaderboardPeriod;
  limit?: number;
} = {}) => {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.period) query.set('period', params.period);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<LeaderboardResponse>(`/leaderboard${qs ? `?${qs}` : ''}`);
};

// ────────────────────────── Mining ──────────────────────────

/**
 * Consecutive daily claims and what they are worth.
 *
 * Optional because the field ships with the retention release: a client
 * talking to an older API must render nothing here rather than crash.
 */
export interface StreakDto {
  days: number;
  bestDays: number;
  /** 0, 3, 7, 10 or 15 — the rate bonus the current run earns. */
  bonusPercent: number;
  nextTier: { days: number; bonusPercent: number } | null;
  /** ISO. Claim before this or the run resets. Null when never mined. */
  keepsUntil: string | null;
}

/** The three things a new miner has to do before the rig is really theirs. */
export interface OnboardingDto {
  claimedFirst: boolean;
  rigRunning: boolean;
  invited: boolean;
  done: boolean;
}

export interface MiningStatus {
  ratePerHour: number;
  pendingPoints: number;
  /** Parts currently socketed — not parts owned. */
  activeBoosters: number;
  /** Live rig readout, so the gauge never lags the rate it explains. */
  rig: RigTelemetryDto;
  canClaim: boolean;
  referralTier: { level: number; multiplier: number };
  /** ISO timestamp the 24h cooldown lifts, or null if never mined. */
  nextClaimAt: string | null;
  /** Accrual ceiling (rate × 24h) — pending stops growing here. */
  maxPendingPoints: number;
  streak?: StreakDto;
  onboarding?: OnboardingDto;
}

export const getMiningStatus = () => apiFetch<MiningStatus>('/mining/status');

export const claimMining = () =>
  apiFetch<{ earnedPoints: number; nextClaimAt: string }>('/mining/claim', {
    method: 'POST',
  });

// ──────────────────────────── Rig ───────────────────────────

export type RigPartKind = 'CORE' | 'COOLER' | 'PSU' | 'MODULE';

/** What a rig is producing, what it costs to run, and what survives. */
export interface RigTelemetryDto {
  hashPerHour: number;
  baseHashPerHour: number;
  heatLoad: number;
  coolingCapacity: number;
  powerDraw: number;
  powerSupply: number;
  /** 0–1 each. */
  thermalEfficiency: number;
  powerEfficiency: number;
  /** 0–100 — the headline number the whole UI is built around. */
  gridStability: number;
  overheating: boolean;
  brownout: boolean;
  installedCount: number;
  /** Installed parts currently burned out by an overclock roll. */
  disabledCount?: number;
  coolingSurplus?: number;
  powerSurplus?: number;
  /** Everything bending the physics right now (grid event, overclock, squad). */
  modifiers?: {
    heatMultBp: number;
    drawMultBp: number;
    hashMultBp: number;
    overclock: boolean;
    squadCooling: number;
    squadPower: number;
    /** Attribution: how much of heatMultBp came from the weather. */
    weatherHeatBp?: number;
    /** Attribution: the collective grid bonus, in basis points. */
    collectiveHashBp?: number;
  };
}

export type BoosterSource = 'PURCHASE' | 'LOANER' | 'REFERRAL' | 'CRAFT' | 'TRADE' | 'CHALLENGE';

/** A grid event as the rig overview reports it. */
export interface RigEventDto {
  id: string;
  code: string;
  title: string;
  body: string;
  heatMultBp: number;
  drawMultBp: number;
  hashMultBp: number;
  startsAt: string;
  endsAt: string;
}

/** One owned part, in a slot or waiting in inventory. */
export interface RigPartDto {
  id: string;
  planId: string;
  code: string | null;
  name: string;
  kind: RigPartKind;
  tier: number;
  priceUsd: number;
  hashPerHour: number;
  heat: number;
  cooling: number;
  watts: number;
  wattsSupplied: number;
  hashBoostPercent: number;
  startedAt: string;
  expiresAt: string;
  installedAt: string | null;
  source?: BoosterSource;
  /** Burned by an overclock roll until this passes. */
  disabledUntil?: string | null;
  burned?: boolean;
}

export interface RigOverview {
  chassis: {
    slots: number;
    baseCooling: number;
    basePower: number;
    bonusCooling: number;
    bonusPower: number;
    /** Equipped cosmetic skin id ("stock" by default). */
    skin?: string;
  };
  grid: { index: number; part: RigPartDto | null }[];
  inventory: RigPartDto[];
  telemetry: RigTelemetryDto;
  scrap?: number;
  squadId?: string | null;
  /** Today's weather where this miner lives, when the grid has a reading. */
  weather?: {
    countryCode: string;
    city: string;
    tempC: number;
    /** Signed: +13 means coolers are working 13% harder today. */
    heatPercent: number;
  } | null;
  /** The platform-wide stability bonus this rig is currently earning. */
  collective?: { bonusPercent: number; holding: boolean };
  event?: RigEventDto | null;
  overclock?: {
    active: boolean;
    until: string | null;
    hashBoostPercent: number;
    heatPercent: number;
    rateOff: number;
    rateOn: number;
    stabilityOff: number;
    stabilityOn: number;
  };
  rate: {
    ratePerHour: number;
    /** What the same build would earn with no throttle — the upsell. */
    potentialRatePerHour: number;
    throttledAwayPerHour: number;
    referralTier: { level: number; multiplier: number };
  };
}

export const getRig = () => apiFetch<RigOverview>('/rig');

export const installPart = (boosterId: string, slot: number) =>
  apiFetch<{ installed: true; index: number; telemetry: RigTelemetryDto }>(
    '/rig/install',
    { method: 'POST', body: JSON.stringify({ boosterId, slot }) },
  );

export const uninstallPart = (slot: number) =>
  apiFetch<{
    uninstalled: true;
    index: number;
    boosterId: string;
    telemetry: RigTelemetryDto;
  }>('/rig/uninstall', { method: 'POST', body: JSON.stringify({ slot }) });

// ─────────────────────────── Tasks ──────────────────────────

export interface TaskDto {
  id: string;
  type: 'TWEET' | 'FOLLOW' | 'REPOST' | 'YOUTUBE' | 'QUIZ' | 'SPIN_WHEEL';
  title: string;
  rewardPoints: number;
  cooldownHours: number;
  canClaim: boolean;
  nextAvailableAt: string | null;
  lastClaimedAt: string | null;
  /** Point value of each wheel segment, in order. Null for non-wheel tasks. */
  wheelSegments: number[] | null;
  /**
   * Dynamic quiz questions configured by admin.
   *
   * The answers are not here. The server withholds `correctIndex` and the
   * explanation (which names the answer in prose) until the claim is
   * submitted — grading happens there, not in this client.
   */
  quizQuestions?: QuizQuestionDto[] | null;
  /** Custom social/target URL */
  actionUrl?: string | null;
}

export interface QuizQuestionDto {
  id: number;
  question: string;
  options: string[];
}

/** How one answer was marked, returned by the server after a quiz claim. */
export interface QuizAnswerResultDto {
  id: number;
  yourAnswer: number;
  correctIndex: number;
  correct: boolean;
  explanation: string;
}

export interface QuizResultDto {
  correctCount: number;
  total: number;
  results: QuizAnswerResultDto[];
}

export interface ClaimTaskResultDto {
  earnedPoints: number;
  balancePoints: number;
  nextAvailableAt: string;
  /** Which wheel segment the server drew. Null for non-wheel tasks. */
  spinIndex: number | null;
  /** Marking and explanations for a QUIZ claim. Null for other tasks. */
  quiz: QuizResultDto | null;
}

export const getTasks = () => apiFetch<TaskDto[]>('/tasks');

/**
 * Claim a task reward.
 *
 * `answers` is required for QUIZ tasks — the chosen option index per
 * question, in order. The reward is scaled by how many were right, and the
 * cooldown starts either way.
 */
export const claimTask = (id: string, answers?: number[]) =>
  apiFetch<ClaimTaskResultDto>(`/tasks/${id}/claim`, {
    method: 'POST',
    body: JSON.stringify(answers ? { answers } : {}),
  });

// ──────────────────────────── KYC ───────────────────────────

export type KycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface KycStatusDto {
  status: KycStatus;
  fullName: string | null;
  documentType: string | null;
  countryCode: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerNote: string | null;
  canSubmit: boolean;
  /** False while verification is not being collected at all. */
  open: boolean;
  /** Announced opening instant, so the UI can say *when*. */
  opensAt: string | null;
}

export interface KycImage {
  mimeType: string;
  data: string;
}

export const getKyc = () => apiFetch<KycStatusDto>('/kyc');

export const submitKyc = (body: {
  fullName: string;
  documentType: string;
  documentNumber: string;
  countryCode: string;
  front: KycImage;
  back?: KycImage;
  selfie: KycImage;
}) =>
  apiFetch<KycStatusDto>('/kyc', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// ───────────────────────── Boosters ─────────────────────────

/** A catalogue part. `rateBonusPerHour` is hash; the rest is running cost. */
/** One step of a suggested fix: a part the rig needs to run what you just added. */
export interface PartFixStep {
  code: string;
  name: string;
  priceUsd: number;
}

/** The cheap working set that gets a deficit build back to full output. */
export interface PartFix {
  steps: PartFixStep[];
  /** Dollars on top of the part itself. */
  extraUsd: number;
  totalUsd: number;
  stability: number;
  ratePerHour: number;
  /** Whether it truly reaches 100%, or only improves things. */
  clean: boolean;
}

/**
 * This part simulated against the caller's OWN rig.
 *
 * Null when the rig could not be read. Prefer every figure here over
 * `resultingRatePerHour`, which is a stock-chassis number and is wrong for
 * anyone who already owns parts.
 */
export interface PartFit {
  code: string;
  freeSlots: number;
  fits: boolean;
  stabilityBefore: number;
  stabilityAfter: number;
  ratePerHourBefore: number;
  ratePerHourAfter: number;
  heatShort: number;
  wattsShort: number;
  clean: boolean;
  fix: PartFix | null;
}

export interface BoosterPlanDto {
  id: string;
  code: string | null;
  name: string;
  kind: RigPartKind;
  tier: number;
  priceUsd: number;
  rateBonusPerHour: number;
  heat: number;
  cooling: number;
  watts: number;
  wattsSupplied: number;
  hashBoostPercent: number;
  durationDays: number;
  /** Stock-chassis figure — decoration once a miner owns parts. Use `fit`. */
  resultingRatePerHour: number;
  fit: PartFit | null;
}

export interface ActiveBoosterDto {
  id: string;
  planId: string;
  code: string | null;
  name: string;
  kind: RigPartKind;
  tier: number;
  priceUsd: number;
  rateBonusPerHour: number;
  heat: number;
  cooling: number;
  watts: number;
  wattsSupplied: number;
  hashBoostPercent: number;
  startedAt: string;
  expiresAt: string;
  /** Slot it is running in, or null when it is sitting in inventory. */
  installedSlot: number | null;
}

export interface BoosterPurchaseDto {
  id: string;
  status: 'AWAITING_PAYMENT' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';
  tokenSymbol: string;
  amount: string;
  payToAddress: string;
  fromAddress: string;
  txHash: string | null;
  failureReason: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface BoosterOverview {
  payment: {
    enabled: boolean;
    disabledReason?: string;
    tokenSymbol: string;
    payToAddress: string | null;
    minConfirmations: number;
  };
  plans: BoosterPlanDto[];
  activeBoosters: ActiveBoosterDto[];
  purchases: BoosterPurchaseDto[];
}

export const getBoosters = () => apiFetch<BoosterOverview>('/boosters');

export const createBoosterIntent = (planId: string, fromAddress: string) =>
  apiFetch<BoosterPurchaseDto>('/boosters/purchase', {
    method: 'POST',
    body: JSON.stringify({ planId, fromAddress }),
  });

export const submitBoosterPayment = (purchaseId: string, txHash: string) =>
  apiFetch<{
    activated: boolean;
    booster: {
      id: string;
      code: string | null;
      name: string;
      kind: RigPartKind;
      rateBonusPerHour: number;
      expiresAt: string;
      /** Slot it was auto-installed into, or null when the rig was full. */
      installedSlot: number | null;
    };
  }>(`/boosters/purchase/${purchaseId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  });

// ─────────────────── Mining history / earnings ──────────────

export interface LedgerEntryDto {
  id: string;
  reason:
    | 'MINING'
    | 'TASK_REWARD'
    | 'REFERRAL_BONUS'
    | 'BOOSTER_PURCHASE'
    | 'WITHDRAWAL'
    | 'AIRDROP'
    | 'ADMIN_ADJUST';
  points: number;
  createdAt: string;
}

export interface MiningHistory {
  lifetimeEarnedPoints: number;
  entries: LedgerEntryDto[];
}

export const getMiningHistory = () => apiFetch<MiningHistory>('/mining/history');

// ───────────────────────── Withdrawals ──────────────────────

export interface WithdrawalDto {
  id: string;
  /** Points debited, in whole points (the API divides milli-points by 1000). */
  points: number;
  /** $VLTR to be paid out — points ÷ 3, as a decimal string. */
  tokenAmount: string;
  toAddress: string;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  txHash: string | null;
  /** Reviewer's note — the reason shown to the user when REJECTED. */
  adminNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

/** Rules the server enforces on a request (SPEC §4) — mirrored for the UI. */
export const WITHDRAWAL_MIN_POINTS = 100;
export const WITHDRAWAL_COOLDOWN_DAYS = 7;

/**
 * Whether payouts are open yet.
 *
 * $VLTR does not exist until the token launches, and a request accepted
 * before then would debit the miner's balance into an escrow nobody can
 * release. The server refuses those outright, so the screen asks first and
 * shows the closed state rather than a form that fails on submit.
 */
export interface PayoutWindowDto {
  open: boolean;
  /** Announced opening instant, ISO, or null if no date is set yet. */
  opensAt: string | null;
}

export const getPayoutWindow = () =>
  apiFetch<PayoutWindowDto>('/withdrawals/window');

export const getWithdrawals = () => apiFetch<WithdrawalDto[]>('/withdrawals');

export const requestWithdrawal = (points: number, toAddress: string) =>
  apiFetch<WithdrawalDto>('/withdrawals', {
    method: 'POST',
    body: JSON.stringify({ points, toAddress }),
  });

// ─────────────────────────── Support ────────────────────────

export interface SupportMessageDto {
  id: string;
  /** False for the miner's own messages, true for an operator reply. */
  fromAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface SupportTicketDto {
  id: string;
  subject: string;
  status: 'OPEN' | 'ANSWERED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  messages: SupportMessageDto[];
}

/** Server-side cap on tickets left unresolved — mirrored so the UI can explain it. */
export const SUPPORT_MAX_OPEN = 3;

export const getSupportTickets = () => apiFetch<SupportTicketDto[]>('/support');

export const createSupportTicket = (subject: string, body: string) =>
  apiFetch<SupportTicketDto>('/support', {
    method: 'POST',
    body: JSON.stringify({ subject, body }),
  });

export const replyToSupportTicket = (id: string, body: string) =>
  apiFetch<SupportTicketDto>(`/support/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });

/* ─────────────────── Public rig card (share landing) ────────────────── */

export interface RigCardSlotDto {
  kind: RigPartKind;
  code: string | null;
  name: string;
  tier: number;
}

/**
 * A miner's build as strangers see it. Everything here is masked or derived
 * — there is no balance, no inventory and no email. See the backend's
 * `RigService.cardFor`.
 */
export interface RigCardDto {
  name: string;
  countryCode: string | null;
  ratePerHour: number;
  gridStability: number;
  slots: (RigCardSlotDto | null)[];
  partCount: number;
  skin: string;
  streakDays: number;
  joinedAt: string;
}

/** Public: no session needed. 404s for an unknown or blocked miner. */
export const getRigCard = (code: string) =>
  apiFetch<RigCardDto>(`/rig/card/${encodeURIComponent(code)}`);

/* ───────────────────── Spectating a rig ──────────────────────────── */

export interface WatchSlotDto {
  index: number;
  kind: RigPartKind;
  code: string | null;
  name: string;
  tier: number;
  heat: number;
  cooling: number;
  watts: number;
  wattsSupplied: number;
  /** The rig is over its cooling budget and this part is one of the sources. */
  hot: boolean;
  burned: boolean;
}

/**
 * A rig as a spectator sees it: the card, plus the live readout behind it.
 * Public, masked, and refreshed every 15s server-side. See
 * `RigService.watchFor`.
 */
export interface RigWatchDto extends RigCardDto {
  telemetry: {
    gridStability: number;
    heatLoad: number;
    coolingCapacity: number;
    powerDraw: number;
    powerSupply: number;
    thermalEfficiency: number;
    powerEfficiency: number;
    overheating: boolean;
    brownout: boolean;
    installedCount: number;
    disabledCount: number;
  };
  overclocking: boolean;
  slotsDetail: (WatchSlotDto | null)[];
  event: { code: string; title: string; endsAt: string } | null;
}

/** Public: no session needed. 404s for an unknown or blocked miner. */
export const getRigWatch = (code: string) =>
  apiFetch<RigWatchDto>(`/rig/watch/${encodeURIComponent(code)}`);

/* ──────────────────────── Apprenticeship ─────────────────────────── */

export type ApprenticeshipStatus = 'PENDING' | 'ACTIVE' | 'ENDED';

export interface ApprenticePeerDto {
  id: string;
  name: string;
  countryCode: string | null;
  joinedAt: string;
  /** Feeds /rig/watch/:code, so a mentor can watch what they are teaching. */
  watchCode: string;
  ratePerHour: number;
  gridStability: number;
}

export interface ApprenticeshipDto {
  id: string;
  status: ApprenticeshipStatus;
  role: 'mentor' | 'apprentice';
  cutPercent: number;
  createdAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
  cutExpiresAt: string | null;
  other: ApprenticePeerDto | null;
}

export type MentorBlock =
  | 'TOO_NEW'
  | 'RIG_UNSTABLE'
  | 'AT_CAPACITY'
  | 'IS_APPRENTICE';

export interface ApprenticeOverviewDto {
  asMentor: ApprenticeshipDto[];
  pendingOffers: ApprenticeshipDto[];
  asApprentice: ApprenticeshipDto | null;
  invitesOpen: ApprenticeshipDto[];
  eligible: {
    canMentor: boolean;
    reason: MentorBlock | null;
    daysToWait: number;
    activeCount: number;
    capacity: number;
  };
  cutDays: number;
  maxApprentices: number;
  mentorEarnedPoints: number;
}

export const getApprentice = () =>
  apiFetch<ApprenticeOverviewDto>('/apprentice');

export const offerApprenticeship = (apprenticeCode: string) =>
  apiFetch<ApprenticeshipDto>('/apprentice/offer', {
    method: 'POST',
    body: JSON.stringify({ apprenticeCode }),
  });

export const acceptApprenticeship = (id: string) =>
  apiFetch<ApprenticeshipDto>('/apprentice/accept', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });

export const declineApprenticeship = (id: string) =>
  apiFetch<ApprenticeshipDto>('/apprentice/decline', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });

export const endApprenticeship = (id: string) =>
  apiFetch<ApprenticeshipDto>('/apprentice/end', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });

export const giftPart = (apprenticeshipId: string, boosterId: string) =>
  apiFetch<{ gifted: true; boosterId: string; partCode: string | null; slot: number | null }>(
    '/apprentice/gift',
    { method: 'POST', body: JSON.stringify({ apprenticeshipId, boosterId }) },
  );
