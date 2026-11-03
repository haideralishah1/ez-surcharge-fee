import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError, useRouteLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { listRules } from "../lib/fee-rules.server";
import { ORDERS_COUNT } from "../graphql/settings";
import { formatMoney } from "../lib/format";
import { IconTile } from "../components/IconPicker";
import type { AppShellData } from "./app";

const PERIODS = [7, 30, 90] as const;

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const days = (PERIODS as readonly number[]).includes(Number(url.searchParams.get("days")))
    ? Number(url.searchParams.get("days"))
    : 30;

  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const prevSince = new Date(since.getTime() - days * 86_400_000);

  const [rows, rules] = await Promise.all([
    prisma.feeOrderUsage.findMany({
      where: { shop: session.shop, createdAt: { gte: prevSince } },
      orderBy: { createdAt: "desc" },
    }),
    listRules(session.shop),
  ]);
  const ruleName = new Map(rules.map((r) => [r.id, { name: r.name, icon: r.icon }]));

  const at = (r: (typeof rows)[number]) => r.orderCreatedAt ?? r.createdAt;
  const current = rows.filter((r) => at(r) >= since);
  const previous = rows.filter((r) => at(r) < since);

  const sum = (xs: typeof rows) => Math.round(xs.reduce((s, r) => s + r.feeTotal, 0) * 100) / 100;

  // Daily series for the chart, zero-filled.
  const byDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) byDay.set(dayKey(new Date(now.getTime() - i * 86_400_000)), 0);
  for (const r of current) {
    const k = dayKey(at(r));
    if (byDay.has(k)) byDay.set(k, Math.round((byDay.get(k)! + r.feeTotal) * 100) / 100);
  }

  // Per-fee totals from the stored breakdown.
  const byRule = new Map<string, { orders: number; revenue: number }>();
  for (const r of current) {
    let b: Record<string, number> = {};
    try {
      b = JSON.parse(r.breakdown);
    } catch {
      b = {};
    }
    const ids: string[] = JSON.parse(r.ruleIds || "[]");
    for (const id of ids) {
      const e = byRule.get(id) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue = Math.round((e.revenue + (b[id] ?? 0)) * 100) / 100;
      byRule.set(id, e);
    }
  }

  // Total orders in the window for the attach rate (needs read_orders; tolerate absence).
  let totalOrders: number | null = null;
  try {
    const res = await admin.graphql(ORDERS_COUNT, { variables: { q: `created_at:>=${dayKey(since)}` } });
    const body = (await res.json()) as { data?: { ordersCount?: { count: number } | null } };
    totalOrders = body.data?.ordersCount?.count ?? null;
  } catch {
    totalOrders = null;
  }

  return {
    days,
    shopHandle: session.shop.replace(".myshopify.com", ""),
    kpis: {
      orders: current.length,
      prevOrders: previous.length,
      revenue: sum(current),
      prevRevenue: sum(previous),
      avg: current.length ? Math.round((sum(current) / current.length) * 100) / 100 : 0,
      totalOrders,
    },
    series: Array.from(byDay.entries()).map(([date, value]) => ({ date, value })),
    topFees: Array.from(byRule.entries())
      .map(([id, v]) => ({ id, name: ruleName.get(id)?.name ?? "Deleted fee", icon: ruleName.get(id)?.icon ?? "order-fee", ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    recent: current.slice(0, 10).map((r) => ({
      orderId: r.orderId,
      name: r.orderName || `#${r.orderId.split("/").pop()}`,
      at: at(r).toISOString(),
      fees: (JSON.parse(r.ruleIds || "[]") as string[]).map((id) => ruleName.get(id)?.name ?? "Deleted fee"),
      amount: r.feeTotal,
    })),
    trackingSince: rows.length ? at(rows[rows.length - 1]).toISOString() : null,
  };
};

export default function Analytics() {
  const d = useLoaderData<typeof loader>();
  const shell = useRouteLoaderData("routes/app") as AppShellData;
  const money = (n: number) => formatMoney(n, shell.shop.currencyCode);
  const delta = (cur: number, prev: number) =>
    prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
  const attach =
    d.kpis.totalOrders && d.kpis.totalOrders > 0
      ? Math.min(100, Math.round((d.kpis.orders / d.kpis.totalOrders) * 100))
      : null;

  return (
    <s-page heading="Analytics" inlineSize="large">
      <s-stack slot="primary-action" direction="inline" gap="small-200">
        {PERIODS.map((p) => (
          <s-button key={p} href={`/app/analytics?days=${p}`} variant={p === d.days ? "secondary" : "tertiary"}>
            {p} days
          </s-button>
        ))}
      </s-stack>

      <s-stack direction="block" gap="base">
        {d.kpis.orders === 0 && (
          <s-banner tone="info" heading="No fee orders in this period yet">
            <s-paragraph>
              Orders are counted from the moment they&apos;re placed, once the orders webhook is active. Place a
              test order with a fee to see numbers here.
            </s-paragraph>
          </s-banner>
        )}

        <s-grid gridTemplateColumns="@container (inline-size > 760px) repeat(4, 1fr), 1fr 1fr" gap="base">
          <Kpi label="Orders with fees" value={String(d.kpis.orders)} delta={delta(d.kpis.orders, d.kpis.prevOrders)} />
          <Kpi label="Fee revenue" value={money(d.kpis.revenue)} delta={delta(d.kpis.revenue, d.kpis.prevRevenue)} />
          <Kpi label="Average fee per order" value={money(d.kpis.avg)} />
          <Kpi
            label="Attach rate"
            value={attach === null ? "—" : `${attach}%`}
            hint={d.kpis.totalOrders === null ? "Needs order access" : `of ${d.kpis.totalOrders} orders`}
          />
        </s-grid>

        <s-section heading="Fee revenue by day">
          <Chart series={d.series} money={money} />
        </s-section>

        <s-grid gridTemplateColumns="@container (inline-size > 860px) 1fr 1fr, 1fr" gap="base">
          <s-section heading="Top fees" padding="none">
            {d.topFees.length === 0 ? (
              <s-box padding="base"><s-text color="subdued">No fees charged yet.</s-text></s-box>
            ) : (
              <s-table>
                <s-table-header-row>
                  <s-table-header>Fee</s-table-header>
                  <s-table-header>Orders</s-table-header>
                  <s-table-header>Revenue</s-table-header>
                  <s-table-header>Share</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {d.topFees.map((f) => (
                    <s-table-row key={f.id}>
                      <s-table-cell>
                        <s-stack direction="inline" gap="small" alignItems="center">
                          <IconTile iconKey={f.icon} />
                          <s-link href={`/app/rules/${f.id}`}>{f.name}</s-link>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>{f.orders}</s-table-cell>
                      <s-table-cell><s-text fontVariantNumeric="tabular-nums">{money(f.revenue)}</s-text></s-table-cell>
                      <s-table-cell>{d.kpis.revenue ? Math.round((f.revenue / d.kpis.revenue) * 100) : 0}%</s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            )}
          </s-section>

          <s-section heading="Recent fee orders" padding="none">
            {d.recent.length === 0 ? (
              <s-box padding="base"><s-text color="subdued">Nothing yet.</s-text></s-box>
            ) : (
              <s-table>
                <s-table-header-row>
                  <s-table-header>Order</s-table-header>
                  <s-table-header>Fees</s-table-header>
                  <s-table-header>Amount</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {d.recent.map((o) => (
                    <s-table-row key={o.orderId}>
                      <s-table-cell>
                        <s-stack direction="block" gap="small-500">
                          <s-link
                            href={`https://admin.shopify.com/store/${d.shopHandle}/orders/${o.orderId.split("/").pop()}`}
                            target="_blank"
                          >
                            {o.name}
                          </s-link>
                          <s-text color="subdued">{new Date(o.at).toLocaleDateString()}</s-text>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>{o.fees.join(", ")}</s-table-cell>
                      <s-table-cell><s-text fontVariantNumeric="tabular-nums">{money(o.amount)}</s-text></s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            )}
          </s-section>
        </s-grid>

        {d.trackingSince && (
          <s-text color="subdued">
            Tracking since {new Date(d.trackingSince).toLocaleDateString()}. Amounts are in your store currency and
            exclude tax, shipping and refunds.
          </s-text>
        )}
      </s-stack>
    </s-page>
  );
}

function Kpi({ label, value, delta, hint }: { label: string; value: string; delta?: number | null; hint?: string }) {
  return (
    <s-box border="base" borderRadius="base" padding="base" background="base">
      <s-stack direction="block" gap="small-300">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
        {delta !== undefined && delta !== null ? (
          <s-badge tone={delta >= 0 ? "success" : "critical"} icon={delta >= 0 ? "arrow-up" : "arrow-down"}>
            {Math.abs(delta)}% vs previous period
          </s-badge>
        ) : hint ? (
          <s-text color="subdued">{hint}</s-text>
        ) : (
          <s-text color="subdued">No previous period</s-text>
        )}
      </s-stack>
    </s-box>
  );
}

/** Dependency-free bar chart; values are shop-currency fee totals per day. */
function Chart({ series, money }: { series: Array<{ date: string; value: number }>; money: (n: number) => string }) {
  const W = 800;
  const H = 180;
  const pad = { l: 8, r: 8, t: 12, b: 24 };
  const max = Math.max(1, ...series.map((s) => s.value));
  const n = series.length;
  const slot = (W - pad.l - pad.r) / n;
  const bw = Math.max(2, slot * 0.6);
  const labelEvery = n > 31 ? 15 : n > 7 ? 5 : 1;
  return (
    <s-stack direction="block" gap="small-200">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Fee revenue by day">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="currentColor" strokeOpacity="0.15" />
        {series.map((s, i) => {
          const h = ((H - pad.t - pad.b) * s.value) / max;
          const x = pad.l + i * slot + (slot - bw) / 2;
          const y = H - pad.b - h;
          return (
            <g key={s.date}>
              <rect x={x} y={y} width={bw} height={h} rx={2} fill="currentColor" fillOpacity={s.value ? 0.85 : 0.12}>
                <title>{`${s.date}: ${money(s.value)}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={H - 6} fontSize="10" textAnchor="middle" fill="currentColor" fillOpacity="0.6">
                  {s.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <s-text color="subdued">Peak day {money(max === 1 && series.every((s) => s.value === 0) ? 0 : max)}</s-text>
    </s-stack>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (h) => boundary.headers(h);
