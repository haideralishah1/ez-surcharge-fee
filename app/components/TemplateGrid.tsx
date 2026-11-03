import { planAtLeast, type Plan } from "../lib/plans";
import { FEE_TEMPLATES } from "../lib/templates";
import { IconTile } from "./IconPicker";

/** Preset starting points. Locked cards still explain what they'd do. */
export function TemplateGrid({ plan }: { plan: Plan }) {
  return (
    <s-grid gridTemplateColumns="@container (inline-size > 640px) 1fr 1fr 1fr, 1fr" gap="base">
      {FEE_TEMPLATES.map((t) => {
        const locked = !planAtLeast(plan, t.plan);
        return (
          <s-box key={t.key} border="base" borderRadius="base" padding="base" background="base">
            <s-stack direction="block" gap="small" blockSize="100%">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <IconTile iconKey={t.values.icon ?? "order-fee"} />
                {locked && <s-badge tone="info">Pro</s-badge>}
              </s-stack>
              <s-text type="strong">{t.title}</s-text>
              <s-text color={locked ? "subdued" : "base"}>{t.blurb}</s-text>
              {locked ? (
                <s-text color="subdued">Required fees are part of Pro. <s-link href="/app/plans">Compare plans</s-link></s-text>
              ) : (
                <s-button href={`/app/rules/new?template=${t.key}`} variant="secondary">
                  Use this start point
                </s-button>
              )}
            </s-stack>
          </s-box>
        );
      })}
    </s-grid>
  );
}
