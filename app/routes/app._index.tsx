import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useFetcher,
  useLoaderData,
  useRevalidator,
  useRouteError,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { listRules, setRuleActive } from "../lib/fee-rules.server";
import { syncRules } from "../lib/fee-engine.server";
import { getShopConfig } from "../lib/settings.server";
import { CHANNEL_LABEL, SCOPE_LABEL, describeCharge } from "../lib/format";
import { PLAN_LABELS } from "../lib/plans";
import { FREE_MONTHLY_FEE_ORDERS } from "../lib/plan-catalog";
import { IconTile } from "../components/IconPicker";
import type { AppShellData } from "./app";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const month = new Date().toISOString().slice(0, 7);
  const [rules, config, usage] = await Promise.all([
    listRules(session.shop),
    getShopConfig(session.shop),
    prisma.feeOrderUsage.count({ where: { shop: session.shop, month } }),
  ]);
  return { rules, guardEnabled: config.guardEnabled, validationId: config.validationId, usage };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  if (form.get("intent") !== "toggle") return null;

  await setRuleActive(session.shop, String(form.get("id")), form.get("active") === "true");
  try {
    await syncRules(admin, session.shop);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

type Rule = ReturnType<typeof useLoaderData<typeof loader>>["rules"][number];

export default function Overview() {
  const { rules, guardEnabled, validationId, usage } = useLoaderData<typeof loader>();
  const shell = useRouteLoaderData("routes/app") as AppShellData;
  const [params] = useSearchParams();
  const revalidator = useRevalidator();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const active = rules.filter((r) => r.active);
  const needsGuard = active.some((r) => r.requirement === "REQUIRED");
  const guardOn = guardEnabled && needsGuard && Boolean(validationId);
  const included = shell.plan === "FREE" ? FREE_MONTHLY_FEE_ORDERS : null;
  const health =
    included === null || usage < included * 0.8
      ? { tone: "success" as const, label: "Healthy" }
      : usage < included
        ? { tone: "warning" as const, label: "Near limit" }
        : { tone: "critical" as const, label: "Limit reached" };
  const visible = rules.filter((r) =>
    filter === "all" ? true : filter === "active" ? r.active : !r.active,
  );
  const syncError = params.get("syncError");

  const steps = [
    { label: "Checkout engine connected", done: !shell.engineError, hint: "Registered automatically when you open the app." },
    { label: "Add your first fee", done: rules.length > 0, hint: "Start from a product fee, an order fee, or a preset.", href: "/app/rules/new" },
    { label: "Turn a fee on", done: active.length > 0, hint: "Active fees apply to checkout within seconds." },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <s-page heading="Overview">
      <s-button slot="primary-action" href="/app/rules/new" variant="primary" icon="plus">
        Create fee
      </s-button>

      <s-stack direction="block" gap="base">
        <s-text color="subdued">
          Track live fees, sales-channel coverage, checkout readiness, and usage from one place.
        </s-text>

        {shell.engineError && (
          <s-banner tone="warning" heading="Checkout engine isn&apos;t connected yet">
            <s-paragraph>
              Fees are saved but won&apos;t be charged until the engine registers.
              Restart <code>npm run dev</code> so the fee-engine function deploys
              to this store, then reload. Details: {shell.engineError}
            </s-paragraph>
          </s-banner>
        )}
        {syncError && (
          <s-banner tone="critical" heading="Saved, but checkout wasn&apos;t updated">
            <s-paragraph>{syncError}</s-paragraph>
            <s-button slot="secondary-actions" href="/app/settings">
              Retry from Settings
            </s-button>
          </s-banner>
        )}

        {doneCount < steps.length && (
          <s-section heading="Getting started">
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-text color="subdued">Steps completed: {doneCount} of {steps.length}</s-text>
                <s-box background="subdued" borderRadius="large" inlineSize="160px" blockSize="6px">
                  <s-box
                    background="strong"
                    borderRadius="large"
                    inlineSize={`${Math.round((doneCount / steps.length) * 100)}%`}
                    blockSize="6px"
                  />
                </s-box>
              </s-stack>
              {steps.map((s) => (
                <s-stack key={s.label} direction="inline" gap="small" alignItems="start">
                  <s-icon type={s.done ? "check-circle-filled" : "circle-dashed"} tone={s.done ? "success" : "neutral"} />
                  <s-stack direction="block" gap="small-500">
                    <s-text type="strong" color={s.done ? "subdued" : "base"}>{s.label}</s-text>
                    <s-text color="subdued">{s.hint}</s-text>
                    {!s.done && s.href && (
                      <s-button href={s.href} variant="secondary">Add fee</s-button>
                    )}
                  </s-stack>
                </s-stack>
              ))}
            </s-stack>
          </s-section>
        )}

        <s-section>
          <s-stack direction="block" gap="small">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small">
              <s-heading>App status</s-heading>
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <StatusPill on={!shell.engineError} label={shell.engineError ? "Fee engine off" : "Fee engine on"} />
                <StatusPill
                  on={guardOn}
                  label={guardOn ? "Fee guard on" : needsGuard ? "Fee guard off" : "Fee guard not needed"}
                />
                <s-button
                  variant="secondary"
                  onClick={() => revalidator.revalidate()}
                  loading={revalidator.state === "loading" ? true : undefined}
                >
                  Check again
                </s-button>
              </s-stack>
            </s-stack>
            <s-text color="subdued">
              The fee engine adds fees in cart and checkout; the fee guard enforces required fees.
            </s-text>
            <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small">
              <s-stack direction="block" gap="small-500">
                <s-text type="strong">Cart checkboxes</s-text>
                <s-text color="subdued">
                  Turn on the Fee options app embed so buyers can tick optional fees in the cart page and cart drawer.
                </s-text>
              </s-stack>
              <s-button
                variant="secondary"
                href={`shopify://admin/themes/current/editor?context=apps&activateAppId=${shell.apiKey}/fee-embed`}
                target="_top"
              >
                Open theme editor
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>

        <s-grid gridTemplateColumns="@container (inline-size > 640px) 1fr 1fr, 1fr" gap="base">
          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack direction="block" gap="small-500">
                <s-heading>Workspace status</s-heading>
                <s-text color="subdued">Keep live fee rules and checkout setup aligned.</s-text>
              </s-stack>
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-stack direction="block" gap="small-500">
                  <s-text type="strong">Published fee rules</s-text>
                  <s-text color="subdued">
                    {active.length} live {active.length === 1 ? "fee" : "fees"} · {rules.length - active.length} not live yet
                  </s-text>
                </s-stack>
                <s-badge tone={active.length ? "success" : "neutral"}>{active.length ? "Live" : "Not live"}</s-badge>
              </s-stack>
            </s-stack>
          </s-section>

          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack direction="block" gap="small-500">
                <s-heading>Surface coverage</s-heading>
                <s-text color="subdued">Where your live fees are configured to run.</s-text>
              </s-stack>
              {Object.entries(CHANNEL_LABEL).map(([key, label], i) => {
                const count = active.filter((r) => r.channels.includes(key)).length;
                return (
                  <s-stack key={key} direction="block" gap="small">
                    {i > 0 && <s-divider />}
                    <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                      <s-stack direction="block" gap="small-500">
                        <s-text type="strong">{label}</s-text>
                        <s-text color="subdued">
                          {count} {count === 1 ? "fee" : "fees"} configured
                        </s-text>
                      </s-stack>
                      <s-badge tone={count ? "success" : "neutral"}>{count ? "Configured" : "None"}</s-badge>
                    </s-stack>
                  </s-stack>
                );
              })}
            </s-stack>
          </s-section>
        </s-grid>

        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small">
              <s-stack direction="block" gap="small-500">
                <s-heading>Billing and usage</s-heading>
                <s-text color="subdued">
                  {included === null
                    ? "Your plan includes unlimited orders with applied fees."
                    : "The Free plan stops applying new fees once monthly usage runs out."}
                </s-text>
              </s-stack>
              <s-stack direction="inline" gap="small-300">
                <s-badge tone="info">{PLAN_LABELS[shell.plan]}</s-badge>
                <s-badge tone={health.tone}>{health.label}</s-badge>
              </s-stack>
            </s-stack>
            <s-stack direction="inline" gap="base" alignItems="center">
              {included !== null && (
                <s-box background="subdued" borderRadius="large" inlineSize="100%" blockSize="6px">
                  <s-box
                    background="strong"
                    borderRadius="large"
                    inlineSize={`${Math.min(100, Math.round((usage / included) * 100))}%`}
                    blockSize="6px"
                  />
                </s-box>
              )}
              <s-text color="subdued" fontVariantNumeric="tabular-nums">
                {included === null ? `${usage} orders with fees this month` : `${usage} / ${included} included orders used`}
              </s-text>
            </s-stack>
            <s-link href="/app/settings?tab=pricing">Manage plan</s-link>
          </s-stack>
        </s-section>

        {rules.length > 0 && (
          <s-section padding="none">
            <s-box padding="base">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-heading>All fees</s-heading>
                <s-select
                  label="Filter"
                  labelAccessibilityVisibility="exclusive"
                  value={filter}
                  onChange={(e) => setFilter((e.target as HTMLSelectElement).value as typeof filter)}
                >
                  <s-option value="all">All</s-option>
                  <s-option value="active">Active</s-option>
                  <s-option value="inactive">Inactive</s-option>
                </s-select>
              </s-stack>
            </s-box>
            <s-table>
              <s-table-header-row>
                <s-table-header>Fee</s-table-header>
                <s-table-header>Charge</s-table-header>
                <s-table-header>Type</s-table-header>
                <s-table-header>Channels</s-table-header>
                <s-table-header>Status</s-table-header>
                <s-table-header></s-table-header>
              </s-table-header-row>
              <s-table-body>
                {visible.map((r) => (
                  <RuleRow key={r.id} rule={r} currencyCode={shell.shop.currencyCode} />
                ))}
              </s-table-body>
            </s-table>
            {visible.length === 0 && (
              <s-box padding="base">
                <s-text color="subdued">No {filter} fees.</s-text>
              </s-box>
            )}
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}

function StatusPill({ on, label }: { on: boolean; label: string }) {
  return (
    <s-badge tone={on ? "success" : "neutral"} icon={on ? "check-circle" : "circle"}>
      {label}
    </s-badge>
  );
}

function RuleRow({ rule, currencyCode }: { rule: Rule; currencyCode: string }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const failed = fetcher.data && fetcher.data.ok === false;
  return (
    <s-table-row>
      <s-table-cell>
        <s-stack direction="inline" gap="small" alignItems="center">
          <IconTile iconKey={rule.icon} />
          <s-stack direction="block" gap="small-500">
            <s-link href={`/app/rules/${rule.id}`}>{rule.name}</s-link>
            {rule.description && <s-text color="subdued">{rule.description}</s-text>}
          </s-stack>
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        <s-text fontVariantNumeric="tabular-nums">{describeCharge(rule, currencyCode)}</s-text>
      </s-table-cell>
      <s-table-cell>{SCOPE_LABEL[rule.scope]}</s-table-cell>
      <s-table-cell>
        <s-stack direction="inline" gap="small-300">
          {rule.channels.map((c) => (
            <s-badge key={c}>{CHANNEL_LABEL[c]}</s-badge>
          ))}
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        <s-stack direction="inline" gap="small-300">
          {failed ? (
            <s-badge tone="critical" icon="alert-circle">Sync failed</s-badge>
          ) : rule.active ? (
            <s-badge tone="success">Active</s-badge>
          ) : (
            <s-badge tone="neutral">Inactive</s-badge>
          )}
          {rule.requirement === "REQUIRED" && <s-badge tone="info" icon="lock">Required</s-badge>}
          {rule.scheduleEnabled && <s-badge icon="calendar">Scheduled</s-badge>}
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        <fetcher.Form method="post">
          <input type="hidden" name="id" value={rule.id} />
          <input type="hidden" name="intent" value="toggle" />
          <input type="hidden" name="active" value={String(!rule.active)} />
          <s-button type="submit" variant="tertiary" loading={busy ? true : undefined}>
            {rule.active ? "Turn off" : "Turn on"}
          </s-button>
        </fetcher.Form>
      </s-table-cell>
    </s-table-row>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (h) => boundary.headers(h);
