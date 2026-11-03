import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useAttributeValues } from "@shopify/ui-extensions/checkout/preact";
import {
  acceptToken,
  collectFees,
  fill,
  parseList,
  readSettings,
  serializeList,
  textFor,
  withoutRule,
} from "./fees";

export default async () => {
  render(<FeeAcceptance />, document.body);
};

/**
 * One checkbox per required fee, shown just above the checkout actions.
 * Acknowledgement is stored in `_accepted_fees` as `ruleId@version`; the
 * fee-guard validation function blocks checkout until every required fee's
 * current version is listed there.
 */
function FeeAcceptance() {
  const lines = shopify.lines.value;
  const settings = readSettings(shopify.appMetafields.value);
  const t = textFor(settings, shopify.localization.language.value?.isoCode);
  const [acceptedRaw] = useAttributeValues(["_accepted_fees"]);
  const accepted = parseList(acceptedRaw);
  const canUpdate = shopify.instructions.value.attributes.canUpdateAttributes;

  if (!settings.showAcceptance) return null;
  const required = collectFees(lines).filter((f) => f.required);
  if (required.length === 0) return null;

  async function toggle(fee, on) {
    const rest = withoutRule(accepted, fee.ruleId);
    const next = on ? [...rest, acceptToken(fee.ruleId, fee.version)] : rest;
    const result = await shopify.applyAttributeChange({
      type: "updateAttribute",
      key: "_accepted_fees",
      value: serializeList(next),
    });
    if (result.type === "error") console.error(result.message);
  }

  return (
    <s-stack gap="small-200">
      {required.map((fee) => (
        <s-checkbox
          key={fee.ruleId}
          checked={accepted.includes(acceptToken(fee.ruleId, fee.version))}
          disabled={!canUpdate}
          onChange={(e) =>
            toggle(fee, /** @type {HTMLInputElement} */ (e.target).checked)
          }
          label={fill(t.accept, { fee: fee.title, price: shopify.i18n.formatCurrency(fee.amount) })}
        />
      ))}
    </s-stack>
  );
}
