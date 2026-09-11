"""VOLTARA tokenomics model.

Layer 1 (VOLTS) is measured from the live engine — base rate, the real part
catalogue, referral tiers. Layer 2 ($VLTR) is the policy being designed.
Every assumption is named and collected at the top so it can be argued with.
"""

H = 24 * 365  # hours per year

# ── Layer 1: what the game actually emits (from the engine) ──────────────
BASE = 0.90            # VOLTS/h, bare chassis
BUILDS = {             # rate for a *working* build at 100% stability
    'free':  0.90,
    'vc1':   2.90,
    'vc5':  10.90,
    'vc10': 20.90,
    'vc50': 90.90,
}

# ── Assumptions (arguable; this is the whole point of writing them down) ─
MIX = {                # share of active miners on each build
    'free': 0.70,
    'vc1':  0.20,
    'vc5':  0.06,
    'vc10': 0.03,
    'vc50': 0.01,
}
AVG_REFERRAL_MULT = 1.35   # most miners invite nobody; a tail reaches x8
ACTIVE_SHARE      = 0.35   # share of registered users still claiming
SINK_SHARE        = 0.25   # VOLTS burned on skins + market fees, never redeemed

assert abs(sum(MIX.values()) - 1) < 1e-9


def volts_per_active_year() -> float:
    """Average VOLTS one *active* miner mines in a year."""
    rate = sum(BUILDS[k] * w for k, w in MIX.items())
    return rate * AVG_REFERRAL_MULT * H


def volts_emitted(registered_users: int) -> float:
    return volts_per_active_year() * registered_users * ACTIVE_SHARE


def volts_redeemed(registered_users: int) -> float:
    """What actually reaches the conversion window, after sinks."""
    return volts_emitted(registered_users) * (1 - SINK_SHARE)


# ── Layer 2: the policy under test ──────────────────────────────────────
def halving_pool(total_alloc: float, halving_months: int):
    """A monthly $VLTR pool that halves every `halving_months`.

    Geometric series: total = P0 * H * (1 + 1/2 + 1/4 + ...) = 2 * P0 * H.
    So the whole schedule is bounded by the allocation, forever, whatever
    the user count does — which is the property a fixed ratio cannot have.
    """
    p0 = total_alloc / (2 * halving_months)
    return p0


def fmt(n):
    return format(round(n), ',')


print('=' * 74)
print('LAYER 1 — what the game emits (measured from the engine)')
print('=' * 74)
print(f'  Average active miner: {volts_per_active_year()/H:.2f} VOLTS/h '
      f'-> {fmt(volts_per_active_year())} VOLTS/yr')
print(f'  Assumed: {ACTIVE_SHARE:.0%} of registered users active, '
      f'avg referral x{AVG_REFERRAL_MULT}, {SINK_SHARE:.0%} burned on sinks')
print()
print(f'  {"Registered":>12} {"VOLTS emitted/yr":>20} {"VOLTS redeemed/yr":>20}')
SCALES = [10_000, 100_000, 500_000, 2_000_000]
for u in SCALES:
    print(f'  {fmt(u):>12} {fmt(volts_emitted(u)):>20} {fmt(volts_redeemed(u)):>20}')

print()
print('=' * 74)
print('THE PROBLEM WITH A FIXED RATIO (3 VOLTS = 1 $VLTR)')
print('=' * 74)
print(f'  {"Registered":>12} {"$VLTR minted/yr":>20}  vs a 1B supply')
for u in SCALES:
    minted = volts_redeemed(u) / 3
    print(f'  {fmt(u):>12} {fmt(minted):>20}  = {minted/1e9:.2f}x the entire supply, per year')

print()
print('=' * 74)
print('LAYER 2 — halving pool: emission bounded by design')
print('=' * 74)
SUPPLY = 1_000_000_000
MINING_PCT = 0.35
ALLOC = SUPPLY * MINING_PCT
HALVING_MONTHS = 24

p0 = halving_pool(ALLOC, HALVING_MONTHS)
print(f'  Supply {fmt(SUPPLY)} | mining allocation {MINING_PCT:.0%} = {fmt(ALLOC)} $VLTR')
print(f'  Halving every {HALVING_MONTHS} months -> opening pool {fmt(p0)} $VLTR/month')
print(f'  Total ever emitted = 2 x {fmt(p0)} x {HALVING_MONTHS} = {fmt(2*p0*HALVING_MONTHS)} '
      f'(never exceeds the allocation, at any user count)')
print()
print('  Effective conversion a miner sees, by era and scale:')
print(f'  {"Era":<22}{"pool/mo":>12}' + ''.join(f'{fmt(u):>14}' for u in SCALES))
for era in range(4):
    pool = p0 / (2 ** era)
    yrs = era * HALVING_MONTHS // 12
    label = f'Year {yrs}-{yrs + HALVING_MONTHS//12}'
    row = f'  {label:<22}{fmt(pool):>12}'
    for u in SCALES:
        monthly_volts = volts_redeemed(u) / 12
        rate = monthly_volts / pool
        row += f'{rate:>13,.0f}:1'
    print(row)

print()
print('  (read: "VOLTS needed for 1 $VLTR" — it rises with users, which is')
print('   exactly what keeps a fixed supply solvent)')
print()
print('=' * 74)
print('WHAT A MINER EARNS IN $VLTR TERMS (year 0-2 pool)')
print('=' * 74)
for u in (10_000, 100_000, 500_000):
    monthly_volts = volts_redeemed(u) / 12
    rate = monthly_volts / p0
    mine_volts = volts_per_active_year() / 12       # one active miner, per month
    print(f'  At {fmt(u):>9} users: 1 $VLTR = {rate:,.0f} VOLTS  ->  '
          f'an average miner earns {mine_volts/rate:,.2f} $VLTR/month')
