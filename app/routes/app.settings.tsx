import { useState, type JSX } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { listRules } from "../lib/fee-rules.server";
import {
  setEngineBlockOnFailure,
  syncRules,
} from "../lib/fee-engine.server";
import {
  getShopConfig,
  listLocales,
  pushCheckoutSettings,
  saveShopConfig,
} from "../lib/settings.server";
import {
  CHECKOUT_TEXT_KEYS,
  DEFAULT_TEXT,
  SORT_ORDERS,
  TEXT_LABELS,
  type CheckoutText,
  type SortOrder,
} from "../lib/settings";
import { FREE_MONTHLY_FEE_ORDERS, PLAN_CATALOG } from "../lib/plan-catalog";
import { PLAN_LABELS, planAtLeast } from "../lib/plans";
import {
  INTEGRATION_GROUPS,
  STATUS_LABEL,
  appStoreSearch,
  faviconUrl,
  type Integration,
} from "../lib/integrations";
import { createCredential, listCredentials, revokeCredential } from "../lib/quote.server";
import {
  CONNECTORS,
  listConnections,
  loadOptions,
  recentDeliveries,
  saveConnection,
  setConnectionEnabled,
  testConnection,
  type ConnectionView,
  type FieldDef,
} from "../lib/connectors.server";
import type { AppShellData } from "./app";

const TABS = [
  { id: "general", label: "General", icon: "settings" },
  { id: "pricing", label: "Pricing", icon: "plan" },
  { id: "integrations", label: "Integrations", icon: "connect" },
  { id: "storefront", label: "Checkout display", icon: "cart" },
  { id: "translations", label: "Translations", icon: "language" },
  { id: "advanced", label: "Advanced", icon: "wrench" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const tab = (TABS.some((t) => t.id === url.searchParams.get("tab"))
    ? url.searchParams.get("tab")
    : "general") as TabId;

  const [config, rules, locales] = await Promise.all([
    getShopConfig(session.shop),
    listRules(session.shop),
    tab === "translations" ? listLocales(admin) : Promise.resolve([]),
  ]);
  const month = new Date().toISOString().slice(0, 7);
  const usage = await prisma.feeOrderUsage.count({ where: { shop: session.shop, month } });
  const connections = tab === "integrations" ? await listConnections(session.shop) : {};
  const deliveries = tab === "integrations" ? await recentDeliveries(session.shop) : {};
  const credentials = tab === "integrations" ? await listCredentials(session.shop) : [];
  const appUrl = process.env.SHOPIFY_APP_URL || "";
  const activeRules = rules.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));
  const connectors = Object.fromEntries(
    Object.entries(CONNECTORS).map(([k, c]) => [
      k,
      { fields: c.fields, unavailable: c.unavailable ?? null, canTest: Boolean(c.test), mode: c.mode ?? "fields", intro: c.intro ?? null },
    ]),
  );

  const localeParam = url.searchParams.get("locale");
  const editable = locales.filter((l) => !l.primary && l.published);
  const locale = editable.some((l) => l.locale === localeParam)
    ? localeParam!
    : editable[0]?.locale ?? null;

  return {
    tab,
    config,
    usage,
    month,
    connections,
    connectors,
    deliveries,
    activeRules,
    credentials,
    appUrl,
    shopDomain: session.shop,
    locales: editable,
    locale,
    feeProducts: rules
      .filter((r) => r.productId)
      .map((r) => ({ id: r.id, name: r.name, productId: r.productId!, active: r.active })),
    requiredActive: rules.some((r) => r.active && r.requirement === "REQUIRED"),
  };
};

const bool = (f: FormData, k: string) => f.get(k) === "true";
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const shop = session.shop;

  try {
    switch (intent) {
      case "general": {
        await saveShopConfig(shop, {
          defaultOrderTag: str(form, "defaultOrderTag", 40),
          autoFulfillFees: bool(form, "autoFulfillFees"),
          sortOrder: (SORT_ORDERS as readonly string[]).includes(String(form.get("sortOrder")))
            ? (String(form.get("sortOrder")) as SortOrder)
            : "CART",
        });
        await pushCheckoutSettings(admin, shop);
        return redirect("/app/settings?tab=general&saved=1");
      }
      case "storefront": {
        const text = { ...DEFAULT_TEXT };
        for (const k of CHECKOUT_TEXT_KEYS) {
          const v = str(form, `text.${k}`, 240);
          if (v) text[k] = v;
        }
        await saveShopConfig(shop, {
          showFeesBlock: bool(form, "showFeesBlock"),
          showAcceptance: bool(form, "showAcceptance"),
          text,
        });
        await pushCheckoutSettings(admin, shop);
        return redirect("/app/settings?tab=storefront&saved=1");
      }
      case "translations": {
        const locale = str(form, "locale", 16);
        if (!locale) return { error: "Choose a language first." };
        const config = await getShopConfig(shop);
        const entry: Partial<CheckoutText> = {};
        for (const k of CHECKOUT_TEXT_KEYS) {
          const v = str(form, `t.${k}`, 240);
          if (v) entry[k] = v;
        }
        const translations = { ...config.translations, [locale]: entry };
        if (Object.keys(entry).length === 0) delete translations[locale];
        await saveShopConfig(shop, { translations });
        await pushCheckoutSettings(admin, shop);
        return redirect(`/app/settings?tab=translations&locale=${encodeURIComponent(locale)}&saved=1`);
      }
      case "advanced": {
        const before = await getShopConfig(shop);
        const guardEnabled = bool(form, "guardEnabled");
        const blockOnFailure = bool(form, "blockOnFailure");
        await saveShopConfig(shop, { guardEnabled, blockOnFailure });
        await pushCheckoutSettings(admin, shop);
        if (blockOnFailure !== before.blockOnFailure) {
          await setEngineBlockOnFailure(admin, shop, blockOnFailure);
        }
        await syncRules(admin, shop);
        return redirect("/app/settings?tab=advanced&saved=1");
      }
      case "integration.save": {
        const key = str(form, "key", 32);
        await saveConnection(shop, key, form);
        return { ok: true as const, message: "Connection saved." };
      }
      case "credential.create": {
        const { token } = await createCredential(shop, str(form, "name", 60));
        return { ok: true as const, message: "Credential generated. Copy it now — it won't be shown again.", token };
      }
      case "credential.revoke": {
        await revokeCredential(shop, str(form, "id", 64));
        return { ok: true as const, message: "Credential revoked." };
      }
      case "integration.options": {
        const key = str(form, "key", 32);
        const options = await loadOptions(shop, key);
        return { ok: true as const, message: "Choices loaded from your account.", options };
      }
      case "integration.test": {
        const key = str(form, "key", 32);
        const r = await testConnection(shop, key);
        return r.ok ? { ok: true as const, message: r.message } : { error: r.message };
      }
      case "integration.toggle": {
        const key = str(form, "key", 32);
        await setConnectionEnabled(shop, key, bool(form, "enabled"));
        return { ok: true as const, message: bool(form, "enabled") ? "Integration enabled." : "Integration disabled." };
      }
      case "resync": {
        const count = await syncRules(admin, shop);
        await pushCheckoutSettings(admin, shop);
        return { ok: true as const, count };
      }
      default:
        return { error: "Unknown action." };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
};

const numericId = (gid: string) => gid.split("/").pop();

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const shell = useRouteLoaderData("routes/app") as AppShellData;
  const actionData = useActionData<typeof action>();
  const saved = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("saved");

  return (
    <s-page heading="Settings" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">Fees</s-link>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-200">
          {TABS.map((t) => (
            <s-button
              key={t.id}
              href={`/app/settings?tab=${t.id}`}
              variant={t.id === data.tab ? "secondary" : "tertiary"}
              icon={t.icon}
            >
              {t.label}
            </s-button>
          ))}
        </s-stack>

        {actionData && "error" in actionData && actionData.error && (
          <s-banner tone="critical" heading="Couldn&apos;t save">
            <s-paragraph>{actionData.error}</s-paragraph>
          </s-banner>
        )}
        {saved && <s-banner tone="success" heading="Settings saved and pushed to checkout" />}

        {data.tab === "general" && <GeneralTab data={data} />}
        {data.tab === "pricing" && <PricingTab data={data} shell={shell} />}
        {data.tab === "integrations" && <IntegrationsTab data={data} />}
        {data.tab === "storefront" && <StorefrontTab data={data} />}
        {data.tab === "translations" && <TranslationsTab data={data} />}
        {data.tab === "advanced" && <AdvancedTab data={data} />}
      </s-stack>
    </s-page>
  );
}

type Data = ReturnType<typeof useLoaderData<typeof loader>>;

function EngineStatus({ data }: { data: Data }) {
  const { cartTransformId, validationId } = data.config;
  return (
    <s-section heading="Checkout engine">
      <s-stack direction="block" gap="small">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {cartTransformId ? (
            <s-badge tone="success" icon="check-circle">Connected</s-badge>
          ) : (
            <s-badge tone="warning" icon="alert-circle">Not connected</s-badge>
          )}
          <s-text color="subdued">
            {cartTransformId
              ? `Cart transform ${numericId(cartTransformId)} applies fees in cart and checkout.`
              : "Registers automatically when the fee-engine function is deployed to this store."}
          </s-text>
        </s-stack>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {validationId ? (
            <s-badge tone={data.requiredActive && data.config.guardEnabled ? "success" : "neutral"} icon="shield-check-mark">
              {data.requiredActive && data.config.guardEnabled ? "Guard on" : "Guard idle"}
            </s-badge>
          ) : (
            <s-badge tone="neutral" icon="shield-none">Guard not registered</s-badge>
          )}
          <s-text color="subdued">
            {validationId
              ? data.requiredActive && data.config.guardEnabled
                ? "Checkout is blocked until buyers accept every required fee."
                : "Turns on automatically when a required fee is active."
              : "Registered on the next sync."}
          </s-text>
        </s-stack>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone="success" icon="check-circle">Checkout placement automatic</s-badge>
          <s-text color="subdued">No theme or app-embed setup. Works with any theme, cart drawer and express checkout.</s-text>
        </s-stack>
      </s-stack>
    </s-section>
  );
}

function GeneralTab({ data }: { data: Data }) {
  const c = data.config;
  return (
    <s-stack direction="block" gap="base">
      <EngineStatus data={data} />
      <Form method="post" data-save-bar>
        <input type="hidden" name="intent" value="general" />
        <s-stack direction="block" gap="base">
          <s-section heading="Order handling">
            <s-stack direction="block" gap="base">
              <s-text-field
                label="Applied-fee order tag"
                name="defaultOrderTag"
                defaultValue={c.defaultOrderTag}
                placeholder="e.g. Fees applied"
                details="Added to every order that contains a fee, unless the fee sets its own tag."
                maxLength={40}
              />
              <s-checkbox
                label="Auto-fulfil fee lines"
                name="autoFulfillFees"
                value="true"
                defaultChecked={c.autoFulfillFees}
                details="Fee lines don't ship. When on, they're marked fulfilled as soon as the order is created so they never show as unfulfilled."
              />
            </s-stack>
          </s-section>
          <s-section heading="Fee display">
            <s-select
              label="Fee order in checkout"
              name="sortOrder"
              value={c.sortOrder}
              details="How the Fees block lists multiple fees."
            >
              <s-option value="CART">As applied</s-option>
              <s-option value="NAME">Alphabetical</s-option>
              <s-option value="AMOUNT">Largest first</s-option>
            </s-select>
          </s-section>
          <s-button type="submit" variant="primary">Save</s-button>
        </s-stack>
      </Form>
    </s-stack>
  );
}

function PricingTab({ data, shell }: { data: Data; shell: AppShellData }) {
  const included = shell.plan === "FREE" ? FREE_MONTHLY_FEE_ORDERS : null;
  const pct = included ? Math.min(100, Math.round((data.usage / included) * 100)) : 0;
  return (
    <s-stack direction="block" gap="base">
      <s-banner tone="info" heading="Billing isn&apos;t connected in this build yet">
        <s-paragraph>
          Plans show what each tier unlocks. Checkout-based upgrades arrive in a later step; until
          then the plan is set by <code>DEV_PLAN</code>.
        </s-paragraph>
      </s-banner>
      <s-grid gridTemplateColumns="@container (inline-size > 760px) 1fr 1fr 1fr, 1fr" gap="base">
        {PLAN_CATALOG.map((p) => {
          const current = p.id === shell.plan;
          const included = planAtLeast(shell.plan, p.id);
          return (
            <s-box key={p.id} border={current ? "base strong" : "base"} borderRadius="base" padding="base" background="base">
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-heading>{PLAN_LABELS[p.id]}</s-heading>
                  {current ? <s-badge tone="success">Current</s-badge> : p.id !== "FREE" && <s-badge tone="info">7-day trial</s-badge>}
                </s-stack>
                <s-stack direction="inline" gap="small-300" alignItems="baseline">
                  <s-heading>{p.price}</s-heading>
                  <s-text color="subdued">/ month</s-text>
                </s-stack>
                <s-text color="subdued">{p.tagline}</s-text>
                <s-divider />
                {p.features.map((f) => (
                  <s-stack key={f} direction="inline" gap="small-200" alignItems="center">
                    <s-icon type="check" tone={included ? "success" : "neutral"} />
                    <s-text>{f}</s-text>
                  </s-stack>
                ))}
                {p.plusOnly && !shell.shop.isPlus && <s-text color="subdued">Requires a Shopify Plus store.</s-text>}
              </s-stack>
            </s-box>
          );
        })}
      </s-grid>
      <s-section heading="Usage this month">
        <s-stack direction="block" gap="base">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap="base">
            <Metric label="Orders with fees" value={String(data.usage)} />
            <Metric label="Included" value={included ? String(included) : "Unlimited"} />
            <Metric label="Remaining" value={included ? String(Math.max(0, included - data.usage)) : "—"} />
          </s-grid>
          {included && (
            <s-box background="subdued" borderRadius="large" blockSize="6px">
              <s-box background={pct >= 100 ? "strong" : "strong"} borderRadius="large" blockSize="6px" inlineSize={`${pct}%`} />
            </s-box>
          )}
          <s-text color="subdued">
            An order counts once when it contains at least one fee line. Counting started when the orders webhook
            was enabled; the month resets on the 1st ({data.month}).
          </s-text>
        </s-stack>
      </s-section>
    </s-stack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <s-stack direction="block" gap="small-500">
      <s-text color="subdued">{label}</s-text>
      <s-heading>{value}</s-heading>
    </s-stack>
  );
}

type IconName = NonNullable<JSX.IntrinsicElements["s-icon"]["type"]>;

/** Vendor logo (licensed file, else public favicon), falling back to the category icon. */
function IntegrationLogo({ it }: { it: Integration }) {
  const src = it.logo ?? (it.domain ? faviconUrl(it.domain) : null);
  const [failed, setFailed] = useState(false);
  return (
    <s-box background="subdued" border="base" borderRadius="base" padding="small-200" inlineSize="40px" blockSize="40px">
      <s-stack alignItems="center" justifyContent="center" blockSize="100%">
        {src && !failed ? (
          <img
            src={src}
            alt={`${it.name} logo`}
            width={24}
            height={24}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ borderRadius: 4, display: "block" }}
            onError={() => setFailed(true)}
          />
        ) : (
          <s-icon type={it.icon as IconName} />
        )}
      </s-stack>
    </s-box>
  );
}

function IntegrationsTab({ data }: { data: Data }) {
  return (
    <s-stack direction="block" gap="base">
      <s-banner tone="info" heading="How integrations work here">
        <s-paragraph>
          Fees are applied by Shopify&apos;s checkout engine, so themes and cart apps need no switches. Apps that
          receive data (invoicing, automation) connect with their own credentials below; connections are
          encrypted and never shown again after saving.
        </s-paragraph>
      </s-banner>
      {INTEGRATION_GROUPS.map((g) => (
        <s-section key={g.title} heading={g.title} padding="none">
          {g.items.map((it, i) => (
            <s-box key={it.name} padding="base">
              {i > 0 && <s-divider />}
              <IntegrationRow it={it} data={data} />
            </s-box>
          ))}
        </s-section>
      ))}
      <s-section heading="Need another one?">
        <s-paragraph color="subdued">
          Fee lines are standard line items carrying a <code>_fee_rule</code> property and the fee&apos;s order
          tag, so reporting, invoicing and fulfilment apps already see them. Anything that accepts a webhook can
          be driven from the Outbound webhook above.
        </s-paragraph>
      </s-section>
    </s-stack>
  );
}

function IntegrationRow({ it, data }: { it: Integration; data: Data }) {
  const st = STATUS_LABEL[it.status];
  const conn: ConnectionView | undefined = it.connector ? data.connections[it.connector] : undefined;
  const def = it.connector ? data.connectors[it.connector] : undefined;
  const toggle = useFetcher<typeof action>();
  const modalId = `integration-${it.connector ?? it.name.replace(/\W+/g, "-").toLowerCase()}`;
  const isCredential = def?.mode === "credential";
  const canEnable = Boolean(def && !def.unavailable && conn && !isCredential && conn.status === "connected");
  const liveCreds = isCredential ? data.credentials.filter((c) => !c.revoked).length : 0;
  const tone = isCredential
    ? (liveCreds ? "success" : st.tone)
    : conn?.status === "connected" ? "success" : conn?.status === "error" ? "critical" : conn?.status === "pending" ? "warning" : st.tone;
  const label = isCredential
    ? liveCreds ? `${liveCreds} active credential${liveCreds === 1 ? "" : "s"}` : st.label
    : conn?.status === "connected" ? (conn.enabled ? "Connected" : "Connected · off") :
      conn?.status === "error" ? "Needs attention" :
      conn?.status === "pending" ? "Awaiting partner access" : st.label;

  return (
    <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
      <s-stack direction="inline" gap="small" alignItems="start">
        <IntegrationLogo it={it} />
        <s-stack direction="block" gap="small-500">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-text type="strong">{it.name}</s-text>
            <s-badge tone={tone}>{label}</s-badge>
          </s-stack>
          <s-text color="subdued">{it.blurb}</s-text>
          {conn?.lastError && <s-text tone="critical">{conn.lastError}</s-text>}
        </s-stack>
      </s-stack>
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-button href={appStoreSearch(it.query)} target="_blank" variant="tertiary" icon="external" accessibilityLabel={`View ${it.name} on the App Store`} />
        {def && (
          <s-button type="button" variant="secondary" commandFor={modalId} command="--show">
            Manage
          </s-button>
        )}
        {def && !isCredential && (
          <s-switch
            label={`Enable ${it.name}`}
            labelAccessibilityVisibility="exclusive"
            checked={Boolean(conn?.enabled)}
            disabled={!canEnable || toggle.state !== "idle"}
            onChange={(e) => {
              const fd = new FormData();
              fd.set("intent", "integration.toggle");
              fd.set("key", it.connector!);
              fd.set("enabled", String((e.target as HTMLInputElement).checked));
              toggle.submit(fd, { method: "post" });
            }}
          />
        )}
      </s-stack>
      {def && <IntegrationModal id={modalId} it={it} def={def} conn={conn} data={data} />}
    </s-stack>
  );
}

function IntegrationModal({
  id,
  it,
  def,
  conn,
  data,
}: {
  id: string;
  it: Integration;
  def: { fields: FieldDef[]; unavailable: { reason: string; alternative: string } | null; canTest: boolean; mode: string; intro: string | null };
  conn?: ConnectionView;
  data: Data;
}) {
  const logs = it.connector ? data.deliveries[it.connector] ?? [] : [];
  const opts = useFetcher<typeof action>();
  const remote: Record<string, Array<{ value: string; label: string }>> =
    opts.data && "options" in opts.data && opts.data.options ? (opts.data.options as Record<string, Array<{ value: string; label: string }>>) : {};
  const hasRemote = def.fields.some((f) => f.type === "remote-select");

  const save = useFetcher<typeof action>();
  const test = useFetcher<typeof action>();

  // All hooks above; credential-mode connectors render a different dialog.
  if (def.mode === "credential") return <CredentialModal id={id} it={it} data={data} />;
  const msg = (f: typeof save) =>
    f.data && "error" in f.data && f.data.error ? (
      <s-banner tone="critical" heading={f.data.error} />
    ) : f.data && "message" in f.data && f.data.message ? (
      <s-banner tone="success" heading={f.data.message} />
    ) : null;

  return (
    <s-modal id={id} heading={it.name} size="base">
      {def.unavailable ? (
        <s-stack direction="block" gap="base">
          <s-banner tone="warning" heading="Direct connection not available yet">
            <s-paragraph>{def.unavailable.reason}</s-paragraph>
          </s-banner>
          <s-text type="strong">What works today</s-text>
          <s-paragraph>{def.unavailable.alternative}</s-paragraph>
          <s-paragraph color="subdued">
            Fee lines reach any connected tool as line items with the fee name, amount, tax flag and the
            <code> _fee_rule</code> property, so invoices can show them as separate lines or as a tax surcharge.
          </s-paragraph>
        </s-stack>
      ) : (
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-badge tone={conn?.status === "connected" ? "success" : conn?.status === "error" ? "critical" : conn?.status === "pending" ? "warning" : "neutral"}>
              {conn?.status === "connected" ? "Connected" : conn?.status === "error" ? "Error" : conn?.status === "pending" ? "Awaiting partner access" : "Not connected"}
            </s-badge>
            <s-text color="subdued">
              {conn?.lastSyncAt ? `Last delivery ${new Date(conn.lastSyncAt).toLocaleString()}` :
               conn?.lastTestedAt ? `Last tested ${new Date(conn.lastTestedAt).toLocaleString()}` : "Never tested"}
            </s-text>
          </s-stack>
          {def.intro && <s-paragraph>{def.intro}</s-paragraph>}
          {msg(save)}
          {msg(test)}
          {hasRemote && (
            <opts.Form method="post">
              <input type="hidden" name="intent" value="integration.options" />
              <input type="hidden" name="key" value={it.connector} />
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-button type="submit" variant="secondary" icon="refresh" loading={opts.state !== "idle" ? true : undefined} disabled={!conn}>
                  Load choices from account
                </s-button>
                {opts.data && "error" in opts.data && opts.data.error && <s-text tone="critical">{opts.data.error}</s-text>}
              </s-stack>
            </opts.Form>
          )}
          <save.Form method="post">
            <input type="hidden" name="intent" value="integration.save" />
            <input type="hidden" name="key" value={it.connector} />
            <s-stack direction="block" gap="base">
              {def.fields.map((f) => {
                const stored = conn?.secretsSet.includes(f.name);
                if (f.type === "secret") {
                  return (
                    <s-stack key={f.name} direction="block" gap="small-300">
                      <s-password-field
                        label={f.label}
                        name={f.name}
                        placeholder={stored ? "•••••••• (saved)" : f.placeholder}
                        details={stored ? "Saved and encrypted. Leave blank to keep it." : f.hint}
                      />
                      {stored && <s-checkbox label="Remove saved value" name={`${f.name}__clear`} value="1" />}
                    </s-stack>
                  );
                }
                if (f.type === "select") {
                  return (
                    <s-select key={f.name} label={f.label} name={f.name} value={conn?.settings[f.name] ?? f.options?.[0]?.value} details={f.hint}>
                      {(f.options ?? []).map((o) => (
                        <s-option key={o.value} value={o.value}>{o.label}</s-option>
                      ))}
                    </s-select>
                  );
                }
                if (f.type === "checkbox") {
                  return (
                    <s-checkbox key={f.name} label={f.label} name={f.name} value="true" defaultChecked={conn?.settings[f.name] === "true"} details={f.hint} />
                  );
                }
                if (f.type === "remote-select") {
                  const current = conn?.settings[f.name] ?? "";
                  const list = remote[f.name];
                  if (!list) {
                    return (
                      <s-text-field key={f.name} label={f.label} name={f.name} defaultValue={current} placeholder="Save, then load choices from account" details={f.hint} />
                    );
                  }
                  return (
                    <s-select key={f.name} label={f.label} name={f.name} value={current} details={f.hint}>
                      <s-option value="">— none —</s-option>
                      {list.map((o) => (
                        <s-option key={o.value} value={o.value}>{o.label}</s-option>
                      ))}
                    </s-select>
                  );
                }
                if (f.type === "rules") {
                  const chosen = (conn?.settings[f.name] ?? "").split(",").filter(Boolean);
                  return (
                    <s-stack key={f.name} direction="block" gap="small-300">
                      <s-text type="strong">{f.label}</s-text>
                      {f.hint && <s-text color="subdued">{f.hint}</s-text>}
                      {data.activeRules.length === 0 ? (
                        <s-text color="subdued">No active fees yet.</s-text>
                      ) : (
                        data.activeRules.map((r) => (
                          <s-checkbox key={r.id} label={r.name} name={f.name} value={r.id} defaultChecked={chosen.includes(r.id)} />
                        ))
                      )}
                    </s-stack>
                  );
                }
                return (
                  <s-text-field key={f.name} label={f.label} name={f.name} defaultValue={conn?.settings[f.name] ?? ""} placeholder={f.placeholder} details={f.hint} required={f.required} />
                );
              })}
              <s-stack direction="inline" gap="small-200">
                <s-button type="submit" variant="primary" loading={save.state !== "idle" ? true : undefined}>
                  Save connection
                </s-button>
              </s-stack>
            </s-stack>
          </save.Form>
          {def.canTest && (
            <test.Form method="post">
              <input type="hidden" name="intent" value="integration.test" />
              <input type="hidden" name="key" value={it.connector} />
              <s-button type="submit" variant="secondary" icon="connect" loading={test.state !== "idle" ? true : undefined} disabled={!conn}>
                Test connection
              </s-button>
            </test.Form>
          )}
          {logs.length > 0 && (
            <s-stack direction="block" gap="small-300">
              <s-text type="strong">Recent deliveries</s-text>
              {logs.map((l, i) => (
                <s-stack key={i} direction="inline" gap="small-200" alignItems="center">
                  <s-badge tone={l.status === "sent" ? "success" : l.status === "error" ? "critical" : "neutral"}>{l.status}</s-badge>
                  <s-text>{l.orderName || "order"}</s-text>
                  <s-text color="subdued">{l.ref ? `${l.ref} · ` : ""}{l.message}</s-text>
                </s-stack>
              ))}
            </s-stack>
          )}
          {it.connector === "webhook" && (
            <s-paragraph color="subdued">
              Payload: <code>{"{ event, shop, order: { id, name, createdAt, currency, feeTotal, fees[] } }"}</code>.
              Verify <code>X-Fees-Signature</code> as HMAC-SHA256 of the raw body with your signing secret.
            </s-paragraph>
          )}
        </s-stack>
      )}
      <s-button slot="secondary-actions" type="button" commandFor={id} command="--hide">Done</s-button>
    </s-modal>
  );
}

function CredentialModal({ id, it, data }: { id: string; it: Integration; data: Data }) {
  const create = useFetcher<typeof action>();
  const revoke = useFetcher<typeof action>();
  const token = create.data && "token" in create.data ? (create.data.token as string) : null;
  const endpoint = `${data.appUrl.replace(/\/$/, "")}/api/quote`;
  return (
    <s-modal id={id} heading={it.name} size="base">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Allow {it.name} to request read-only surcharge quotes. The credential is bound to this store and can
          only call the quote endpoint; it cannot change fees, carts, orders or settings.
        </s-paragraph>
        {token ? (
          <s-banner tone="success" heading="Copy this credential now — it won&apos;t be shown again">
            <s-text-field label="Credential" labelAccessibilityVisibility="exclusive" value={token} readOnly />
          </s-banner>
        ) : (
          <create.Form method="post">
            <input type="hidden" name="intent" value="credential.create" />
            <s-stack direction="inline" gap="small-200" alignItems="end">
              <s-text-field label="Name" name="name" placeholder={it.name} />
              <s-button type="submit" variant="primary" loading={create.state !== "idle" ? true : undefined}>
                Generate credential
              </s-button>
            </s-stack>
          </create.Form>
        )}
        {create.data && "error" in create.data && create.data.error && <s-banner tone="critical" heading={create.data.error} />}
        <s-divider />
        <s-text type="strong">Endpoint</s-text>
        <s-paragraph><code>POST {endpoint}</code> with <code>Authorization: Bearer fq_…</code></s-paragraph>
        <s-paragraph color="subdued">
          Body: <code>{"{ lines: [{ variantId, quantity, unitPrice? }], countryCode?, customerTags?, channel? }"}</code> →
          <code>{" { currency, fees: [{ ruleId, name, amount, required }], feeTotal }"}</code>
        </s-paragraph>
        {data.credentials.length > 0 && (
          <s-stack direction="block" gap="small-300">
            <s-text type="strong">Credentials</s-text>
            {data.credentials.map((c) => (
              <s-stack key={c.id} direction="inline" justifyContent="space-between" alignItems="center" gap="base">
                <s-stack direction="block" gap="small-500">
                  <s-text>{c.name || it.name} <s-text color="subdued">({c.prefix}…)</s-text></s-text>
                  <s-text color="subdued">
                    {c.revoked ? "Revoked" : c.lastUsedAt ? `Last used ${new Date(c.lastUsedAt).toLocaleString()}` : "Never used"} · created {new Date(c.createdAt).toLocaleDateString()}
                  </s-text>
                </s-stack>
                {!c.revoked && (
                  <revoke.Form method="post">
                    <input type="hidden" name="intent" value="credential.revoke" />
                    <input type="hidden" name="id" value={c.id} />
                    <s-button type="submit" variant="tertiary" tone="critical">Revoke</s-button>
                  </revoke.Form>
                )}
              </s-stack>
            ))}
          </s-stack>
        )}
      </s-stack>
      <s-button slot="secondary-actions" type="button" commandFor={id} command="--hide">Done</s-button>
    </s-modal>
  );
}

function StorefrontTab({ data }: { data: Data }) {
  const c = data.config;
  return (
    <Form method="post" data-save-bar>
      <input type="hidden" name="intent" value="storefront" />
      <s-stack direction="block" gap="base">
        <s-section heading="Checkout blocks">
          <s-stack direction="block" gap="base">
            <s-checkbox
              label="Show the Fees block in the order summary"
              name="showFeesBlock"
              value="true"
              defaultChecked={c.showFeesBlock}
              details="Lists each fee with its amount and lets buyers remove optional ones. Fees still apply when hidden."
            />
            <s-checkbox
              label="Show required-fee acceptance above Pay now"
              name="showAcceptance"
              value="true"
              defaultChecked={c.showAcceptance}
              details="Turn off only if you accept required fees another way; the guard still blocks checkout."
            />
          </s-stack>
        </s-section>
        <s-section heading="Default text">
          <s-stack direction="block" gap="base">
            <s-paragraph color="subdued">Shown to buyers in your store&apos;s default language. Translate per language on the Translations tab.</s-paragraph>
            {CHECKOUT_TEXT_KEYS.map((k) => (
              <s-text-field
                key={k}
                label={TEXT_LABELS[k].label}
                name={`text.${k}`}
                defaultValue={c.text[k]}
                placeholder={DEFAULT_TEXT[k]}
                details={TEXT_LABELS[k].hint}
                maxLength={240}
              />
            ))}
          </s-stack>
        </s-section>
        <s-button type="submit" variant="primary">Save</s-button>
      </s-stack>
    </Form>
  );
}

function TranslationsTab({ data }: { data: Data }) {
  const c = data.config;
  if (data.locales.length === 0) {
    return (
      <s-section heading="Translations">
        <s-stack direction="block" gap="base">
          <s-paragraph color="subdued">
            No additional published languages found. Add one under Settings → Languages in Shopify admin, then
            reload. If you just restarted the app, the <code>read_locales</code> scope may still be pending.
          </s-paragraph>
        </s-stack>
      </s-section>
    );
  }
  const entry = (data.locale && c.translations[data.locale]) || {};
  return (
    <s-stack direction="block" gap="base">
      <s-section heading="Language">
        <s-stack direction="inline" gap="small-200">
          {data.locales.map((l) => (
            <s-button
              key={l.locale}
              href={`/app/settings?tab=translations&locale=${encodeURIComponent(l.locale)}`}
              variant={l.locale === data.locale ? "secondary" : "tertiary"}
            >
              {l.name}
            </s-button>
          ))}
        </s-stack>
      </s-section>
      <Form method="post" data-save-bar key={data.locale ?? ""}>
        <input type="hidden" name="intent" value="translations" />
        <input type="hidden" name="locale" value={data.locale ?? ""} />
        <s-section heading={`Checkout text (${data.locale})`}>
          <s-stack direction="block" gap="base">
            <s-paragraph color="subdued">Leave a field empty to fall back to the default text.</s-paragraph>
            {CHECKOUT_TEXT_KEYS.map((k) => (
              <s-text-field
                key={k}
                label={TEXT_LABELS[k].label}
                name={`t.${k}`}
                defaultValue={entry[k] ?? ""}
                placeholder={c.text[k]}
                details={TEXT_LABELS[k].hint}
                maxLength={240}
              />
            ))}
            <s-button type="submit" variant="primary">Save {data.locale}</s-button>
          </s-stack>
        </s-section>
      </Form>
    </s-stack>
  );
}

function AdvancedTab({ data }: { data: Data }) {
  const c = data.config;
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const storeHandle = data.shopDomain.replace(".myshopify.com", "");
  return (
    <s-stack direction="block" gap="base">
      <Form method="post" data-save-bar>
        <input type="hidden" name="intent" value="advanced" />
        <s-section heading="Checkout safeguards">
          <s-stack direction="block" gap="base">
            <s-checkbox
              label="Block checkout when a required fee isn&apos;t accepted"
              name="guardEnabled"
              value="true"
              defaultChecked={c.guardEnabled}
              details="Runs the fee-guard validation while any required fee is active. Turning this off makes required fees behave like optional ones at checkout."
            />
            <s-checkbox
              label="Block checkout if the fee engine fails"
              name="blockOnFailure"
              value="true"
              defaultChecked={c.blockOnFailure}
              details="Off: a function timeout lets the buyer check out without fees. On: checkout is held until fees can be applied. Changing this re-registers the engine."
            />
            <s-button type="submit" variant="primary">Save</s-button>
          </s-stack>
        </s-section>
      </Form>

      <s-section heading="Sync">
        <s-stack direction="block" gap="base">
          <s-paragraph color="subdued">
            Every save pushes fees and settings to checkout automatically. Use this after a sync error or a plan change.
          </s-paragraph>
          {fetcher.data && "ok" in fetcher.data && fetcher.data.ok && (
            <s-banner tone="success" heading={`Synced ${fetcher.data.count} active fee${fetcher.data.count === 1 ? "" : "s"} and settings to checkout`} />
          )}
          {fetcher.data && "error" in fetcher.data && fetcher.data.error && (
            <s-banner tone="critical" heading="Sync failed"><s-paragraph>{fetcher.data.error}</s-paragraph></s-banner>
          )}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="resync" />
            <s-button type="submit" icon="refresh" loading={busy ? true : undefined}>Re-sync to checkout</s-button>
          </fetcher.Form>
        </s-stack>
      </s-section>

      <s-section heading="Fee products">
        <s-stack direction="block" gap="base">
          <s-paragraph color="subdued">
            Each fee is backed by a hidden product so it can appear as its own line. They&apos;re tagged{" "}
            <code>fee-engine</code>. Don&apos;t edit or delete them in Products; remove the fee here instead.
          </s-paragraph>
          {data.feeProducts.length === 0 ? (
            <s-text color="subdued">No fee products yet. One is created the first time a fee is turned on.</s-text>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header>Fee</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header>Product</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {data.feeProducts.map((p) => (
                  <s-table-row key={p.id}>
                    <s-table-cell><s-link href={`/app/rules/${p.id}`}>{p.name}</s-link></s-table-cell>
                    <s-table-cell><s-badge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Inactive"}</s-badge></s-table-cell>
                    <s-table-cell>
                      <s-link href={`https://admin.shopify.com/store/${storeHandle}/products/${numericId(p.productId)}`} target="_blank">
                        View in Products
                      </s-link>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-stack>
      </s-section>
    </s-stack>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (h) => boundary.headers(h);
