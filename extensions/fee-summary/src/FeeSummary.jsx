import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useAttributeValues } from "@shopify/ui-extensions/checkout/preact";
import {
  choosableInCheckout,
  collectFees,
  fill,
  parseList,
  readOptionalFees,
  readSettings,
  serializeList,
  sortFees,
  textFor,
  toggleFee,
} from "./fees";

export default async () => {
  render(<FeeSummary />, document.body);
};

/**
 * Order-summary breakdown of every fee the cart transform added. Optional fees
 * get a checkbox: unticking an opt-out fee records it in `_declined_fees`,
 * ticking an opt-in fee records it in `_selected_fees`; the cart transform
 * honours both. Opt-in fees that aren't selected yet are listed unticked.
 */
function FeeSummary() {
  const lines = shopify.lines.value;
  const settings = readSettings(shopify.appMetafields.value);
  const options = readOptionalFees(shopify.appMetafields.value);
  const t = textFor(settings, shopify.localization.language.value?.isoCode);
  const [declinedRaw, selectedRaw] = useAttributeValues(["_declined_fees", "_selected_fees"]);
  const declined = parseList(declinedRaw);
  const selected = parseList(selectedRaw);
  const canUpdate = shopify.instructions.value.attributes.canUpdateAttributes;

  if (!settings.showFeesBlock) return null;

  const fees = sortFees(collectFees(lines), settings.sortOrder);
  const applied = new Set(fees.map((f) => f.ruleId));
  // Optional fees the buyer can add: opt-in fees not selected yet, and opt-out
  // fees they removed. Fees missing for other reasons (conditions) aren't shown.
  const addable = Array.from(options.values()).filter(
    (o) =>
      !o.required &&
      !applied.has(o.id) &&
      choosableInCheckout(o) &&
      (o.selection === "OPT_IN" ? !selected.includes(o.id) : declined.includes(o.id)),
  );
  // Removed fees from before the optional-fee list existed; keep them restorable.
  const removed = declined.filter((id) => !applied.has(id) && !options.has(id));
  if (fees.length === 0 && addable.length === 0 && removed.length === 0) return null;

  async function setFee(ruleId, on) {
    const next = toggleFee(ruleId, on, options.get(ruleId), selected, declined);
    for (const [key, ids] of Object.entries(next)) {
      const result = await shopify.applyAttributeChange({
        type: "updateAttribute",
        key,
        value: serializeList(ids),
      });
      if (result.type === "error") console.error(result.message);
    }
  }

  const price = (o) =>
    o.type === "PERCENTAGE" ? `${o.amount}%` : shopify.i18n.formatCurrency(o.amount);

  return (
    <s-stack gap="small-200">
      <s-text type="strong">{t.heading}</s-text>
      {fees.map((fee) => {
        const option = options.get(fee.ruleId);
        const toggleable = !fee.required && canUpdate && choosableInCheckout(option);
        return (
          <s-stack key={fee.ruleId} direction="inline" justifyContent="space-between" alignItems="center">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              {toggleable && (
                <s-checkbox
                  checked
                  accessibilityLabel={`${t.remove} ${fee.title}`}
                  onChange={() => setFee(fee.ruleId, false)}
                />
              )}
              <s-stack gap="none">
                <s-text>{fee.title}</s-text>
                {fee.note && <s-text color="subdued">{fee.note}</s-text>}
                {fee.details && <s-text color="subdued" type="small">{fee.details}</s-text>}
              </s-stack>
              {fee.required && <s-badge tone="neutral">{t.required}</s-badge>}
            </s-stack>
            <s-text>{shopify.i18n.formatCurrency(fee.amount)}</s-text>
          </s-stack>
        );
      })}
      {addable.map((o) => (
        <s-stack key={o.id} direction="inline" justifyContent="space-between" alignItems="center">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            {canUpdate && (
              <s-checkbox
                checked={false}
                accessibilityLabel={fill(t.addFee, { fee: o.name })}
                onChange={() => setFee(o.id, true)}
              />
            )}
            <s-stack gap="none">
              <s-text color="subdued">{o.name}</s-text>
              {o.note && <s-text color="subdued">{o.note}</s-text>}
            </s-stack>
          </s-stack>
          <s-text color="subdued">{price(o)}</s-text>
        </s-stack>
      ))}
      {removed.map((id) => (
        <s-stack key={id} direction="inline" justifyContent="space-between" alignItems="center">
          <s-text color="subdued">{t.feeRemoved}</s-text>
          {canUpdate && (
            <s-link onClick={() => setFee(id, true)}>{t.addBack}</s-link>
          )}
        </s-stack>
      ))}
    </s-stack>
  );
}
