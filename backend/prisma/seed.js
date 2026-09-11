/**
 * Seeds the VOLTARA catalogue from SPEC.md §2a.
 *
 * A part is not just a rate bonus any more: cores make heat and draw watts,
 * coolers pay watts to remove heat, PSUs supply watts. A rig that demands
 * more than it can cool or feed throttles, so the catalogue has to contain
 * the answers as well as the problems.
 *
 * Plain JavaScript on purpose. This runs on every deploy, and ts-node is a
 * devDependency that a production install does not have — a TypeScript seed
 * simply cannot run there, which left the catalogues empty on any host
 * without shell access.
 *
 * Idempotent, and matched on `code` rather than price: an operator can
 * reprice a part in the admin panel without the next deploy inserting a
 * second copy of it. Legacy rows (priced, but seeded before parts existed)
 * are adopted by code rather than duplicated.
 *
 * It also performs the rig backfill that `prisma/migrations/…_voltara_rig`
 * does in SQL. Deployment has two paths — `prisma migrate deploy` from
 * `start:prod` and `prisma db push` from the GitHub workflow — and only one
 * of them runs migrations. Doing it here as well means a miner's existing
 * boosters end up installed and grandfathered either way.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** Mirrors CHASSIS_COOLING / CHASSIS_WATTS in src/mining/rig.engine.ts. */
const CHASSIS_COOLING = 12;
const CHASSIS_WATTS = 120;
const CHASSIS_SLOTS = 6;

/**
 * The catalogue. `rateBonusMilli` is hash in milli-points/hour.
 *
 * Balance note: VC-1 (10 heat, 45 W) runs at full stability on a bare
 * chassis, so a first purchase always behaves exactly as advertised —
 * 0.9 → 2.9/hr. Everything above it needs cooling and power bought
 * alongside, which is the build.
 */
const RIG_PARTS = [
  // ── Cores: hash, heat, draw ──
  {
    code: 'VC1',
    name: 'VC-1 Volt Core',
    kind: 'CORE',
    priceUsd: 1,
    rateBonusMilli: 2000,
    heat: 10,
    watts: 45,
    tier: 1,
  },
  {
    code: 'VC5',
    name: 'VC-5 Arc Core',
    kind: 'CORE',
    priceUsd: 5,
    rateBonusMilli: 10000,
    heat: 26,
    watts: 110,
    tier: 2,
  },
  {
    code: 'VC10',
    name: 'VC-10 Plasma Core',
    kind: 'CORE',
    priceUsd: 10,
    rateBonusMilli: 20000,
    heat: 48,
    watts: 200,
    tier: 3,
  },
  {
    code: 'VC50',
    name: 'VC-50 Fusion Core',
    kind: 'CORE',
    priceUsd: 50,
    rateBonusMilli: 90000,
    heat: 190,
    watts: 760,
    tier: 5,
  },
  // ── Coolers: remove heat, cost watts ──
  {
    code: 'CX2',
    name: 'CX-2 Vapor Cooler',
    kind: 'COOLER',
    priceUsd: 2,
    rateBonusMilli: 0,
    cooling: 40,
    watts: 18,
    tier: 2,
  },
  {
    code: 'CX6',
    name: 'CX-6 Cryo Loop',
    kind: 'COOLER',
    priceUsd: 6,
    rateBonusMilli: 0,
    cooling: 120,
    watts: 40,
    tier: 3,
  },
  {
    code: 'CX20',
    name: 'CX-20 Immersion Bath',
    kind: 'COOLER',
    priceUsd: 20,
    rateBonusMilli: 0,
    cooling: 420,
    watts: 90,
    tier: 4,
  },
  // ── PSUs: supply watts, cost a little heat ──
  {
    code: 'PS3',
    name: 'PS-3 Feeder Unit',
    kind: 'PSU',
    priceUsd: 3,
    rateBonusMilli: 0,
    wattsSupplied: 260,
    heat: 4,
    tier: 2,
  },
  {
    code: 'PS12',
    name: 'PS-12 Substation',
    kind: 'PSU',
    priceUsd: 12,
    rateBonusMilli: 0,
    wattsSupplied: 900,
    heat: 12,
    tier: 4,
  },
  // ── Module: multiplies what the cores already make ──
  {
    code: 'OD8',
    name: 'OD-8 Overdrive Chip',
    kind: 'MODULE',
    priceUsd: 8,
    rateBonusMilli: 0,
    hashBoostBp: 1500, // +15% on total core hash
    heat: 14,
    watts: 30,
    tier: 4,
  },
];

const TASKS = [
  { type: 'TWEET', title: 'Tweet about VOLTARA', rewardMilli: 5000 },
  { type: 'FOLLOW', title: 'Follow us on X', rewardMilli: 3000 },
  { type: 'REPOST', title: 'Repost our pinned post', rewardMilli: 3000 },
  { type: 'YOUTUBE', title: 'Watch our YouTube video', rewardMilli: 4000 },
  { type: 'QUIZ', title: 'Complete the daily quiz', rewardMilli: 6000 },
  { type: 'SPIN_WHEEL', title: 'Spin the reward wheel', rewardMilli: 2000 },
];

/** Fill in the columns a part needs, leaving unspecified ones at zero. */
function partRow(part) {
  return {
    code: part.code,
    name: part.name,
    kind: part.kind,
    priceUsd: part.priceUsd,
    rateBonusMilli: part.rateBonusMilli,
    heat: part.heat ?? 0,
    cooling: part.cooling ?? 0,
    watts: part.watts ?? 0,
    wattsSupplied: part.wattsSupplied ?? 0,
    hashBoostBp: part.hashBoostBp ?? 0,
    tier: part.tier ?? 1,
    durationDays: 30,
  };
}

/**
 * Ensure one catalogue part exists and carries its running costs.
 *
 * Three cases: already seeded by code (top up the physics columns only, so
 * an admin's repricing survives); a legacy plan at the same price with no
 * code (adopt it, so nobody's purchase history points at an orphan); or
 * missing entirely (create it).
 */
async function ensurePart(part) {
  const row = partRow(part);
  const { priceUsd: _price, ...physics } = row;

  const byCode = await prisma.boosterPlan.findUnique({
    where: { code: part.code },
  });
  if (byCode) {
    await prisma.boosterPlan.update({ where: { id: byCode.id }, data: physics });
    return 'kept';
  }

  const legacy = await prisma.boosterPlan.findFirst({
    where: { code: null, priceUsd: part.priceUsd },
  });
  if (legacy) {
    await prisma.boosterPlan.update({ where: { id: legacy.id }, data: physics });
    return 'adopted';
  }

  await prisma.boosterPlan.create({ data: row });
  return 'added';
}

/**
 * Put every miner's already-owned parts into slots, once.
 *
 * Only touches miners who hold an unexpired part and have nothing installed,
 * so it is safe to re-run and never disturbs a rig someone has arranged
 * themselves. The chassis bonus covers exactly what those parts cost to run:
 * a booster bought under the old rules — when parts were free to run — keeps
 * earning the rate it was sold at, and only the NEXT purchase has to be
 * cooled and fed.
 */
async function backfillRigs() {
  const now = new Date();
  const candidates = await prisma.user.findMany({
    where: {
      boosters: { some: { expiresAt: { gt: now } } },
      installedParts: { none: {} },
    },
    select: {
      id: true,
      rigSlots: true,
      rigCoolingBonus: true,
      rigPowerBonus: true,
      boosters: {
        where: { expiresAt: { gt: now } },
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        include: { plan: true },
      },
    },
  });

  let installed = 0;
  for (const user of candidates) {
    const slots = user.rigSlots || CHASSIS_SLOTS;
    const fitting = user.boosters.slice(0, slots);
    if (fitting.length === 0) continue;

    const heat = fitting.reduce((n, b) => n + b.plan.heat, 0);
    const watts = fitting.reduce((n, b) => n + b.plan.watts, 0);

    await prisma.$transaction([
      ...fitting.map((b, index) =>
        prisma.rigSlot.create({
          data: { userId: user.id, index, boosterId: b.id },
        }),
      ),
      prisma.user.update({
        where: { id: user.id },
        data: {
          rigCoolingBonus: Math.max(
            user.rigCoolingBonus,
            Math.max(0, heat - CHASSIS_COOLING),
          ),
          rigPowerBonus: Math.max(
            user.rigPowerBonus,
            Math.max(0, watts - CHASSIS_WATTS),
          ),
        },
      }),
    ]);
    installed += fitting.length;
  }
  return installed;
}

async function main() {
  let added = 0;
  let updated = 0;

  for (const part of RIG_PARTS) {
    const outcome = await ensurePart(part);
    if (outcome === 'added') added += 1;
    else updated += 1;
  }

  for (const task of TASKS) {
    const existing = await prisma.task.findFirst({ where: { type: task.type } });
    if (existing) continue;
    await prisma.task.create({ data: { ...task, cooldownHours: 24 } });
    added += 1;
  }

  const installed = await backfillRigs();

  // eslint-disable-next-line no-console
  console.log(
    `Catalogue: ${added} added, ${updated} refreshed. ` +
      (installed === 0
        ? 'No rigs needed backfilling.'
        : `Installed ${installed} pre-existing part(s) into rigs.`),
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
