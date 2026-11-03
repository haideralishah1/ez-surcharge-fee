import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleOrderWebhook, type OrderPayload } from "../lib/fee-orders.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, admin } = await authenticate.webhook(request);
  await handleOrderWebhook(shop, payload as OrderPayload, admin);
  return new Response();
};
