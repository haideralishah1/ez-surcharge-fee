import prisma from "../db.server";
import { SET_RULES_METAFIELD } from "../graphql/cart-transform";
import { SHOP_ID, SHOP_LOCALES } from "../graphql/settings";
import type { AdminClient } from "./fee-engine.server";

import {
  DEFAULT_TEXT,
  SORT_ORDERS,
  type CheckoutText,
  type SortOrder,
} from "./settings";

export * from "./settings";

export interface ShopConfig {
  shop: string;
  cartTransformId: string | null;
  validationId: string | null;
  defaultOrderTag: string;
  autoFulfillFees: boolean;
  blockOnFailure: boolean;
  guardEnabled: boolean;
  showFeesBlock: boolean;
  showAcceptance: boolean;
  sortOrder: SortOrder;
  text: CheckoutText;
  translations: Record<string, Partial<CheckoutText>>;
}

const parseJson = <T,>(raw: string | null | undefined, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export async function getShopConfig(shop: string): Promise<ShopConfig> {
  const row = await prisma.shopSettings.findUnique({ where: { shop } });
  return {
    shop,
    cartTransformId: row?.cartTransformId ?? null,
    validationId: row?.validationId ?? null,
    defaultOrderTag: row?.defaultOrderTag ?? "",
    autoFulfillFees: row?.autoFulfillFees ?? false,
    blockOnFailure: row?.blockOnFailure ?? false,
    guardEnabled: row?.guardEnabled ?? true,
    showFeesBlock: row?.showFeesBlock ?? true,
    showAcceptance: row?.showAcceptance ?? true,
    sortOrder: (SORT_ORDERS as readonly string[]).includes(row?.sortOrder ?? "")
      ? (row!.sortOrder as SortOrder)
      : "CART",
    text: { ...DEFAULT_TEXT, ...parseJson<Partial<CheckoutText>>(row?.checkoutText, {}) },
    translations: parseJson<Record<string, Partial<CheckoutText>>>(row?.translations, {}),
  };
}

type Patch = Partial<Omit<ShopConfig, "shop" | "cartTransformId" | "validationId">>;

export async function saveShopConfig(shop: string, patch: Patch) {
  const data: Record<string, unknown> = {};
  for (const k of ["defaultOrderTag", "autoFulfillFees", "blockOnFailure", "guardEnabled", "showFeesBlock", "showAcceptance", "sortOrder"] as const) {
    if (patch[k] !== undefined) data[k] = patch[k];
  }
  if (patch.text) data.checkoutText = JSON.stringify(patch.text);
  if (patch.translations) data.translations = JSON.stringify(patch.translations);
  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
}

/** The JSON the checkout extension and guard function read from `$app.checkout-settings`. */
export function checkoutPayload(c: ShopConfig) {
  return {
    version: 1,
    showFeesBlock: c.showFeesBlock,
    showAcceptance: c.showAcceptance,
    sortOrder: c.sortOrder,
    guardEnabled: c.guardEnabled,
    text: c.text,
    translations: c.translations,
  };
}

async function shopGid(admin: AdminClient): Promise<string> {
  const res = await admin.graphql(SHOP_ID);
  const body = (await res.json()) as { data?: { shop?: { id: string } } };
  const id = body.data?.shop?.id;
  if (!id) throw new Error("Could not read shop id");
  return id;
}

/** Writes the current config to the shop metafield. Call after any settings save. */
export async function pushCheckoutSettings(admin: AdminClient, shop: string) {
  const config = await getShopConfig(shop);
  const ownerId = await shopGid(admin);
  const res = await admin.graphql(SET_RULES_METAFIELD, {
    variables: {
      metafields: [
        {
          ownerId,
          namespace: "$app",
          key: "checkout-settings",
          type: "json",
          value: JSON.stringify(checkoutPayload(config)),
        },
      ],
    },
  });
  const body = (await res.json()) as {
    data?: { metafieldsSet?: { userErrors?: Array<{ message: string }> } };
  };
  const errs = body.data?.metafieldsSet?.userErrors ?? [];
  if (errs.length) throw new Error(`Saving checkout settings: ${errs.map((e) => e.message).join("; ")}`);
}

export interface ShopLocale {
  locale: string;
  name: string;
  primary: boolean;
  published: boolean;
}

export async function listLocales(admin: AdminClient): Promise<ShopLocale[]> {
  try {
    const res = await admin.graphql(SHOP_LOCALES);
    const body = (await res.json()) as { data?: { shopLocales?: ShopLocale[] } };
    return body.data?.shopLocales ?? [];
  } catch {
    // read_locales may not be granted yet; Translations tab explains.
    return [];
  }
}
