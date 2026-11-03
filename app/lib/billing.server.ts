import type { Plan } from "./plans";

/**
 * Placeholder until Shopify Billing lands (step 9). Set DEV_PLAN=PRO|PLUS in
 * .env to exercise gated features locally; defaults to FREE.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getPlan(_shop: string): Promise<Plan> {
  const p = process.env.DEV_PLAN;
  return p === "PRO" || p === "PLUS" ? p : "FREE";
}
