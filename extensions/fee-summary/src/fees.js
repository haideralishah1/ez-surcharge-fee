/**
 * Fee lines are bundle components the fee-engine cart transform injects, each
 * tagged with `_fee_rule` (rule id) and `_fee_required` ("1" | "0") attributes.
 * The same rule can appear on several lines (per-unit fees), so amounts are
 * summed per rule.
 */
export function collectFees(lines) {
  const byRule = new Map();
  for (const line of lines ?? []) {
    for (const component of line.lineComponents ?? []) {
      const attrs = Object.fromEntries(
        (component.attributes ?? []).map((a) => [a.key, a.value]),
      );
      const ruleId = attrs._fee_rule;
      if (!ruleId) continue;
      const amount = Number(component.cost?.totalAmount?.amount ?? 0);
      const existing = byRule.get(ruleId);
      if (existing) {
        existing.amount += amount;
        continue;
      }
      byRule.set(ruleId, {
        ruleId,
        title:
          component.merchandise?.product?.title ??
          component.merchandise?.title ??
          "Fee",
        required: attrs._fee_required === "1",
        version: attrs._fee_version || "",
        note: attrs._fee_note || "",
        details: attrs._fee_details || "",
        amount,
      });
    }
  }
  return Array.from(byRule.values());
}

/**
 * `_accepted_fees` entry for a required fee. Tied to the fee's version so an
 * old acceptance stops counting once the merchant edits the fee; must match
 * the token the fee-guard function checks.
 */
export const acceptToken = (ruleId, version) => (version ? `${ruleId}@${version}` : ruleId);

/** `accepted` with any token for `ruleId` removed (old versions included). */
export const withoutRule = (accepted, ruleId) =>
  accepted.filter((t) => t !== ruleId && !t.startsWith(`${ruleId}@`));

export const parseList = (raw) =>
  String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const serializeList = (ids) => Array.from(new Set(ids)).join(",");

const DEFAULT_TEXT = {
  heading: "Fees",
  remove: "Remove",
  addBack: "Add back",
  feeRemoved: "Fee removed",
  addFee: "Add {fee}",
  required: "Required",
  accept: "I accept the {fee} ({price})",
  missingRequired: "Please go back to your cart and accept the {fee} to continue.",
};

/** Merchant settings from the `$app.checkout-settings` shop metafield, with defaults. */
export function readSettings(appMetafields) {
  const entry = (appMetafields ?? []).find(
    (m) => m.target?.type === "shop" && m.metafield?.key === "checkout-settings",
  );
  let parsed = {};
  try {
    parsed = entry ? JSON.parse(entry.metafield.value) : {};
  } catch {
    parsed = {};
  }
  return {
    showFeesBlock: parsed.showFeesBlock !== false,
    showAcceptance: parsed.showAcceptance !== false,
    sortOrder: parsed.sortOrder || "CART",
    text: { ...DEFAULT_TEXT, ...(parsed.text || {}) },
    translations: parsed.translations || {},
  };
}

/**
 * Optional fees from the `$app.optional-fees` shop metafield (written by the
 * app on every rule sync), keyed by rule id.
 */
export function readOptionalFees(appMetafields) {
  const entry = (appMetafields ?? []).find(
    (m) => m.target?.type === "shop" && m.metafield?.key === "optional-fees",
  );
  let parsed = [];
  try {
    parsed = entry ? JSON.parse(entry.metafield.value) : [];
  } catch {
    parsed = [];
  }
  return new Map((Array.isArray(parsed) ? parsed : []).map((f) => [f.id, f]));
}

/** Whether the buyer can tick/untick this optional fee in checkout. */
export const choosableInCheckout = (option) =>
  !option || option.placement !== "CART";

/**
 * The cart attributes that make an optional fee applied (`on`) or not.
 * Opt-in fees are tracked in `_selected_fees`, opt-out fees in `_declined_fees`.
 */
export function toggleFee(ruleId, on, option, selected, declined) {
  const without = (xs) => xs.filter((id) => id !== ruleId);
  const optIn = option?.selection === "OPT_IN";
  return {
    _selected_fees: optIn ? (on ? [...without(selected), ruleId] : without(selected)) : selected,
    _declined_fees: on ? without(declined) : optIn ? declined : [...without(declined), ruleId],
  };
}

/** Text for the buyer's language, falling back per key to the default text. */
export function textFor(settings, isoCode) {
  const code = String(isoCode || "").toLowerCase().replace("_", "-");
  const base = code.split("-")[0];
  const t = settings.translations[code] || settings.translations[base] || {};
  return { ...settings.text, ...t };
}

export const fill = (template, vars) =>
  String(template).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));

export function sortFees(fees, order) {
  const copy = [...fees];
  if (order === "NAME") copy.sort((a, b) => a.title.localeCompare(b.title));
  if (order === "AMOUNT") copy.sort((a, b) => b.amount - a.amount);
  return copy;
}
