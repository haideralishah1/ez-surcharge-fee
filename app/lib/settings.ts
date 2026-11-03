/** Client-safe settings constants; server I/O lives in settings.server.ts. */

/** Buyer-facing strings the checkout extension and guard function render. */
export const CHECKOUT_TEXT_KEYS = [
  "heading",
  "remove",
  "addBack",
  "feeRemoved",
  "required",
  "accept",
  "missingRequired",
] as const;
export type CheckoutTextKey = (typeof CHECKOUT_TEXT_KEYS)[number];
export type CheckoutText = Record<CheckoutTextKey, string>;

export const DEFAULT_TEXT: CheckoutText = {
  heading: "Fees",
  remove: "Remove",
  addBack: "Add back",
  feeRemoved: "Fee removed",
  required: "Required",
  accept: "I accept the {fee} ({price})",
  missingRequired: "Please go back to your cart and accept the {fee} to continue.",
};

export const TEXT_LABELS: Record<CheckoutTextKey, { label: string; hint?: string }> = {
  heading: { label: "Fees block heading" },
  remove: { label: "Remove link" },
  addBack: { label: "Add back link" },
  feeRemoved: { label: "Removed fee placeholder" },
  required: { label: "Required badge" },
  accept: { label: "Acceptance checkbox", hint: "Use {fee} and {price}." },
  missingRequired: { label: "Blocked-checkout message", hint: "Use {fee}." },
};

export const SORT_ORDERS = ["CART", "NAME", "AMOUNT"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
