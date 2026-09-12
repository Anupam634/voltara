# VOLTARA — Growth Playbook

Users ko pehle 60 second mein hook kaise dein, aur platform apne aap kaise phaile.
Har idea is codebase ki mechanic se bandha hai: rig, GRID STABILITY, VOLTS,
referral tiers, tasks, leaderboard.

## 1. Core idea: rig hi content hai

Tap-to-earn apps ek jaisi lagti hain kyunki unke paas dikhane ke liye kuch nahi
hota. VOLTARA ke paas hai: har user ka rig ek unique build hai jo overheat kar
sakta hai, brownout kar sakta hai, ya 100% stability pe chamak sakta hai. Yahi
screenshot-able moment hai.

**Strategy ek line mein:** pehle 60 second mein user ka rig chal jaye, pehle din
uska rig share ho jaye, pehle hafte uske 3 dost aa jayein.

## 2. First hook: pehle 60 second

Abhi signup ke baad khali chassis + 24h wait milta hai. Yeh churn point hai.

### 2a. Instant first claim
- Signup pe pehla Mine button turant ready ho, 3–5 VOLTS milein (shockwave,
  sound, "+5 VOLTS" float-up). User ko mechanic pehli baar mein feel ho.
- Backend: `mining.service` mein signup pe `nextClaimAt = now` aur ek one-time
  `WELCOME` ledger reason. Withdrawal 100 VOLTS + KYC pe gated hai, fraud risk kam.

### 2b. Loaner core: 72h trial
- Har naye user ke slot 1 mein VC-1 loaner core auto-install, 72h ke liye.
  Rate 0.9 → 2.9/hr; user rig screen pe apna pehla part jalte dekhta hai.
- Expiry se 12h pehle countdown + push: "Loaner expire ho raha hai, apna VC-1
  lagao ($1)". Yeh pehla purchase moment hai.
- Backend: `Booster` row with `source = LOANER`, 72h expiry, non-transferable.

### 2c. Onboarding as a build
- 3-step checklist: Mine once → Install loaner → Share your rig. Har step pe
  VOLTS. Existing `tasks` system se ban sakta hai (3 naye task types).

## 3. Viral loop: rig card

Referral link share karna boring hai, rig card share karna nahi.

1. User rig banata hai; 100% stability ya overheat, dono share-worthy.
2. Card auto-generate: Next.js OG route `/api/og/rig/[code]` (dark plate,
   six slot pips, gauge, invite code).
3. X / Telegram / WhatsApp pe link unfurl hone pe card dikhta hai.
4. Dost click karta hai: landing pe "Beat this rig" CTA, referrer ka build side mein.
5. Two-sided reward.

### Referral rewards: parts, not just multiplier

| Invites | Reward | Kyun |
|---|---|---|
| 1 | Invitee ko +24h loaner core | Invitee ka pehla hafta better |
| 3 | Free CX-2 Vapor Cooler (30d) | User cooling / heat mechanic sikhta hai |
| 5 | Free PS-3 Feeder Unit (30d) | Power budget unlock, ab VC-5 khareedne layak |
| 10 | Permanent 7th slot | Rare, visible on rig card (`rigSlots` already exists) |
| 25+ | "Grid Operator" badge + leaderboard highlight | Social proof |

Backend: `referrals.service.ts` mein tier unlock pe `Booster` grant with
`source = REFERRAL`.

## 4. Retention

- **Streak:** 7 lagatar claims → +10% rate 24h ke liye; miss = reset. Flame counter.
- **Push (3 types):** claim ready · part expiring in 24h · rig overheating
  (stability < 60%). Mobile scheduler already hai.
- **Weekly seasons (ban chuka):** leaderboard ka WEEK filter *rolling* 7 din
  hai — browse karne ke liye theek, prize ke liye bekaar, kyunki rolling window
  kabhi khatam hi nahi hota. Season apna fixed Monday→Monday block rakhta hai,
  har Monday 00:10 UTC close hota hai aur top 10 ko 625 VOLTS ka pool baant
  deta hai (`GET /api/season`, SPEC §2b.13).
- **Missions (3/week):** "Hold 100% stability 5 din", "Install a cooler",
  "Invite 1". Tasks table reuse.
- **Overheat drama:** stability < 60% pe rescue moment: heat animation, CTA
  "Cool it down (CX-2, $2)", share "My rig is melting". Overheat theme auto
  apply jab rig hot ho.

## 5. Distribution

Pehle ye maano: **referral loop engine nahi hai, multiplier hai.** Zero ko
multiply karoge to zero hi milega. Pehle ~100 users kahin aur se laane padenge,
aur wo jagah loop nahi ho sakti.

Isliye do alag list hain, aur inhe mix karna hi sabse badi galti hogi.

### 5a. Cold start: 0 → 100

| Channel | Kyun abhi | Kya lagta hai |
|---|---|---|
| Incremental / idle game communities (r/incremental_games, idle-game Discords) | Mechanic hi pitch hai. Ye log build optimise karne ke liye aate hain, payout ke liye nahi — aur payouts abhi band hain | Ek achhi post, koi paisa nahi |
| KO + ZH micro-KOLs | Product pehle se teen zubaan mein hai; zyadatar competitors nahi hain. Naver cafe, Kakao open chat, WeChat | 3–5 KOLs ko free VC-5 + custom code |
| Airdrop aggregators (airdrops.io, CMC airdrop, DappRadar, Airdropalert) | Sabse zyada volume, sabse tez, submit karna free | Ek form, par listing pe **pre-launch** likhna zaroori |
| Telegram GameFi / airdrop channels | Ye poori category Telegram pe rehti hai, X pe nahi | Channel outreach |
| Reddit: r/airdrops, r/PlayToEarn, r/CryptoMoonShots | Promo allowed hai, r/CryptoCurrency ke ulat | Post + replies |

**Kaunsa darwaza khatkhataoge wo tay karta hai kaun aayega.** Airdrop hunters
sabse tez aate hain aur sabse tez chale jaate hain — aur `PAYOUTS_OPEN=false`
dekh ke public mein shikayat karenge, kyunki unse wahi wada kiya gaya tha. Idle
game wale kam hain lekin wo actually khelte hain aur mechanic pe asli feedback
dete hain. Abhi jo chahiye wo earners nahi, **playtesters** hain — to pitch bhi
"ise khelo" hona chahiye, "isse kamao" nahi.

Iska matlab D7 aur share rate tabhi kuch kehte hain jab wo sahi audience se
aaye hon. 500 airdrop hunters ka D7 2% tumhe kuch nahi batata.

### 5b. Loop: 100+

| Channel | Kya karna hai | Fit |
|---|---|---|
| Rig card shares | Har share miner ka apna rig unfurl karta hai (`/r/<code>`), ek jaisa house ad nahi | High |
| X bounties | **Cold start pe zero hain** — bounty karne wala hi koi nahi. 100 active users ke baad hi inka matlab hai | High (baad mein) |
| Telegram mini app | Dashboard + Mine ko TG WebApp mein wrap. Referral share native hai | High |
| Seasons + leaderboard | Hafte ka reset wapas aane ki wajah deta hai | Medium |
| YouTube build videos | "Best $10 rig", "How to hit 100% stability"; calculator embed | Medium |
| Paid ads | Abhi nahi; pehle organic K-factor 0.5+ | Later |

X account ka handle, bio, pinned post aur pehle hafte ke posts **X-LAUNCH.md**
mein hain. Pinned post ka URL `X_PINNED_POST_URL` mein daalna zaroori hai —
REPOST bounty wahi padhta hai.

## 6. Trust

- **Fake numbers kabhi nahi.** Landing strip ab measured grid stats dikhati hai
  (`GET /api/grid/stats`: miners, online now, 24h VOLTS, stability, countries).
  Pehle wahan ek marquee thi jo apne aap random wallet address aur "350 $VLTR
  paid out on BNB Chain" jaisi lines banati thi — jab ek bhi payout hua hi nahi
  tha. API na chale to strip kuch nahi dikhati; khali strip jhooti strip se
  behtar hai.
- Public payout ledger `/proof`: har approved withdrawal ka BscScan link
  (masked email). **Token launch ke baad** — abhi withdrawals hi band hain
  (`PAYOUTS_OPEN=false`), to proof page ke paas dikhane ko kuch nahi.
- Tokenomics page: supply, distribution, mined vs paid.
- KYC ko "fair distribution" ke tarah pitch: "One person, one rig."
- Founder face: 60-second video landing pe.

## 7. Metrics

| Metric | Target |
|---|---|
| K-factor | ≥ 0.5 (1.0+ = self-sustaining) |
| D1 / D7 retention | 40% / 20% |
| Signup → first $1 purchase | ≤ 7 din |
| Share rate (rig card shares / active users) | 15% |

**Ban chuka:** ye char admin dashboard pe hain (`GET /api/admin/ops/growth`,
SPEC §6). Teen measure hote hain — K-factor, D1/D7, signup→first purchase.
**Share rate measure nahi hota:** share ka koi event kahin record hi nahi
hota, to wo tile jaan-boojh kar khali hai, wajah ke saath. Uski jagah koi
milta-julta number (rig card views, referral link hits) dikhana sabse bura
hoga — target pe log kaam karte hain.

## 8. Build order

**Status (12 Sep 2026):** items 1, 2, 3, 4, 5, 6 aur 9 ban chuke hain — instant
first claim, rig card OG + share, loaner core, streak + push, referral part
rewards, weekly season, overheat rescue. Bacha hai: **8 (Telegram)** aur
**7 (proof page), jo token launch tak blocked hai** — withdrawals hi band hain,
to proof karne ko koi payout hi nahi.

Season ka prize **VOLTS mein hai, $VLTR mein nahi** (SPEC §2b.13): token launch
tak on-chain kuch hai hi nahi aur payouts gated hain, to $VLTR pool ek IOU
hota. VOLTS turant asli hain — parts khareedte hain, aur payout window khulne
pe 3:1 convert hote hain.

| # | Feature | Effort | Impact | Kahan |
|---|---|---|---|---|
| 1 | Instant first claim + welcome VOLTS | 1 din | High | `mining.service`, seed |
| 2 | Rig card OG image + share buttons | 2 din | High | Next OG route, dashboard, referrals |
| 3 | 72h loaner core | 1 din | High | `Booster` source, signup hook |
| 4 | Claim streak + push | 2 din | High | mining engine, mobile scheduler |
| 5 | Referral part rewards (3/5/10) | 2 din | High | `referrals.service` |
| 6 | Weekly season + prize pool (625 VOLTS/hafta, top 10) | 2 din | Medium | `seasons/`, leaderboard |
| 7 | Public payout proof page — **launch tak blocked** | 1 din | Medium | withdrawals API, new page |
| 8 | Telegram mini app wrapper | 1 week | High | new entry, TG auth |
| 9 | Overheat rescue flow + auto theme | 1 din | Medium | rig page, theme |

**Decision (13 Sep 2026):** pehle user ko rig banane ka reason do, phir us rig
ko share karne ka reason do. Isliye order hai: **instant first claim + loaner
core → streak/retention → rig card sharing.** Rig card ek multiplier hai, engine
nahi: agar log ruk hi nahi rahe to behtar card zero ko multiply karega.

**Pehle 2 hafte:** items 1, 2, 3 ship karo, phir pehle 100 users §5a se lao —
idle-game communities aur KO/ZH KOL codes. X bounty se nahi: wo loop ka hissa
hai, aur loop tab tak zero hai jab tak usme log na hon.

Uske baad share rate + D7 measure karo. 10%+ hai to 4, 5, 6 pe jao; nahi to
pehle rig card ka design theek karo — wo loop ka engine hai.

Jo sabse zyada matter karta hai: user ko apna rig dikhane pe garv ho.
