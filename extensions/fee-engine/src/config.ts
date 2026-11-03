/**
 * Shape of the JSON stored in the cart transform's `$app.rules` metafield.
 * Written by app/lib/fee-engine.server.ts; keep the two in sync.
 */
export interface FeeRuleConfig {
  id: string;
  name: string;
  type: "FIXED" | "PERCENTAGE";
  /** Shop-currency amount for FIXED, percent (e.g. 2.5) for PERCENTAGE. */
  amount: number;
  scope: "PRODUCT" | "CART";
  /** PRODUCT scope only: repeat for every unit, or once per matching line. */
  frequency?: "PER_UNIT" | "PER_LINE";
  requirement: "OPTIONAL" | "REQUIRED";
  /**
   * OPTIONAL fees only. OPT_OUT (default) applies unless the buyer declines it
   * (`_declined_fees`); OPT_IN applies only once the buyer selects it
   * (`_selected_fees`).
   */
  selection?: "OPT_OUT" | "OPT_IN";
  channels: Array<"ONLINE_STORE" | "POS" | "DRAFT_ORDER">;
  /**
   * Changes whenever the merchant saves the rule. Stamped on fee lines as
   * `_fee_version` so a buyer's acceptance of a required fee only counts for
   * the version they accepted.
   */
  version?: string;
  /** Hidden fee variant this rule's charge is attached to. */
  variantId: string;
  /** Caps on each computed charge, shop currency. */
  minCharge?: number;
  maxCharge?: number;
  /** How product/collection rules combine. Default ALL_PRODUCTS. */
  matchMode?: "ALL_PRODUCTS" | "ANY" | "ALL";
  schedule?: {
    weekdays?: number[]; // 0 = Sunday
    startDate?: string; // YYYY-MM-DD, shop-local
    endDate?: string;
  };
  countryMode?: "ALL" | "ONLY" | "EXCEPT";
  marketHandles?: string[];
  /** Short note surfaced in checkout under the fee. */
  note?: string;
  /** Longer plain-text details surfaced under the note. */
  details?: string;
  conditions: {
    productIds?: string[];
    collectionIds?: string[];
    minSubtotal?: number;
    maxSubtotal?: number;
    minQuantity?: number;
    maxWeightGrams?: number;
    countries?: string[];
    customerTags?: string[];
  };
}

export interface FeeEngineConfig {
  version: 1;
  rules: FeeRuleConfig[];
}

export function parseConfig(value: unknown): FeeEngineConfig | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<FeeEngineConfig>;
  if (!Array.isArray(v.rules)) return null;
  return { version: 1, rules: v.rules.filter((r) => r && r.variantId) };
}
