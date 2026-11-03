import type {
  CartValidationsGenerateRunInput,
  CartValidationsGenerateRunResult,
  ValidationError,
} from "../generated/api";
import type { CartTransformRunInput } from "../../fee-engine/generated/api";
import { cartTransformRun } from "../../fee-engine/src/cart_transform_run";
import { parseConfig } from "../../fee-engine/src/config";

const DEFAULT_MESSAGE = "Please go back to your cart and accept the {fee} to continue.";

interface Settings {
  guardEnabled?: boolean;
  text?: { missingRequired?: string };
  translations?: Record<string, { missingRequired?: string }>;
}

/** Message template for the buyer's language, falling back to the default. */
function messageTemplate(raw: unknown, isoCode: string): string {
  const s = (raw && typeof raw === "object" ? raw : {}) as Settings;
  const code = isoCode.toLowerCase().replace("_", "-");
  const base = code.split("-")[0];
  return (
    s.translations?.[code]?.missingRequired ||
    s.translations?.[base]?.missingRequired ||
    s.text?.missingRequired ||
    DEFAULT_MESSAGE
  );
}

/**
 * Blocks checkout while a required fee that applies to this cart hasn't been
 * accepted. Validations see the cart before the fee-engine cart transform
 * expands it, so the fee lines aren't visible here; instead the required rules
 * (synced to this validation's `$app.rules` metafield) are run through the
 * engine's own matching. The checkout block and cart-page block/embed record
 * acceptance in the `_accepted_fees` cart attribute as `ruleId@version`
 * tokens; a token only counts for the version the buyer accepted.
 *
 * Cart interactions are never blocked, so buyers can still build their cart
 * before accepting.
 */
export function cartValidationsGenerateRun(
  input: CartValidationsGenerateRunInput,
): CartValidationsGenerateRunResult {
  const raw = input.shop.settings?.jsonValue;
  const settings = (raw && typeof raw === "object" ? raw : {}) as Settings;
  if (settings.guardEnabled === false) return { operations: [] };
  if (input.buyerJourney.step === "CART_INTERACTION") return { operations: [] };

  const config = parseConfig(input.validation.rules?.jsonValue);
  if (!config || config.rules.length === 0) return { operations: [] };
  const rules = new Map(config.rules.map((r) => [r.id, r]));

  // Same shape as the engine's input; declined/selected only affect optional fees.
  const engineInput = {
    presentmentCurrencyRate: input.presentmentCurrencyRate,
    cartTransform: { metafield: input.validation.rules },
    localization: input.localization,
    shop: input.shop,
    cart: { ...input.cart, declinedFees: null, selectedFees: null },
  } as unknown as CartTransformRunInput;

  const applied = new Set<string>();
  for (const op of cartTransformRun(engineInput).operations) {
    for (const item of op.lineExpand?.expandedCartItems ?? []) {
      const ruleId = item.attributes?.find((a) => a.key === "_fee_rule")?.value;
      if (ruleId && rules.get(ruleId)?.requirement === "REQUIRED") applied.add(ruleId);
    }
  }
  if (applied.size === 0) return { operations: [] };

  const template = messageTemplate(raw, input.localization.language.isoCode);
  const accepted = new Set(
    (input.cart.acceptedFees?.value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const errors: ValidationError[] = [];
  for (const ruleId of applied) {
    const rule = rules.get(ruleId)!;
    const token = rule.version ? `${ruleId}@${rule.version}` : ruleId;
    if (accepted.has(token)) continue;
    errors.push({
      message: template.replace(/\{fee\}/g, rule.name),
      target: "$.cart",
    });
  }

  if (errors.length === 0) return { operations: [] };
  return { operations: [{ validationAdd: { errors } }] };
}
