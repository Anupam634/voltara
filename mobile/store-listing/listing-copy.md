# Google Play listing copy — VOLTARA

## App name (30 max)
VOLTARA — Build the Rig

## Short description (80 max)
Build a 6-slot rig. Balance heat and power. Hold grid stability at 100%.

## Full description (4000 max)
VOLTARA is a daily rewards app on BNB Smart Chain — and it asks something of you that the others don't.

You don't buy a number that gets added to a rate. You get a six-slot rig, and every part you put in it costs something to run. Cores make hash and heat. Coolers kill heat but draw watts. Power supplies feed the whole thing. Let the heat outrun your cooling, or the draw outrun your supply, and your rig throttles — in proportion, visibly, on a gauge. GRID STABILITY is one number from 0 to 100%, and it multiplies everything you earn.

Nothing runs on your phone in the background: no proof-of-work, no battery drain, no hardware. The heat and the watts are a game you play, not a bill you pay.

HOW IT WORKS
• Register free in seconds — you get a six-slot chassis with 12 TU of cooling and 120 W, free.
• Tap Mine once a day to start a 24-hour accrual window.
• VOLTS accrue at the rate your rig actually holds. VOLTS convert to $VLTR (BEP-20) at a fixed 3 : 1 ratio.
• Request a withdrawal once you pass the minimum balance. Payouts are reviewed by our team and sent to the BEP-20 address you provide.

BUILD THE RIG
• Cores (VC-1 to VC-50): more hash, more heat, more watts. Every time.
• Cooling (vapor, cryo loop, immersion bath): buys back the headroom — and spends watts doing it.
• Power (feeder units, substations): keeps the build fed.
• Modules: multiply what your cores already make.
• Six slots. Owning a part isn't running it — you choose what earns.

GROW YOUR RATE
• Referral network: invite friends with your code and climb six tiers of rate multipliers, up to 8×.
• Daily bounties: quick tasks and a daily prize wheel for bonus VOLTS.
• Live leaderboard: see where your rig ranks worldwide.

SECURE BY DEFAULT
• KYC identity verification before the first withdrawal.
• Biometric unlock and secure on-device credential storage.
• Anti-abuse checks that disqualify self-referrals and duplicate devices.

Rewards are recorded on BNB Smart Chain as BEP-20 tokens. VOLTARA does not mine cryptocurrency on your device and does not use your phone's processor for any computation. The rig, its heat and its power draw are a simulation with real economics. VOLTS and tokens have no guaranteed value. Availability of withdrawals is subject to identity verification and a security review.

Website: https://voltaragrid.com
Privacy policy: https://voltaragrid.com/en/privacy
Support: hello@voltaragrid.com

## Category
Finance

## Contact
Email: hello@voltaragrid.com
Website: https://voltaragrid.com

## Notes for whoever uploads this
- The package name changed to `com.voltaragrid.app`, so Play treats this as a
  **new app**: a new listing, and no update path from the previous one.
- Replace `icon-512.png` and `feature-graphic-1024x500.png` with exports of the
  current mark — regenerate with `node tools/brand/generate-assets.js`, which
  writes `mobile/assets/icon.png` at 1024 (downscale to 512) and
  `frontend/public/og-image.png` at 1200×630 (crop to 1024×500).
- The domain `voltaragrid.com` is a placeholder until the real one is
  registered. It appears here, in `mobile/app.json`, `render.yaml`,
  `backend/src/common/cors-origins.ts` and `backend/nginx/voltara.conf`.
