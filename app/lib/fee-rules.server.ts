import prisma from "../db.server";
import { decodeRule, type FeeRuleInput } from "./fee-rules";

export async function listRules(shop: string) {
  const rows = await prisma.feeRule.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(decodeRule);
}

export async function getRule(shop: string, id: string) {
  const row = await prisma.feeRule.findFirst({ where: { id, shop } });
  return row ? decodeRule(row) : null;
}

const toData = (v: FeeRuleInput) => ({
  ...v,
  channels: JSON.stringify(v.channels),
  conditions: JSON.stringify(v.conditions),
  weekdays: JSON.stringify(v.weekdays),
  marketHandles: JSON.stringify(v.marketHandles),
  minCharge: v.minCharge ?? null,
  maxCharge: v.maxCharge ?? null,
  startDate: v.startDate ?? null,
  endDate: v.endDate ?? null,
});

export const createRule = (shop: string, v: FeeRuleInput) =>
  prisma.feeRule.create({ data: { shop, ...toData(v) } });

export const updateRule = (shop: string, id: string, v: FeeRuleInput) =>
  prisma.feeRule.updateMany({ where: { id, shop }, data: toData(v) });

export const setRuleActive = (shop: string, id: string, active: boolean) =>
  prisma.feeRule.updateMany({ where: { id, shop }, data: { active } });

export const deleteRule = (shop: string, id: string) =>
  prisma.feeRule.deleteMany({ where: { id, shop } });
