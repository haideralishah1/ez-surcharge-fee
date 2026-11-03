/**
 * Integrations directory shown on Settings → Integrations. Every row is a
 * factual statement about how that app behaves alongside fees applied by the
 * checkout engine; none of them need a switch because nothing runs in the theme.
 */
export type IntegrationStatus = "automatic" | "compatible" | "planned" | "connectable" | "partner";

export interface Integration {
  name: string;
  blurb: string;
  status: IntegrationStatus;
  /** Polaris icon name used as the row's tile. */
  icon: string;
  /** App Store search so merchants can find it without us shipping logos. */
  query: string;
  /** Vendor domain; its public favicon is shown as the logo when available. */
  domain?: string;
  /** Optional licensed logo under /public, e.g. "/integrations/finseed.png". Overrides the favicon. */
  logo?: string;
  /** Key into CONNECTORS when the row has a Manage dialog. */
  connector?: string;
}

export interface IntegrationGroup {
  title: string;
  items: Integration[];
}

export const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    title: "Automation",
    items: [
      {
        name: "Outbound webhook (Make, Zapier, n8n)",
        blurb: "Sends a signed JSON event for every order that contains a fee. Build invoices, sheets or alerts from it.",
        status: "connectable",
        icon: "automation",
        query: "Make",
        connector: "webhook",
        domain: "make.com",
      },
    ],
  },
  {
    title: "Invoicing",
    items: [
      {
        name: "Finseed",
        connector: "finseed",
        domain: "finseed.es",
        blurb: "Issue Verifactu-compliant invoices for orders with fees. Fees can appear as lines or be collected as Recargo de Equivalencia.",
        status: "connectable",
        icon: "receipt",
        query: "Finseed",
      },
      {
        name: "STEL Order",
        connector: "stel",
        domain: "stelorder.com",
        blurb: "Create STEL Order invoices for orders with fees, with the client matched or created by tax ID / email and Recargo handled as secondary tax.",
        status: "connectable",
        icon: "receipt-folded",
        query: "STEL Order",
      },
    ],
  },
  {
    title: "Pricing data",
    items: [
      {
        name: "Wholesale Pricing Discount",
        connector: "wpd",
        domain: "wholesalehelper.io",
        blurb: "Use wholesale prices for fee calculations. Needs the read-only token from WPD → Integrations (partner access).",
        status: "partner",
        icon: "price-list",
        query: "Wholesale Pricing Discount",
      },
      {
        name: "BSS B2B Solution",
        domain: "bsscommerce.com",
        blurb: "Company and customer-tag rules (Plus) let you target B2B buyers. Fees use B2B catalog prices automatically.",
        status: "compatible",
        icon: "business-entity",
        query: "BSS B2B Solution",
      },
    ],
  },
  {
    title: "Cart and delivery apps",
    items: [
      {
        name: "Candy Rack",
        domain: "digismoothie.com",
        blurb: "Upsells added to the cart are evaluated like any other line. No drawer syncing needed.",
        status: "automatic",
        icon: "cart-up",
        query: "Candy Rack",
      },
      {
        name: "Pickeasy",
        domain: "logbase.io",
        blurb: "Pickup and delivery choices are untouched; fees are applied by Shopify's checkout, not by cart updates.",
        status: "automatic",
        icon: "store",
        query: "Pickeasy",
      },
      {
        name: "Bespoke Shipping",
        domain: "mzlsolutions.com",
        blurb: "Shipping rates are calculated after fees, so rate rules see the fee-inclusive subtotal.",
        status: "automatic",
        icon: "truck",
        query: "Bespoke Shipping",
      },
    ],
  },
  {
    title: "Navigation apps",
    items: [
      {
        name: "Globo Mega Menu",
        domain: "globosoftware.net",
        blurb: "No storefront JavaScript from this app, so menus and cart updates never collide.",
        status: "automatic",
        icon: "menu",
        query: "Globo Mega Menu",
      },
    ],
  },
  {
    title: "Point of Sale",
    items: [
      {
        name: "Shopify POS",
        domain: "shopify.com",
        blurb: "Pro plan. Fees apply to POS carts through the same function; a POS tile for cashier-added fees is coming.",
        status: "planned",
        icon: "point-of-sale",
        query: "Shopify POS",
      },
      {
        name: "Flip POS",
        blurb: "Lets Flip POS request read-only surcharge quotes before a table check is printed, computed by the same engine as checkout.",
        status: "connectable",
        icon: "credit-card-reader",
        query: "Flip POS",
        connector: "flippos",
      },
    ],
  },
  {
    title: "Themes",
    items: [
      {
        name: "NAVEE Benelux",
        blurb: "Buy-now and collection checkout buttons go through Shopify checkout, where fees are applied.",
        status: "automatic",
        icon: "theme",
        query: "NAVEE Benelux theme",
      },
      {
        name: "Split (Krown Themes)",
        domain: "krownthemes.com",
        blurb: "Cart items and totals already include fees; nothing to keep in sync.",
        status: "automatic",
        icon: "theme",
        query: "Split theme Krown",
      },
      {
        name: "Expanse",
        domain: "archetypethemes.co",
        blurb: "Works with the theme's cart drawer and quick-add without configuration.",
        status: "automatic",
        icon: "theme",
        query: "Expanse theme",
      },
    ],
  },
];

export const STATUS_LABEL: Record<IntegrationStatus, { label: string; tone: "success" | "info" | "neutral" | "caution" }> = {
  automatic: { label: "Works automatically", tone: "success" },
  compatible: { label: "Compatible", tone: "info" },
  connectable: { label: "Connect", tone: "info" },
  partner: { label: "Via Make / partner API", tone: "caution" },
  planned: { label: "Planned", tone: "neutral" },
};

/** Public favicon for a vendor domain (Google's resolver handles missing/odd icons). */
export const faviconUrl = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

export const appStoreSearch = (q: string) =>
  `https://apps.shopify.com/search?q=${encodeURIComponent(q)}`;
