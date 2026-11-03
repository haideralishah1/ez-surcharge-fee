export function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

export function formatFee(
  type: string,
  amount: number,
  currencyCode: string,
): string {
  return type === "PERCENTAGE"
    ? `${amount}%`
    : formatMoney(amount, currencyCode);
}

export const SCOPE_LABEL: Record<string, string> = {
  PRODUCT: "Product fee",
  CART: "Order fee",
};

export const FREQUENCY_LABEL: Record<string, string> = {
  PER_UNIT: "every unit",
  PER_LINE: "once per product",
};

export const CHANNEL_LABEL: Record<string, string> = {
  ONLINE_STORE: "Online Store",
  POS: "POS",
  DRAFT_ORDER: "Draft orders",
};

export const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/** Short human summary of how a rule charges, for lists and previews. */
export function describeCharge(rule: {
  type: string;
  amount: number;
  scope: string;
  frequency: string;
}, currencyCode: string): string {
  const amt = formatFee(rule.type, rule.amount, currencyCode);
  if (rule.scope === "CART") return `${amt} once per order`;
  return `${amt} ${FREQUENCY_LABEL[rule.frequency] ?? "every unit"}`;
}
