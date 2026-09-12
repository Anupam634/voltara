import { apiFetch, deviceFingerprint, setToken } from './client';

/**
 * Every route the app talks to, typed exactly as the server returns it.
 * Mirrors `frontend/lib/api.ts` so both clients drift together, not apart.
 */

/* ─────────────────────────────── Auth ─────────────────────────────── */

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
  countryCode: string;
  otp?: string;
}): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      referralCode: params.referralCode || undefined,
      countryCode: params.countryCode,
      otp: params.otp || undefined,
      deviceFingerprint: await deviceFingerprint(),
    }),
  });
  await setToken(data.accessToken);
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
      email: params.email,
      password: params.password,
      otp: params.otp || undefined,
      deviceFingerprint: await deviceFingerprint(),
    }),
  });
  await setToken(data.accessToken);
  return data;
}

export const sendOtp = (
  email: string,
  purpose: 'signup' | 'login' | 'forgot_password' = 'signup',
) =>
  apiFetch<{ success: boolean; message: string }>('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email, purpose }),
  });

export const forgotPassword = (email: string) =>
  apiFetch<{ success: boolean; message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const resetPassword = (params: {
  email: string;
  otp: string;
  newPassword: string;
}) =>
  apiFetch<{ success: boolean; message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export type KycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Profile {
  id: string;
  email: string | null;
  walletAddress: string | null;
  countryCode: string | null;
  pointsBalance: number;
  referralCode: string;
  referralCount: number;
  referralTier: { level: number; multiplier: number };
  kycStatus: KycStatus;
  /** False while verification is not being collected at all. */
  kycOpen: boolean;
  createdAt: string;
}

export const getProfile = () => apiFetch<Profile>('/auth/me');

/* ────────────────────────────── Mining ────────────────────────────── */

/** A rung on the streak ladder. */
export interface StreakTierDto {
  days: number;
  bonusPercent: number;
}

/** Consecutive daily claims, and what the run is currently worth. */
export interface StreakDto {
  days: number;
  bestDays: number;
  /** 0, 3, 7, 10 or 15. */
  bonusPercent: number;
  /** The rung being climbed towards, or null at the top. */
  nextTier: StreakTierDto | null;
  /** ISO — claim before this or the run resets. Null if never mined. */
  keepsUntil: string | null;
}

/** The three things a new miner has to do before the app makes sense. */
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
  /** Optional until the streak API ships; absent means "render nothing". */
  streak?: StreakDto;
  onboarding?: OnboardingDto;
}

export const getMiningStatus = () => apiFetch<MiningStatus>('/mining/status');

export const claimMining = () =>
  apiFetch<{ earnedPoints: number; nextClaimAt: string }>('/mining/claim', {
    method: 'POST',
  });

export type LedgerReason =
  | 'MINING'
  | 'TASK_REWARD'
  | 'REFERRAL_BONUS'
  | 'BOOSTER_PURCHASE'
  | 'WITHDRAWAL'
  | 'AIRDROP'
  | 'ADMIN_ADJUST';

export interface LedgerEntryDto {
  id: string;
  reason: LedgerReason;
  points: number;
  createdAt: string;
}

export interface MiningHistory {
  lifetimeEarnedPoints: number;
  entries: LedgerEntryDto[];
}

/** `take` caps the ledger rows returned (server default 12, max 200). */
export const getMiningHistory = (take?: number) =>
  apiFetch<MiningHistory>(
    take ? `/mining/history?take=${Math.round(take)}` : '/mining/history',
  );

/* ─────────────────────────────── Tasks ────────────────────────────── */

export type TaskType =
  | 'TWEET'
  | 'FOLLOW'
  | 'REPOST'
  | 'YOUTUBE'
  | 'QUIZ'
  | 'SPIN_WHEEL';

/**
 * A question as the client is allowed to see it before answering.
 *
 * `correctIndex` and `explanation` (which names the answer in prose) are
 * withheld by the server until the answers are submitted — grading happens
 * there, not here.
 */
export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
}

/** How one submitted answer was marked. */
export interface QuizAnswerResult {
  id: number;
  yourAnswer: number;
  correctIndex: number;
  correct: boolean;
  explanation: string;
}

export interface QuizResult {
  correctCount: number;
  total: number;
  results: QuizAnswerResult[];
}

export interface ClaimTaskResult {
  earnedPoints: number;
  balancePoints: number;
  nextAvailableAt: string;
  /** Which wheel segment the server drew. Null for non-wheel tasks. */
  spinIndex: number | null;
  /** Marking and explanations for a QUIZ claim. Null for other tasks. */
  quiz: QuizResult | null;
}

export interface TaskDto {
  id: string;
  type: TaskType;
  title: string;
  rewardPoints: number;
  cooldownHours: number;
  canClaim: boolean;
  nextAvailableAt: string | null;
  lastClaimedAt: string | null;
  /** Point value of each wheel segment, in order. Null for non-wheel tasks. */
  wheelSegments: number[] | null;
  quizQuestions?: QuizQuestion[] | null;
  actionUrl?: string | null;
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
  apiFetch<ClaimTaskResult>(`/tasks/${id}/claim`, {
    method: 'POST',
    body: JSON.stringify(answers ? { answers } : {}),
  });

/* ───────────────────────────── Referrals ──────────────────────────── */

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
}

export const getReferralStats = () =>
  apiFetch<ReferralStatsResponse>('/referrals/stats');

/** Email one idle referral a reminder to mine. Once per referral per cooldown. */
export const remindReferral = (referralId: string) =>
  apiFetch<ReferralRemindResponse>(
    `/referrals/${encodeURIComponent(referralId)}/remind`,
    { method: 'POST' },
  );

/* ──────────────────────────── Leaderboard ─────────────────────────── */

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
   * The miner's referral code, already public — it is the key in every share
   * link. Present so a row can open the spectator view. Optional so the app
   * survives an API that predates it.
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

export const getLeaderboard = (
  params: {
    category?: LeaderboardCategory;
    period?: LeaderboardPeriod;
    limit?: number;
  } = {},
) => {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.period) query.set('period', params.period);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<LeaderboardResponse>(`/leaderboard${qs ? `?${qs}` : ''}`);
};

/* ──────────────────────────────── KYC ─────────────────────────────── */

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

/* ─────────────────────────────── Rig ──────────────────────────────── */

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
  modifiers?: {
    heatMultBp: number;
    drawMultBp: number;
    hashMultBp: number;
    overclock: boolean;
    squadCooling: number;
    squadPower: number;
  };
}

export type BoosterSource = 'PURCHASE' | 'LOANER' | 'REFERRAL' | 'CRAFT' | 'TRADE' | 'CHALLENGE';

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
  disabledUntil?: string | null;
  /** Burned by an overclock roll and still cooling off. */
  burned?: boolean;
}

/** A world event bending every rig's physics for a few hours. */
export interface GridEventDto {
  id: string;
  code: 'HEATWAVE' | 'COLD_SNAP' | 'CHEAP_POWER' | 'GRID_STRAIN' | 'SOLAR_SURGE' | string;
  title: string;
  body: string;
  heatMultBp: number;
  drawMultBp: number;
  hashMultBp: number;
  /** (bp − 10000) / 100, e.g. +30, −50. */
  heatPercent: number;
  drawPercent: number;
  hashPercent: number;
  startsAt: string;
  endsAt: string;
}

export interface GridEventBoard {
  active: GridEventDto | null;
  upcoming: GridEventDto | null;
  recent: GridEventDto[];
  serverTime: string;
}

export const getGridEvent = () => apiFetch<GridEventBoard>('/grid/event');

export interface OverclockDto {
  active: boolean;
  until: string | null;
  hashBoostPercent: number;
  heatPercent: number;
  rateOff: number;
  rateOn: number;
  stabilityOff: number;
  stabilityOn: number;
}

export interface RigOverview {
  chassis: {
    slots: number;
    baseCooling: number;
    basePower: number;
    bonusCooling: number;
    bonusPower: number;
    skin?: string;
  };
  grid: { index: number; part: RigPartDto | null }[];
  inventory: RigPartDto[];
  telemetry: RigTelemetryDto;
  rate: {
    ratePerHour: number;
    /** What the same build would earn with no throttle — the upsell. */
    potentialRatePerHour: number;
    throttledAwayPerHour: number;
    referralTier: { level: number; multiplier: number };
  };
  scrap?: number;
  squadId?: string | null;
  event?: GridEventDto | null;
  overclock?: OverclockDto;
  /** Today's weather where this miner lives, when the grid has a reading. */
  weather?: {
    countryCode: string;
    city: string;
    tempC: number;
    heatPercent: number;
  } | null;
  /** The platform-wide stability bonus this rig currently earns. */
  collective?: { bonusPercent: number; holding: boolean };
}

export const setOverclock = (on: boolean) =>
  apiFetch<RigOverview>('/rig/overclock', { method: 'POST', body: JSON.stringify({ on }) });

export const salvagePart = (boosterId: string) =>
  apiFetch<{ scrap: number; salvagedId: string; gained?: number }>('/rig/salvage', {
    method: 'POST',
    body: JSON.stringify({ boosterId }),
  });

export const craftPart = () =>
  apiFetch<{ part: RigPartDto; scrap: number; slot: number | null }>('/rig/craft', {
    method: 'POST',
  });

export interface SkinDto {
  id: string;
  name: string;
  priceVolts: number;
  description: string;
  accent: string;
  owned: boolean;
  equipped: boolean;
}

export interface SkinsDto {
  equipped: string;
  owned: string[];
  catalog: SkinDto[];
}

export const getSkins = () => apiFetch<SkinsDto>('/rig/skins');
export const buySkin = (skin: string) =>
  apiFetch<SkinsDto>('/rig/skins/buy', { method: 'POST', body: JSON.stringify({ skin }) });
export const equipSkin = (skin: string) =>
  apiFetch<SkinsDto>('/rig/skins/equip', { method: 'POST', body: JSON.stringify({ skin }) });

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

/* ──────────────────────── Parts shop (boosters) ────────────────────── */

/** A catalogue part. `rateBonusPerHour` is hash; the rest is running cost. */
/** One step of a suggested fix: a part the rig needs to run what was added. */
export interface PartFixStep {
  code: string;
  name: string;
  priceUsd: number;
}

/** The cheap working set that gets a deficit build back to full output. */
export interface PartFix {
  steps: PartFixStep[];
  extraUsd: number;
  totalUsd: number;
  stability: number;
  ratePerHour: number;
  /** Whether it truly reaches 100%, or only improves things. */
  clean: boolean;
}

/**
 * This part simulated against the caller's OWN rig, by the same engine the
 * dashboard and the claim use.
 *
 * Null when the rig could not be read. Every figure here beats a locally
 * computed projection: adding `rateBonusPerHour` to the current rate ignores
 * GRID STABILITY, so on a rig with no spare cooling it promises a gain the
 * miner will not get.
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

export type PurchaseStatus =
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED';

export interface BoosterPurchaseDto {
  id: string;
  status: PurchaseStatus;
  tokenSymbol: string;
  /** Human amount, e.g. "10.0". */
  amount: string;
  /** The same amount in the token's smallest unit — for wallet URIs. */
  expectedUnits: string;
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
    /** BEP-20 contract to pay in; null when payments are off or native BNB. */
    tokenAddress: string | null;
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

/* ──────────────────────────── Withdrawals ─────────────────────────── */

export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';

export interface WithdrawalDto {
  id: string;
  /** Points debited, in whole points. */
  points: number;
  /** $VLTR to be paid out — points ÷ 3, as a decimal string. */
  tokenAmount: string;
  toAddress: string;
  status: WithdrawalStatus;
  txHash: string | null;
  /** Reviewer's note — the reason shown to the user when REJECTED. */
  adminNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

/** Rules the server enforces on a request (SPEC §4) — mirrored for the UI. */
export const WITHDRAWAL_MIN_POINTS = 100;
export const WITHDRAWAL_COOLDOWN_DAYS = 7;
/** SPEC §3: 3 points = 1 mainnet $VLTR. */
export const POINTS_PER_TOKEN = 3;

/**
 * Whether payouts are open yet.
 *
 * $VLTR is not on-chain until the token launches, and a request accepted
 * before then debits the miner's balance into an escrow nobody can release.
 * The server refuses those, so the screen asks first.
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

/* ────────────────────────────── Support ───────────────────────────── */

export interface SupportMessageDto {
  id: string;
  /** False for the miner's own messages, true for an operator reply. */
  fromAdmin: boolean;
  body: string;
  createdAt: string;
}

export type TicketStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';

export interface SupportTicketDto {
  id: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessageDto[];
}

/** Server-side cap on unresolved tickets — mirrored so the UI can explain it. */
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

/* ────────────────────────── Rig duels ──────────────────────────────── */

export type DuelStatus = 'OPEN' | 'ACTIVE' | 'SETTLED' | 'CANCELLED' | 'EXPIRED';

export interface DuelSide {
  id: string;
  name: string;
  ratePerHour: number;
  gridStability: number;
  countryCode: string | null;
}

export interface DuelDto {
  id: string;
  code: string;
  status: DuelStatus;
  stakeBp: number;
  stakePercent: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  challenger: DuelSide;
  opponent: DuelSide | null;
  winnerId: string | null;
  transferPoints: number;
  liveScore: { challenger: number; opponent: number };
  mine: 'challenger' | 'opponent' | null;
}

export interface DuelBoard {
  open: DuelDto | null;
  active: DuelDto | null;
  history: DuelDto[];
}

export const getDuels = () => apiFetch<DuelBoard>('/duels/mine');
export const getDuel = (code: string) => apiFetch<DuelDto>(`/duels/${code}`);
export const createDuel = () => apiFetch<DuelDto>('/duels', { method: 'POST' });
export const acceptDuel = (code: string) =>
  apiFetch<DuelDto>(`/duels/${code}/accept`, { method: 'POST' });
export const cancelDuel = (code: string) =>
  apiFetch<DuelDto>(`/duels/${code}/cancel`, { method: 'POST' });

/* ──────────────────────────── Squads ───────────────────────────────── */

export interface SquadMemberDto {
  id: string;
  name: string;
  isOwner: boolean;
  joinedAt: string;
  ratePerHour: number;
  gridStability: number;
  coolingSurplus: number;
  powerSurplus: number;
  lent: { cooling: number; power: number };
}

export interface SquadDto {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  maxMembers: number;
  createdAt: string;
  members: SquadMemberDto[];
  pool: {
    coolingSurplus: number;
    powerSurplus: number;
    coolingLent: number;
    powerLent: number;
  };
  earnedPoints7d: number;
}

export interface SquadRankDto {
  id: string;
  name: string;
  members: number;
  earnedPoints: number;
  rank: number;
}

export const getSquad = () => apiFetch<{ squad: SquadDto | null }>('/squads/mine');
export const getSquadLeaderboard = () =>
  apiFetch<{ squads: SquadRankDto[] }>('/squads/leaderboard');
export const createSquad = (name: string) =>
  apiFetch<SquadDto>('/squads', { method: 'POST', body: JSON.stringify({ name }) });
export const joinSquad = (code: string) =>
  apiFetch<SquadDto>('/squads/join', { method: 'POST', body: JSON.stringify({ code }) });
export const leaveSquad = () => apiFetch<{ left: true }>('/squads/leave', { method: 'POST' });

/* ───────────────────────── Player part market ──────────────────────── */

export type ListingStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';

export interface ListingDto {
  id: string;
  status: ListingStatus;
  priceVolts: number;
  createdAt: string;
  soldAt: string | null;
  seller: { id: string; name: string };
  buyer: { id: string; name: string } | null;
  part: RigPartDto & { daysLeft: number };
  mine: boolean;
}

export const getListings = (kind?: RigPartKind) =>
  apiFetch<{ listings: ListingDto[]; feeBp: number }>(
    kind ? `/market/parts?kind=${kind}` : '/market/parts',
  );
export const getMyListings = () =>
  apiFetch<{ selling: ListingDto[]; sold: ListingDto[]; bought: ListingDto[] }>(
    '/market/parts/mine',
  );
export const listPart = (boosterId: string, priceVolts: number) =>
  apiFetch<ListingDto>('/market/parts', {
    method: 'POST',
    body: JSON.stringify({ boosterId, priceVolts }),
  });
export const cancelListing = (id: string) =>
  apiFetch<ListingDto>(`/market/parts/${id}`, { method: 'DELETE' });
export const buyListing = (id: string) =>
  apiFetch<{ listing: ListingDto; slot: number | null }>(`/market/parts/${id}/buy`, {
    method: 'POST',
  });

/* ─────────────────────── Weekly blueprint challenge ────────────────── */

export interface ChallengeDto {
  id: string;
  weekKey: string;
  title: string;
  body: string;
  targetHashPerHour: number;
  startsAt: string;
  endsAt: string;
  submissions: number;
  rewards: string[];
}

export interface BlueprintPartDto {
  code: string;
  name: string;
  kind: RigPartKind;
  priceUsd: number;
  hashPerHour: number;
  heat: number;
  cooling: number;
  watts: number;
  wattsSupplied: number;
  hashBoostPercent: number;
  tier: number;
}

export interface SubmissionDto {
  id: string;
  rank: number;
  user: { id: string; name: string };
  partCodes: string[];
  costUsd: number;
  hashPerHour: number;
  gridStability: number;
  createdAt: string;
  mine: boolean;
}

export interface ChallengeBoard {
  challenge: ChallengeDto;
  catalog: BlueprintPartDto[];
  mine: SubmissionDto | null;
  top: SubmissionDto[];
  previous: { challenge: ChallengeDto; winners: SubmissionDto[] } | null;
}

export const getChallenge = () => apiFetch<ChallengeBoard>('/challenge');
export const submitBlueprint = (partCodes: string[]) =>
  apiFetch<{ mine: SubmissionDto; rank: number }>('/challenge/submit', {
    method: 'POST',
    body: JSON.stringify({ partCodes }),
  });

/* ────────────────────────── Weekly season ──────────────────────────── */

export interface SeasonStandingDto {
  rank: number;
  id: string;
  displayName: string;
  countryCode: string;
  /** VOLTS mined inside the season window. */
  earned: number;
  /** VOLTS the place pays — projected while the season is still running. */
  prize: number;
  isCurrentUser: boolean;
  watchCode: string | null;
}

export interface SeasonDto {
  weekKey: string;
  startsAt: string;
  endsAt: string;
  /** Null while the season is running. */
  closedAt: string | null;
  poolVolts: number;
  prizes: number[];
  places: number;
  standings: SeasonStandingDto[];
  me: { rank: number | null; earned: number; prize: number; totalRanked: number };
}

export const getSeason = () =>
  apiFetch<{ current: SeasonDto; previous: SeasonDto | null }>('/season');

/* ──────────── Real-world weather and the collective grid goal ───────── */

export interface WeatherEntryDto {
  countryCode: string;
  city: string;
  tempC: number;
  /** Signed: +13 means coolers are working 13% harder today. */
  heatPercent: number;
}

export const getGridWeather = () =>
  apiFetch<{ countries: WeatherEntryDto[]; updatedAt: string | null }>('/grid/weather');

export interface CollectiveDto {
  stablePercent: number;
  threshold: number;
  active: number;
  /** What every miner earns while the grid holds. Never negative. */
  bonusPercent: number;
  holding: boolean;
  pointsToGo: number;
  updatedAt: string;
}

export const getGridCollective = () => apiFetch<CollectiveDto>('/grid/collective');

/* ────────────────────────── Daily rig puzzle ───────────────────────── */

export interface DailyPuzzleDto {
  dayKey: string;
  /** 1-based, so the share line reads "#214". */
  number: number;
  budgetUsd: number;
  targetHashPerHour: number;
  startsAt: string;
  endsAt: string;
}

export interface DailySubmissionDto {
  id: string;
  rank: number;
  user: { id: string; name: string };
  partCodes: string[];
  costUsd: number;
  hashPerHour: number;
  gridStability: number;
  attempts: number;
  solvedAt: string;
  /** The two-line block, built server-side so every client agrees. */
  shareText: string;
  mine: boolean;
}

export interface DailyBoard {
  puzzle: DailyPuzzleDto;
  catalog: BlueprintPartDto[];
  mine: DailySubmissionDto | null;
  solvedCount: number;
  distribution: { cost: number; count: number }[];
  top: DailySubmissionDto[];
  yesterday: { dayKey: string; number: number; best: DailySubmissionDto[] } | null;
}

export interface DailySubmitResult {
  mine: DailySubmissionDto;
  rank: number;
  beatPercent: number;
  shareText: string;
}

export const getDaily = () => apiFetch<DailyBoard>('/daily');

export const submitDaily = (partCodes: string[]) =>
  apiFetch<DailySubmitResult>('/daily/submit', {
    method: 'POST',
    body: JSON.stringify({ partCodes }),
  });

/* ───────────────────── Spectating a rig ────────────────────────────── */

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
  hot: boolean;
  burned: boolean;
}

export interface RigWatchDto {
  name: string;
  countryCode: string | null;
  ratePerHour: number;
  gridStability: number;
  partCount: number;
  skin: string;
  streakDays: number;
  joinedAt: string;
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

/** Public: no session needed. */
export const getRigWatch = (code: string) =>
  apiFetch<RigWatchDto>(`/rig/watch/${encodeURIComponent(code)}`);

/* ──────────────────────── Apprenticeship ───────────────────────────── */

export type ApprenticeshipStatus = 'PENDING' | 'ACTIVE' | 'ENDED';

export interface ApprenticePeerDto {
  id: string;
  name: string;
  countryCode: string | null;
  joinedAt: string;
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

export type MentorBlock = 'TOO_NEW' | 'RIG_UNSTABLE' | 'AT_CAPACITY' | 'IS_APPRENTICE';

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

export const getApprentice = () => apiFetch<ApprenticeOverviewDto>('/apprentice');

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
