# Fee & Surcharge App — Project Status

_Last updated 2026-10-28. App "ez Surchange fee", org EZ COD Forms, dev store `ez-cod-forms-dev.myshopify.com`._

Legend: **Verified** = seen working in the dev store · **Built** = code complete, automated checks pass, not yet exercised in the store · **Partial** · **Not started**.

---

## 1. Architecture (as built)

| Piece | What it is | Where |
|---|---|---|
| Admin app | React Router 7 + Polaris web components, embedded in Shopify admin, Prisma/SQLite | `app/` |
| Fee engine | Shopify Function, **Cart Transform API** (`lineExpand`): expands a product line into `[product, fee variant]` | `extensions/fee-engine/` |
| Fee guard | Shopify Function, **Cart & Checkout Validation API**: blocks checkout until required fees are accepted | `extensions/fee-guard/` |
| Checkout UI | Checkout UI extension (Preact): Fees block in order summary + required-fee acceptance above Pay | `extensions/fee-summary/` |
| Orders webhook | `orders/create`: usage counting, analytics, order tags, auto-fulfil, integration dispatch | `app/routes/webhooks.orders.create.tsx` |
| Config to checkout | Rules → metafield on the CartTransform; display settings → shop metafield `$app.checkout-settings` | `app/lib/fee-engine.server.ts`, `app/lib/settings.server.ts` |

Each fee rule is backed by a hidden product (tagged `fee-engine`, type "Fee") whose variant is the fee line's merchandise.

Scopes: `write_products, write_cart_transforms, read_publications, write_publications, write_validations, read_orders, write_orders, read_locales, read/write_merchant_managed_fulfillment_orders`. Protected customer data access: **granted for the dev store** (needed for the orders webhook); formal review still required at App Store submission.

---

## 2. Build-order steps (from the original brief)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Scaffold, auth, embedded admin page | **Verified** | React Router template (Remix successor) |
| 2 | Fee rule data model + CRUD admin | **Verified** | Create/edit/toggle/delete, plan gating server-side |
| 3 | Cart Transform, single fixed fee, Online Store | **Verified** | $729.95 → $802.95 with 10% tariff in checkout |
| 4 | Conditions evaluated in the function | **Verified (partly)** | Products, subtotal, country verified in store; collections, quantity, weight, tags, markets, schedule, caps, match modes covered by Wasm tests only |
| 5 | Percentage fees + multiple rules | **Verified** | Two fees stacking → $817.95 |
| 6 | Checkout UI + validation function | **Built** | Fees block never seen rendering yet — must open checkout via the Dev Console **preview link** (dev-mode requirement). Required-fee flow untested |
| 7 | POS support | **Not started** | Function already distinguishes POS carts; `requiresComponents` on variants and POS testing outstanding |
| 8 | Draft order fees via Admin API | **Not started** | |
| 9 | Billing (plans, trial, Free cap) | **Partial** | Plan catalog, usage counter (`FeeOrderUsage`) and Free-cap numbers exist; **no AppSubscription / Billing API yet**. Plan comes from `DEV_PLAN` in `.env` |
| 10 | Plus-tier (payment method, shipping destination, B2B) | **Not started** | Customer-tag rule exists (Plus-gated); payment-method and shipping-destination surcharges need research — Cart Transform cannot see payment method or shipping address |

---

## 3. Feature inventory

### Fee rules (editor)
| Feature | Status |
|---|---|
| Product fee / Order fee; fixed or percentage | Verified |
| Charge frequency (every unit / once per product) | Built (Wasm-tested) |
| Min/max charge caps for percentage fees | Built (Wasm-tested) |
| Charge tax on this fee (variant `taxable`) | Built |
| Optional (buyer can remove) / Required (Pro) | Optional verified; Required built |
| Channels: Online Store / POS (Pro) / Draft orders (Pro) | Online Store verified; POS/Draft stored only |
| Matching rules: All products / Any / All, product & collection pickers | Products verified; collections + modes Wasm-tested |
| Schedule (weekdays, date range, store-local) | Built (Wasm-tested) |
| Cart limits (subtotal min/max, qty, weight) | Subtotal verified; rest Wasm-tested |
| Country visibility: all / only / hidden-in (buyer's Markets country) | Only-mode verified; except-mode Wasm-tested |
| Shopify Markets handles (Pro) | Built (Wasm-tested) |
| Customer tags (Plus) | Built (Wasm-tested) |
| Icon picker (35 Polaris icons) | Built — Polaris glyphs, not illustrated art |
| Shopper note + optional details (shown in checkout) | Built |
| Order tag per fee | Built |
| Fee barcode (synced to variant) | Built |
| Templates / starting points (8 presets, Pro-gated ones locked) | Verified (Import tariff, Customs duty used) |
| Live cart preview, contextual save bar | Built |
| **Line item label prefix** ("Fee for [Product]") | **Not feasible** with Cart Transform (one fee product per rule, not per product) |

### Checkout
| Feature | Status |
|---|---|
| Fee applied as nested line, totals correct | Verified |
| Fees block (name, note, details, amount, Remove / Add back) | Built, unverified |
| Required-fee acceptance checkbox + guard error | Built, unverified (needs `DEV_PLAN=PRO`) |
| Merchant-editable labels + per-language translations | Built, unverified |
| Fee sort order, show/hide blocks | Built, unverified |
| Fee product thumbnail in checkout | Placeholder image — **no fee product images yet** |

### Overview / Analytics
| Feature | Status |
|---|---|
| Overview: getting-started checklist, stats, fee table with icons | Verified (pre-icon version); icon version built |
| Analytics: 7/30/90-day KPIs, revenue-by-day chart, top fees, recent orders, attach rate | Built, unverified — data only from orders placed after the webhook went live |

### Settings
| Tab | Status |
|---|---|
| General: engine status, default order tag, auto-fulfil fee lines, fee sort order | Built, unverified |
| Pricing: plan cards, usage this month, Free-cap meter | Built (no real billing) |
| Integrations: directory with logos (vendor favicons), status, Manage dialogs, enable toggles | Built, unverified |
| Checkout display: show/hide blocks, 7 label strings | Built, unverified |
| Translations: per published language overrides | Built, unverified (needs a second published language) |
| Advanced: guard on/off, block-on-engine-failure (re-creates transform), re-sync, fee product list | Re-sync verified; rest built |

### Integrations
| Integration | Status | Notes |
|---|---|---|
| Outbound webhook (Make / Zapier / n8n) | Built, unverified | Signed `fee_order.created` events, Test sends a ping |
| **Finseed** | Built from official API reference; mocked run correct; **no real API call yet** | Complete/simplified, RE as surcharge, idempotency + `external_id`, EUR only |
| **STEL Order** | Built from the account's Swagger; mocked run correct; **no real API call yet** | Client lookup/create, service-backed lines, RE via `secondary-tax-enabled`. Draft state and `POST /clients` body unconfirmed |
| Wholesale Pricing Discount | Compatible only | No API; catalog prices already respected; discount-applied prices invisible to fees (Shopify ordering) |
| Candy Rack, Pickeasy, Bespoke Shipping, Globo Mega Menu, themes | Works automatically | No switches by design — nothing runs in the theme |
| **Flip POS / surcharge quote API** | Built, unverified | `POST /api/quote` with store-bound `fq_…` credentials (hashed, revocable); quote runs the real engine code server-side |
| Shopify POS | Planned | |
| Credentials | Built | AES-256-GCM, keyed by `INTEGRATIONS_SECRET` (set one in production) |

### Orders webhook
| Feature | Status |
|---|---|
| Fee-order usage row (month, rule ids, revenue breakdown) | Built, unverified |
| Order tag (per-fee or default) | Built, unverified |
| Auto-fulfil fee line items | Built, unverified |
| Dispatch to enabled integrations with per-delivery log | Built, unverified |

---

## 4. Tests

### Automated (all passing as of this update)
| Suite | Count | What it covers |
|---|---|---|
| `extensions/fee-engine` vitest (real Wasm) | 43 | Every condition, frequency, caps, schedule, markets, country modes, stacking, declines, currency conversion, attributes |
| `extensions/fee-guard` vitest (real Wasm) | 10 | Required-fee blocking, acceptance, custom/translated messages, guard disabled |
| `npm run typecheck`, `npm run lint` | — | Clean |
| `extensions/fee-summary` `tsc --noEmit` (checkJs) | — | Clean |
| Ad-hoc scripts (scratch, not in repo) | — | Crypto round-trip/tamper/HMAC; Finseed and STEL invoice builders with mocked HTTP |

### Manual, in dev store — done
- Embedded admin loads; fee CRUD; sync to checkout; engine registration.
- Checkout math: fixed and percentage fees, two fees stacking, product condition, subtotal condition, buyer-country condition — all both directions.
- Resource picker (products/collections) opens and saves.

### Manual, in dev store — NOT done (ordered by value)
1. **Checkout UI**: open checkout via Dev Console → fee-summary **Preview** link; Fees block shows, Remove / Add back works, note + details render.
2. **Required fee** (`DEV_PLAN=PRO`): "Required" saved → Settings shows Guard on → checkbox above Pay → Pay blocked until ticked.
3. **Orders webhook**: place a test order → Analytics shows it; order tagged; fee line auto-fulfilled (General → toggle on).
4. **Settings**: label change reaches checkout; translations with a second language; block-on-failure toggle keeps engine Connected.
5. **Integrations**: Outbound webhook ping to webhook.site; Finseed with an `ev_test_` key; STEL with the trial key (then delete the "Integration docs key"); Flip POS → generate a credential and `curl` the quote endpoint.
6. **New editor fields**: schedule, caps, charge frequency, match modes, country "hidden in", markets — at least one round trip each.
7. Plan states: `DEV_PLAN=FREE` locks the right things; `PLUS` unlocks customer tags.
8. Discard on the save bar resets the form; deleting a fee removes its fee product.

---

## 5. Known limitations / decisions
- Fee is a **component of the product's line** (Cart Transform), so cart pages show a bumped line price; the separate Fees breakdown exists only in checkout.
- **Per-cart fees attach to the lowest-quantity line**; if every line has qty > 1 and the amount doesn't divide, there is a 1-cent rounding effect.
- **Country = buyer's Markets country**, not shipping address (not available at cart stage).
- Discounts run **after** cart transforms: percentage fees see pre-discount prices.
- Fee products are **active and published** to all channels (required for the line to be accepted); they appear in storefront search unless the theme hides tag `fee-engine`.
- Checkout UI extensions in dev only load via the Dev Console preview link until the app is deployed.
- No cart-page checkbox UI (theme app embed) — deliberate; see the Integrations rationale in Settings.

## 6. Not started / roadmap
- Shopify Billing API (plans, 7-day trials, Plus gating by shop plan, Free cap enforcement).
- POS (step 7), Draft orders (step 8), Plus-tier payment-method / shipping surcharges (step 10).
- Fee product images (illustrated icon set) and licensed partner logos.
- Translations UI needs `read_locales` + a published language to be exercised.
- App Store listing prerequisites: protected customer data review, GDPR webhooks (`customers/data_request`, `customers/redact`, `shop/redact`), privacy policy, production DB (SQLite is dev-only), `INTEGRATIONS_SECRET`.
- Git: repo is **not initialised** — no commits exist yet.

## 7. Local workflow
```
npm run dev            # Shopify CLI: tunnel, functions, extensions, app
npm run typecheck && npm run lint
cd extensions/fee-engine && npx vitest run
cd extensions/fee-guard && npx vitest run
```
Restart `npm run dev` after any change to scopes, extensions, or Prisma schema. `.env` holds `DEV_PLAN` (FREE|PRO|PLUS) and, for production, `INTEGRATIONS_SECRET`.
Prisma migrations: `migrate dev` silently no-ops while the dev server runs — use `prisma migrate diff … --script > prisma/migrations/<ts>_<name>/migration.sql` then `prisma migrate deploy`.
