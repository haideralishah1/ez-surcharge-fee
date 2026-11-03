# Deploying to Railway

This app ("ez Surcharge fee") is embedded, uses SQLite via Prisma, and ships
as a Docker image. This doc is the exact click-path (and CLI equivalent) to
get it running on Railway, **before** touching Shopify.

Do **not** run `shopify app deploy` until the final step of "Post-deploy on
Railway" below — doing it earlier pushes `application_url = "https://example.com"`
live and breaks the currently-released version for anyone using it, and
redirects webhooks nowhere.

---

## 1. Create the Railway project and connect the repo

**You, in the Railway dashboard:**

1. Go to [railway.com/new](https://railway.com/new) → **Deploy from GitHub repo**.
2. Pick your private repo (`ez-surcharge-fee`). Authorize Railway's GitHub
   App for that repo if prompted.
3. Railway will detect the `Dockerfile` automatically. On the service's
   **Settings → Build** tab, confirm **Builder** is set to **Dockerfile**
   (not Nixpacks) and the Dockerfile path is the repo root `Dockerfile`.

**CLI equivalent, you in a terminal:**

```bash
npm install -g @railway/cli   # if you don't have it
railway login
railway init                  # creates a new Railway project, run from the repo root
railway up                    # builds from the Dockerfile and deploys
```

(`railway up` triggers a build from your local working directory; for
ongoing deploys you'll still want GitHub-connected auto-deploys set up in
the dashboard, since the CLI push is a one-off.)

---

## 2. Add a persistent volume for SQLite

**You, in the Railway dashboard:**

1. Open the service → **Settings → Volumes** → **New Volume**.
2. Mount path: `/data`
3. Attach it to this service and redeploy once (volumes only take effect on
   the next deploy).

**CLI equivalent:**

```bash
railway volume add --mount-path /data
```

Without this, every deploy wipes the SQLite database — the volume is what
makes `/data` survive redeploys and restarts. Note: don't add a `VOLUME`
instruction to the Dockerfile for this — Railway's build rejects it
outright ("docker VOLUME ... is not supported, use Railway Volumes"); the
dashboard/CLI volume above is the only thing that actually persists `/data`.

---

## 3. Set environment variables

**You, in the Railway dashboard:** Service → **Variables** → add each of
these (or **Raw Editor** to paste them all at once):

| Variable | Value | Notes |
|---|---|---|
| `SHOPIFY_API_KEY` | from Partner Dashboard → App setup | Client ID shown in `shopify.app.toml` (`client_id`). |
| `SHOPIFY_API_SECRET` | from Partner Dashboard → App setup | Keep this secret; don't commit it. |
| `INTEGRATIONS_SECRET` | output of `openssl rand -base64 32` | See the exact command below. Used to derive the AES-256-GCM key that encrypts stored integration credentials. No real keys are stored yet, so there's nothing to migrate — generate fresh. |
| `DATABASE_URL` | `file:/data/prod.db` | Points Prisma at the SQLite file **inside the mounted volume**, so it survives redeploys. |
| `SCOPES` | `write_products,write_cart_transforms,read_publications,write_publications,write_validations,read_orders,write_orders,read_locales,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders` | Copied verbatim from `shopify.app.toml`'s `[access_scopes]`. Keep both in sync if you ever change scopes. |
| `SHOPIFY_APP_URL` | *(leave blank for now)* | Railway doesn't have a URL yet. Deploy once first, then come back and set this to the Railway-assigned URL (see step 5), then redeploy. |
| `NODE_ENV` | `production` | Already set inside the Dockerfile too, but Railway convention is to also set it as a service variable. |

**CLI equivalent:**

```bash
railway variables --set "SHOPIFY_API_KEY=xxxxx"
railway variables --set "SHOPIFY_API_SECRET=xxxxx"
railway variables --set "INTEGRATIONS_SECRET=$(openssl rand -base64 32)"
railway variables --set "DATABASE_URL=file:/data/prod.db"
railway variables --set "SCOPES=write_products,write_cart_transforms,read_publications,write_publications,write_validations,read_orders,write_orders,read_locales,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders"
railway variables --set "NODE_ENV=production"
# SHOPIFY_APP_URL comes after the first deploy, see step 5.
```

### Generating `INTEGRATIONS_SECRET`

```bash
openssl rand -base64 32
```

This produces 32 random bytes, base64-encoded. Note on the byte count: the
app doesn't actually require exactly 32 bytes — `app/lib/crypto.server.ts`
runs whatever string you give it through SHA-256 (`createHash("sha256")`)
to derive the AES-256 key, so any length input works and always yields a
32-byte key. `-base64 32` is simply a strong, conventional amount of
entropy for a secret — there's no hard byte-count requirement to match.

---

## 4. Deploy

If you connected GitHub in step 1, pushing to your default branch triggers
a deploy automatically. Watch it under the service's **Deployments** tab.
With the CLI, `railway up` (from step 1) already triggered one.

At this point the app will build and the container will boot, run
`prisma migrate deploy` against the fresh volume, and start listening —
but Shopify auth won't work yet because `SHOPIFY_APP_URL` isn't set and
`shopify.app.toml` still points at `example.com`. That's expected; fix it
in the next section.

---

## Post-deploy on Railway

### A. Find your Railway-assigned URL

**You, in the Railway dashboard:** open the service → **Settings →
Networking** → **Generate Domain** (if you haven't already). Railway gives
you a URL like `https://ez-surcharge-fee-production.up.railway.app`.

**CLI equivalent:** `railway domain` (shows the current domain, or
generates one if none exists yet).

### B. Set `SHOPIFY_APP_URL`

**You, in the Railway dashboard:** Variables → set `SHOPIFY_APP_URL` to
that URL (no trailing slash), then let it redeploy (Railway redeploys
automatically when you change a variable — or trigger it manually under
Deployments).

**CLI:** `railway variables --set "SHOPIFY_APP_URL=https://your-app.up.railway.app"`

### C. Update `shopify.app.toml` (you, in your editor — this is local, not Railway)

Change these two lines:

```diff
- application_url = "https://example.com"
+ application_url = "https://your-app.up.railway.app"
```

```diff
[auth]
- redirect_urls = [ "https://example.com/api/auth" ]
+ redirect_urls = [ "https://your-app.up.railway.app/api/auth" ]
```

Keep the `/api/auth` path as-is for this step — see the "Known issue to
check before `shopify app deploy`" note at the bottom of this doc, it's a
separate thing from the domain swap.

### D. Push the toml change (you, in a terminal) — automatic from there

```bash
git add shopify.app.toml
git commit -m "Point application_url/redirect_urls at Railway"
git push
```

Railway redeploys automatically on push (if GitHub-connected) — nothing
else to do here.

### E. Push the config to Shopify (you, in a terminal — do this last)

Only after the Railway URL is live and `shopify.app.toml` has been pushed:

```bash
shopify app deploy
```

This is the step the original audit told this session not to run — it's
on you, once Railway's URL is correct in the toml. It pushes the extension
builds (Cart Transform, Validation, Checkout UI) and the app config
(`include_config_on_deploy = true` means `application_url`/`redirect_urls`
go out with it) to the versions Shopify serves.

---

## Summary: who does what

| Step | Where |
|---|---|
| Create project, connect repo, select Dockerfile builder | Railway dashboard (or CLI) |
| Add volume at `/data` | Railway dashboard (or CLI) |
| Set env vars | Railway dashboard (or CLI) |
| First deploy | Automatic (GitHub push) or `railway up` |
| Generate/find Railway domain | Railway dashboard (or CLI) |
| Set `SHOPIFY_APP_URL` | Railway dashboard (or CLI) |
| Edit `application_url` / `redirect_urls` in `shopify.app.toml` | You, locally, in your editor |
| Commit + push the toml change | You, in a terminal |
| Redeploy after that push | Automatic |
| `shopify app deploy` | You, in a terminal, last |

---

## Known issue to check before `shopify app deploy` (not fixed here)

`shopify.app.toml`'s `redirect_urls` currently lists `.../api/auth`, but
the only OAuth route implemented in the app is the catch-all at
`app/routes/auth.$.tsx` (i.e. `/auth/*`, matching `authPathPrefix: "/auth"`
in `app/shopify.server.ts`) — there's no `/api/auth` route in this repo.
This was already the case before any of today's changes (it's not
something introduced by the Railway work), and this session deliberately
left it alone since fixing Shopify auth routing wasn't part of what was
asked and touching it without testing against a real OAuth flow would be
guessing. Worth confirming — possibly by testing install against the dev
store — before relying on it in production.
