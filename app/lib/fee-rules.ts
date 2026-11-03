import { hasFeature, type Plan } from "./plans";
import { DEFAULT_ICON, FEE_ICONS } from "./icons";

export const FEE_TYPES = ["FIXED", "PERCENTAGE"] as const;
export const SCOPES = ["PRODUCT", "CART"] as const;
export const FREQUENCIES = ["PER_UNIT", "PER_LINE"] as const;
export const REQUIREMENTS = ["OPTIONAL", "REQUIRED"] as const;
export const SELECTIONS = ["OPT_OUT", "OPT_IN"] as const;
export const PLACEMENTS = ["CART", "CHECKOUT", "BOTH"] as const;
export const CHANNELS = ["ONLINE_STORE", "POS", "DRAFT_ORDER"] as const;
export const MATCH_MODES = ["ALL_PRODUCTS", "ANY", "ALL"] as const;
export const COUNTRY_MODES = ["ALL", "ONLY", "EXCEPT"] as const;

export type FeeType = (typeof FEE_TYPES)[number];
export type Scope = (typeof SCOPES)[number];
export type Frequency = (typeof FREQUENCIES)[number];
export type Requirement = (typeof REQUIREMENTS)[number];
export type Selection = (typeof SELECTIONS)[number];
export type Placement = (typeof PLACEMENTS)[number];
export type Channel = (typeof CHANNELS)[number];
export type MatchMode = (typeof MATCH_MODES)[number];
export type CountryMode = (typeof COUNTRY_MODES)[number];

/** All present conditions must match (AND). Empty/undefined means "no restriction". */
export interface Conditions {
  productIds?: string[];
  productLabels?: Record<string, string>;
  collectionIds?: string[];
  collectionLabels?: Record<string, string>;
  minSubtotal?: number;
  maxSubtotal?: number;
  minQuantity?: number;
  maxWeightGrams?: number;
  countries?: string[]; // ISO 3166-1 alpha-2, interpreted via countryMode
  customerTags?: string[];
}

export interface FeeRuleInput {
  name: string;
  description: string;
  active: boolean;
  type: FeeType;
  amount: number;
  scope: Scope;
  frequency: Frequency;
  requirement: Requirement;
  /** OPTIONAL fees: added by default (buyer unticks) or opt-in (buyer ticks). */
  selection: Selection;
  /** OPTIONAL fees: where the buyer gets the checkbox. */
  placement: Placement;
  channels: Channel[];
  conditions: Conditions;
  icon: string;
  minCharge?: number;
  maxCharge?: number;
  taxable: boolean;
  matchMode: MatchMode;
  scheduleEnabled: boolean;
  weekdays: number[];
  startDate?: string;
  endDate?: string;
  countryMode: CountryMode;
  marketHandles: string[];
  shopperNote: string;
  details: string;
  orderTag: string;
  barcode: string;
}

const list = (v: FormDataEntryValue | null): string[] =>
  String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Display names captured from the resource picker, kept only for ids still selected. */
const labels = (v: FormDataEntryValue | null, ids: string[]) => {
  try {
    const all = JSON.parse(String(v ?? "{}")) as Record<string, string>;
    return Object.fromEntries(ids.filter((id) => all[id]).map((id) => [id, all[id]]));
  } catch {
    return {};
  }
};

const num = (v: FormDataEntryValue | null): number | undefined => {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const oneOf = <T extends string>(v: FormDataEntryValue | null, allowed: readonly T[]): T | null => {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FieldErrors = Partial<Record<string, string>>;

/** Parses and validates a submitted form, enforcing plan gating server-side. */
export function parseFeeRuleForm(
  form: FormData,
  plan: Plan,
): { value?: FeeRuleInput; errors?: FieldErrors } {
  const errors: FieldErrors = {};

  const name = String(form.get("name") ?? "").trim();
  if (!name) errors.name = "Enter a name.";

  const type = oneOf(form.get("type"), FEE_TYPES);
  if (!type) errors.type = "Choose a fee type.";

  const amount = num(form.get("amount"));
  if (amount === undefined || Number.isNaN(amount) || amount <= 0) {
    errors.amount = "Enter an amount greater than 0.";
  } else if (type === "PERCENTAGE" && amount > 100) {
    errors.amount = "A percentage fee can't exceed 100.";
  }

  const scope = oneOf(form.get("scope"), SCOPES);
  if (!scope) errors.scope = "Choose what the fee applies to.";
  const frequency = oneOf(form.get("frequency"), FREQUENCIES) ?? "PER_UNIT";

  const requirement = oneOf(form.get("requirement"), REQUIREMENTS);
  if (!requirement) {
    errors.requirement = "Choose whether buyers can decline.";
  } else if (requirement === "REQUIRED" && !hasFeature(plan, "requiredFees")) {
    errors.requirement = "Required fees need the Pro plan.";
  }

  const selection = oneOf(form.get("selection"), SELECTIONS) ?? "OPT_OUT";
  const placement = oneOf(form.get("placement"), PLACEMENTS) ?? "BOTH";

  const channels = form
    .getAll("channels")
    .map(String)
    .filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c));
  if (channels.length === 0) errors.channels = "Select at least one channel.";
  if (channels.includes("POS") && !hasFeature(plan, "channelPos")) {
    errors.channels = "POS fees need the Pro plan.";
  }
  if (channels.includes("DRAFT_ORDER") && !hasFeature(plan, "channelDraftOrder")) {
    errors.channels = "Draft order fees need the Pro plan.";
  }

  const icon = FEE_ICONS.some((i) => i.key === form.get("icon"))
    ? String(form.get("icon"))
    : DEFAULT_ICON;

  const minCharge = num(form.get("minCharge"));
  const maxCharge = num(form.get("maxCharge"));
  if (minCharge !== undefined && (Number.isNaN(minCharge) || minCharge < 0)) {
    errors.minCharge = "Enter a valid amount.";
  }
  if (maxCharge !== undefined && (Number.isNaN(maxCharge) || maxCharge < 0)) {
    errors.maxCharge = "Enter a valid amount.";
  }
  if (
    minCharge !== undefined && maxCharge !== undefined &&
    !Number.isNaN(minCharge) && !Number.isNaN(maxCharge) && minCharge > maxCharge
  ) {
    errors.maxCharge = "Maximum must be at least the minimum.";
  }

  const matchMode = oneOf(form.get("matchMode"), MATCH_MODES) ?? "ALL_PRODUCTS";

  const conditions: Conditions = {};
  const productIds = matchMode === "ALL_PRODUCTS" ? [] : list(form.get("productIds"));
  if (productIds.length) {
    conditions.productIds = productIds;
    conditions.productLabels = labels(form.get("productLabels"), productIds);
  }
  const collectionIds = matchMode === "ALL_PRODUCTS" ? [] : list(form.get("collectionIds"));
  if (collectionIds.length) {
    conditions.collectionIds = collectionIds;
    conditions.collectionLabels = labels(form.get("collectionLabels"), collectionIds);
  }
  if (matchMode !== "ALL_PRODUCTS" && productIds.length === 0 && collectionIds.length === 0) {
    errors.matchMode = "Choose at least one product or collection, or switch to all products.";
  }

  for (const key of ["minSubtotal", "maxSubtotal", "minQuantity", "maxWeightGrams"] as const) {
    const n = num(form.get(key));
    if (n === undefined) continue;
    if (Number.isNaN(n) || n < 0) errors[key] = "Enter a valid number.";
    else conditions[key] = n;
  }
  if (
    conditions.minSubtotal !== undefined &&
    conditions.maxSubtotal !== undefined &&
    conditions.minSubtotal > conditions.maxSubtotal
  ) {
    errors.maxSubtotal = "Maximum must be at least the minimum.";
  }

  const countryMode = oneOf(form.get("countryMode"), COUNTRY_MODES) ?? "ALL";
  const countries = list(form.get("countries")).map((c) => c.toUpperCase());
  if (countries.some((c) => !/^[A-Z]{2}$/.test(c))) {
    errors.countries = "Use 2-letter country codes, e.g. US, CA.";
  } else if (countryMode !== "ALL") {
    if (countries.length === 0) errors.countries = "Add at least one country.";
    else conditions.countries = countries;
  }

  const marketHandles = list(form.get("marketHandles")).map((m) => m.toLowerCase());
  if (marketHandles.length && !hasFeature(plan, "markets")) {
    errors.marketHandles = "Market targeting needs the Pro plan.";
  }

  const customerTags = list(form.get("customerTags"));
  if (customerTags.length) {
    if (!hasFeature(plan, "customerTags")) {
      errors.customerTags = "Customer tag rules need the Plus plan.";
    } else {
      conditions.customerTags = customerTags;
    }
  }

  const scheduleEnabled = form.get("scheduleEnabled") === "true";
  const weekdays = form
    .getAll("weekdays")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const startDate = String(form.get("startDate") ?? "").trim() || undefined;
  const endDate = String(form.get("endDate") ?? "").trim() || undefined;
  if (scheduleEnabled) {
    if (startDate && !ISO_DATE.test(startDate)) errors.startDate = "Use YYYY-MM-DD.";
    if (endDate && !ISO_DATE.test(endDate)) errors.endDate = "Use YYYY-MM-DD.";
    if (startDate && endDate && startDate > endDate) errors.endDate = "End must be after start.";
    if (weekdays.length === 0 && !startDate && !endDate) {
      errors.scheduleEnabled = "Pick weekdays or a date range, or turn the schedule off.";
    }
  }

  if (Object.keys(errors).length) return { errors };

  return {
    value: {
      name,
      description: String(form.get("description") ?? "").trim(),
      active: form.get("active") === "true",
      type: type!,
      amount: amount as number,
      scope: scope!,
      frequency,
      requirement: requirement!,
      selection: requirement === "OPTIONAL" ? selection : "OPT_OUT",
      placement,
      channels,
      conditions,
      icon,
      minCharge: type === "PERCENTAGE" ? minCharge : undefined,
      maxCharge: type === "PERCENTAGE" ? maxCharge : undefined,
      taxable: form.get("taxable") === "true",
      matchMode,
      scheduleEnabled,
      weekdays: scheduleEnabled ? weekdays : [],
      startDate: scheduleEnabled ? startDate : undefined,
      endDate: scheduleEnabled ? endDate : undefined,
      countryMode: conditions.countries ? countryMode : "ALL",
      marketHandles,
      shopperNote: String(form.get("shopperNote") ?? "").trim().slice(0, 140),
      details: String(form.get("details") ?? "").trim().slice(0, 500),
      orderTag: String(form.get("orderTag") ?? "").trim().slice(0, 40),
      barcode: String(form.get("barcode") ?? "").trim().slice(0, 64),
    },
  };
}

/** Prisma row -> typed rule (enum strings narrowed, JSON columns decoded). */
export function decodeRule<
  T extends {
    type: string;
    scope: string;
    frequency: string;
    requirement: string;
    selection: string;
    placement: string;
    channels: string;
    conditions: string;
    matchMode: string;
    countryMode: string;
    weekdays: string;
    marketHandles: string;
    minCharge: number | null;
    maxCharge: number | null;
    startDate: string | null;
    endDate: string | null;
  },
>(row: T) {
  return {
    ...row,
    type: row.type as FeeType,
    scope: row.scope as Scope,
    frequency: row.frequency as Frequency,
    requirement: row.requirement as Requirement,
    selection: row.selection as Selection,
    placement: row.placement as Placement,
    channels: JSON.parse(row.channels) as Channel[],
    conditions: JSON.parse(row.conditions) as Conditions,
    matchMode: row.matchMode as MatchMode,
    countryMode: row.countryMode as CountryMode,
    weekdays: JSON.parse(row.weekdays) as number[],
    marketHandles: JSON.parse(row.marketHandles) as string[],
    minCharge: row.minCharge ?? undefined,
    maxCharge: row.maxCharge ?? undefined,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
  };
}

export function formatAmount(type: string, amount: number): string {
  return type === "PERCENTAGE" ? `${amount}%` : amount.toFixed(2);
}
