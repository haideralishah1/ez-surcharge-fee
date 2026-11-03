import type { Connector, FeeOrderEvent } from "./connectors.server";

/**
 * STEL Order (https://app.stelorder.com/app) — Spanish ERP invoicing.
 * Confirmed from the account's Swagger docs (2026-10-27): header `APIKEY`,
 * `GET /clients?email=|tax-identification-number=`, `POST /clients`,
 * `GET /services`, `GET /taxLines`, `POST /ordinaryInvoices` whose lines are
 * `{ line-type: "ITEM", item-id, item-name, item-base-price, units, primary-tax-id | primary-tax-percentage }`.
 * Recargo de Equivalencia is the invoice-level `secondary-tax-enabled` flag.
 */
const BASE = "https://app.stelorder.com/app";

type Json = Record<string, unknown>;

async function call<T = unknown>(apiKey: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: T; text: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { APIKEY: apiKey, accept: "application/json", "content-type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body: body as T, text };
}

const fail = (what: string, r: { status: number; text: string }) =>
  `${what}: HTTP ${r.status}${r.text ? ` — ${r.text.slice(0, 160)}` : ""}`;

const label = (o: Json) =>
  String(o["name"] ?? o["item-name"] ?? o["tax-name"] ?? o["legal-name"] ?? o["reference"] ?? o["id"]);

const round2 = (n: number) => Math.round(n * 100) / 100;

export const stel: Connector = {
  key: "stel",
  fields: [
    { name: "api_key", label: "STEL API key", type: "secret", required: true, hint: "Settings → Functionalities → API in STEL Order. Sent as the APIKEY header." },
    { name: "service_id", label: "Service used for imported invoice lines", type: "remote-select", hint: "STEL requires every line to reference an item. Create a dedicated service (e.g. “Shopify order line”) in STEL; lines keep their Shopify names and net amounts." },
    { name: "tax_id", label: "VAT tax line", type: "remote-select", hint: "Applied to every line. Leave empty to send the Shopify tax rate as a percentage instead." },
    { name: "re_rules", label: "Fees collected as Recargo de Equivalencia", type: "rules", hint: "These fee lines are left off the invoice and the invoice's secondary tax (Recargo) is switched on." },
    { name: "test_orders_only", label: "Process Shopify test orders only", type: "checkbox" },
    { name: "test_client_id", label: "Test customer in STEL", type: "remote-select", hint: "Used for Shopify test orders instead of creating real clients." },
    { name: "comments_prefix", label: "Comments", type: "text", placeholder: "Shopify order", hint: "Prefixed to the order name in the invoice comments." },
  ],

  async options(secrets) {
    const key = secrets.api_key ?? "";
    if (!key) throw new Error("Save your STEL API key first.");
    const [services, taxes, clients] = await Promise.all([
      call<Json[]>(key, "/services?limit=100"),
      call<Json[]>(key, "/taxLines"),
      call<Json[]>(key, "/clients?limit=50"),
    ]);
    for (const [name, r] of [["services", services], ["tax lines", taxes], ["clients", clients]] as const) {
      if (r.status !== 200 || !Array.isArray(r.body)) throw new Error(fail(`Loading ${name}`, r));
    }
    return {
      service_id: services.body.map((s) => ({ value: String(s["id"]), label: label(s) })),
      tax_id: taxes.body
        .filter((t) => t["type"] === "CONSUMPTION")
        .map((t) => ({ value: String(t["id"]), label: `${label(t)} ${t["tax-percentage"]}%` })),
      test_client_id: clients.body.map((c) => ({ value: String(c["id"]), label: `${label(c)}${c["email"] ? ` · ${c["email"]}` : ""}` })),
    };
  },

  async test(secrets) {
    const key = secrets.api_key ?? "";
    if (!key) return { ok: false, message: "Enter your STEL API key." };
    const r = await call<Json[]>(key, "/taxLines");
    if (r.status === 200 && Array.isArray(r.body)) return { ok: true, message: `Connected to STEL Order (${r.body.length} tax lines visible).` };
    if (r.status === 401 || r.status === 403) return { ok: false, message: "STEL rejected the key. Check it under Settings → Functionalities → API." };
    return { ok: false, message: fail("STEL connection", r) };
  },

  async onFeeOrder(event, secrets, settings) {
    const key = secrets.api_key ?? "";
    const raw = event.raw;
    if (!key) return { status: "error", message: "No API key saved." };
    if (!raw) return { status: "error", message: "Order details unavailable." };
    if (settings.test_orders_only === "true" && !raw.test) return { status: "skipped", message: "Live order ignored (test orders only)." };
    if (!settings.service_id) return { status: "error", message: "Choose the STEL service used for invoice lines (Manage → Load STEL choices)." };

    const serviceId = Number(settings.service_id);
    const taxLineId = settings.tax_id ? Number(settings.tax_id) : null;
    const reRules = new Set((settings.re_rules ?? "").split(",").map((s) => s.trim()).filter(Boolean));
    const feeNames = new Map(event.order.fees.map((f) => [f.ruleId, f.name]));

    let recargo = false;
    const lines: Json[] = [];
    const addLine = (name: string, qty: number, gross: number, discount: number, rate: number | null) => {
      const net = raw.taxesIncluded && rate ? gross / (1 + rate) : gross;
      if (net === 0) return;
      const line: Json = {
        "line-type": "ITEM",
        "item-id": serviceId,
        "item-name": name,
        "item-base-price": round2(net),
        units: qty,
      };
      if (discount > 0 && gross * qty > 0) line["discount-percentage"] = round2((discount / (gross * qty)) * 100);
      if (taxLineId) line["primary-tax-id"] = taxLineId;
      else line["primary-tax-percentage"] = rate !== null ? round2(rate * 100) : 0;
      lines.push(line);
    };
    for (const li of raw.lineItems) {
      if (li.feeRuleId && reRules.has(li.feeRuleId)) {
        recargo = true;
        continue;
      }
      addLine(li.feeRuleId ? (feeNames.get(li.feeRuleId) ?? li.title) : li.title, li.quantity, li.price, li.totalDiscount, li.taxRate);
    }
    for (const sh of raw.shippingLines) addLine(`Envío: ${sh.title}`, 1, sh.price, 0, sh.taxRate);
    if (lines.length === 0) return { status: "skipped", message: "Nothing to invoice after excluding RE fees." };

    const clientId = await resolveClient(key, raw, settings);
    if (typeof clientId !== "number") return { status: "error", message: clientId };

    const body: Json = {
      "account-id": clientId,
      date: event.order.createdAt,
      "currency-code": raw.currency,
      "primary-tax-enabled": true,
      "secondary-tax-enabled": recargo,
      "income-tax-enabled": false,
      comments: `${settings.comments_prefix || "Shopify order"} ${event.order.name}`.trim(),
      lines,
    };
    const r = await call<Json>(key, "/ordinaryInvoices", { method: "POST", body: JSON.stringify(body) });
    if (r.status >= 200 && r.status < 300 && r.body) {
      const ref = String(r.body["full-reference"] ?? r.body["reference"] ?? r.body["id"] ?? "");
      return { status: "sent", message: `Invoice ${ref} created in STEL Order.`, ref };
    }
    return { status: "error", message: fail("Creating invoice", r) };
  },
};

/** Finds the STEL client by tax id, then email; creates one if neither matches. Test orders use the configured test client. */
async function resolveClient(key: string, raw: NonNullable<FeeOrderEvent["raw"]>, settings: Record<string, string>): Promise<number | string> {
  if (raw.test && settings.test_client_id) return Number(settings.test_client_id);

  const taxId = raw.noteAttributes.find((a) => ["nif", "cif", "vat", "tax_id", "taxid"].includes(a.name.trim().toLowerCase()))?.value?.trim() || raw.companyTaxId || "";
  const lookups: string[] = [];
  if (taxId) lookups.push(`/clients?tax-identification-number=${encodeURIComponent(taxId)}`);
  if (raw.email) lookups.push(`/clients?email=${encodeURIComponent(raw.email)}`);
  for (const path of lookups) {
    const r = await call<Json[]>(key, path);
    if (r.status === 200 && Array.isArray(r.body) && r.body.length > 0) return Number(r.body[0]["id"]);
  }

  const addr = raw.billingAddress;
  const name = addr?.company || addr?.name || raw.customerName || raw.email || "Cliente Shopify";
  const create: Json = {
    name,
    "legal-name": addr?.company || name,
    email: raw.email || undefined,
    "tax-identification-number": taxId || undefined,
    "currency-code": raw.currency,
    ...(addr
      ? {
          "main-address": {
            "address-data": [addr.address1, addr.address2].filter(Boolean).join(", "),
            "city-town": addr.city,
            "postal-code": addr.zip,
            "country-code": addr.countryCode,
          },
        }
      : {}),
  };
  const r = await call<Json>(key, "/clients", { method: "POST", body: JSON.stringify(create) });
  if (r.status >= 200 && r.status < 300 && r.body && r.body["id"] !== undefined) return Number(r.body["id"]);
  return fail("Creating STEL client", r);
}
