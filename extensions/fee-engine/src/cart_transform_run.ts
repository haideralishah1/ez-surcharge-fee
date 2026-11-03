import type {
  CartTransformRunInput,
  CartTransformRunResult,
  ExpandedItem,
  Operation,
} from "../generated/api";
import { parseConfig, type FeeRuleConfig } from "./config";

const NO_CHANGES: CartTransformRunResult = { operations: [] };

type Line = CartTransformRunInput["cart"]["lines"][number];

interface VariantLine {
  line: Line;
  variantId: string;
  productId: string;
  unitPrice: number;
  /** Per-unit weight in grams (0 when the variant has no weight). */
  grams: number;
  collectionIds: Set<string>;
}

/** Everything a rule's conditions can be checked against. */
interface CartFacts {
  channel: "ONLINE_STORE" | "POS";
  /** Presentment-currency subtotal of eligible lines. */
  subtotal: number;
  quantity: number;
  grams: number;
  countryCode: string;
  marketHandle: string;
  /** Shop-local calendar date, YYYY-MM-DD, and its weekday (0 = Sunday). */
  date: string;
  weekday: number;
  customerTags: Set<string>;
  isB2B: boolean;
  /** Shop currency -> presentment currency. */
  rate: number;
}

/** Fees queued against a cart line, keyed by line id. */
type FeeQueue = Map<string, { line: VariantLine; fees: ExpandedItem[] }>;

const money = (n: number) => n.toFixed(2);

const GRAMS_PER: Record<string, number> = {
  GRAMS: 1,
  KILOGRAMS: 1000,
  OUNCES: 28.349523125,
  POUNDS: 453.59237,
};

export function cartTransformRun(
  input: CartTransformRunInput,
): CartTransformRunResult {
  const config = parseConfig(input.cartTransform.metafield?.jsonValue);
  if (!config || config.rules.length === 0) return NO_CHANGES;

  const feeVariantIds = new Set(config.rules.map((r) => r.variantId));

  // Only plain product-variant lines can carry a fee. Lines that *are* a fee
  // variant are skipped so a previously-expanded cart isn't charged twice, and
  // Shopify rejects lineExpand on subscription lines, so those can't carry one.
  const lines: VariantLine[] = [];
  for (const line of input.cart.lines) {
    const m = line.merchandise;
    if (m.__typename !== "ProductVariant") continue;
    if (feeVariantIds.has(m.id)) continue;
    if (line.sellingPlanAllocation) continue;
    lines.push({
      line,
      variantId: m.id,
      productId: m.product.id,
      unitPrice: Number(line.cost.amountPerQuantity.amount),
      grams: (m.weight ?? 0) * (GRAMS_PER[m.weightUnit] ?? 1),
      collectionIds: new Set(
        m.product.inCollections.filter((c) => c.isMember).map((c) => c.collectionId),
      ),
    });
  }
  if (lines.length === 0) return NO_CHANGES;

  const customer = input.cart.buyerIdentity?.customer;
  const date = input.shop.localTime.date;
  const facts: CartFacts = {
    channel: input.cart.retailLocation ? "POS" : "ONLINE_STORE",
    subtotal: lines.reduce((s, l) => s + l.unitPrice * l.line.quantity, 0),
    quantity: lines.reduce((s, l) => s + l.line.quantity, 0),
    grams: lines.reduce((s, l) => s + l.grams * l.line.quantity, 0),
    countryCode: input.localization.country.isoCode,
    marketHandle: input.localization.market.handle,
    date,
    weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
    customerTags: new Set(
      (customer?.hasTags ?? []).filter((t) => t.hasTag).map((t) => t.tag),
    ),
    isB2B: Boolean(input.cart.buyerIdentity?.purchasingCompany),
    rate: Number(input.presentmentCurrencyRate) || 1,
  };

  const idList = (raw: string | null | undefined) =>
    new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const declined = idList(input.cart.declinedFees?.value);
  const selected = idList(input.cart.selectedFees?.value);

  const queue: FeeQueue = new Map();
  const enqueue = (target: VariantLine, item: ExpandedItem) => {
    const entry = queue.get(target.line.id) ?? { line: target, fees: [] };
    entry.fees.push(item);
    queue.set(target.line.id, entry);
  };

  for (const rule of config.rules) {
    if (!rule.channels.includes(facts.channel)) continue;
    if (rule.requirement === "OPTIONAL") {
      if (declined.has(rule.id)) continue;
      if (rule.selection === "OPT_IN" && !selected.has(rule.id)) continue;
    }
    if (!cartMatches(rule, facts)) continue;

    const matching = lines.filter((l) => lineMatches(rule, l));
    if (matching.length === 0) continue;

    if (rule.scope === "PRODUCT") {
      for (const l of matching) {
        const qty = l.line.quantity;
        // PER_LINE charges once for the line, so spread it across the units.
        const perLine = rule.frequency === "PER_LINE";
        const base = perLine ? l.unitPrice * qty : l.unitPrice;
        const charge = feeAmount(rule, base, facts.rate);
        if (charge <= 0) continue;
        enqueue(l, feeItem(rule, perLine ? charge / qty : charge));
      }
      continue;
    }

    // CART: charge once. A component's fixedPricePerUnit is multiplied by the
    // parent line's quantity, so attach the fee to the lowest-quantity line
    // and divide by that quantity.
    const total = feeAmount(rule, facts.subtotal, facts.rate);
    if (total <= 0) continue;
    const target = lines.reduce((a, b) =>
      b.line.quantity < a.line.quantity ? b : a,
    );
    enqueue(target, feeItem(rule, total / target.line.quantity));
  }

  if (queue.size === 0) return NO_CHANGES;

  const operations: Operation[] = [];
  for (const { line, fees } of queue.values()) {
    operations.push({
      lineExpand: {
        cartLineId: line.line.id,
        expandedCartItems: [
          {
            merchandiseId: line.variantId,
            quantity: 1,
            price: {
              adjustment: {
                fixedPricePerUnit: { amount: money(line.unitPrice) },
              },
            },
          },
          ...fees,
        ],
      },
    });
  }
  return { operations };
}

/** Cart-wide conditions. Money thresholds are in shop currency, so convert first. */
function cartMatches(rule: FeeRuleConfig, f: CartFacts): boolean {
  const c = rule.conditions;
  if (c.minSubtotal !== undefined && f.subtotal < c.minSubtotal * f.rate) return false;
  if (c.maxSubtotal !== undefined && f.subtotal > c.maxSubtotal * f.rate) return false;
  if (c.minQuantity !== undefined && f.quantity < c.minQuantity) return false;
  if (c.maxWeightGrams !== undefined && f.grams > c.maxWeightGrams) return false;

  const countries = c.countries ?? [];
  const mode = rule.countryMode ?? (countries.length ? "ONLY" : "ALL");
  if (mode === "ONLY" && countries.length && !countries.includes(f.countryCode)) return false;
  if (mode === "EXCEPT" && countries.includes(f.countryCode)) return false;

  if (rule.marketHandles?.length && !rule.marketHandles.includes(f.marketHandle)) return false;

  if (c.customerTags?.length && !c.customerTags.some((t) => f.customerTags.has(t))) {
    return false;
  }

  const s = rule.schedule;
  if (s) {
    if (s.weekdays?.length && !s.weekdays.includes(f.weekday)) return false;
    if (s.startDate && f.date < s.startDate) return false;
    if (s.endDate && f.date > s.endDate) return false;
  }
  return true;
}

/**
 * Product / collection targeting.
 *  - ALL_PRODUCTS (or nothing chosen): every line qualifies.
 *  - ANY: the line matches any chosen product or collection.
 *  - ALL: the line is one of the chosen products (if any) AND in every chosen collection.
 */
function lineMatches(rule: FeeRuleConfig, l: VariantLine): boolean {
  const products = rule.conditions.productIds ?? [];
  const collections = rule.conditions.collectionIds ?? [];
  const mode = rule.matchMode ?? "ANY";
  if (mode === "ALL_PRODUCTS" || (products.length === 0 && collections.length === 0)) {
    return true;
  }
  const inProducts = products.includes(l.productId) || products.includes(l.variantId);
  if (mode === "ALL") {
    if (products.length && !inProducts) return false;
    return collections.every((id) => l.collectionIds.has(id));
  }
  return inProducts || collections.some((id) => l.collectionIds.has(id));
}

/** Fee for one charge instance, capped, rounded to cents in presentment currency. */
function feeAmount(rule: FeeRuleConfig, base: number, rate: number): number {
  let raw =
    rule.type === "PERCENTAGE" ? (base * rule.amount) / 100 : rule.amount * rate;
  if (rule.minCharge !== undefined) raw = Math.max(raw, rule.minCharge * rate);
  if (rule.maxCharge !== undefined) raw = Math.min(raw, rule.maxCharge * rate);
  return Math.round(raw * 100) / 100;
}

function feeItem(rule: FeeRuleConfig, amount: number): ExpandedItem {
  const attributes = [
    { key: "_fee_rule", value: rule.id },
    { key: "_fee_required", value: rule.requirement === "REQUIRED" ? "1" : "0" },
  ];
  if (rule.version) attributes.push({ key: "_fee_version", value: rule.version });
  if (rule.note) attributes.push({ key: "_fee_note", value: rule.note });
  if (rule.details) attributes.push({ key: "_fee_details", value: rule.details });
  return {
    merchandiseId: rule.variantId,
    quantity: 1,
    price: { adjustment: { fixedPricePerUnit: { amount: money(amount) } } },
    attributes,
  };
}
