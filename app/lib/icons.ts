/**
 * Fee icon catalog. `icon` is a Polaris icon name, `tone` colours it. The key
 * is stored on the rule and will also select the fee product's image once
 * image uploads are wired in.
 */
export type IconTone =
  | "neutral"
  | "info"
  | "success"
  | "caution"
  | "warning"
  | "critical";

export interface FeeIcon {
  key: string;
  label: string;
  icon: string;
  tone: IconTone;
  group: "General" | "Fulfilment" | "Cross-border" | "Environment" | "Services" | "Risk";
}

export const FEE_ICONS: FeeIcon[] = [
  { key: "surcharge", label: "Surcharge", icon: "transaction-fee-dollar", tone: "caution", group: "General" },
  { key: "extra-fee", label: "Extra fee", icon: "cash-dollar", tone: "success", group: "General" },
  { key: "order-fee", label: "Order fee", icon: "receipt-dollar", tone: "neutral", group: "General" },
  { key: "processing", label: "Processing", icon: "settings", tone: "info", group: "General" },
  { key: "payment", label: "Payment", icon: "payment", tone: "info", group: "General" },
  { key: "credit-card", label: "Credit card", icon: "credit-card", tone: "info", group: "General" },
  { key: "product-fee", label: "Product fee", icon: "product", tone: "neutral", group: "General" },
  { key: "cart-fee", label: "Cart fee", icon: "cart", tone: "neutral", group: "General" },
  { key: "tax", label: "Tax / levy", icon: "tax", tone: "critical", group: "General" },
  { key: "pos", label: "POS", icon: "point-of-sale", tone: "neutral", group: "General" },
  { key: "shipping", label: "Shipping", icon: "truck", tone: "info", group: "Fulfilment" },
  { key: "delivery", label: "Delivery", icon: "delivery", tone: "info", group: "Fulfilment" },
  { key: "pickup", label: "Pickup", icon: "store", tone: "success", group: "Fulfilment" },
  { key: "express", label: "Express / urgent", icon: "bolt", tone: "warning", group: "Fulfilment" },
  { key: "packaging", label: "Packaging", icon: "package", tone: "warning", group: "Fulfilment" },
  { key: "oversize", label: "Oversize", icon: "measurement-size", tone: "warning", group: "Fulfilment" },
  { key: "handling", label: "Handling", icon: "forklift", tone: "warning", group: "Fulfilment" },
  { key: "fuel", label: "Fuel", icon: "gauge", tone: "critical", group: "Fulfilment" },
  { key: "cold-chain", label: "Cold chain", icon: "inventory", tone: "info", group: "Fulfilment" },
  { key: "international", label: "International", icon: "globe", tone: "info", group: "Cross-border" },
  { key: "customs", label: "Customs", icon: "flag", tone: "warning", group: "Cross-border" },
  { key: "duties", label: "Duties", icon: "bank", tone: "warning", group: "Cross-border" },
  { key: "tariff", label: "Tariff", icon: "chart-histogram-growth", tone: "warning", group: "Cross-border" },
  { key: "import-export", label: "Import / export", icon: "airplane", tone: "info", group: "Cross-border" },
  { key: "location", label: "Location", icon: "location", tone: "critical", group: "Cross-border" },
  { key: "environmental", label: "Environmental", icon: "nature", tone: "success", group: "Environment" },
  { key: "bottle", label: "Bottle / container", icon: "measurement-volume", tone: "success", group: "Environment" },
  { key: "deposit", label: "Deposit", icon: "savings", tone: "success", group: "Environment" },
  { key: "gift", label: "Gift", icon: "gift", tone: "critical", group: "Services" },
  { key: "protection", label: "Protection", icon: "shield-check-mark", tone: "info", group: "Services" },
  { key: "service", label: "Service", icon: "wrench", tone: "neutral", group: "Services" },
  { key: "b2b", label: "B2B / wholesale", icon: "business-entity", tone: "info", group: "Services" },
  { key: "registration", label: "Registration", icon: "clipboard-check", tone: "neutral", group: "Services" },
  { key: "regulatory", label: "Regulatory", icon: "shield-pending", tone: "info", group: "Risk" },
  { key: "fragile", label: "Fragile handling", icon: "alert-triangle", tone: "critical", group: "Risk" },
];

export const DEFAULT_ICON = "order-fee";

export const findIcon = (key: string | undefined | null): FeeIcon =>
  FEE_ICONS.find((i) => i.key === key) ?? FEE_ICONS.find((i) => i.key === DEFAULT_ICON)!;
