# VOLTARA — Technical Specification

> Rig-building / reward-**simulation** platform on BNB Chain.
> "Mining" is a scheduled reward accrual (tap-to-earn), NOT real PoW hardware.
> The only real on-chain component is the VOLTARA BEP-20 token ($VLTR) +
> withdrawal payouts.
>
> **What makes it a different product from a tap-to-earn:** a purchase is not
> a number added to a rate. It is a PART installed into one of six slots, and
> it costs something to run. Cores make hash and heat; coolers remove heat and
> draw watts; PSUs supply watts and run slightly warm. A rig whose heat
> outruns its cooling, or whose draw outruns its supply, throttles in
> proportion. GRID STABILITY (0–100%) is that penalty, and it multiplies
> everything the miner earns.

---

## 1. Product summary

- **Registration:** free.
- **Mining:** user taps "Mine" once per 24h; accrues **VOLTS** at a per-hour rate.
- **Rig:** six slots on a free chassis. Owned parts only earn while installed (§2a).
- **Parts:** bought with real crypto; 30 days each; stackable. Four kinds —
  CORE (hash), COOLER (removes heat), PSU (supplies watts), MODULE (multiplies
  core hash). Every part has a running cost.
- **Referrals:** invited-user count sets a mining-rate multiplier (see table).
- **Tasks:** tweet, follow, repost, watch YouTube, quiz, spin wheel — grant point rewards.
- **KYC:** mandatory for all users (stated reason: fair coin distribution).
- **Withdrawal:** points convert to on-chain $VLTR and are paid out, subject to admin approval.
- **Platform:** responsive website + installable app (PWA).
- **Languages:** English, 中文 (Chinese), 한국어 (Korean).

---

## 2. Mining reward math

- **Base rate:** `0.9 VOLTS / hour`.
- **Effective rate:**
  ```
  rate = (base_rate + rig_hash + admin_adjust)
         × thermal_efficiency
         × power_efficiency
         × referral_multiplier
  ```
  A single VC-1 core on a stock chassis: `(0.9 + 2.0) × 1 × 1 × 1 = 2.9/hr` —
  the client's own worked example, unchanged.
- **Claim cadence:** user must press "Mine" once per 24h to keep accruing.
  Implemented as continuous server-side accrual capped at a 24h window,
  settled by the tap.

Implemented in `backend/src/mining/mining.engine.ts` (rate, accrual, tiers)
and `backend/src/mining/rig.engine.ts` (the rig readout). Both are pure and
unit-tested; nothing else in the codebase is allowed to do this arithmetic.

---

## 2a. The rig (the signature mechanic)

### Chassis — free, every miner
| Property | Value |
|---|---|
| Slots | 6 |
| Cooling | 12 TU (thermal units) |
| Power | 120 W |

`rigSlots`, `rigCoolingBonus` and `rigPowerBonus` on `User` let an operator
widen any of these; the rig migration used the bonuses to grandfather parts
bought before running costs existed.

### Parts
A `Booster` row is one OWNED part. It earns only while it occupies a
`RigSlot`. Buying auto-installs into the first free slot; a full rig leaves
the part in inventory rather than evicting a part the miner chose to run.

| Code | Name | Kind | $ | Hash/h | Heat | Cooling | Draw | Supply |
|---|---|---|---|---|---|---|---|---|
| VC1  | VC-1 Volt Core       | CORE   | 1  | +2.0  | 10  | —   | 45 W  | — |
| VC5  | VC-5 Arc Core        | CORE   | 5  | +10.0 | 26  | —   | 110 W | — |
| VC10 | VC-10 Plasma Core    | CORE   | 10 | +20.0 | 48  | —   | 200 W | — |
| VC50 | VC-50 Fusion Core    | CORE   | 50 | +90.0 | 190 | —   | 760 W | — |
| CX2  | CX-2 Vapor Cooler    | COOLER | 2  | —     | —   | 40  | 18 W  | — |
| CX6  | CX-6 Cryo Loop       | COOLER | 6  | —     | —   | 120 | 40 W  | — |
| CX20 | CX-20 Immersion Bath | COOLER | 20 | —     | —   | 420 | 90 W  | — |
| PS3  | PS-3 Feeder Unit     | PSU    | 3  | —     | 4   | —   | —     | 260 W |
| PS12 | PS-12 Substation     | PSU    | 12 | —     | 12  | —   | —     | 900 W |
| OD8  | OD-8 Overdrive Chip  | MODULE | 8  | +15%  | 14  | —   | 30 W  | — |

Duration: **30 days** each, stackable, unlimited quantity.

VC-1 is sized to run at full stability on a bare chassis, so a first purchase
always behaves exactly as advertised. Everything above it has to be cooled and
fed, which is the build.

### Throttling
```
cooling_capacity = 12 + rigCoolingBonus + Σ cooling
heat_load        = Σ heat
power_supply     = 120 + rigPowerBonus + Σ wattsSupplied
power_draw       = Σ watts

thermal_efficiency = heat_load  <= cooling_capacity ? 1
                   : clamp(cooling_capacity / heat_load, 0.25, 1)
power_efficiency   = power_draw <= power_supply     ? 1
                   : clamp(power_supply / power_draw, 0.10, 1)

grid_stability = round(thermal_efficiency × power_efficiency × 100)
```
Straight ratios, so the gauge is readable: cooling that covers 60% of the heat
yields 60% of the output. Neither floors at zero — a rig that has stopped
earning entirely gives the miner no reason to come back.

MODULE boosts are additive across modules (two OD-8s are +30%, not ×1.15²) and
apply to total core hash, so a module on a rig with no cores is worth nothing.

### API
| Method | Route | Notes |
|---|---|---|
| GET | `/api/rig` | Chassis, grid, inventory, telemetry, live rate |
| POST | `/api/rig/install` | `{ boosterId, slot }` |
| POST | `/api/rig/uninstall` | `{ slot }` |

`/api/mining/status` carries the same telemetry under `rig`, so the dashboard
gauge cannot drift from the rate it explains.

### Shop fit preview — `GET /api/boosters`, `plans[].fit`

Every catalogue row is re-simulated against the **caller's own rig** before it
is priced, by the same `rigTelemetry` the dashboard and the claim settle with,
through `RigContextService` — so the grid event, the weather, an engaged
overclock and a squad loan are all in the number. Rules live in
`src/boosters/fit.rules.ts`, pure and unit tested.

It exists because the figure it replaces was wrong in both directions:

- **A core that cannot be cooled read as a pure upgrade.** `resultingRatePerHour`
  is `(900 + rateBonusMilli) / 1000` — a *stock chassis* at ×1 referral. On a
  rig with no spare cooling, a VC-10 drops GRID STABILITY far enough to earn
  less than the cheaper core beside it, and the card said otherwise.
- **A cooler read as `+0/hr`.** Coolers make no hash, so the shop could never
  say that on an overheating rig cooling is frequently the single largest rate
  increase on the page — stability multiplies everything.

| Field | Meaning |
|---|---|
| `ratePerHourBefore` / `After` | The miner's real rate, referral multiplier and streak included |
| `stabilityBefore` / `After` | GRID STABILITY either side of the install |
| `heatShort` / `wattsShort` | The actual shortfall, so the UI can name it |
| `clean` | Runs at a full 100% with nothing else bought |
| `fits` / `freeSlots` | False when every slot is taken |
| `fix` | A cheap working set that closes the deficit, with `totalUsd` |

`fix` is a **greedy** search, not a proven optimum: at each step it takes the
cheapest part that finishes the job outright, and only settles for the largest
stability gain when nothing finishes it. Each step considers coolers *and*
PSUs together — a big core usually breaks both budgets at once, and an
earlier version picked whichever deficit was larger and kept feeding it,
buying cooler after cooler while the rig stayed in brownout.

A fix must also hold **15% thermal headroom** (`FIX_HEADROOM_BP`), because a
build can sit at exactly 100% and still be bad advice: the catalogue's VC-10
reaches a full 100% on heat 52 against cooling 52, with nothing spare, and
weather alone swings heat by ±15% (`WEATHER_MAX_SWING_BP`). That rig drops
below 100% on the first warm afternoon — on a build the shop had just called
clean, which is exactly the buyer's remorse the preview exists to prevent.
The margin is sized to the weather rather than to a HEATWAVE event (+30%):
the weather arrives unannounced, an event is announced and is meant to be
survivable only by rigs built with slack. Headroom decides which parts are
recommended; the figures quoted back are the unstressed ones, so the margin
never understates what the miner will earn today. It is bounded by `MAX_FIX_PARTS` and
by the slots actually free, and it reports the stability it really reaches —
`fix.clean` is false when it only improved matters. Nothing downstream may
describe it as "the cheapest"; an exhaustive search over a dozen parts is
affordable if that is ever needed.

The upsell this drives is the honest kind: the rig genuinely needs the cooler,
and the price of the whole working build is shown **before** the buy button
rather than discovered after the first purchase throttles the rig. A rig that
cannot be read returns `fit: null` and the catalogue still renders.

### Referral multiplier (by invited-user count)
| Invited users | Level | Multiplier |
|---|---|---|
| 0 | 1 | ×1 |
| 1–5 | 2 | ×3 |
| 6–10 | 3 | ×4 |
| 11–20 | 4 | ×5 |
| 21–30 | 5 | ×6 |
| 31–2000 | 6 | ×8 |

---

## 2b. The grid around the rig

Ten systems that make a rig something to show, race, pool and gamble with.
Every one of them goes through `rig.engine.ts` (modifiers) or the ledger;
none of them adds a second place where points are computed.

### Modifiers (rig.engine.ts)
```
heat_i   = part.heat  × (overclock && CORE ? 1.8 : 1) × event.heatMult
draw_i   = part.watts × event.drawMult
hash     = Σ core hash × (1 + Σ module bp) × (overclock ? 1.4 : 1) × event.hashMult
cooling  = 12 + rigCoolingBonus + Σ cooling + squadCooling
supply   = 120 + rigPowerBonus  + Σ supplied + squadPower
```
Burned parts (`Booster.disabledUntil` in the future) contribute nothing.
`RigContextService` (backend/src/rig/rig-context.service.ts) is the only
loader of these modifiers; the rig screen, the status poll and the claim
settlement all read through it so they never disagree.

### 1. Grid events — `GridEvent`
| Code | Effect | Window |
|---|---|---|
| HEATWAVE | heat ×1.3 | 4–8 h |
| COLD_SNAP | heat ×0.7 | 4–8 h |
| CHEAP_POWER | draw ×0.5 | 4–8 h |
| GRID_STRAIN | draw ×1.4, hash ×1.1 | 4–8 h |
| SOLAR_SURGE | hash ×1.5 | 4–8 h |

One event at a time. The scheduler (`grid.service.ts`, every 15 min) keeps
exactly one upcoming event queued 36–72 h out, never repeating the last
code. `GET /api/grid/event` is public.

### 2. Live grid map — `GET /api/grid/map` (public, 60 s cache)
Per-country counts of miners, active miners (tap in 7 d) and the share whose
rig reads 100 % stability. No identities.

### 2a. Real-world heat — `GET /api/grid/weather` (public)

The temperature in the miner's own country shifts how hard their coolers
work. One capital-city reading per country from Open-Meteo, refreshed every
3 h into memory; a country not in the coordinate table, a stale reading or a
failed fetch all mean **no effect** — never a penalty.

```
heat_mult = 1.0 at 20 °C, +15% at 45 °C, -15% at -10 °C, clamped
```

Two straight lines meeting at 20 °C. The whole range is ±15%, enough to tip
a rig that is already on the edge of its cooling budget and nothing more.
Constants and the curve live in `backend/src/grid/weather.rules.ts`.

### 2b. Collective grid goal — `GET /api/grid/collective` (public)

One number the whole platform shares: the share of ACTIVE rigs (a tap in the
last 7 days) sitting at 100% stability, taken from the map aggregate.

| Constant | Value |
|---|---|
| `COLLECTIVE_THRESHOLD_PERCENT` | 70 |
| `COLLECTIVE_BONUS_BP` | 500 (+5% hash) |

At or above the threshold every miner earns the bonus. **It is a bonus and
never a penalty** — `collectiveBonusBp` is asserted non-negative for every
possible share, so no arrangement of other people's rigs can cost a miner
anything. A collective mechanic that punished you for strangers' builds
would drive out exactly the careful miners it needs. Constants in
`backend/src/grid/collective.rules.ts`.

### 2c. How the modifiers compose

All of them scale the same two quantities, so they multiply rather than add,
through `composeBp` in `rig.engine.ts`:

```
heat_mult = event.heatMult × weather.heatMult
hash_mult = event.hashMult × (1 + collective_bonus)
```

A heatwave (×1.3) on a 42 °C afternoon (×1.13) is ×1.47, not ×1.43.
`RigContextService` is the single place this assembly happens, and the rig
screen, the status poll and the claim settlement all read through it, so
none of them can disagree. Both lookups are in-memory: neither touches the
network or the database on the claim path. The composed product lands in
`heatMultBp` / `hashMultBp`; `weatherHeatBp` and `collectiveHashBp` ride
along as attribution only, so the UI can name what moved the number.

### 3. Overclock — `POST /api/rig/overclock { on }`
+40 % core hash, +80 % core heat, 6 h maximum. Every hour it stays on, one
installed live part burns with probability 0.15 (`OVERCLOCK_BURN_CHANCE`)
and is disabled for 48 h. Requires an installed live CORE. The overview
returns `overclock.rateOff/rateOn/stabilityOff/stabilityOn` so the toggle
shows the trade before the miner commits.

### 4. Salvage & craft — `POST /api/rig/salvage`, `POST /api/rig/craft`
A part that is expired, burned, or within 3 days of expiry can be salvaged
for scrap: +1 (tier 1–2), +2 (tier 3–4), +3 (tier 5). Three scrap craft one
random part (30 days, `source = CRAFT`) weighted by tier 50/28/15/5/2.

### 5. Rig skins — `GET /api/rig/skins`, `…/buy`, `…/equip`
Cosmetic only. stock 0 · neon 150 · carbon 200 · overheat 250 · aurora 400 ·
gold 800 VOLTS. Ledger reason `SKIN_PURCHASE`. Shown on the rig and on the
share card.

### 6. Squads — `Squad`, `/api/squads/*`
Up to 5 miners. Each member's unused cooling and power feed a pool; members
over budget draw from it in proportion to their deficit (`poolHeadroom`).
The pool never lends more than it has, so balanced squads change nothing.
Squad leaderboard = members' MINING credits over 7 days.

### 7. Rig duels — `Duel`, `/api/duels/*`
A 24 h output race. Score = MINING ledger credits inside the window. The
loser forfeits 10 % (`stakeBp`) of their in-window score to the winner,
capped by their balance. Open duels expire after 48 h. `GET /api/duels/:code`
is public so the share link can render the challenger's rig.

### 8. Part marketplace — `PartListing`, `/api/market/parts*`
Uninstalled, unexpired (> 3 days), unburned parts can be listed for VOLTS.
Buying moves ownership (`source = TRADE`), debits the buyer (`PART_BUY`),
credits the seller 95 % (`PART_SALE`) and records the 5 % fee (`MARKET_FEE`,
zero-delta entry with `meta.feeMilli`).

### 9. Weekly blueprint challenge — `Challenge`, `/api/challenge*`
ISO week, UTC. "Cheapest build that makes N hash/h at 100 % stability", N
rotating through 5 / 12 / 25 / 40. Submissions are recomputed server-side
with `rigTelemetry` on a stock chassis with no modifiers. Monday 00:05 UTC
the previous week pays 1st VC-5, 2nd CX-2, 3rd VC-1 (`source = CHALLENGE`).

### 10. Rig health sound (mobile)
The Mine screen plays a low hum while stability ≥ 90 % and a fan loop with a
warm haptic pulse below 60 %. Purely feedback; nothing is earned or lost.

### 11. Spectator mode — `GET /api/rig/watch/:code` (public, 15 s cache)

Anyone may watch any rig. The route takes a `User.referralCode` — already
public, since it is the key in every share link — and returns the public card
plus the live readout behind it: heat against cooling, draw against supply,
stability, rate, which sockets are running hot, whether the rig is
overclocking, and the grid event in force. Identity is masked with
`maskIdentity`, and a blocked account reads as **missing** rather than
forbidden, so a stale leaderboard row can never confirm a ban.

It shares one loader with the rig card (`RigService.loadPublicRig`), so the
two views can never disagree about the stability figure they both lead with.
Leaderboard rows carry `watchCode` and link straight through.

A socket is reported `hot` when it makes heat (CORE or PSU) **and** the rig as
a whole is over its cooling budget. Derived, not stored — there is no
per-part thermal reading, and inventing one would be a second source of truth
for a number the engine already settles.

### 12. Apprenticeship — `Apprenticeship`, `/api/apprentice/*`

A veteran adopts a newcomer. Deliberately **not** the referral graph: a mentor
need never have invited their apprentice, the relationship is ongoing rather
than a one-time credit, and it gives a veteran something to do with the spare
parts piling up in their inventory.

| Rule | Value |
|---|---|
| Mentor minimum account age | 7 days |
| Mentor rig stability, at the moment of offering | 100 % |
| Apprentice maximum account age | 14 days |
| Apprentices per mentor | 3 |
| Mentor's share | 5 % (`mentorCutBp` 500) |
| How long the share runs | 30 days from acceptance |

One mentor per apprentice, enforced by a unique index on `apprenticeId` — two
mentors racing to adopt the same newcomer lose in the database, not only in
the service. A miner who is themselves an apprentice may not mentor, or two
fresh accounts could adopt each other and both draw a cut on day seven.
Ending is **permanent for that pair**; a previously ENDED row is never
revived, so "end" is never merely a pause.

**The cut is newly minted, never deducted.** When an apprentice claims, the
mentor is credited `floor(earned × mentorCutBp / 10000)` with
`LedgerReason.MENTOR_CUT` and the apprentice's own credit is untouched. Taking
a slice out of a newcomer's first week would make being mentored a cost, which
is the fastest way to kill a mentorship feature. The window expires so a
veteran cannot build a permanent rent-seeking position by adopting everyone
who joins in week one.

The hook lives inside the claim transaction in `mining.service.ts` and calls
`ApprenticeService.creditMentor`, which swallows its own failures: a mentor's
bonus must never roll back the apprentice's own mining.

**Gifting.** `POST /api/apprentice/gift` moves an owned part that is
unexpired, uninstalled, unsalvaged and not listed for sale from mentor to
apprentice, auto-installing it. Both sides get a zero-delta ledger row so each
can see where the part went or came from. The part's `source` becomes
`REFERRAL` — there is no MENTOR source, and adding one would mean a migration
for a label.

Rules live in `src/apprentice/apprentice.rules.ts`, pure and unit tested.

### 13. Weekly season — `Season`, `SeasonAward`, `GET /api/season`

The leaderboard's own `WEEK` filter is a **rolling** seven days: right for
browsing, useless as a prize, because a rolling window has no moment at which
anyone has won. A season is one fixed ISO week — Monday 00:00 UTC to the next
Monday 00:00 UTC — that closes, pays, and stays on the record. It shares its
boundary with the blueprint challenge through `common/iso-week.ts`; two
"weekly" features drifting a day apart is a bug nobody can see from the UI.

| Rule | Value |
|---|---|
| Window | Mon 00:00 UTC → Mon 00:00 UTC (ISO week, `weekKey` e.g. `2026-W37`) |
| Paid places | 10 |
| Prize table | 200 / 120 / 80 / 50 / 50 / 25 / 25 / 25 / 25 / 25 VOLTS |
| Pool | 625 VOLTS per season |
| Close job | `@Cron('10 0 * * 1')` — five minutes behind the challenge roll |
| Ranked on | Ledger **credits** inside the window, blocked accounts excluded |
| Not ranked | `SEASON_REWARD`, `ADMIN_ADJUST` |

Prizes are **VOLTS, not $VLTR**: the token is not on-chain until launch and
payouts are gated until then (§4), so a $VLTR pool would be an IOU. VOLTS are
real the moment they land — they buy parts, and they convert at 3:1 when the
payout window opens. First place is worth a little more than a free week of
mining (a bare chassis makes ≈151 VOLTS/week), tenth is worth an evening.

`SEASON_REWARD` is excluded from ranking because a prize is credited *after*
its week closed, which lands it in the next week — counting it would hand
last week's winner a head start for no mining at all. `ADMIN_ADJUST` is out
for the same reason: a support refund is not a performance.

Idempotency is the unique `(seasonId, userId)` index, not the `closedAt`
stamp. Each award is written in its own transaction under the winner's row
lock, so a prize cannot interleave with a claim or a withdrawal reading the
same balance; a pass that dies halfway, a retry, or two instances waking
together all collide on the miners already paid and skip them. `roll()`
opens the previous week as well as the current one, so a deploy gap does not
silently swallow a season.

`GET /api/season` returns the running season scored live from the ledger
(every prize on it is a **projection**, and the UI says so), the caller's own
standing across the whole field, and the last season that paid. Closed
standings are read back from `SeasonAward` rather than recomputed — what a
season paid is a fact, and re-deriving it would rewrite the past the first
time the prize table moved.

Rules live in `src/seasons/season.rules.ts`, pure and unit tested; the payout
path is covered in `seasons.service.spec.ts`.

---

## 2c. Onboarding and retention

The first minute and the seventh day. A rig nobody built is worth nothing, and
a rig nobody comes back to is worth less.

### The loaner core
Every new account is lent a **VC-1 Volt Core for 72 hours** — `Booster` with
`source = LOANER`, auto-installed into the first free slot at signup. The rig
screen shows a lit part from the first second and the rate reads 2.9/hr
instead of 0.9.

The grant is idempotent on `User.loanerGrantedAt` and never throws: a signup
must not fail because a free part could not be handed out. It writes a
zero-delta `WELCOME` ledger row recording the part and its expiry.

Twelve hours before it burns out the miner is emailed once
(`LoanerService.warnExpiring`, hourly, 200 per pass). That mail is the first
purchase moment in the funnel: the replacement VC-1 costs $1 and runs 30 days.
"Already warned" is flagged on the `WELCOME` row rather than in a column of
its own.

Implemented in `backend/src/rig/loaner.service.ts`.

### The first tap
A brand-new account can tap **Mine** the instant it exists, and that tap is
capped at **`WELCOME_CLAIM_MILLI` = 5 000 milli (5.0 VOLTS)**.

Without the cap the first tap pays a full 24h window at the loaner rate —
~69 VOLTS, most of the 100 VOLTS withdrawal minimum, handed over before the
miner has done anything. The cap makes the first tap a *taste*: it fires
immediately, the shockwave and the sound land, and the real reward is the full
window waiting 24h later. A miner whose whole window is worth less than the cap
is paid what they actually earned, never topped up to it.

One constant in `mining.engine.ts`; raise it to be more generous.

### Claim streak
Consecutive daily claims multiply the rate. A tap inside
**`STREAK_GRACE_HOURS` = 24** of the cooldown lifting extends the run; a later
one resets it to 1.

| Streak | Rate bonus |
|---|---|
| 3 days | +3 % |
| 7 days | +7 % |
| 14 days | +10 % |
| 30 days | +15 % |

The bonus lands between the throttles and the referral multiplier:

```
rate = (base + rig hash + admin adjust)
       × thermal × power
       × (1 + streak bonus)
       × referral multiplier
```

Deliberately modest — the top tier is under a single referral step, so a
streak rewards showing up without becoming the main lever.

A claim settles at the streak the miner **already had**: the window being paid
for was mined under that run, and extending first would pay today's hours at
tomorrow's bonus. Crossing into a new tier writes a zero-delta `STREAK_BONUS`
ledger row so the dashboard can celebrate it; the streak itself is paid as a
rate bonus on every future claim, never as a lump sum.

`User.streakDays` and `User.bestStreakDays`; math in `mining.engine.ts`
(`nextStreakDays`, `streakBonusBp`, `nextStreakTier`), applied in
`mining.service.ts`.

### Onboarding checklist
`GET /api/mining/status` returns an `onboarding` block derived from data that
already exists — no columns, so it can never drift:

| Step | True when |
|---|---|
| `claimedFirst` | `lastMineAt` is set |
| `rigRunning` | any `RigSlot` is filled |
| `invited` | referral count > 0 |

`done` is all three.

### Referral reward ladder

A referral moves the rate multiplier (§2), and it also pays **hardware**. A
multiplier is a number a miner has to take on trust; a cooler sits in a slot
and moves the gauge.

| Invites | Reward | Kind | Why this rung |
|---|---|---|---|
| 1 | +24h on the **invitee's** starter core | `LOANER_EXTENSION` | The person who was just invited gets a better first week |
| 3 | CX-2 Vapor Cooler, 30 days | `PART` | Teaches the heat mechanic before it bites |
| 5 | PS-3 Feeder Unit, 30 days | `PART` | Unlocks the power budget for a VC-5 |
| 10 | A permanent 7th rig slot | `SLOT` | The only permanent grant in the game; visible on the rig card |
| 25 | Grid Operator standing | `BADGE` | Reputation only — no economic effect |

Nothing on this ladder pays points, so invites can never be farmed into a
withdrawal. Tier 1 targets the most recently joined invitee whose loaner is
still alive; an expired loaner cannot be extended, so the rung stays owed for
a later invitee rather than being burnt on nobody.

**Idempotency.** A grant is recorded as a `LedgerEntry` with reason
`REFERRAL_BONUS`, `deltaMilli = 0` and `meta.tier = <threshold>`. That row is
both the record and the proof — there is no second source of truth and no
schema column. The read of those rows and the write of a new one happen in one
transaction under `lockUserRow`, so two invites landing together serialise.
The tier id is deliberately equal to the invite threshold, so an
already-granted row stays matched even if the ladder grows around it.

**When it fires.** Three paths, all converging on the same locked grant:
`ReferralsService.onReferralJoined(referrerId)` (the signup hook), a lazy sync
on every `GET /api/referrals/stats` read, and a `@Cron('*/30 * * * *')`
reconciliation that grants anything owed but missing. The sweep makes the
other two best-effort rather than load-bearing.

Ladder in `backend/src/referrals/referral-rewards.ts` (pure, unit-tested);
granting in `referrals.service.ts`.

---

## 3. Token & conversion

- **Token:** Voltara, BEP-20 on BNB Chain — client states it is **already deployed**. (Need: contract address + ABI + decimals.)
- **Conversion:** `3 VOLTS = 1 mainnet $VLTR`.
- **Listing:** client intends to list the coin after reaching 500k users (business milestone, not an engineering task).
- Points are internal DB units; $VLTR is the real transferable asset paid on withdrawal.

---

## 4. Withdrawal rules

- **Payout window:** withdrawals are **closed until the $VLTR token launches**
  and open only on `PAYOUTS_OPEN=true` or once `PAYOUTS_OPEN_AT` has passed.
  This gate is checked first, before every other rule, and before the
  transaction — a request debits the balance into escrow, so one accepted
  ahead of launch would be balance no payout could ever release.
- **Minimum:** 100 VOLTS.
- **Frequency:** 1 withdrawal request per week per user.
- **Approval:** manual admin review before on-chain payout. Admin approve and
  reject stay available while the window is shut, so any request that predates
  the gate can still be settled or refunded.
- **KYC:** must be completed/approved before withdrawal — and is **not
  collected until there is a withdrawal to collect it for**. Verification has
  its own window (`KYC_OPEN` / `KYC_OPEN_AT`, `src/kyc/kyc-window.ts`) which
  **follows the payout window by default**.

  KYC gates exactly one call site in this codebase, `WithdrawalsService.request`,
  and that call refuses everyone twenty lines earlier while `PAYOUTS_OPEN` is
  false — so the check is unreachable, and asking for passport photographs to
  satisfy it buys nothing. It costs plenty: it is the heaviest friction in the
  funnel, it puts real identity documents in Postgres (base64) with no present
  use, and each one costs an operator a manual review for a payout that cannot
  happen. Collecting personal data before you need it is a liability; a breach
  would expose IDs that were never required. Note also that no provider has
  been chosen (§9b.4), so documents gathered in-house now may have to be
  gathered again later anyway.

  Following payouts rather than being a second independent switch prevents the
  one failure that matters: opening payouts while KYC stays shut turns every
  withdrawal into "KYC must be approved" with no way for anyone to comply.
  `KYC_OPEN="true"` exists only to run verification *ahead* of launch and
  spread the review load. The **admin review queue stays open either way**, so
  a record submitted before the gate is never stranded — the same rule the
  payout window follows for approve/reject.
- Fees: **OPEN** — client hasn't specified a withdrawal fee. **See §9.**

---

### Public payout status — `GET /api/withdrawals/status`

The landing page advertises the conversion ratio and the 100-VOLTS minimum.
Both are true and, alone, misleading: together they describe a cash-out path
that is closed until $VLTR is on-chain. The terms therefore carry their own
status from an unguarded route reading the same `readPayoutWindow` the
withdraw screen and the request path use — one source of truth, and the page
starts saying "open" by itself the moment it is, with no redeploy and nothing
to remember to change. Unguarded is safe here: it exposes a published policy
and a launch date, nothing about any miner.

---

## 5. Tasks / engagement

Reward-granting tasks: tweet, follow, repost, watch YouTube video, quiz participation, spin wheel.
- Each task = configurable point reward, verification method, and cooldown. (Verification depth per task is OPEN.)

---

## 6. Admin panel

The client's original list (all built):

- Active miners count.
- Referral count + full referral tree per user.
- User balances.
- Block / unblock user.
- User counts by country.
- Increase / decrease a user's hash (mining) rate manually.
- Manual airdrop claim function.
- Withdrawal approval queue (implied by manual-approval rule).

### Operator views for the rig era — `GET /api/admin/ops/*`

That list describes the *flat-rate* product. Everything the rig rebrand added
ran with no operator visibility at all: a season prize job that stopped
paying, a grid event stuck on, a weather feed that had gone quiet and a part
market with no liquidity were each invisible. Four read-only views close
that, in `src/admin/ops.service.ts` (kept out of `admin.service.ts`, which is
already 1,800 lines of the original product).

| Route | Tab | Answers |
|---|---|---|
| `ops/grid` | Grid Operations | Event running and when it ends, collective goal, per-country weather, fleet size, how many rigs are overclocking |
| `ops/seasons` | Weekly Seasons | What every season decided and paid, read back from `SeasonAward` |
| `ops/social` | Competitive & Social | Duels, squads, market listings and fees, challenge, daily puzzle, apprenticeships |
| `ops/growth` | Dashboard | The four targets GROWTH.md §7 sets |

**Read-only on purpose.** There is no "fire a grid event" button: starting one
changes what every rig earns, and that belongs behind a deliberate action
rather than one click from a status page.

`ops/grid` reads `GridService`, `WeatherService` and `CollectiveService` —
the same instances the rigs are scored against — instead of recomputing, so
the panel and the miners' dashboards cannot disagree about how many rigs are
running.

Two failure states are called out in red rather than shown as a zero,
because a zero and a missed job look identical on a chart:

- a season whose week **ended but never closed** (the Monday 00:10 UTC cron
  did not fire), and
- a blueprint challenge that **ended without granting rewards** (the 00:05
  roll). Both jobs are idempotent and retry on boot.

### Growth metrics, and the one that is not measured

`ops/growth` serves the four figures GROWTH.md §7 sets targets against.
Three are measured from the ledger:

- **K-factor** — referred signups in 30 days over the userbase that existed
  when the window opened. The textbook K is invites *sent* × conversion, and
  invites sent are not recorded anywhere, so this is the observable half and
  is labelled as the proxy it is.
- **D1 / D7 retention** — cohorts aged 8–38 days (so everyone has had a full
  seven days), retained if they *mined* in the window. Mining, not "logged
  in": the tap is the action the product exists for and the one the ledger
  records honestly.
- **Signup → first purchase** — median days to the first CONFIRMED purchase.
  Median, not mean, so one miner who buys on day ninety does not describe
  everybody else.

**Share rate is not measured.** Nothing records a share event, so the tile
renders as an explicit blank with the reason rather than a lookalike (rig-card
views, referral link hits) that would be read as the real thing. Adding it
means recording a share; until then the honest value is nothing. See
`no-fabricated-numbers` — a target that gets acted on is exactly where an
invented number does the most damage.

### Console UI conventions

The panel predates the rebrand and drifted: eighteen tabs each hand-rolled the
same header, seven the same error banner, five the same refresh button, and
the navigation ran on emoji. `components/admin/ui.tsx` holds the shared
pieces — `AdminPage`, `SyncButton`, `Notice`, `StatTile`, `Section`, `Row`,
`Table` — and new tabs compose those rather than inventing a layout.

**Colour comes from the brand, through the legacy class names.** The console
still writes `slate-`, `amber-`, `red-`; `tailwind.config.ts` aliases each
scale onto the VOLTARA palette, so `text-amber-400` resolves to lime
`163 230 53` (`--c-charge`) and `bg-violet-600` to `124 58 237` (`--c-brand`).
`red` and `orange` were added to that shim — before, they rendered as stock
Tailwind and read as a second palette beside the rose/amber the tokens use.

**Lime is scarce.** It marks what is genuinely live — an event running, a
season in progress, rigs mining now. Structure (active nav, primary actions,
focus rings) is violet. The console previously used lime for every active tab
and every badge, which left nothing to signal "this is happening right now".

**No decorative status.** The header carried a hardcoded `BNB Mainnet Sync
100%` chip with a pulsing dot — a static string that claimed a healthy
mainnet connection whatever the chain was doing, on a build whose
`WALLET_MODE` is `offchain`. Real chain status belongs on the Blockchain tab,
which reads it. An always-green badge is worse than none.

---

## 7. Anti-abuse (required by client)

Limits/detection for: multiple accounts, same IP address, same device (fingerprint), fake referrals, bot farming.

---

## 8. Proposed architecture

- **Frontend:** Next.js (React) + Tailwind, PWA, i18n via next-intl (en/zh/ko).
- **Backend:** Node (NestJS) + PostgreSQL (Prisma) + Redis (accrual jobs, rate limits, anti-abuse counters).
- **Chain:** ethers.js on BNB Chain; WalletConnect/MetaMask link; swappable `WalletService`
  (real contract ↔ BSC-testnet mock ↔ off-chain-points-first).
- **Realtime:** Socket.IO for live hash rate / active miners / earnings.
- **Auth:** email/OTP or wallet; JWT sessions; KYC provider integration.

---

## 9. QUESTION LOG

### 9a. Answered by the client (Jul 3 call)

| # | Question | Answer |
|---|---|---|
| 1 | Real mining hardware or simulation? | Simulation, "like periacoin com" |
| 2 | Accrual model | User taps "Mine" once per 24h. Implemented as continuous server-side accrual capped at a 24h window, settled by the tap. |
| 3 | Booster quantity | "user can buy maximum booster they wish" — unlimited, stackable, 30 days each |
| 4 | Referral structure | Not a % commission — an invite-count → mining-rate multiplier (§2 table) |
| 5 | Withdrawal minimum / frequency | 100 VOLTS, 1 request per week |
| 6 | Withdrawal approval | Manual admin review |
| 7 | Conversion rate | 3 VOLTS = 1 mainnet $VLTR |
| 8 | KYC scope | Mandatory for all users, "for fairness of coin distribution" |
| 9 | Listing | After 500k users (business milestone, not engineering) |
| 10 | UI/UX + branding assets | None supplied — "its all your imagization to start with" |

### 9b. BLOCKING — still unanswered, needed before a real-money launch

1. **Token details:** client says the BEP-20 is "created already" on BNB Chain, but has not supplied the **contract address, ABI, or decimals**. Until then `WALLET_MODE=offchain` is the only honest setting — no real payout can be wired.
2. **Deposit / payment rail:** "people use real money to buy booster plans" — but *how*? Direct BNB/USDT transfer, on-page wallet payment, or a card processor? Nothing can be charged until this is chosen.
3. **Withdrawal fee:** asked, not answered. Any % or flat deduction? Who pays gas — user or platform?
4. **KYC provider:** mandatory KYC confirmed, but no provider named (Sumsub / Onfido / manual doc upload). Gates every payout.
5. **Task verification depth:** task types confirmed (tweet, follow, repost, YouTube, quiz, spin wheel) but not whether they need real X/YouTube API checks or honour-system + admin spot-check.

### 9c. RESOLVED by the rig mechanic (§2a)

**Does the referral multiplier apply to booster bonuses, or only to the base rate?**

Still reading A — `(base + hash) × multiplier` — but the unbounded-rate worry
below is now answered by the mechanic rather than by a cap: stacking cores
raises heat and draw as fast as it raises hash, so an unbalanced stack
throttles itself. Ten $50 cores on a stock chassis run at the 25% thermal
floor and the 10% power floor, not at 7,207/hr. Buying the cooling and power
to actually run them costs real money, which is the intended shape of the
economy. The analysis below is kept because the formula itself is unchanged.

The client's only worked example (`$1 booster → 2.9/hr`) was given at 0 invites, where the
multiplier is ×1 — so it does **not** disambiguate the two readings. The financial
difference is very large:

| Reading | Formula | $50 booster + 31 invites |
|---|---|---|
| **A — current implementation** | `(base + Σ bonuses) × multiplier` | **727.2 /hr** |
| B — multiplier on base only | `(base × multiplier) + Σ bonuses` | 97.2 /hr |

Reading A is ~7.5× more expensive to the platform, and because boosters are **unlimited and
stackable** the effective rate is unbounded: 10 × $50 boosters at 31+ invites yields
~7,207 points/hr ≈ 57,650 $VLTR/day for a $500 outlay. Confirm the intended formula and
whether a rate cap is wanted before any real-money launch.

### 9d. CONTRADICTION — resolved in favour of the client's direct answer

The job post asks for "**instant** withdrawal" with "automated transaction processing", but
in conversation the client said withdrawals "undergo admin preview manually". Built as
manual admin approval (§4). Worth re-confirming, since the two statements conflict.
