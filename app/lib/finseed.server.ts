import type { Connector, FeeOrderEvent } from "./connectors.server";

/**
 * Finseed (https://api.finseed.es) — Spanish Verifactu-compliant invoicing.
 * Reference: Finseed_API_Reference.md (2026-10-27). Amounts are integer cents,
 * currency must be EUR, invoices are `complete` (needs recipient tax id) or
 * `simplified` (≤ 3,000 EUR incl. tax; many businesses cap at 400).
 */
const BASE = "https://api.finseed.es/v1";

interface FinseedError {
  code?: string;
  detail?: string;
  errors?: Array<{ field?: string; message?: string }>;
}

async function call<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { detail: text.slice(0, 200) };
  }
  return { status: res.status, body: body as T };
}

const describeError = (status: number, e: FinseedError) => {
  const field = e.errors?.[0];
  const extra = field ? ` (${field.field ?? "field"}: ${field.message ?? ""})` : "";
  return `${e.code ?? `HTTP ${status}`}: ${e.detail ?? "request failed"}${extra}`;
};

const envOf = (key: string) => (key.startsWith("ev_live_") ? "live" : key.startsWith("ev_test_") ? "test" : "unknown");
const cents = (n: number) => Math.round(n * 100);

type TaxSpec = { type: "vat"; rate: number } | { type: "es_exempt" };

function taxFor(rateFraction: number | null, fallback: string): TaxSpec {
  if (rateFraction !== null && rateFraction > 0) return { type: "vat", rate: Math.round(rateFraction * 10000) / 100 };
  if (fallback === "exempt" || rateFraction === 0) return { type: "es_exempt" };
  return { type: "vat", rate: Number(fallback) || 21 };
}

interface Line {
  description: string;
  quantity: number;
  unit_amount: number;
  tax: TaxSpec;
}

/** Net line total in cents (after line discounts, before tax). */
function netCents(gross: number, taxesIncluded: boolean, rate: number | null): number {
  const divisor = taxesIncluded && rate ? 1 + rate : 1;
  return cents(gross / divisor);
}

/** Emits an integer-cents line; falls back to qty 1 when the total doesn't divide evenly. */
function line(description: string, qty: number, net: number, tax: TaxSpec): Line | null {
  if (net === 0) return null;
  if (qty > 1 && net % qty === 0) return { description, quantity: qty, unit_amount: net / qty, tax };
  return { description: qty > 1 ? `${description} (${qty} ud.)` : description, quantity: 1, unit_amount: net, tax };
}

export const finseed: Connector = {
  key: "finseed",
  fields: [
    { name: "api_key", label: "Finseed API key", type: "secret", placeholder: "ev_test_… or ev_live_…", required: true, hint: "Settings → API Keys in Finseed. The prefix selects the test or live environment." },
    {
      name: "invoice_type",
      label: "Invoice type",
      type: "select",
      options: [
        { value: "auto", label: "Complete when a tax ID is present, otherwise simplified" },
        { value: "complete", label: "Always complete (requires a tax ID)" },
        { value: "simplified", label: "Always simplified" },
      ],
    },
    {
      name: "simplified_limit",
      label: "Simplified invoice limit",
      type: "select",
      options: [
        { value: "400", label: "€400 — general limit" },
        { value: "3000", label: "€3,000 — sector limit approved by Finseed" },
      ],
      hint: "Orders above this without a tax ID are skipped with a note so you can invoice them manually.",
    },
    { name: "tax_id_attribute", label: "Tax ID attribute", type: "text", placeholder: "NIF", hint: "Order note / cart attribute that holds the buyer's NIF, CIF or EU VAT number. Also read from B2B company and billing data." },
    {
      name: "default_vat",
      label: "VAT when Shopify sends no tax line",
      type: "select",
      options: [
        { value: "21", label: "21%" },
        { value: "10", label: "10%" },
        { value: "4", label: "4%" },
        { value: "exempt", label: "Exempt (es_exempt)" },
      ],
    },
    { name: "re_rules", label: "Fees collected as Recargo de Equivalencia", type: "rules", hint: "These fee lines are left off the invoice; Finseed adds the paired surcharge (21→5.2, 10→1.4, 4→0.5) as tax instead." },
    { name: "number_series_id", label: "Number series", type: "text", placeholder: "ns_… (optional)", hint: "Leave blank for the environment default." },
    { name: "test_orders_only", label: "Process Shopify test orders only", type: "checkbox", hint: "Useful while validating with an ev_test_ key." },
    { name: "footer_notes", label: "Footer notes", type: "text", placeholder: "Optional, shown on every invoice" },
  ],

  async test(secrets) {
    const key = secrets.api_key ?? "";
    if (!key) return { ok: false, message: "Enter your Finseed API key." };
    const r = await call<FinseedError & { data?: unknown[] }>(key, "/number_series?limit=1");
    if (r.status === 200) return { ok: true, message: `Connected to Finseed (${envOf(key)} environment).` };
    if (r.status === 401) return { ok: false, message: "Finseed rejected the key (unauthorized). Check it was copied in full." };
    if (r.status === 402) return { ok: false, message: "Finseed: live key without an active subscription." };
    if (r.status === 403) return { ok: false, message: "Finseed: AEAT mandate not approved yet — finish onboarding in Finseed." };
    return { ok: false, message: describeError(r.status, r.body) };
  },

  async onFeeOrder(event, secrets, settings) {
    const key = secrets.api_key ?? "";
    const raw = event.raw;
    if (!key) return { status: "error", message: "No API key saved." };
    if (!raw) return { status: "error", message: "Order details unavailable." };
    if (settings.test_orders_only === "true" && !raw.test) return { status: "skipped", message: "Live order ignored (test orders only)." };
    if (raw.currency.toUpperCase() !== "EUR") return { status: "skipped", message: `Finseed invoices EUR only (order is ${raw.currency}).` };

    const reRules = new Set((settings.re_rules ?? "").split(",").map((s) => s.trim()).filter(Boolean));
    const feeByLine = new Map(event.order.fees.map((f) => [f.ruleId, f]));
    const lines: Line[] = [];
    let recargo = false;

    for (const li of raw.lineItems) {
      if (li.feeRuleId && reRules.has(li.feeRuleId)) {
        recargo = true;
        continue;
      }
      const rate = li.taxRate;
      const tax = taxFor(rate, settings.default_vat ?? "21");
      const net = netCents(li.price * li.quantity - li.totalDiscount, raw.taxesIncluded, rate);
      const title = li.feeRuleId ? (feeByLine.get(li.feeRuleId)?.name ?? li.title) : li.title;
      const l = line(title, li.quantity, net, tax);
      if (l) lines.push(l);
    }
    for (const sh of raw.shippingLines) {
      const tax = taxFor(sh.taxRate, settings.default_vat ?? "21");
      const l = line(`Envío: ${sh.title}`, 1, netCents(sh.price, raw.taxesIncluded, sh.taxRate), tax);
      if (l) lines.push(l);
    }
    if (lines.length === 0) return { status: "skipped", message: "Nothing to invoice after excluding RE fees." };

    const taxId = findTaxId(raw, settings.tax_id_attribute || "NIF");
    const totalCents = cents(raw.totalPrice);
    const limit = Number(settings.simplified_limit || "400") * 100;
    let type: "complete" | "simplified";
    switch (settings.invoice_type || "auto") {
      case "complete":
        if (!taxId) return { status: "skipped", message: "Complete invoice needs a tax ID; none found on the order." };
        type = "complete";
        break;
      case "simplified":
        type = "simplified";
        break;
      default:
        type = taxId ? "complete" : "simplified";
    }
    if (type === "simplified" && totalCents > limit) {
      return { status: "skipped", message: `Over the €${limit / 100} simplified limit and no tax ID — invoice manually.` };
    }

    const addr = raw.billingAddress;
    const recipient =
      type === "complete"
        ? {
            name: addr?.company || addr?.name || raw.customerName || "Cliente",
            company_name: addr?.company || undefined,
            tax_id: taxId!,
            email: raw.email || undefined,
            address: {
              line1: addr?.address1 || "—",
              line2: addr?.address2 || undefined,
              postal_code: addr?.zip || "",
              city: addr?.city || "",
              country: addr?.countryCode || "ES",
            },
          }
        : addr || raw.email
          ? {
              name: addr?.name || raw.customerName || undefined,
              email: raw.email || undefined,
              address: addr
                ? { line1: addr.address1 || "—", line2: addr.address2 || undefined, postal_code: addr.zip || "", city: addr.city || "", country: addr.countryCode || "ES" }
                : undefined,
            }
          : undefined;

    const payload: Record<string, unknown> = {
      type,
      external_id: `shopify-${raw.numericId}`,
      line_items: lines,
      ...(recipient ? { recipient } : {}),
      ...(recargo ? { recargo_equivalencia: true } : {}),
      ...(settings.number_series_id ? { number_series_id: settings.number_series_id } : {}),
      ...(settings.footer_notes ? { footer_notes: settings.footer_notes } : {}),
    };

    const r = await call<FinseedError & { id?: string; number?: string; pdf_url?: string; total?: number }>(key, "/invoices", {
      method: "POST",
      headers: { "idempotency-key": `shopify-order-${raw.numericId}` },
      body: JSON.stringify(payload),
    });
    if (r.status === 201) {
      const drift = r.body.total !== undefined ? r.body.total - totalCents : 0;
      const note = drift ? ` (invoice total differs from order by ${(drift / 100).toFixed(2)} €)` : "";
      return { status: "sent", message: `Invoice ${r.body.number ?? r.body.id} issued${note}.`, ref: r.body.number ?? r.body.id };
    }
    if (r.status === 409 && r.body.code === "external_id_already_used") {
      return { status: "skipped", message: "Already invoiced in Finseed for this order." };
    }
    return { status: "error", message: describeError(r.status, r.body) };
  },
};

function findTaxId(raw: NonNullable<FeeOrderEvent["raw"]>, attributeKey: string): string | null {
  const wanted = attributeKey.trim().toLowerCase();
  const hit = raw.noteAttributes.find((a) => a.name.trim().toLowerCase() === wanted)?.value?.trim();
  if (hit) return hit;
  if (raw.companyTaxId) return raw.companyTaxId;
  return null;
}
