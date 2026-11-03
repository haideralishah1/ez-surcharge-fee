import prisma from "../db.server";
import { decryptJson, encryptJson, hmacHex } from "./crypto.server";
import { finseed } from "./finseed.server";
import { stel } from "./stel.server";

/** Fee-order event handed to connectors by the orders webhook. */
export interface FeeOrderEvent {
  shop: string;
  order: {
    id: string;
    name: string;
    createdAt: string;
    currency: string;
    feeTotal: number;
    fees: Array<{ ruleId: string; name: string; amount: number; orderTag: string }>;
  };
  /** Order details some connectors (invoicing) need; omitted from outbound webhooks. */
  raw?: {
    numericId: string;
    test: boolean;
    currency: string;
    taxesIncluded: boolean;
    totalPrice: number;
    email: string;
    customerName: string;
    companyTaxId: string | null;
    billingAddress: {
      name: string; company: string; address1: string; address2: string; zip: string; city: string; countryCode: string;
    } | null;
    noteAttributes: Array<{ name: string; value: string }>;
    lineItems: Array<{
      title: string; sku: string; quantity: number; price: number; totalDiscount: number;
      taxRate: number | null; feeRuleId: string | null;
    }>;
    shippingLines: Array<{ title: string; price: number; taxRate: number | null }>;
  };
}

export interface DeliveryResult {
  status: "sent" | "skipped" | "error";
  message: string;
  ref?: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "secret" | "select" | "checkbox" | "rules" | "remote-select";
  hint?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
}

export interface Connector {
  key: string;
  /** "credential": the dialog issues store-bound API credentials instead of collecting vendor keys. */
  mode?: "fields" | "credential";
  /** Fields rendered in the Manage dialog. Secret fields are encrypted at rest. */
  fields: FieldDef[];
  /** Shown when a connector can't be connected directly yet. */
  unavailable?: { reason: string; alternative: string };
  test?: (secrets: Record<string, string>, settings: Record<string, string>) => Promise<{ ok: boolean; message: string; pending?: boolean }>;
  /** Shown in the dialog above the fields. */
  intro?: string;
  /** Fills `remote-select` fields from the vendor account (keyed by field name). */
  options?: (secrets: Record<string, string>) => Promise<Record<string, Array<{ value: string; label: string }>>>;
  onFeeOrder?: (event: FeeOrderEvent, secrets: Record<string, string>, settings: Record<string, string>) => Promise<DeliveryResult | void>;
}

const sign = (secret: string, body: string) => (secret ? hmacHex(secret, body) : "");

async function post(url: string, secret: string, eventName: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fees-event": eventName,
      "x-fees-signature": sign(secret, body),
      "user-agent": "fee-rules-app/1.0",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${eventName}: endpoint returned ${res.status}`);
}

/** Generic outbound webhook — works with Make, Zapier, n8n or any HTTPS endpoint. */
const webhook: Connector = {
  key: "webhook",
  fields: [
    { name: "url", label: "Endpoint URL", type: "text", placeholder: "https://hook.make.com/…", required: true, hint: "Receives a JSON POST for every order that contains a fee." },
    { name: "secret", label: "Signing secret", type: "secret", hint: "Optional. Each request carries X-Fees-Signature = HMAC-SHA256(body)." },
    {
      name: "events",
      label: "Send",
      type: "select",
      options: [
        { value: "fee_order.created", label: "Orders with fees (on creation)" },
      ],
    },
  ],
  async test(secrets, settings) {
    const url = settings.url?.trim();
    if (!url?.startsWith("https://")) return { ok: false, message: "Enter an https:// endpoint." };
    try {
      await post(url, secrets.secret ?? "", "ping", { event: "ping", sentAt: new Date().toISOString() });
      return { ok: true, message: "Endpoint accepted a signed ping." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
  async onFeeOrder(event, secrets, settings) {
    // Raw order details stay internal; JSON.stringify drops the undefined key.
    const outbound = { ...event, raw: undefined };
    await post(settings.url, secrets.secret ?? "", "fee_order.created", { event: "fee_order.created", ...outbound });
    return { status: "sent", message: "Delivered." };
  },
};

/**
 * Wholesale Pricing Discount (Wholesale Helper). The read-only token is minted in
 * WPD → Integrations for approved partner apps and unlocks a private price-lookup
 * endpoint. Until Wholesale Helper enables this app, the token is stored but no
 * lookups run — the dialog says so.
 */
const wpd: Connector = {
  key: "wpd",
  intro: "Save the read-only token generated in Wholesale Pricing Discount → Integrations. It belongs to one merchant WPD account and will be used server-side to look up effective wholesale prices when calculating percentage fees.",
  fields: [
    { name: "token", label: "Access token", type: "secret", placeholder: "Paste the generated WPD token", required: true, hint: "Encrypted at rest and never returned to the browser after it is saved." },
  ],
  async test(secrets) {
    if (!secrets.token) return { ok: false, message: "Paste the WPD token first." };
    return {
      ok: true,
      pending: true,
      message: "Token saved. Price lookups activate once Wholesale Helper enables this app for its partner API; until then fees use Shopify catalog prices.",
    };
  },
};

/** Flip POS (and any POS) calls our quote API with a store-bound credential. */
const flippos: Connector = {
  key: "flippos",
  mode: "credential",
  fields: [],
};

export const CONNECTORS: Record<string, Connector> = {
  webhook,
  flippos,
  finseed,
  stel,
  wpd,

};

export interface ConnectionView {
  key: string;
  enabled: boolean;
  status: string;
  lastError: string;
  lastTestedAt: string | null;
  lastSyncAt: string | null;
  settings: Record<string, string>;
  /** Which secret fields currently have a stored value (values never leave the server). */
  secretsSet: string[];
}

export async function listConnections(shop: string): Promise<Record<string, ConnectionView>> {
  const rows = await prisma.integrationConnection.findMany({ where: { shop } });
  const out: Record<string, ConnectionView> = {};
  for (const r of rows) {
    const secrets = decryptJson<Record<string, string>>(r.secrets, {});
    out[r.key] = {
      key: r.key,
      enabled: r.enabled,
      status: r.status,
      lastError: r.lastError,
      lastTestedAt: r.lastTestedAt?.toISOString() ?? null,
      lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
      settings: JSON.parse(r.settings || "{}"),
      secretsSet: Object.keys(secrets).filter((k) => secrets[k]),
    };
  }
  return out;
}

/** Saves fields from a Manage form. Blank secret fields keep their stored value. */
export async function saveConnection(shop: string, key: string, form: FormData) {
  const connector = CONNECTORS[key];
  if (!connector) throw new Error("Unknown integration");
  const row = await prisma.integrationConnection.findUnique({ where: { shop_key: { shop, key } } });
  const secrets = decryptJson<Record<string, string>>(row?.secrets ?? "", {});
  const settings: Record<string, string> = JSON.parse(row?.settings || "{}");
  for (const f of connector.fields) {
    const v = String(form.get(f.name) ?? "").trim();
    if (f.type === "rules") {
      settings[f.name] = form.getAll(f.name).map(String).filter(Boolean).join(",");
    } else if (f.type === "secret") {
      if (form.get(`${f.name}__clear`) === "1") delete secrets[f.name];
      else if (v) secrets[f.name] = v;
    } else if (f.type === "checkbox") {
      settings[f.name] = form.get(f.name) === "true" ? "true" : "false";
    } else {
      settings[f.name] = v;
    }
  }
  const missing = connector.fields.filter((f) => f.required && f.type !== "secret" && !settings[f.name]);
  if (missing.length) throw new Error(`${missing[0].label} is required.`);
  await prisma.integrationConnection.upsert({
    where: { shop_key: { shop, key } },
    create: { shop, key, secrets: encryptJson(secrets), settings: JSON.stringify(settings) },
    update: { secrets: encryptJson(secrets), settings: JSON.stringify(settings) },
  });
}

export async function loadOptions(shop: string, key: string) {
  const connector = CONNECTORS[key];
  const row = await prisma.integrationConnection.findUnique({ where: { shop_key: { shop, key } } });
  if (!connector?.options || !row) throw new Error("Save the connection first.");
  return connector.options(decryptJson(row.secrets, {}));
}

export async function testConnection(shop: string, key: string) {
  const connector = CONNECTORS[key];
  const row = await prisma.integrationConnection.findUnique({ where: { shop_key: { shop, key } } });
  if (!connector?.test || !row) return { ok: false, message: "Save the connection first." };
  const result = await connector.test(decryptJson(row.secrets, {}), JSON.parse(row.settings || "{}"));
  await prisma.integrationConnection.update({
    where: { id: row.id },
    data: {
      status: result.ok ? (result.pending ? "pending" : "connected") : "error",
      lastError: result.ok ? "" : result.message,
      lastTestedAt: new Date(),
    },
  });
  return result;
}

export async function setConnectionEnabled(shop: string, key: string, enabled: boolean) {
  const connector = CONNECTORS[key];
  if (!connector || connector.unavailable) throw new Error("This integration can't be enabled yet.");
  const row = await prisma.integrationConnection.findUnique({ where: { shop_key: { shop, key } } });
  if (!row) throw new Error("Connect the integration first.");
  if (enabled && row.status !== "connected") throw new Error("Run “Test connection” successfully before enabling.");
  await prisma.integrationConnection.update({ where: { id: row.id }, data: { enabled } });
}

/** Called by the orders webhook; every attempt is logged, failures never throw. */
export async function dispatchFeeOrder(event: FeeOrderEvent) {
  const rows = await prisma.integrationConnection.findMany({ where: { shop: event.shop, enabled: true } });
  for (const row of rows) {
    const connector = CONNECTORS[row.key];
    if (!connector?.onFeeOrder) continue;
    let result: DeliveryResult;
    try {
      result = (await connector.onFeeOrder(event, decryptJson(row.secrets, {}), JSON.parse(row.settings || "{}"))) ?? {
        status: "sent",
        message: "Delivered.",
      };
    } catch (e) {
      result = { status: "error", message: e instanceof Error ? e.message : String(e) };
    }
    await prisma.integrationLog.create({
      data: {
        shop: event.shop,
        key: row.key,
        orderId: event.order.id,
        orderName: event.order.name,
        status: result.status,
        message: result.message.slice(0, 500),
        ref: result.ref ?? "",
      },
    });
    await prisma.integrationConnection.update({
      where: { id: row.id },
      data:
        result.status === "error"
          ? { lastError: result.message.slice(0, 500), status: "error" }
          : { lastSyncAt: new Date(), lastError: "", status: "connected" },
    });
  }
}

/** A fee order the catch-up recovered without its webhook, so integrations didn't receive it. */
export async function logUndeliveredFeeOrder(shop: string, order: FeeOrderEvent["order"]) {
  const rows = await prisma.integrationConnection.findMany({ where: { shop, enabled: true } });
  for (const row of rows) {
    if (!CONNECTORS[row.key]?.onFeeOrder) continue;
    await prisma.integrationLog.create({
      data: {
        shop,
        key: row.key,
        orderId: order.id,
        orderName: order.name,
        status: "error",
        message: "Shopify's order notice never arrived, so this order wasn't sent here. Send it manually if needed.",
      },
    });
  }
}

export async function recentDeliveries(shop: string, limit = 8) {
  const rows = await prisma.integrationLog.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: 200 });
  const byKey: Record<string, Array<{ orderName: string; status: string; message: string; ref: string; at: string }>> = {};
  for (const r of rows) {
    const list = (byKey[r.key] ??= []);
    if (list.length < limit) list.push({ orderName: r.orderName, status: r.status, message: r.message, ref: r.ref, at: r.createdAt.toISOString() });
  }
  return byKey;
}
