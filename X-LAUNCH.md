# VOLTARA on X

Account abhi bana nahi hai, lekin code mein handle pehle se baked hai — landing
ka footer, har page ka Twitter card, aur FOLLOW / REPOST bounties sab ek hi
account ki taraf point karte hain. Isliye pehla kaam "kya post karein" nahi
hai; pehla kaam **handle claim karna** hai.

Neeche har code block copy-paste ke liye hai — re-wrap mat karna. X ka limit
280 hai (bio 160), aur link chhota ho ya bada 23 count hota hai; sab fit hain.

## 1. Handle

**`@VoltaraGrid`** — domain (`voltaragrid.com`), footer link aur Twitter cards
sab already yahi kehte hain.

Backend `X_HANDLE=Voltara` pe drift ho gaya tha, to FOLLOW bounty miners ko
`x.com/intent/follow?screen_name=Voltara` bhej raha tha — ek account jo hamara
hai hi nahi, aur TWEET task ka text bhi usi ko mention karta tha. Wo fix ho
chuka hai; ab handle do jagah se aata hai:

| Kahan | Kya |
|---|---|
| `frontend/app/seo.ts` | `X_HANDLE` / `X_TAG` / `X_URL` — footer, OG cards, share intents |
| `backend/.env` | `X_HANDLE`, `X_PINNED_POST_URL` — social bounties |

Agar `@VoltaraGrid` taken nikla: ek constant + ek env var badlo, aur kahin
nahi. Jo bhi handle mile, dono jagah **same** hona chahiye.

Handle decided hai: **VoltaraGrid**. Agar exact wala na mile to underscore ya
digits mat lagana (`@Voltara_Grid`, `@VoltaraGrid1`) — wo scam accounts jaise
padhe jaate hain, aur crypto mein pehle se trust deficit hai; `@VoltaraHQ` ya
`@VoltaraLabs` behtar hain.

## 2. Profile

| Field | Value |
|---|---|
| Name | `VOLTARA` |
| Handle | `@VoltaraGrid` |
| Avatar | `frontend/public/x-avatar.png` (400×400) |
| Header | `frontend/public/x-header.png` (1500×500) |
| Link | `https://www.voltaragrid.com` (www — apex 308 redirect karta hai) |
| Location | blank chhodo |

Bio (150 chars, limit 160):

```
Build the rig. Hold the grid.

Six slots. Heat and power are real constraints. GRID STABILITY multiplies everything you mine. Not another tap-to-earn.
```

Signup ke waqt X ise "Describe yourself — what makes you special? Don't think
too hard, just have fun with it" ke roop mein poochta hai. Wahi bio field hai,
aur wo composer line break accept nahi karta — to signup pe ye single line
paste karo (149 chars), aur baad mein Settings → Edit profile se upar wala
do-line version daal dena:

```
Build the rig. Hold the grid. Six slots. Heat and power are real constraints. GRID STABILITY multiplies everything you mine. Not another tap-to-earn.
```

Dono `tools/brand/generate-assets.js` se nikalte hain, baaki har icon ki tarah
— palette ya shape badla to `node tools/brand/generate-assets.js` chala dena,
alag se koi file maintain nahi karni.

Avatar `voltara-logo.png` nahi hai, apni file hai. Wo 0.14 inset pe bana hai jo
rounded square ke liye theek hai, lekin X avatar ko **circle** mein crop karta
hai aur circle corners kha jaata hai — hex ke left/right grid stubs har size pe
cut ho rahe the. `x-avatar.png` 0.22 inset pe hai, pura mark circle ke andar.

Email `hello@voltaragrid.com` use karo — SMTP wahi mailbox authenticate karta
hai, aur recovery ke liye wahi inbox chahiye jo tum actually padhte ho.

## 3. Pinned post

Ye sirf ek post nahi hai — REPOST bounty isi ki taraf point karta hai. Post
karne ke baad uska URL `X_PINNED_POST_URL` mein daalo, warna bounty profile pe
gir jaayega aur miner ko pata hi nahi chalega kya repost karna hai.

**Image ke saath post karna.** Text wala post timeline mein gayab ho jaata
hai, aur ye pinned rahega — saal bhar log ise dekhenge. Card yahan render hota
hai:

```
https://www.voltaragrid.com/api/og/compare
```

1600×900, do rigs side by side: $20 wala 7% stability pe 2.79/hr, $19 wala
100% pe 20.90/hr. Saare numbers asli engine se nikle hain (`rigTelemetry` +
`effectiveRateMilli`, catalogue `backend/prisma/seed.js` se), kisi ne acche
dikhne wale figures chun ke nahi likhe.

**Iska matlab ye bhi hai ki catalogue badla to card jhoot bolne lagega.** Kisi
part ka heat, watts ya price badlo to `frontend/app/api/og/compare/route.tsx`
ke numbers dobara nikalna padenge — aur ye pinned post hai, wahan galat number
wapas nahi liya ja sakta.

Attach karte waqt link post mein rehne do; image attach karne pe X unfurl card
nahi dikhata, to dono ka conflict nahi hota.

```
VOLTARA is not a tap-to-earn button.

It's a rig. Six slots. Cores make hash and heat. Coolers pull it out. PSUs carry the load. Push too far and GRID STABILITY drops — and stability multiplies everything you mine.

Build it right, or watch it throttle.

voltaragrid.com
```

## 4. Launch thread

Pinned post ko thread ka pehla post banao, phir:

**2/**
```
A cooler is not a "+10% boost" you buy and forget.

It pulls a fixed amount of heat. Your core makes heat every second. The difference is what your stability actually is.

That's the whole game: two numbers that have to balance, and six slots to balance them in.
```

**3/**
```
So a $15 build can out-mine a $40 one.

Stack four cores and you get a furnace at 38% stability. Three cores and a cooler that keeps up runs at 100% — and 100% of less hash beats 38% of more.

Most people learn this by overbuilding first. That's fine. Parts are swappable.
```

**4/**
```
Free to start. You get a loaner core for 72 hours, no card, no wallet connect. Mine with it, see the numbers move, then decide if you want a rig that's yours.

en / 中文 / 한국어. Web + Android.

voltaragrid.com
```

Thread yahin khatam. Roadmap post mat karo — jo cheez abhi live nahi hai uska
wada thread mein daalne ka matlab hai pehle din se uska hisaab dena.

## 5. Kaise post karein

Content se zyada ye maayne rakhta hai, kyunki shuru mein followers zero hain.

**Link post ke andar mat daalo.** X external link wale posts ki reach dabata
hai — uska business hi yehi hai ki log platform pe rukein. Link pehle reply
mein daalo ya bio pe chhod do. Pinned post exception hai: wahan link hi kaam
hai, aur pinned reach algorithm se nahi aati.

**Rig card free content hai.** `GET /api/og/rig/<code>` kisi bhi rig ka
1200×630 card render karta hai — kaunse parts socketed hain, rate kya hai,
stability kya hai. Matlab har post ke liye ek real image already generate ho
sakti hai, design kiye bina:

```
https://www.voltaragrid.com/api/og/rig/<referral-code>
```

Isse banta hai sabse sasta recurring post: ek build, uska card, aur ek sawaal.
"Guess the stability" type post log isliye jawab dete hain kyunki jawab dene
mein ek second lagta hai.

**Reply karna post karne se zyada kaam karta hai.** 0 followers pe tumhara
post koi nahi dekhta; reply doosre ke audience ke saamne jaata hai. Roz 5–10
replies, sirf wahan jahan tumhare paas kehne ko kuch actual hai. Ye pehle
mahine ka asli kaam hai — posting nahi.

**Numbers likho, adjectives nahi.** "38% stability" ko log padhte hain, "huge
boost" ko scroll karte hain. Product ka pura differentiator hi numbers hai, to
usko chhupana ulta pad raha hai.

**Ek post, ek idea.** Do ideas ka matlab hai dono kamzor.

**Thread ka pehla post akela khada hona chahiye.** Log thread expand nahi
karte. Agar pehle post se baat samajh nahi aayi to baaki 3 waste hain.

**Post karke gayab mat ho jao.** Pehle 30 minute ke replies hi decide karte
hain ki post aage jaayega ya nahi. Jab tak 20 minute na ho, post mat karo.

**Timing:** audience en / zh / ko hai. 12:00–14:00 UTC teeno ke liye theek hai
— Asia evening, Europe midday. Ek hi time pe roz post karo, taaki pata chale
kya kaam kiya aur kya nahi.

**Purani post repost mat karo, quote karo** ek nayi line ke saath. Repost dead
reach hai; quote naya post hai.

## 6. Pehla hafta

| Din | Post |
|---|---|
| 1 | Launch thread (upar) + pin |
| 2 | Rig card screenshot — ek real build, actual numbers, "guess the stability" |
| 3 | Ek mechanic ka explainer: thermal throttle curve, ek image |
| 4 | Reply karo. Koi bhi mining/BNB post jahan tumhare paas kehne ko kuch actual hai. Naya post se zyada kaam karta hai |
| 5 | "Cheapest 100% stability build" — community se poochho, screenshots maango |
| 6 | Behind the scenes: koi ek build decision aur uska reason |
| 7 | Week recap — **sirf agar** dikhane ko kuch real hai |

Roz post karna zaroori nahi. Khaali din ek bakwaas post se behtar hai.

## 7. Post bank

Official page se. Inme se koi bhi post karne ke liye users ki zaroorat nahi —
sab abhi sach hain. Har number engine se nikla hai (`rigTelemetry` +
`effectiveRateMilli`, catalogue `backend/prisma/seed.js`).

Ek baat pehle: **post viral karne ka koi tareeka nahi hai.** Jo control mein
hai wo ye hai ki post ki *shakl* aisi ho jise koi apni baat jod ke aage bhej
sake. X pe reach quote aur reply se aati hai, like se nahi. Isliye har post
neeche ya to ek aisa daava hai jispe koi ruk jaaye, ya ek sawaal jiska jawab
dena sasta ho.

### P1 — Sabse strong (232 chars)

Image: `/api/og/compare?p=dollar`

```
Our $1 part beats our $20 build.

One VC-1 core in a bare chassis: 2.90/hr, holding 100%.

Four $5 cores and no cooler: twenty times the hash, 104 heat against 12 cooling. 7% stability, 2.79/hr.

Spending more isn't building better.
```

Company apne hi $1 wale option ko $20 wale se upar bata rahi hai — yehi wo
hissa hai jo log repeat karte hain. Anti-sales lagta hai, isliye bikta hai.

### P2 — Guess (197 chars)

```
Six slots:
3 × VC-10 Plasma Core
1 × CX-6 Cryo Loop
1 × PS-3 Feeder Unit

Heat: 148, against 132 cooling.
Power: 640 W, against 380 supplied.

$39 spent. Guess the GRID STABILITY before you scroll.
```

Jawab **53%** hai, 32.25/hr. Use apne hi post ke reply mein daalo, 30–60 minute
baad. Har guess ek reply hai, aur reply reach badhate hain. Ye format har hafte
naye build ke saath dobara chal sakta hai.

### P3 — Jo galti sab karte hain (234 chars)

Image: `/api/og/compare` (default)

```
Nobody's first rig has a cooler in it.

Four cores, every slot that matters filled, looks maxed out. The bare chassis gives you 12 cooling. Those cores make 104 heat.

It runs at 7%.

The fix costs $2. Most people find it a week late.
```

Sikhane wale posts bookmark hote hain, aur bookmark X ke liye strong signal hai.

### P4 — Challenge (209 chars)

```
$15. Six slots. Highest GRID STABILITY wins.

Cores make hash and heat. Coolers remove heat and cost watts. PSUs supply watts and make a little heat.

Post your build. I'll run the real numbers on every reply.
```

Ye ek aisa post hai jo actually users laata hai: jo reply karega wo pehle hi
tumhare mechanic ke baare mein soch chuka hoga. Jawab dena tumhare liye free
hai — `rigTelemetry` har build ka number nikaal deta hai. Jawab dena bhoolna
mat, warna ulta asar hoga.

### P5 — Build in public (254 chars)

```
Our own admin dashboard was showing this:

≈ 35.00 $VLTR (~$5.25)

The $5.25 came from a hardcoded $0.15 per token. $VLTR has never been on a chain and has never traded. There is no price.

Deleted it. A number that isn't measured doesn't go on a screen.
```

Ye sach hai aur crypto mein aisa post durlabh hai, isliye phailta hai. Saath hi
ye §8 wala rule public kar deta hai, jisse baad mein usse hatna mushkil ho
jaata hai — jo achhi baat hai.

### P6 — Category contrast (238 chars)

```
Tap-to-earn gives you one button and one number that goes up.

VOLTARA gives you six slots, a heat budget, a power budget, and a stability figure that multiplies everything the rig makes.

Same idle loop. One of them has a decision in it.
```

Ek saaf position. Kisi ka naam mat lena — category pe baat karo, competitor pe
nahi, warna baat product se hat ke ladai pe aa jaati hai.

### Verified builds

Inhe naye posts banane ke liye use karo. Engine se nikle hain, 12 Sep 2026:

| Build | $ | Heat | Power | Stability | Earns |
|---|---|---|---|---|---|
| VC-1 akela | 1 | 10/12 | 45/120 | 100% | 2.90/hr |
| VC-5 + CX-2 + PS-3 | 10 | 30/52 | 128/380 | 100% | 10.90/hr |
| VC-10 + CX-2 + PS-3 | 15 | 52/52 | 218/380 | 100% | 20.90/hr |
| 4 × VC-5 | 20 | 104/12 | 440/120 | **7%** | 2.79/hr |
| 2 × VC-5 + CX-6 + PS-3 | 19 | 56/132 | 260/380 | 100% | 20.90/hr |
| 3 × VC-10 + CX-6 + PS-3 | 39 | 148/132 | 640/380 | **53%** | 32.25/hr |
| 2 × VC-10 + CX-20 + PS-12 + OD-8 | 60 | 122/432 | 520/1020 | 100% | 46.90/hr |

$15 wala 100% pe hai lekin **52 heat against exactly 52 cooling** — zero
margin. Koi bhi grid event heat badhaye to wo 100% se gir jaata hai. Isliye
launch card pe $19 wala hai, $15 wala nahi: pinned card pe aisa daava nahi
jaana chahiye jo chupchaap jhoot ho jaaye.

Catalogue badla to ye poori table dobara nikalni padegi.

## 8. Jo kabhi post nahi karna

- **$VLTR ka koi bhi price ya market cap.** Token on-chain hai hi nahi, kabhi
  trade nahi hua. Ek bhi dollar figure post ho gaya to wahi screenshot ban ke
  wapas aayega. (Admin dashboard mein ek invented `$0.15` figure tha — nikal
  diya.)
- **Payout ki date ya "payouts soon".** `PAYOUTS_OPEN=false` hai. Jab khulega
  tab bolna.
- **User counts, jab tak wo sach na ho.** Landing measured stats dikhati hai
  (`GET /api/grid/stats`); post bhi wahi number use kare ya koi number na use
  kare. Ye GROWTH.md §6 wali hi baat hai, bas ab public.
- **Giveaway/airdrop hype.** Bounties app ke andar hain, wahi theek hai.

## 9. Account banne ke baad

1. `X_PINNED_POST_URL` = pinned post ka poora URL (`.../status/123…`), Render
   env mein. Status ID hoga tabhi REPOST one-tap repost intent banega; profile
   URL ho to sirf profile khulta hai.
2. `X_HANDLE` Render pe set karo agar `@VoltaraGrid` nahi mila.
3. `frontend/app/seo.ts` ka `X_HANDLE` bhi wahi karo, phir redeploy.
4. Ek referral link se TWEET bounty khud test karo — compose box mein handle,
   link aur OG card teenon aane chahiye.
