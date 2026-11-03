export type Plan = "FREE" | "PRO" | "PLUS";

const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, PLUS: 2 };

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free",
  PRO: "Pro",
  PLUS: "Plus",
};

export function planAtLeast(plan: Plan, required: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[required];
}

/** Minimum plan needed for each gated feature. Used by both UI and server. */
export const FEATURE_PLAN = {
  channelPos: "PRO",
  channelDraftOrder: "PRO",
  requiredFees: "PRO",
  markets: "PRO",
  customerTags: "PLUS",
} as const satisfies Record<string, Plan>;

export type Feature = keyof typeof FEATURE_PLAN;

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return planAtLeast(plan, FEATURE_PLAN[feature]);
}
