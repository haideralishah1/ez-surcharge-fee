import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { listRules } from "./fee-rules.server";
import { cartTransformRun } from "../../extensions/fee-engine/src/cart_transform_run";
import type { CartTransformRunInput } from "../../extensions/fee-engine/generated/api";
import type { FeeRuleConfig } from "../../extensions/fee-engine/src/config";

/**
 * Read-only surcharge quotes for POS / third parties. A credential is bound to
 * one shop, stored hashed, and can only call POST /api/quote. The quote runs
 * the real cart-transform function code against live rules, so it matches
 * checkout exactly.
 */

const TOKEN_PREFIX = "fq_";
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createCredential(shop: string, name: string) {
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
  const row = await prisma.apiCredential.create({
    data: { shop, name: name || "Flip POS", tokenHash: hash(token), prefix: token.slice(0, 10) },
  });
  return { id: row.id, token };
}

export async function revokeCredential(shop: string, id: string) {
  await prisma.apiCredential.updateMany({ where: { id, shop, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function listCredentials(shop: string) {
  const rows = await prisma.apiCredential.findMany({ where: { shop }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    revoked: Boolean(r.revokedAt),
  }));
}

/** Resolves a bearer token to its shop, or null. */
export async function authenticateCredential(token: string | null): Promise<string | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const h = hash(token);
  const row = await prisma.apiCredential.findFirst({ where: { prefix: token.slice(0, 10), revokedAt: null } });
  if (!row) return null;
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(h);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  await prisma.apiCredential.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return row.shop;
}

export interface QuoteRequest {
  lines: Array<{ variantId: string; quantity: number; unitPrice?: number }>;
  countryCode?: string;
  marketHandle?: string;
  customerTags?: string[];
  channel?: "POS" | "ONLINE_STORE";
  declinedFeeIds?: string[];
  /** Opt-in optional fees the buyer selected. */
  selectedFeeIds?: string[];
}

export interface QuoteResponse {
  currency: string;
  fees: Array<{ ruleId: string; name: string; amount: number; required: boolean; note?: string }>;
  feeTotal: number;
}

const GRAMS: Record<string, number> = { GRAMS: 1, KILOGRAMS: 1000, OUNCES: 28.349523125, POUNDS: 453.59237 };

const VARIANTS = `#graphql
  query QuoteVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        price
        product { id collections(first: 50) { nodes { id } } }
        inventoryItem { measurement { weight { value unit } } }
      }
    }
  }
`;

const SHOP = `#graphql
  query QuoteShop { shop { currencyCode ianaTimezone } }
`;

export async function quoteFees(shop: string, req: QuoteRequest): Promise<QuoteResponse> {
  const { admin } = await unauthenticated.admin(shop);
  const rules = (await listRules(shop)).filter((r) => r.active && r.variantId);
  const [varRes, shopRes] = await Promise.all([
    admin.graphql(VARIANTS, { variables: { ids: req.lines.map((l) => l.variantId) } }),
    admin.graphql(SHOP),
  ]);
  const varBody = (await varRes.json()) as {
    data?: {
      nodes: Array<{
        id: string;
        price: string;
        product: { id: string; collections: { nodes: Array<{ id: string }> } };
        inventoryItem?: { measurement?: { weight?: { value: number; unit: string } | null } | null } | null;
      } | null>;
    };
  };
  const shopBody = (await shopRes.json()) as { data?: { shop: { currencyCode: string; ianaTimezone: string } } };
  const currency = shopBody.data?.shop.currencyCode ?? "USD";
  const tz = shopBody.data?.shop.ianaTimezone ?? "UTC";
  const byId = new Map((varBody.data?.nodes ?? []).filter(Boolean).map((n) => [n!.id, n!]));

  const config: { version: 1; rules: FeeRuleConfig[] } = {
    version: 1,
    rules: rules.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      amount: r.amount,
      scope: r.scope,
      frequency: r.frequency,
      requirement: r.requirement,
      selection: r.requirement === "OPTIONAL" ? r.selection : undefined,
      channels: r.channels,
      variantId: r.variantId!,
      minCharge: r.minCharge,
      maxCharge: r.maxCharge,
      matchMode: r.matchMode,
      schedule: r.scheduleEnabled ? { weekdays: r.weekdays, startDate: r.startDate, endDate: r.endDate } : undefined,
      countryMode: r.countryMode,
      marketHandles: r.marketHandles,
      note: r.shopperNote || undefined,
      conditions: r.conditions,
    })),
  };
  const allCollections = new Set(rules.flatMap((r) => r.conditions.collectionIds ?? []));
  const tagSet = new Set(req.customerTags ?? []);
  const allTags = Array.from(new Set(rules.flatMap((r) => r.conditions.customerTags ?? [])));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD in shop time

  const input: CartTransformRunInput = {
    presentmentCurrencyRate: "1.0",
    cartTransform: { metafield: { jsonValue: config } },
    localization: { country: { isoCode: (req.countryCode ?? "US").toUpperCase() as never }, market: { handle: req.marketHandle ?? "" } },
    shop: { localTime: { date: today } },
    cart: {
      declinedFees: req.declinedFeeIds?.length ? { value: req.declinedFeeIds.join(",") } : null,
      selectedFees: req.selectedFeeIds?.length ? { value: req.selectedFeeIds.join(",") } : null,
      retailLocation: (req.channel ?? "POS") === "POS" ? { id: "gid://shopify/Location/0" } : null,
      buyerIdentity: {
        customer: allTags.length ? { hasTags: allTags.map((t) => ({ tag: t, hasTag: tagSet.has(t) })) } : null,
        purchasingCompany: null,
      },
      lines: req.lines.map((l, i) => {
        const v = byId.get(l.variantId);
        const w = v?.inventoryItem?.measurement?.weight ?? null;
        return {
          id: `gid://shopify/CartLine/${i + 1}`,
          quantity: l.quantity,
          cost: { amountPerQuantity: { amount: String(l.unitPrice ?? Number(v?.price ?? 0)) } },
          merchandise: {
            __typename: "ProductVariant" as const,
            id: l.variantId,
            weight: w ? w.value * (GRAMS[w.unit] ?? 1) : null,
            weightUnit: "GRAMS" as never,
            product: {
              id: v?.product.id ?? "",
              inCollections: Array.from(allCollections).map((id) => ({
                collectionId: id,
                isMember: Boolean(v?.product.collections.nodes.some((c) => c.id === id)),
              })),
            },
          },
        };
      }),
    },
  };

  const result = cartTransformRun(input);
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const totals = new Map<string, number>();
  for (const op of result.operations) {
    const exp = op.lineExpand;
    if (!exp) continue;
    const line = input.cart.lines.find((l) => l.id === exp.cartLineId);
    const qty = line?.quantity ?? 1;
    for (const item of exp.expandedCartItems) {
      const ruleId = item.attributes?.find((a) => a.key === "_fee_rule")?.value;
      if (!ruleId) continue;
      const unit = Number(item.price?.adjustment?.fixedPricePerUnit?.amount ?? 0);
      totals.set(ruleId, Math.round(((totals.get(ruleId) ?? 0) + unit * qty) * 100) / 100);
    }
  }
  const fees = Array.from(totals.entries()).map(([ruleId, amount]) => {
    const r = ruleById.get(ruleId)!;
    return { ruleId, name: r.name, amount, required: r.requirement === "REQUIRED", note: r.shopperNote || undefined };
  });
  return { currency, fees, feeTotal: Math.round(fees.reduce((s, f) => s + f.amount, 0) * 100) / 100 };
}
