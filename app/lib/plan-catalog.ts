import type { Plan } from "./plans";

export const FREE_MONTHLY_FEE_ORDERS = 10;

export const PLAN_CATALOG: Array<{
  id: Plan;
  price: string;
  tagline: string;
  features: string[];
  plusOnly?: boolean;
}> = [
  {
    id: "FREE",
    price: "$0",
    tagline: "Try fees on your online store.",
    features: [
      `${FREE_MONTHLY_FEE_ORDERS} orders with applied fees / month`,
      "Online Store fees only",
      "Fixed and percentage fees",
      "Product and cart conditions",
      "Country rules",
      "Optional fees buyers can remove",
    ],
  },
  {
    id: "PRO",
    price: "$15",
    tagline: "Fees everywhere you sell.",
    features: [
      "Unlimited orders with applied fees",
      "Online Store, POS and draft order fees",
      "Required fees that block checkout",
      "Shopify Markets rules",
      "Handling and recycling presets",
      "Auto-fulfil fee lines",
    ],
  },
  {
    id: "PLUS",
    price: "$35",
    tagline: "For Shopify Plus stores.",
    plusOnly: true,
    features: [
      "Everything in Pro",
      "Credit card and payment-method surcharges",
      "Shipping destination fees",
      "Customer tag and B2B rules",
      "Shipping surcharges",
    ],
  },
];
