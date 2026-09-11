# Running & deploying Voltara

Two paths, depending on what you need right now:

- **[Local test](#local-test-fastest)** — everything on your own machine, free, ~5 minutes. Good for "does this work end to end."
- **[Public deploy](#public-deploy-shareable-url)** — a real URL you (or anyone) can open from a phone. Needs free accounts on two hosts.

Both were verified end to end while writing this: register → login → mining status → claim, through the real UI hitting the real API.

---

## Local test (fastest)

### 1. Start Postgres + Redis

```bash
docker compose up -d
```

This starts the two services the backend needs, using the same
credentials already in `backend/.env.example`. Nothing else runs in
Docker — the API and the frontend run directly with `npm` so you get fast
reloads.

Don't have Docker? Install Postgres 16 and Redis locally instead, then
create a `voltara` database with user/password `postgres`/`postgres`
(or edit `backend/.env` to match whatever you already have running).

### 2. Backend

```bash
cd backend
cp .env.example .env      # defaults already point at the docker-compose services
npm install
npx prisma migrate dev    # creates the schema
npm run start:dev         # http://localhost:3001/api
```

Leave this running. You should see `Voltara API listening on
http://0.0.0.0:3001/api` in the log, and routes like
`{/api/auth/register, POST}` listed above it.

Sanity-check it directly, no frontend needed:

```bash
curl http://localhost:3001/api/grid/stats
```

### 2a. Email — signup does not work without it

**Registration requires a 6-digit code sent by email.** With no working SMTP
the `send-otp` call answers `502` and nobody can create an account. The API
is otherwise healthy and the health check passes, so this does not surface
until someone actually tries to sign up.

Run a local mail catcher:

```bash
docker run -d --name voltara-mail -p 1025:1025 -p 8025:8025 axllent/mailpit
```

and point the backend at it in `backend/.env`:

```
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER="dev@voltaragrid.com"
SMTP_PASS="anything"        # mailpit accepts any credentials
```

Codes then land in the web inbox at **http://localhost:8025** — open the
message, copy the six digits, finish the form.

An explicitly set `SMTP_HOST` always wins. It did not used to: the provider
was chosen from the *username's* domain, so a `@voltaragrid.com` user
silently rebuilt the transport as `mail.spacemail.com:465` and ignored the
configured host. The symptom was `535 authentication failed`, which sends you
looking at credentials rather than at the host.

### 3. Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL="http://localhost:3001/api" — already correct for local
npm install
npm run dev                  # http://localhost:3000
```

Open `http://localhost:3000/en`, click **Create free account**, register,
and you should land on `/en/dashboard` with a live hash rate, pending
points, and a working **Mine** button pulling real numbers from the API
you started in step 2.

### What's not wired up yet

- **Seeding is automatic.** `npm run start:prod` applies migrations and seeds
  the four booster plans and six tasks from SPEC on every deploy. The seed is
  idempotent, so it fills an empty catalogue once and does nothing thereafter.
  To run it by hand against a local database:
  ```bash
  cd backend && npm run seed
  ```
- **Boosters**: fully purchasable, paid on BNB Chain and verified
  automatically — no admin approval. Purchases stay **disabled until you
  configure a receiving wallet**, and the UI says so plainly rather than
  offering a button that cannot work. To enable, set in the backend env:
  ```
  BOOSTER_PAY_TO_ADDRESS=0xYourReceivingWallet
  BOOSTER_PAY_TOKEN=USDT                 # or BNB
  BOOSTER_PAY_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
  BOOSTER_PAY_TOKEN_DECIMALS=18
  BOOSTER_MIN_CONFIRMATIONS=6
  BOOSTER_RPC_URL=https://bsc-dataseed.binance.org/
  ```
  Plans are priced in USD, so a dollar stablecoin (USDT) maps 1:1 and needs
  no price feed. Paying in **BNB** additionally requires `BOOSTER_BNB_PER_USD`
  — without an explicit rate, BNB payments stay disabled rather than being
  priced by a guess.
- **Admin panel**: built (SPEC §6) at `/<locale>/admin`. There is no admin
  self-signup — create the first operator account from the `backend/`
  directory:
  ```bash
  npm run admin:create -- admin@yourdomain.com 'a-strong-password'
  ```
  Then sign in at e.g. `http://localhost:3000/en/admin`. Admin sessions use a
  separate token type from miner sessions, so a miner's token cannot reach
  any admin route.
- **KYC**: built as **in-house manual review** — miners upload documents at
  `/<locale>/kyc` and an operator approves or rejects them from the admin
  panel's KYC tab. No third-party provider is wired up, because the client
  hasn't chosen one (SPEC §9b.4). Document images are stored base64 in
  Postgres; that is fine for manual review at this scale, but move them to
  object storage before serious volume.
- **Withdrawal payouts** still settle through the swappable `WalletService`,
  which stays in `offchain` mode until the client supplies the token's
  contract address, ABI and decimals.

---

## Public deploy (shareable URL)

For a real link you can open on a phone, without running anything
locally. Free tiers are enough for testing.

### Backend + database — [Render](https://render.com)

Migrations and catalogue seeding run from `npm run start:prod`, so they happen
on every deploy no matter how the dashboard is configured. Nothing needs to be
run by hand, and nothing breaks if a start command is later edited.

1. Sign in to Render with GitHub, and give it access to this repo.
2. **New → PostgreSQL** — free tier is fine. Copy the **Internal Database URL**.
3. **New → Web Service** → pick this repo.
   - **Root directory**: `backend`
   - **Build command**: `npm install && npx prisma generate && npm run build`
   - **Start command**: `npm run start:prod`
   - **Health check path**: `/api/health`
   - **Environment variables**: copy every key from `backend/.env.example`, with:
     - `DATABASE_URL` → the Postgres URL from step 2
     - `JWT_SECRET` → any long random string (`openssl rand -hex 32`)
     - `WALLET_MODE` → leave as `offchain` for testing — no real chain calls, no private key needed

   **Signup does not work without SMTP.** Registration requires a 6-digit
   emailed code, so until these are set every `send-otp` answers `502` and
   nobody can create an account — while `/api/health` still reports `ok`,
   so the deploy looks fine. `render.yaml` declares them as prompted
   secrets; the boot log says `SIGNUP IS DISABLED` when they are missing:
     - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

   `backend/.env.example` still ships `SMTP_PASS="your-spacemail-password"`,
   a placeholder — a real mailbox password has to go in, or point the five
   variables at whatever provider you actually use (Resend, SES, Postmark
   and Mailgun all expose plain SMTP).

   To reach the admin panel, also set:
     - `ADMIN_EMAIL` → the login you want, e.g. `ops@yourdomain.com`
     - `ADMIN_PASSWORD` → at least 12 characters

   The account is created on boot. There is no admin self-signup, and the
   free tier has no shell to run `npm run admin:create` from, so without
   these two variables a fresh deployment cannot get into its own admin
   panel. `ADMIN_PASSWORD` is the source of truth — to rotate or recover a
   forgotten password, change it and redeploy. Sign in at
   `https://your-frontend/en/admin`.

   Redis is optional but no longer unused: pending verification codes live in
   it when `REDIS_URL` is set, and in the API process when it is not. Provision
   one or leave the variable unset — do not point it at a Redis that isn't
   there (see [Verification codes](#verification-codes-are-in-memory-unless-redis-is-configured)).

4. Deploy. Render gives you a URL like `https://voltara-api.onrender.com`.
   Check it came up, and that the database is reachable from it:
   ```bash
   curl https://voltara-api.onrender.com/api/health
   # {"status":"ok","database":"ok"}   — 503 means it cannot reach Postgres
   ```

Alternatively, **New → Blueprint** and point Render at `render.yaml` in the
repo root, which carries all of the above. An existing service keeps its own
dashboard settings when you adopt a blueprint, so compare the two afterwards.

#### If a new feature 500s after a deploy

Almost always an unapplied migration. Setting environment variables does not
run migrations — Prisma never migrates on its own, something has to call
`prisma migrate deploy`. That call now lives inside `start:prod`, so:

- Confirm the start command is `npm run start:prod` and not `node dist/main`
  or `nest start`, both of which skip migrations entirely.
- Check the deploy log for `migrations have been applied` or `No pending
  migrations`. If neither line appears, the migrate step never ran.
- A failed migration stops the service from starting, so a running service
  with a missing table means the step was skipped rather than that it failed.

### Frontend — [Vercel](https://vercel.com)

1. Sign in with GitHub, **Add New → Project**, pick this repo.
2. **Root directory**: `frontend`
3. **Environment variable**: `NEXT_PUBLIC_API_URL` = `https://voltara-api.onrender.com/api` (your Render URL + `/api`)
4. Deploy. Vercel gives you `https://<something>.vercel.app` — that's the link to open and test, on desktop or phone.

### Notes

- CORS is an **allowlist**, not wide open. Set `CORS_ORIGINS` to a
  comma-separated list of the front-end origins (e.g.
  `https://voltaragrid.com,https://www.voltaragrid.com`). With it unset
  the defaults in `src/common/cors-origins.ts` apply, which do not include
  a `*.vercel.app` preview URL — add it there or the preview's API calls
  will be blocked by the browser.
- Render's free web service and Postgres both spin down on inactivity —
  the first request after a while will be slow (cold start), not broken.
- Don't put a real `HOT_WALLET_PRIVATE_KEY` or mainnet contract address
  into a free-tier test deploy's environment variables.

## Breaking changes to carry into an existing deployment

### Rebrand to VOLTARA + the rig mechanic

Everything below is what changes for a deployment that was running the
previous brand. Nothing here is optional if that deployment has real users.

- **New migration: `20260911120000_voltara_rig`.** Adds the part columns, the
  `RigSlot` table and the three chassis columns on `User`, then backfills:
  every unexpired part a miner owns is installed into a slot, oldest first,
  and their chassis is widened to cover exactly what those parts cost to run.
  A booster bought under the old rules — when parts were free to run — keeps
  the rate it was sold at; only the *next* purchase has to be cooled and fed.
  `start:prod` applies it automatically.

  The GitHub workflow deploys with `prisma db push`, which does **not** run
  migrations, so `prisma/seed.js` performs the same backfill itself. Either
  path lands in the same state, and both are safe to re-run.

- **The seed now owns the part catalogue.** It matches on the new `code`
  column (`VC1`, `CX2`, …) rather than on price, so repricing a part in the
  admin panel survives the next deploy instead of being duplicated. The four
  plans that already existed are adopted by code, not replaced — existing
  purchase rows keep pointing at them.

- **Token env vars were renamed, with fallbacks.** `VLTR_CONTRACT_ADDRESS` and
  `VLTR_DECIMALS` are the current names. `VOLTARA_*`, `BONDKOIN_*` and
  `MATSUMOTO_*` are still read, in that order, so an existing dashboard keeps
  working — but rename them at your next window, since the fallbacks are
  there for the migration, not forever.

- **Withdrawals ship closed.** `PAYOUTS_OPEN` defaults to `false`, and the API
  refuses payout requests until it is `true` (or `PAYOUTS_OPEN_AT` has passed).
  This is deliberate: accepting a request debits the miner's balance into
  escrow, and before $VLTR exists on-chain nothing can release it — a queued
  request would be balance held hostage by a date. The withdraw screen on web
  and mobile reads `GET /api/withdrawals/window` and shows the closed state
  instead of a form. **On launch day** set `PAYOUTS_OPEN="true"` and restart;
  no redeploy of code is needed, the value is read per request. An explicit
  `PAYOUTS_OPEN="false"` overrides the date and is the kill switch if a launch
  has to be rolled back. Admin approve/reject stay open throughout.

- **Domain and app identity changed.** `CORS_ORIGINS`, the frontend's
  `NEXT_PUBLIC_SITE_URL`, the nginx server block (`backend/nginx/voltara.conf`)
  and the Expo deep links all point at `voltaragrid.com`. Set them to whatever
  domain you actually own before going live — the name appears in
  `backend/src/common/cors-origins.ts`, `mobile/app.json` and `render.yaml`.

- **The Android package changed** (`com.bondkoinlabs.app` →
  `com.voltaragrid.app`), which Google Play treats as a *new app*: a new
  listing, and existing installs will not update to it. That is the intended
  consequence of launching a different product, but it is a one-way door —
  decide before the first upload. The upload key is unchanged
  (`mobile/voltara-release.jks`, alias still `bondkoin`, which lives inside
  the keystore and cannot be renamed); the EAS `projectId` in `app.json` still
  points at the old Expo project and needs replacing for a clean slate.

- **Brand assets are generated, not hand-drawn.** `node tools/brand/generate-assets.js`
  writes every favicon, PWA icon, Expo icon, splash and the OG card from one
  source. Re-run it after touching the mark; do not edit the PNGs.


- **`JWT_SECRET` is now required.** There is no fallback any more: the API
  refuses to boot without one, and rejects the two example values that used
  to ship in the repo. If the running deployment relied on the fallback,
  setting a real secret invalidates every existing session — miners and
  admins both sign in again once. Generate with `openssl rand -hex 32`.

  A secret shorter than 32 characters boots, but logs an error on every
  start. That is not a passing grade: the same key signs admin sessions, and
  the deploy pipeline replaces the process before the new one is known to be
  healthy, so a key worth fixing is worth fixing before the next deploy.
- **Run the new migration.** `20260904140000_task_config_columns` moves the
  admin-editable quiz questions, wheel segments and bounty URLs onto the
  `Task` row. They previously lived in memory, so whatever is configured in
  the running instance is not in the database and has to be re-entered once
  after deploying. `start:prod` applies migrations automatically.
- **`NEXT_PUBLIC_API_URL` must be set at frontend build time.** It was
  already inlined into the bundle; it now also feeds the `connect-src`
  directive of the Content-Security-Policy in `next.config.js`. Building
  without it produces a policy that blocks the app's own API calls, and the
  only symptom is a console error in the browser.
- **Deploy the new nginx config** — see "CORS" below.

## Production hardening still owed on the server

These are host-side, not code: the app cannot fix them from inside.

### CORS: deploy the current nginx config

`backend/nginx/voltara.conf` no longer touches CORS — the `add_header
Access-Control-*` lines and the `if ($request_method = 'OPTIONS')` block are
gone, so the app's allowlist in `src/common/cors-origins.ts` is the single
source of truth. **The running server keeps whatever config was installed
there**, so copy the current file over and reload:

```
sudo cp backend/nginx/voltara.conf /etc/nginx/sites-available/voltara
sudo nginx -t && sudo systemctl reload nginx
```

Then verify an unlisted origin is refused — this must come back with **no**
`Access-Control-Allow-Origin` header at all:

```
curl -sS -X OPTIONS -D - -o /dev/null \
  -H 'Origin: https://evil.example.com' \
  -H 'Access-Control-Request-Method: POST' \
  https://api.voltaragrid.com/api/auth/login
```

If it still echoes `Access-Control-Allow-Origin: https://evil.example.com`,
the old config is still installed: nginx is reflecting whatever origin asks,
which makes every endpoint callable from any page on the internet.

### The API is HTTP/1.1 with no TLS-level caching

The front end is served over HTTP/2 from a CDN; the API is plain HTTP/1.1.
Enabling `listen 443 ssl http2;` on the API vhost removes a round trip per
connection. Responses are gzipped by the app itself now (`compression`
middleware in `main.ts`), so nginx does not need `gzip on` for proxied JSON.

### Apex redirects to www on every request

`https://voltaragrid.com/en` answers `308` to `https://www.voltaragrid.com/en`,
so every cold navigation pays an extra round trip. Pick one canonical host in
the DNS/CDN config and point the other at it at the edge, or serve the apex
directly.

### Verification codes are in memory unless Redis is configured

`REDIS_URL` unset means pending OTPs live in the API process and are lost on
every restart or deploy — a user mid-signup has to request a new code. Set
`REDIS_URL` and they survive restarts and a second instance.

A `REDIS_URL` that points at nothing is worse than none at all if you leave
it in `.env` and never provision the server: the API logs
`OTP store … failed` and quietly serves codes from memory. Either run a
Redis at that address or take the line out — copying `.env.example` verbatim
sets `redis://localhost:6379`, which is a real Redis on nobody's box.

## Turning on booster payments

Boosters are paid by direct transfer — the miner sends USDT from their own
wallet to a receiving address, then submits the transaction hash, which the
server verifies on-chain. There is no deposit step and the platform never
custodies user funds.

Until the receiving address and token contract are set, `GET /api/boosters`
reports `payment.enabled: false` and the boosters page shows a "not
configured" banner instead of letting anyone pay.

Set these on the backend:

```
BOOSTER_PAY_TO_ADDRESS=      # wallet that receives booster payments
BOOSTER_PAY_TOKEN_ADDRESS=   # USDT BEP-20 contract on the target network
```

The rest already default correctly for BSC and only need changing to
override: `BOOSTER_PAY_TOKEN=USDT`, `BOOSTER_PAY_TOKEN_DECIMALS=18` (BSC
USDT uses 18 decimals, unlike the 6 used on Ethereum),
`BOOSTER_MIN_CONFIRMATIONS=6`, and `BOOSTER_RPC_URL`, which falls back to
`BSC_RPC_URL`.

**Verify the token contract address on BscScan before setting it.** A wrong
contract means payments in a worthless token are accepted as real ones.

Test on BSC testnet first: point `BSC_RPC_URL` at the testnet RPC and
`BOOSTER_PAY_TOKEN_ADDRESS` at a testnet BEP-20, then run one real purchase
end to end. `payment.rules.ts` rejects a wrong token, wrong recipient, wrong
sender, underpayment, too few confirmations, a reverted transaction, and a
stale one — each with its own reason, so a failed attempt tells you which.
