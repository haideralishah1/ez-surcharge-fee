import prisma from "../db.server";
import {
  CREATE_CART_TRANSFORM,
  LIST_CART_TRANSFORMS,
  OPTIONAL_FEE_OWNERS,
  SET_RULES_METAFIELD,
} from "../graphql/cart-transform";
import {
  CONFIGURE_FEE_VARIANT,
  CREATE_FEE_PRODUCT,
  DELETE_FEE_PRODUCT,
  FIND_FEE_PRODUCT,
  LIST_PUBLICATIONS,
  PUBLISH_FEE_PRODUCT,
  UNLIST_FEE_PRODUCT,
} from "../graphql/fee-product";
import {
  CREATE_VALIDATION,
  LIST_VALIDATIONS,
  UPDATE_VALIDATION,
} from "../graphql/validation";
import { DELETE_CART_TRANSFORM } from "../graphql/settings";
import { listRules } from "./fee-rules.server";

/** Must match `handle` in extensions/fee-engine/shopify.extension.toml. */
export const FUNCTION_HANDLE = "fee-engine";
/** Must match `handle` in extensions/fee-guard/shopify.extension.toml. */
export const VALIDATION_HANDLE = "fee-guard";
export const FEE_PRODUCT_TAG = "fee-engine";

/** Minimal shape of the `admin` object from `authenticate.admin()`. */
export interface AdminClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<{ json: () => Promise<unknown> }>;
}

export class FeeEngineError extends Error {}

interface GraphQLBody {
  data?: unknown;
  errors?: Array<{ message: string }>;
}

// Responses are untyped here; each caller narrows the slice it reads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gql<T = any>(
  admin: AdminClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await admin.graphql(query, { variables });
  const body = (await res.json()) as GraphQLBody;
  if (body.errors?.length) {
    throw new FeeEngineError(body.errors.map((e) => e.message).join("; "));
  }
  return body.data as T;
}

function assertNoUserErrors(
  payload: { userErrors?: Array<{ message: string }> } | undefined,
  what: string,
) {
  const errs = payload?.userErrors ?? [];
  if (errs.length) {
    throw new FeeEngineError(
      `${what}: ${errs.map((e) => e.message).join("; ")}`,
    );
  }
}

/**
 * Looks up (or registers) this app's CartTransform on the shop. Shopify allows
 * one per app per store, so an existing one is reused. The stored id is only
 * trusted while Shopify still lists it; a reinstall or dev preview reset drops
 * the transform and leaves a stale id behind ("Owner does not exist").
 */
export async function ensureCartTransform(
  admin: AdminClient,
  shop: string,
): Promise<string> {
  const existing = await prisma.shopSettings.findUnique({ where: { shop } });
  const list = await gql(admin, LIST_CART_TRANSFORMS);
  const nodes: Array<{ id: string }> = list.cartTransforms.nodes;
  if (existing?.cartTransformId && nodes.some((n) => n.id === existing.cartTransformId)) {
    return existing.cartTransformId;
  }

  let id: string | undefined = nodes[0]?.id;

  if (!id) {
    const created = await gql(admin, CREATE_CART_TRANSFORM, {
      functionHandle: FUNCTION_HANDLE,
      blockOnFailure: existing?.blockOnFailure ?? false,
    });
    assertNoUserErrors(created.cartTransformCreate, "Registering cart transform");
    id = created.cartTransformCreate.cartTransform.id as string;
  }

  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, cartTransformId: id },
    update: { cartTransformId: id },
  });
  return id!;
}

/**
 * Looks up (or registers) the required-fee validation. Created disabled; sync
 * turns it on only while a required fee is active so optional-only setups never
 * run an extra function at checkout.
 */
export async function ensureValidation(
  admin: AdminClient,
  shop: string,
): Promise<string> {
  const existing = await prisma.shopSettings.findUnique({ where: { shop } });
  const list = await gql(admin, LIST_VALIDATIONS);
  const nodes: Array<{ id: string }> = list.validations.nodes;
  if (existing?.validationId && nodes.some((n) => n.id === existing.validationId)) {
    return existing.validationId;
  }

  let id: string | undefined = nodes[0]?.id;

  if (!id) {
    const created = await gql(admin, CREATE_VALIDATION, {
      validation: {
        functionHandle: VALIDATION_HANDLE,
        title: "Required fee acceptance",
        enable: false,
        blockOnFailure: false,
      },
    });
    assertNoUserErrors(created.validationCreate, "Registering fee validation");
    id = created.validationCreate.validation.id as string;
  }

  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, validationId: id },
    update: { validationId: id },
  });
  return id!;
}

async function setValidationEnabled(admin: AdminClient, id: string, enable: boolean) {
  const res = await gql(admin, UPDATE_VALIDATION, { id, validation: { enable } });
  assertNoUserErrors(res.validationUpdate, "Updating fee validation");
}

/**
 * There is no cartTransformUpdate, so flipping blockOnFailure means deleting and
 * re-creating the transform; the caller must syncRules afterwards to restore its
 * metafields. The validation supports an in-place update.
 */
export async function setEngineBlockOnFailure(admin: AdminClient, shop: string, blockOnFailure: boolean) {
  const settings = await prisma.shopSettings.findUnique({ where: { shop } });
  if (settings?.cartTransformId) {
    const del = await gql(admin, DELETE_CART_TRANSFORM, { id: settings.cartTransformId });
    assertNoUserErrors(del.cartTransformDelete, "Removing cart transform");
    await prisma.shopSettings.update({ where: { shop }, data: { cartTransformId: null } });
  }
  await ensureCartTransform(admin, shop);
  if (settings?.validationId) {
    const res = await gql(admin, UPDATE_VALIDATION, {
      id: settings.validationId,
      validation: { blockOnFailure },
    });
    assertNoUserErrors(res.validationUpdate, "Updating fee validation");
  }
}

/**
 * Creates the hidden product whose variant represents a rule's fee line.
 * Price is irrelevant (the function sets it per cart); the product only has to
 * exist, be active and be purchasable on the channels where fees apply.
 */
async function provisionFeeProduct(
  admin: AdminClient,
  rule: { id: string; name: string; taxable: boolean },
): Promise<{ productId: string; variantId: string }> {
  // Reuse a product from an earlier, partially-failed sync rather than
  // leaving orphans behind.
  const found = await gql(admin, FIND_FEE_PRODUCT, {
    query: `tag:'fee-rule:${rule.id}'`,
  });
  const existing = found.products.nodes[0];
  if (existing) {
    await publishFeeProduct(admin, existing.id);
    return { productId: existing.id, variantId: existing.variants.nodes[0].id };
  }

  const created = await gql(admin, CREATE_FEE_PRODUCT, {
    product: {
      title: rule.name,
      // Purchasable, but hidden from storefront search, collections and recommendations.
      status: "UNLISTED",
      productType: "Fee",
      vendor: "Fee rules",
      tags: [FEE_PRODUCT_TAG, `fee-rule:${rule.id}`],
      descriptionHtml:
        "<p>Service fee line managed by the fee rules app. Do not edit or delete.</p>",
    },
  });
  assertNoUserErrors(created.productCreate, "Creating fee product");
  const productId: string = created.productCreate.product.id;
  const variantId: string = created.productCreate.product.variants.nodes[0].id;

  const configured = await gql(admin, CONFIGURE_FEE_VARIANT, {
    productId,
    variants: [
      {
        id: variantId,
        price: "0.00",
        taxable: rule.taxable,
        inventoryItem: { tracked: false, requiresShipping: false },
      },
    ],
  });
  assertNoUserErrors(configured.productVariantsBulkUpdate, "Configuring fee variant");

  await publishFeeProduct(admin, productId);
  return { productId, variantId };
}

/**
 * Publish to every sales channel so the fee line is accepted wherever the
 * cart transform runs (Online Store today, POS later). Idempotent.
 */
async function publishFeeProduct(admin: AdminClient, productId: string) {
  const pubs = await gql(admin, LIST_PUBLICATIONS);
  const input = pubs.publications.nodes.map((p: { id: string }) => ({
    publicationId: p.id,
  }));
  if (!input.length) return;
  const published = await gql(admin, PUBLISH_FEE_PRODUCT, { id: productId, input });
  assertNoUserErrors(published.publishablePublish, "Publishing fee product");
}

export async function deleteFeeProduct(admin: AdminClient, productId: string) {
  const res = await gql(admin, DELETE_FEE_PRODUCT, { input: { id: productId } });
  assertNoUserErrors(res.productDelete, "Deleting fee product");
}

/**
 * Pushes every active rule to the cart transform's metafield, provisioning fee
 * products for any rule that doesn't have one yet. Call after any rule change.
 */
export async function syncRules(admin: AdminClient, shop: string) {
  const cartTransformId = await ensureCartTransform(admin, shop);
  const rules = await listRules(shop);

  const active = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    let { productId, variantId } = rule;
    if (!productId || !variantId) {
      ({ productId, variantId } = await provisionFeeProduct(admin, rule));
      await prisma.feeRule.update({
        where: { id: rule.id },
        data: { productId, variantId },
      });
    }
    // Keep the hidden variant's tax flag and barcode in step with the rule.
    const configured = await gql(admin, CONFIGURE_FEE_VARIANT, {
      productId,
      variants: [{ id: variantId, taxable: rule.taxable, barcode: rule.barcode || null }],
    });
    assertNoUserErrors(configured.productVariantsBulkUpdate, "Updating fee variant");
    // Fee products created before Unlisted existed were Active and showed up in
    // storefront search and collections.
    const unlisted = await gql(admin, UNLIST_FEE_PRODUCT, { id: productId });
    assertNoUserErrors(unlisted.productUpdate, "Hiding fee product");

    active.push({
      id: rule.id,
      name: rule.name,
      type: rule.type,
      amount: rule.amount,
      scope: rule.scope,
      frequency: rule.frequency,
      requirement: rule.requirement,
      version: String(rule.updatedAt.getTime()),
      selection: rule.requirement === "OPTIONAL" ? rule.selection : undefined,
      placement: rule.placement,
      channels: rule.channels,
      variantId,
      minCharge: rule.minCharge,
      maxCharge: rule.maxCharge,
      matchMode: rule.matchMode,
      schedule: rule.scheduleEnabled
        ? { weekdays: rule.weekdays, startDate: rule.startDate, endDate: rule.endDate }
        : undefined,
      countryMode: rule.countryMode,
      marketHandles: rule.marketHandles,
      note: rule.shopperNote || undefined,
      details: rule.details || undefined,
      conditions: rule.conditions,
    });
  }

  // The function's input query takes the union of every rule's collections and
  // tags as query variables (max 100 each, per Shopify's limit).
  const uniq = (xs: string[]) => Array.from(new Set(xs)).slice(0, 100);
  const inputVariables = {
    collectionIds: uniq(active.flatMap((r) => r.conditions.collectionIds ?? [])),
    customerTags: uniq(active.flatMap((r) => r.conditions.customerTags ?? [])),
  };

  // Buyer-facing list of optional and required fees for the cart-page block
  // and embed (theme app extensions read app-data metafields on the app
  // installation) and the checkout block (reads $app shop metafields).
  const optionalFees = JSON.stringify(
    active
      .filter((r) => r.channels.includes("ONLINE_STORE"))
      .map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        amount: r.amount,
        required: r.requirement === "REQUIRED",
        version: r.version,
        selection: r.selection,
        placement: r.placement,
        note: r.note ?? "",
        // Cart-wide limits the storefront can check itself, so it can hide
        // fees that won't apply. Shop currency.
        minSubtotal: r.conditions.minSubtotal ?? null,
        maxSubtotal: r.conditions.maxSubtotal ?? null,
        minQuantity: r.conditions.minQuantity ?? null,
      })),
  );
  const ids = await gql(admin, OPTIONAL_FEE_OWNERS);
  // The fee-guard validation sees the cart before the transform runs, so it
  // re-runs the engine's matching on the required rules to know what applies.
  const validationId = await ensureValidation(admin, shop);
  const requiredRules = active.filter((r) => r.requirement === "REQUIRED");

  const res = await gql(admin, SET_RULES_METAFIELD, {
    metafields: [
      {
        ownerId: ids.currentAppInstallation.id,
        namespace: "fee_cart",
        key: "options",
        type: "json",
        value: optionalFees,
      },
      {
        ownerId: ids.shop.id,
        namespace: "$app",
        key: "optional-fees",
        type: "json",
        value: optionalFees,
      },
      {
        ownerId: cartTransformId,
        namespace: "$app",
        key: "rules",
        type: "json",
        value: JSON.stringify({ version: 1, rules: active }),
      },
      {
        ownerId: cartTransformId,
        namespace: "$app",
        key: "input-variables",
        type: "json",
        value: JSON.stringify(inputVariables),
      },
      {
        ownerId: validationId,
        namespace: "$app",
        key: "rules",
        type: "json",
        value: JSON.stringify({ version: 1, rules: requiredRules }),
      },
      {
        ownerId: validationId,
        namespace: "$app",
        key: "input-variables",
        type: "json",
        value: JSON.stringify(inputVariables),
      },
    ],
  });
  assertNoUserErrors(res.metafieldsSet, "Saving fee configuration");

  const settings = await prisma.shopSettings.findUnique({ where: { shop } });
  const needsGuard =
    (settings?.guardEnabled ?? true) && requiredRules.length > 0;
  await setValidationEnabled(admin, validationId, needsGuard);

  return active.length;
}
