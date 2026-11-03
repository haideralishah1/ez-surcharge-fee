import type { ActionFunctionArgs } from "react-router";
import { authenticateCredential, quoteFees, type QuoteRequest } from "../lib/quote.server";

/**
 * POST /api/quote — read-only surcharge quote for POS and partner systems.
 * Auth: `Authorization: Bearer fq_…` (Settings → Integrations → Flip POS).
 * Body: { lines: [{ variantId, quantity, unitPrice? }], countryCode?, marketHandle?, customerTags?, channel?, declinedFeeIds?, selectedFeeIds? }
 */
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const loader = () => json(405, { error: "Use POST." });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") return json(405, { error: "Use POST." });
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const shop = await authenticateCredential(token);
  if (!shop) return json(401, { error: "Invalid or revoked credential." });

  let body: Partial<QuoteRequest>;
  try {
    body = (await request.json()) as Partial<QuoteRequest>;
  } catch {
    return json(400, { error: "Body must be JSON." });
  }
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0 || lines.length > 100) return json(400, { error: "Provide 1–100 lines." });
  for (const l of lines) {
    if (typeof l?.variantId !== "string" || !l.variantId.startsWith("gid://shopify/ProductVariant/")) {
      return json(400, { error: "Each line needs a variantId like gid://shopify/ProductVariant/123." });
    }
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 2000) return json(400, { error: "quantity must be 1–2000." });
    if (l.unitPrice !== undefined && !(Number.isFinite(l.unitPrice) && l.unitPrice >= 0)) return json(400, { error: "unitPrice must be ≥ 0." });
  }

  try {
    const quote = await quoteFees(shop, {
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })),
      countryCode: typeof body.countryCode === "string" ? body.countryCode : undefined,
      marketHandle: typeof body.marketHandle === "string" ? body.marketHandle : undefined,
      customerTags: Array.isArray(body.customerTags) ? body.customerTags.map(String) : undefined,
      channel: body.channel === "ONLINE_STORE" ? "ONLINE_STORE" : "POS",
      declinedFeeIds: Array.isArray(body.declinedFeeIds) ? body.declinedFeeIds.map(String) : undefined,
      selectedFeeIds: Array.isArray(body.selectedFeeIds) ? body.selectedFeeIds.map(String) : undefined,
    });
    return json(200, quote);
  } catch (e) {
    return json(502, { error: e instanceof Error ? e.message : "Quote failed." });
  }
};
