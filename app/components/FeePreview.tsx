import type { FeeRuleInput } from "../lib/fee-rules";
import { formatMoney } from "../lib/format";
import { IconTile } from "./IconPicker";

/** Sample cart used to show merchants how a fee will land, mirroring the function's math. */
const SAMPLE_LINES = [
  { title: "Canvas tote bag", price: 24, quantity: 1 },
  { title: "Glass water bottle", price: 12.5, quantity: 2 },
];

interface Props {
  rule: Partial<FeeRuleInput>;
  currencyCode: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function FeePreview({ rule, currencyCode }: Props) {
  const money = (n: number) => formatMoney(n, currencyCode);
  const amount = Number(rule.amount) || 0;
  const isPct = rule.type === "PERCENTAGE";
  const name = rule.name?.trim() || "Your fee";
  const subtotal = SAMPLE_LINES.reduce((s, l) => s + l.price * l.quantity, 0);

  const cap = (n: number) => {
    let v = n;
    if (rule.minCharge !== undefined && rule.minCharge !== null) v = Math.max(v, Number(rule.minCharge));
    if (rule.maxCharge !== undefined && rule.maxCharge !== null) v = Math.min(v, Number(rule.maxCharge));
    return round(v);
  };

  let feeTotal = 0;
  let detail = "";
  if (rule.scope === "PRODUCT") {
    // Preview targets the first sample product when specific products are chosen.
    const targeted =
      rule.matchMode !== "ALL_PRODUCTS" &&
      ((rule.conditions?.productIds?.length ?? 0) > 0 ||
        (rule.conditions?.collectionIds?.length ?? 0) > 0);
    const lines = targeted ? [SAMPLE_LINES[0]] : SAMPLE_LINES;
    for (const l of lines) {
      if (rule.frequency === "PER_LINE") {
        feeTotal += cap(isPct ? (l.price * l.quantity * amount) / 100 : amount);
      } else {
        feeTotal += cap(isPct ? (l.price * amount) / 100 : amount) * l.quantity;
      }
    }
    detail = rule.frequency === "PER_LINE" ? "once per matching product" : "per unit";
  } else {
    feeTotal = cap(isPct ? (subtotal * amount) / 100 : amount);
    detail = "once per order";
  }
  feeTotal = round(feeTotal);

  return (
    <s-box border="base" borderRadius="base" padding="base" background="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="start">
          <s-stack direction="block" gap="small-500">
            <s-heading>Cart</s-heading>
            <s-text color="subdued">Preview</s-text>
          </s-stack>
          <s-badge tone={feeTotal > 0 ? "success" : "neutral"}>
            {feeTotal > 0 ? "Fee applied" : "No fee yet"}
          </s-badge>
        </s-stack>

        <s-stack direction="inline" justifyContent="space-between">
          <s-text color="subdued">ITEM</s-text>
          <s-text color="subdued">TOTAL</s-text>
        </s-stack>
        {SAMPLE_LINES.map((l) => (
          <s-stack key={l.title} direction="inline" justifyContent="space-between" alignItems="center" gap="base">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-box background="subdued" borderRadius="base" inlineSize="40px" blockSize="40px" />
              <s-stack direction="block" gap="small-500">
                <s-text>{l.title}</s-text>
                <s-text color="subdued">× {l.quantity}</s-text>
              </s-stack>
            </s-stack>
            <s-text fontVariantNumeric="tabular-nums">{money(l.price * l.quantity)}</s-text>
          </s-stack>
        ))}

        <s-box border="base" borderRadius="base" padding="small" background="subdued">
          <s-stack direction="block" gap="small-200">
            <s-text color="subdued">{rule.scope === "PRODUCT" ? "LINE FEE" : "ORDER FEE"}</s-text>
            <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
              <s-stack direction="inline" gap="small" alignItems="center">
                <IconTile iconKey={rule.icon ?? "order-fee"} />
                <s-stack direction="block" gap="small-500">
                  <s-text type="strong">{name}</s-text>
                  <s-text color="subdued">{rule.shopperNote?.trim() || `Charged ${detail}.`}</s-text>
                </s-stack>
              </s-stack>
              <s-stack direction="block" gap="small-500" alignItems="end">
                <s-text fontVariantNumeric="tabular-nums">{money(feeTotal)}</s-text>
                {rule.requirement === "REQUIRED" ? (
                  <s-badge tone="info">Required</s-badge>
                ) : (
                  <s-text color="subdued">Remove</s-text>
                )}
              </s-stack>
            </s-stack>
          </s-stack>
        </s-box>

        <s-divider />
        <s-stack direction="inline" justifyContent="space-between">
          <s-text color="subdued">Subtotal</s-text>
          <s-text fontVariantNumeric="tabular-nums">{money(subtotal)}</s-text>
        </s-stack>
        <s-stack direction="inline" justifyContent="space-between">
          <s-text color="subdued">Fees</s-text>
          <s-text fontVariantNumeric="tabular-nums">{money(feeTotal)}</s-text>
        </s-stack>
        <s-stack direction="inline" justifyContent="space-between">
          <s-text type="strong">Total</s-text>
          <s-text type="strong" fontVariantNumeric="tabular-nums">{money(subtotal + feeTotal)}</s-text>
        </s-stack>
        <s-text color="subdued">
          {rule.taxable === false ? "Fee is not taxed. " : "Tax on the fee is calculated at checkout. "}
          Shipping at checkout.
        </s-text>
      </s-stack>
    </s-box>
  );
}
