import type { FeeRuleInput } from "./fee-rules";
import type { Plan } from "./plans";

export interface FeeTemplate {
  key: string;
  title: string;
  blurb: string;
  /** Minimum plan that can start from this template. */
  plan: Plan;
  values: Partial<FeeRuleInput>;
}

/** Starting points offered on the "Create fee" page beyond the two blank types. */
export const FEE_TEMPLATES: FeeTemplate[] = [
  {
    key: "protection",
    title: "Product protection",
    blurb: "Optional percentage add-on buyers can remove, tied to chosen products.",
    plan: "FREE",
    values: {
      name: "Product protection",
      icon: "protection",
      type: "PERCENTAGE",
      amount: 5,
      scope: "PRODUCT",
      frequency: "PER_UNIT",
      matchMode: "ANY",
      shopperNote: "Covers accidental damage for 12 months.",
    },
  },
  {
    key: "tariff",
    title: "Tariff surcharge",
    blurb: "Visible percentage surcharge for import, excise or similar product costs.",
    plan: "FREE",
    values: {
      name: "Tariff surcharge",
      icon: "tariff",
      type: "PERCENTAGE",
      amount: 10,
      scope: "CART",
      shopperNote: "Import duties on international goods.",
    },
  },
  {
    key: "recycling",
    title: "Recycling fee",
    blurb: "Required per-unit fee for recycling, environmental or disposal programs.",
    plan: "PRO",
    values: {
      name: "Recycling fee",
      icon: "environmental",
      type: "FIXED",
      amount: 2,
      scope: "PRODUCT",
      frequency: "PER_UNIT",
      requirement: "REQUIRED",
      matchMode: "ANY",
      shopperNote: "Environmental handling levy.",
    },
  },
  {
    key: "deposit",
    title: "Bottle deposit",
    blurb: "Required per-item deposit for bottles, containers or packaging.",
    plan: "PRO",
    values: {
      name: "Bottle deposit",
      icon: "bottle",
      type: "FIXED",
      amount: 0.1,
      scope: "PRODUCT",
      frequency: "PER_UNIT",
      requirement: "REQUIRED",
      matchMode: "ANY",
      shopperNote: "Refundable when you return the container.",
    },
  },
  {
    key: "gift-wrap",
    title: "Gift wrap fee",
    blurb: "Optional one-time order fee for gift packaging or presentation.",
    plan: "FREE",
    values: {
      name: "Gift wrap",
      icon: "gift",
      type: "FIXED",
      amount: 4.99,
      scope: "CART",
      shopperNote: "Wrapped with a handwritten note.",
    },
  },
  {
    key: "customs",
    title: "Customs duty",
    blurb: "Flat amount per order for cross-border shipments.",
    plan: "FREE",
    values: {
      name: "Customs duty",
      icon: "customs",
      type: "FIXED",
      amount: 15,
      scope: "CART",
    },
  },
  {
    key: "processing",
    title: "Processing fee",
    blurb: "Percentage of the cart to cover payment costs, with a cap.",
    plan: "FREE",
    values: {
      name: "Processing fee",
      icon: "processing",
      type: "PERCENTAGE",
      amount: 3,
      scope: "CART",
      maxCharge: 25,
    },
  },
  {
    key: "handling",
    title: "Handling fee",
    blurb: "Flat charge for packing and preparation.",
    plan: "PRO",
    values: {
      name: "Handling fee",
      icon: "handling",
      type: "FIXED",
      amount: 4.99,
      scope: "CART",
    },
  },
];

export const findTemplate = (key: string | null) =>
  FEE_TEMPLATES.find((t) => t.key === key) ?? null;
