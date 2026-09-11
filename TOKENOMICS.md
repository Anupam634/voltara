# VOLTARA — Tokenomics model

**Status: a proposal, not a decision.** Nothing here is implemented and no
number below is published anywhere yet. It exists so the supply figure can be
chosen from arithmetic rather than from a round number that sounds right.

Two things gate the whole document:

1. **Is the contract actually deployed?** SPEC §3 records the client's claim
   that the BEP-20 is already live on BNB Chain, but no address, ABI or
   decimals have ever been supplied (§9b.1). If it is deployed, the supply is
   already minted and this is not our choice — the site would have to match
   the chain, not the other way round.
2. **The token launches later.** Today the product is the mining game, and
   payouts are gated behind `PAYOUTS_OPEN=false`. None of this blocks
   shipping. It blocks *publishing numbers*, which the landing page currently
   does anyway — see §6.

---

## 1. The finding that started this

The landing page advertises `3 VOLTS = 1 $VLTR` as a fixed, permanent
conversion. A fixed ratio cannot survive growth, because emission scales with
the number of miners and a fixed supply does not.

Measured against the real engine — the actual base rate, the actual part
catalogue, the actual referral tiers:

| Registered users | $VLTR minted per year at 3:1 | Against a 1B supply |
|---|---:|---|
| 10,000 | 35,182,350 | 0.04× |
| 100,000 | 351,823,500 | 0.35× |
| **500,000** | **1,759,117,500** | **1.76× the entire supply, every year** |
| 2,000,000 | 7,036,470,000 | 7.04× |

500,000 users is the client's own stated listing milestone (SPEC §3). At that
size the platform mints nearly twice its total supply annually. Raising the
supply does not fix this — it is a rate problem, not a size problem. Going
900M → 1B buys 11% against a shortfall of roughly 1,000%.

---

## 2. Layer 1 — what the game emits (measured, not assumed)

VOLTS emission comes from the engine and is **not** what this document
proposes changing. The rig economy is well balanced and is the product.

| Build | Rate at 100% stability |
|---|---:|
| Bare chassis (free) | 0.90 VOLTS/h |
| VC-1 build ($1) | 2.90 VOLTS/h |
| VC-5 build ($10) | 10.90 VOLTS/h |
| VC-10 build ($19) | 20.90 VOLTS/h |
| VC-50 build ($82) | 90.90 VOLTS/h |

### Assumptions, stated so they can be argued with

| Parameter | Value | Why |
|---|---:|---|
| Build mix | 70% free · 20% VC-1 · 6% VC-5 · 3% VC-10 · 1% VC-50 | Conservative free-to-play skew |
| Average referral multiplier | ×1.35 | Most miners invite nobody; a tail reaches ×8 |
| Active share of registered | 35% | Registered ≠ still claiming |
| Sink share | 25% | Skins burn VOLTS outright (150–400 each); the market takes a 5% fee. Neither ever reaches the conversion window |

These four numbers move the output more than anything else in this document.
They are guesses today and should be replaced with measurements as soon as
there are real users — the growth metrics in the admin panel already measure
three of the four.

**Result:** an average *active* miner produces **4.59 VOLTS/h ≈ 40,208
VOLTS/year**.

| Registered | VOLTS emitted/yr | VOLTS reaching conversion (after sinks) |
|---|---:|---:|
| 10,000 | 140,729,400 | 105,547,050 |
| 100,000 | 1,407,294,000 | 1,055,470,500 |
| 500,000 | 7,036,470,000 | 5,277,352,500 |
| 2,000,000 | 28,145,880,000 | 21,109,410,000 |

---

## 3. Layer 2 — the proposal: a halving pool, not a fixed ratio

Replace the fixed ratio with a **periodic pool**:

> Each month a fixed number of $VLTR is released. Every miner who redeems
> VOLTS that month takes a share proportional to what they redeemed.
> The effective rate is an outcome, not a promise.

The pool **halves every 24 months**. That single choice bounds total emission
forever, whatever happens to user count:

```
total = P₀ × H × (1 + ½ + ¼ + …) = 2 × P₀ × H
```

So picking an allocation fixes the opening pool, and the schedule can never
overshoot it — which is precisely the property a fixed ratio cannot have.

### Worked example

| Parameter | Value |
|---|---:|
| Total supply | 1,000,000,000 $VLTR |
| Mining allocation | 35% = 350,000,000 |
| Halving period | 24 months |
| **Opening pool** | **7,291,667 $VLTR / month** |
| Total ever emitted | 2 × 7,291,667 × 24 = **350,000,000** — exactly the allocation |

### The rate a miner actually sees

| Era | Pool / month | 10k users | 100k | 500k | 2M |
|---|---:|---:|---:|---:|---:|
| Year 0–2 | 7,291,667 | 1:1 | 12:1 | 60:1 | 241:1 |
| Year 2–4 | 3,645,833 | 2:1 | 24:1 | 121:1 | 483:1 |
| Year 4–6 | 1,822,917 | 5:1 | 48:1 | 241:1 | 965:1 |
| Year 6–8 | 911,458 | 10:1 | 97:1 | 483:1 | 1,930:1 |

Read as "VOLTS needed for 1 $VLTR". It rises with users — that rise is the
mechanism, not a bug. It is what keeps a fixed supply solvent at any scale.

### What that means for a miner

At the year 0–2 pool, an average active miner earns:

| Scale | Effective rate | Miner earns |
|---|---:|---:|
| 10,000 users | 1 VOLTS = 1 $VLTR | ~2,778 $VLTR / month |
| 100,000 users | 12:1 | ~278 $VLTR / month |
| 500,000 users | 60:1 | ~56 $VLTR / month |

Note the early-adopter effect falls out of the arithmetic rather than being
promised: at launch scale the rate is *better* than the 3:1 currently
advertised. That is a genuinely good launch story, and an honest one, because
it is a consequence rather than a commitment.

---

## 4. Where this proposal is weak

Stated plainly, because these are the parts that will be argued with:

- **A miner cannot know in advance what their VOLTS are worth.** This is a
  real cost and the main objection. Mitigation: publish the current month's
  pool and the running total of VOLTS redeemed, live, so the rate is a
  visible converging number rather than a surprise — the way a mining pool
  shows its payout rate. Without that transparency this design is worse than
  a fixed ratio, not better.
- **The four assumptions in §2 are guesses.** If the active share is 60%
  rather than 35%, every figure moves by nearly a factor of two. Replace them
  with measurements before committing.
- **$VLTR price is unknown**, so "56 $VLTR/month" cannot yet be translated
  into whether mining is worth anyone's time. That question is not answerable
  today by anybody.
- **Halving every 24 months is a convention borrowed from Bitcoin**, not a
  derivation. A slower decay favours later miners; a faster one favours
  early ones. It is a fairness dial, and it should be set deliberately.

---

## 5. Recommendation

1. **Confirm whether the contract is deployed.** Everything else is
   downstream of this, and it has been an open question since §9b.1.
2. **If it is not deployed: 1,000,000,000 total supply.** It is standard, it
   reads well, and under a halving pool it is a promise that can actually be
   kept. The number matters far less than the schedule attached to it.
3. **Drop the fixed `3 VOLTS = 1 $VLTR`** in favour of the monthly pool. Do
   it now, while only ~15 VOLTS have ever been minted and no real balance
   exists — after launch the same change looks like a devaluation.
4. **Build the live rate display before the token ships**, not after. The
   design depends on it.

### Suggested allocation (1B supply)

| Bucket | % | $VLTR | Note |
|---|---:|---:|---|
| Mining community | 35% | 350,000,000 | The halving pool above |
| Public liquidity | 20% | 200,000,000 | Locked DEX/CEX pairs |
| Ecosystem & growth | 15% | 150,000,000 | Grants, bounties, KOLs |
| Core team | 20% | 200,000,000 | Long vesting |
| Strategic partners | 10% | 100,000,000 | Advisory, infra |

Mining is raised from the currently-published 30% to 35% because the mining
community is the only bucket that has to fund an ongoing, open-ended
obligation; the others are one-time.

---

## 6. What the site says today, and why it needs to change first

Independent of which numbers are chosen, `OnChainArchitecture.tsx` currently
presents all of this as settled, present-tense fact on the public landing
page:

| Claim on the landing page | Reality |
|---|---|
| Total supply: **900M fixed** | Not decided; this document proposes 1B |
| **Inflation-capped mining** | **No implementation exists** — it is a label with no code behind it |
| 270M / 180M / 180M / 180M / 90M split | Not decided |
| Official domain: voltaragrid.com | A placeholder chosen during the rebrand, never confirmed |
| "Transparent mathematics… fair scheduled distribution" | There is no distribution yet |

This is the same failure the landing page already corrected once: a marquee
used to generate fake payouts and wallet addresses before a single payout had
happened, and it was removed because *a fabricated number on a landing page
is the most expensive kind*. This section does it again, more quietly.

**The minimum honest fix, independent of any tokenomics decision:** mark the
section as forward-looking — "Planned — at token launch. $VLTR is not on-chain
yet." — and remove "inflation-capped mining" until something implements it.

That change is small, can be made today, and leaves the token decision
entirely open.

---

*Model source: `scratchpad/tokenomics.py`. Layer 1 figures are computed from
the live engine constants and the seeded catalogue, not estimated.*
