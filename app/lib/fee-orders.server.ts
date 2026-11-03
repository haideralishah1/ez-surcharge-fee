import prisma from "../db.server";
import { ORDER_FEE_LINES, ORDERS_TO_CHECK, TAG_ORDER } from "../graphql/order";
import { FEE_FULFILLMENT_ORDERS, FULFILL_FEE_LINES } from "../graphql/settings";
import { unauthenticated } from "../shopify.server";
import { dispatchFeeOrder, logUndeliveredFeeOrder } from "./connectors.server";
import type { AdminClient } from "./fee-engine.server";
import { listRules } from "./fee-rules.server";
import { getShopConfig } from "./settings.server";

interface TaxLine { rate?: number | null; price?: string }
export interface OrderPayload {
  id?: number;
  admin_graphql_api_id: string;
  name?: string;
  created_at: string;
  currency?: string;
  test?: boolean;
  taxes_included?: boolean;
  total_price?: string;
  email?: string | null;
  contact_email?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null } | null;
  company?: { id?: number; name?: string } | null;
  billing_address?: {
    name?: string | null; company?: string | null; address1?: string | null; address2?: string | null;
    zip?: string | null; city?: string | null; country_code?: string | null;
  } | null;
  note_attributes?: Array<{ name: string; value: string }> | null;
  localization_extensions?: Array<{ purpose?: string; key?: string; value?: string }> | null;
  line_items?: Array<{
    variant_id?: number | null;
    title?: string;
    variant_title?: string | null;
    sku?: string | null;
    quantity?: number;
    price?: string;
    total_discount?: string;
    tax_lines?: TaxLine[] | null;
    price_set?: { shop_money?: { amount?: string; currency_code?: string } } | null;
    properties?: Array<{ name: string; value: string }> | null;
  }>;
  shipping_lines?: Array<{ title?: string; price?: string; tax_lines?: TaxLine[] | null }> | null;
}

type LineItem = NonNullable<OrderPayload["line_items"]>[number];
type Rule = Awaited<ReturnType<typeof listRules>>[number];

const firstRate = (tl: TaxLine[] | null | undefined): number | null =>
  tl && tl.length && typeof tl[0].rate === "number" ? tl[0].rate : null;

/**
 * Finds the fee lines on an order. They're recognised by the `_fee_rule` line
 * property the cart transform sets, with the fee variant id as fallback.
 */
function matchFees(order: OrderPayload, rules: Rule[]) {
  const byVariant = new Map(rules.filter((r) => r.variantId).map((r) => [r.variantId!, r]));
  const byId = new Map(rules.map((r) => [r.id, r]));
  const ruleFor = (li: LineItem) => {
    const prop = li.properties?.find((p) => p.name === "_fee_rule")?.value;
    return (prop && byId.get(prop)) ||
      (li.variant_id ? byVariant.get(`gid://shopify/ProductVariant/${li.variant_id}`) : undefined);
  };

  const hit = new Map<string, Rule>();
  const breakdown: Record<string, number> = {};
  let feeTotal = 0;
  let currency = order.currency ?? "";
  for (const li of order.line_items ?? []) {
    const rule = ruleFor(li);
    if (!rule) continue;
    hit.set(rule.id, rule);
    const unit = Number(li.price_set?.shop_money?.amount ?? li.price ?? 0);
    const total = Math.round(unit * (li.quantity ?? 1) * 100) / 100;
    if (li.price_set?.shop_money?.currency_code) currency = li.price_set.shop_money.currency_code;
    breakdown[rule.id] = Math.round(((breakdown[rule.id] ?? 0) + total) * 100) / 100;
    feeTotal = Math.round((feeTotal + total) * 100) / 100;
  }
  return { hit, breakdown, feeTotal, currency, ruleFor, feeVariantIds: new Set(byVariant.keys()) };
}
type FeeMatch = ReturnType<typeof matchFees>;

const usageRow = (shop: string, order: OrderPayload, m: FeeMatch) => ({
  orderId: order.admin_graphql_api_id,
  shop,
  // Month key from the order's own timestamp (shop-local offset is embedded).
  month: order.created_at.slice(0, 7),
  ruleIds: JSON.stringify(Array.from(m.hit.keys())),
  feeTotal: m.feeTotal,
  currency: m.currency,
  breakdown: JSON.stringify(m.breakdown),
  orderName: order.name ?? "",
  orderCreatedAt: new Date(order.created_at),
});

const feeSummary = (order: OrderPayload, m: FeeMatch) => ({
  id: order.admin_graphql_api_id,
  name: order.name ?? "",
  createdAt: order.created_at,
  currency: m.currency,
  feeTotal: m.feeTotal,
  fees: Array.from(m.hit.values()).map((r) => ({
    ruleId: r.id,
    name: r.name,
    amount: m.breakdown[r.id] ?? 0,
    orderTag: r.orderTag,
  })),
});

/** Applies order tags and auto-fulfilment. Safe to repeat for the same order. */
async function applyOrderChores(admin: AdminClient, shop: string, order: OrderPayload, m: FeeMatch) {
  const config = await getShopConfig(shop);
  const tags = Array.from(new Set(Array.from(m.hit.values()).map((r) => r.orderTag).filter(Boolean)));
  if (tags.length === 0 && config.defaultOrderTag) tags.push(config.defaultOrderTag);
  if (tags.length) {
    const res = await admin.graphql(TAG_ORDER, {
      variables: { id: order.admin_graphql_api_id, tags },
    });
    const body = (await res.json()) as { data?: { tagsAdd?: { userErrors?: Array<{ message: string }> } } };
    const errs = body.data?.tagsAdd?.userErrors ?? [];
    if (errs.length) console.error("fee order tagging failed:", errs.map((e) => e.message).join("; "));
  }

  if (config.autoFulfillFees) {
    try {
      await fulfillFeeLines(admin, order.admin_graphql_api_id, m.feeVariantIds);
    } catch (e) {
      console.error("fee auto-fulfil failed:", e instanceof Error ? e.message : e);
    }
  }
  return tags;
}

/**
 * Handles an orders/create delivery: records the order (feeds the Free-plan
 * monthly cap), hands it to integrations at most once, then tags and fulfils.
 */
export async function handleOrderWebhook(shop: string, order: OrderPayload, admin: AdminClient | undefined) {
  console.log(`[orders/create] ${shop} ${order.name ?? order.admin_graphql_api_id}: received`);
  const m = matchFees(order, await listRules(shop));
  if (m.hit.size === 0) {
    console.log(`[orders/create] ${order.name}: no fee lines, skipped`);
    return;
  }

  await prisma.feeOrderUsage.upsert({
    where: { orderId: order.admin_graphql_api_id },
    create: usageRow(shop, order, m),
    update: {},
  });

  // Shopify retries deliveries, and the catch-up may have recorded this order
  // first; the claim keeps integrations (invoices) from receiving it twice.
  const claim = await prisma.feeOrderUsage.updateMany({
    where: { orderId: order.admin_graphql_api_id, dispatchedAt: null },
    data: { dispatchedAt: new Date() },
  });
  if (claim.count === 1) await dispatchFeeOrder({ shop, raw: rawOrder(order, m), order: feeSummary(order, m) });

  const tags = admin ? await applyOrderChores(admin, shop, order, m) : [];
  console.log(`[orders/create] ${order.name}: ${m.hit.size} fee(s) recorded, tags [${tags.join(", ")}]${admin ? "" : ", no admin session"}`);
}

function rawOrder(order: OrderPayload, m: FeeMatch) {
  const taxIdExt = order.localization_extensions?.find((x) => (x.purpose ?? "").toLowerCase() === "tax" || (x.key ?? "").toLowerCase().includes("tax"))?.value ?? null;
  return {
    numericId: String(order.id ?? order.admin_graphql_api_id.split("/").pop()),
    test: Boolean(order.test),
    currency: order.currency ?? "",
    taxesIncluded: Boolean(order.taxes_included),
    totalPrice: Number(order.total_price ?? 0),
    email: order.email ?? order.contact_email ?? "",
    customerName: [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" "),
    companyTaxId: taxIdExt,
    billingAddress: order.billing_address
      ? {
          name: order.billing_address.name ?? "",
          company: order.billing_address.company ?? "",
          address1: order.billing_address.address1 ?? "",
          address2: order.billing_address.address2 ?? "",
          zip: order.billing_address.zip ?? "",
          city: order.billing_address.city ?? "",
          countryCode: order.billing_address.country_code ?? "",
        }
      : null,
    noteAttributes: order.note_attributes ?? [],
    lineItems: (order.line_items ?? []).map((li) => ({
      title: [li.title, li.variant_title].filter(Boolean).join(" – "),
      sku: li.sku ?? "",
      quantity: li.quantity ?? 1,
      price: Number(li.price ?? 0),
      totalDiscount: Number(li.total_discount ?? 0),
      taxRate: firstRate(li.tax_lines),
      feeRuleId: m.ruleFor(li)?.id ?? null,
    })),
    shippingLines: (order.shipping_lines ?? []).map((sh) => ({
      title: sh.title ?? "Shipping",
      price: Number(sh.price ?? 0),
      taxRate: firstRate(sh.tax_lines),
    })),
  };
}

/** Marks fee line items fulfilled so they never sit as "unfulfilled" on the order. */
async function fulfillFeeLines(admin: AdminClient, orderId: string, feeVariantIds: Set<string>) {
  const res = await admin.graphql(FEE_FULFILLMENT_ORDERS, { variables: { id: orderId } });
  const body = (await res.json()) as {
    data?: {
      order?: {
        fulfillmentOrders: {
          nodes: Array<{
            id: string;
            status: string;
            lineItems: { nodes: Array<{ id: string; remainingQuantity: number; lineItem: { variant: { id: string } | null } }> };
          }>;
        };
      };
    };
  };
  const groups = (body.data?.order?.fulfillmentOrders.nodes ?? [])
    .filter((fo) => fo.status === "OPEN" || fo.status === "IN_PROGRESS")
    .map((fo) => ({
      fulfillmentOrderId: fo.id,
      fulfillmentOrderLineItems: fo.lineItems.nodes
        .filter((li) => li.remainingQuantity > 0 && li.lineItem.variant && feeVariantIds.has(li.lineItem.variant.id))
        .map((li) => ({ id: li.id, quantity: li.remainingQuantity })),
    }))
    .filter((g) => g.fulfillmentOrderLineItems.length > 0);
  if (groups.length === 0) return;

  const out = await admin.graphql(FULFILL_FEE_LINES, {
    variables: { fulfillment: { lineItemsByFulfillmentOrder: groups, notifyCustomer: false } },
  });
  const ob = (await out.json()) as { data?: { fulfillmentCreate?: { userErrors?: Array<{ message: string }> } } };
  const errs = ob.data?.fulfillmentCreate?.userErrors ?? [];
  if (errs.length) throw new Error(errs.map((e) => e.message).join("; "));
}

/* ---------------------------------------------------------- missed-order catch-up */

/** Webhooks aren't guaranteed, so recent orders are checked against what was recorded. */
const CATCH_UP_EVERY_MS = 15 * 60 * 1000;
const CATCH_UP_FIRST_RUN_MS = 60 * 1000;
/** Leaves time for the webhook, which carries the full order, to arrive first. */
const CATCH_UP_GRACE_MS = 10 * 60 * 1000;
const CATCH_UP_DEFAULT_DAYS = 3;

async function gqlData<T>(admin: AdminClient, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await admin.graphql(query, { variables });
  const body = (await res.json()) as { data?: T; errors?: unknown };
  if (!body.data) throw new Error(`Order lookup failed: ${JSON.stringify(body.errors ?? "no data")}`);
  return body.data;
}

/** The fields the fee matching and chores need, in the webhook's shape. */
function toOrderPayload(o: {
  id: string;
  name: string;
  createdAt: string;
  currencyCode: string;
  lineItems: {
    nodes: Array<{
      quantity: number;
      variant: { id: string } | null;
      customAttributes: Array<{ key: string; value: string | null }>;
      originalUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } };
    }>;
  };
}): OrderPayload {
  return {
    admin_graphql_api_id: o.id,
    name: o.name,
    created_at: o.createdAt,
    currency: o.currencyCode,
    line_items: o.lineItems.nodes.map((li) => ({
      quantity: li.quantity,
      variant_id: li.variant ? Number(li.variant.id.split("/").pop()) : null,
      properties: li.customAttributes.map((a) => ({ name: a.key, value: a.value ?? "" })),
      price_set: {
        shop_money: {
          amount: li.originalUnitPriceSet.shopMoney.amount,
          currency_code: li.originalUnitPriceSet.shopMoney.currencyCode,
        },
      },
    })),
  };
}

/**
 * Records, tags and fulfils fee orders whose webhook never arrived. Integrations
 * aren't sent to from here: invoices need order details only the webhook carries,
 * so the miss is logged where merchants see deliveries. A late webhook still sends.
 */
export async function recoverMissedOrders(shop: string, admin: AdminClient) {
  const now = Date.now();
  const end = new Date(now - CATCH_UP_GRACE_MS);
  const settings = await prisma.shopSettings.findUnique({ where: { shop } });
  const override = Number(process.env.ORDER_CATCHUP_DAYS) || 0;
  const days = override || CATCH_UP_DEFAULT_DAYS;
  const lookback = new Date(now - days * 24 * 60 * 60 * 1000);
  const start = settings?.orderCatchUpAt && !override ? settings.orderCatchUpAt : lookback;
  if (start >= end) return 0;

  const saveProgress = (at: Date) =>
    prisma.shopSettings.upsert({
      where: { shop },
      create: { shop, orderCatchUpAt: at },
      update: { orderCatchUpAt: at },
    });

  const rules = await listRules(shop);
  const query = `created_at:>='${start.toISOString()}' created_at:<='${end.toISOString()}'`;
  let after: string | null = null;
  let recovered = 0;
  do {
    const data: {
      orders: { nodes: Array<{ id: string; createdAt: string }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
    } = await gqlData(admin, ORDERS_TO_CHECK, { query, after });
    const ids = data.orders.nodes.map((n) => n.id);
    const known = await prisma.feeOrderUsage.findMany({ where: { orderId: { in: ids } }, select: { orderId: true } });
    const seen = new Set(known.map((k) => k.orderId));

    for (const node of data.orders.nodes) {
      if (seen.has(node.id)) continue;
      const { order: found } = await gqlData<{
        order: (Parameters<typeof toOrderPayload>[0] & { cancelledAt: string | null }) | null;
      }>(admin, ORDER_FEE_LINES, { id: node.id });
      if (!found || found.cancelledAt) continue;

      const order = toOrderPayload(found);
      const m = matchFees(order, rules);
      if (m.hit.size === 0) continue;

      try {
        // No dispatchedAt: a webhook that turns up later may still send it.
        await prisma.feeOrderUsage.create({ data: usageRow(shop, order, m) });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") continue; // the webhook got there first
        throw e;
      }
      await logUndeliveredFeeOrder(shop, feeSummary(order, m));
      const tags = await applyOrderChores(admin, shop, order, m);
      recovered += 1;
      console.log(`[order-catchup] ${shop} ${order.name}: recovered ${m.hit.size} fee(s), tags [${tags.join(", ")}]`);
    }

    // Oldest first, so a failed run resumes from the last finished page.
    const last = data.orders.nodes.at(-1);
    if (last && !override) await saveProgress(new Date(last.createdAt));
    after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (after);

  if (!override) await saveProgress(end);
  return recovered;
}

async function runCatchUp() {
  const sessions = await prisma.session.findMany({
    where: { isOnline: false },
    distinct: ["shop"],
    select: { shop: true },
  });
  for (const { shop } of sessions) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      await recoverMissedOrders(shop, admin);
    } catch (e) {
      // Progress isn't saved past the failure, so the next run retries it.
      console.error(`[order-catchup] ${shop} failed:`, e instanceof Error ? e.message : e);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __feeOrderCatchUp: { first: NodeJS.Timeout; every: NodeJS.Timeout } | undefined;
}

/** Starts the periodic catch-up once per server process. */
export function startOrderCatchUp() {
  // Dev reloads re-run this module; keep one schedule running the latest code.
  if (global.__feeOrderCatchUp) {
    clearTimeout(global.__feeOrderCatchUp.first);
    clearInterval(global.__feeOrderCatchUp.every);
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runCatchUp();
    } catch (e) {
      console.error("[order-catchup] run failed:", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };
  global.__feeOrderCatchUp = {
    first: setTimeout(tick, CATCH_UP_FIRST_RUN_MS),
    every: setInterval(tick, CATCH_UP_EVERY_MS),
  };
}
