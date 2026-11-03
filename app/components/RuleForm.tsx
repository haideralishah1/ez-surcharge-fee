import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import type {
  Channel,
  Conditions,
  CountryMode,
  FieldErrors,
  FeeRuleInput,
  MatchMode,
} from "../lib/fee-rules";
import { hasFeature, type Plan } from "../lib/plans";
import { CHANNEL_LABEL, WEEKDAYS } from "../lib/format";
import { DEFAULT_ICON } from "../lib/icons";
import { FeePreview } from "./FeePreview";
import { IconPicker } from "./IconPicker";

type Num = number | "";
type Draft = Omit<FeeRuleInput, "amount" | "minCharge" | "maxCharge"> & {
  amount: Num;
  minCharge: Num;
  maxCharge: Num;
};

const EMPTY: Draft = {
  name: "",
  description: "",
  active: true,
  type: "FIXED",
  amount: "",
  scope: "CART",
  frequency: "PER_UNIT",
  requirement: "OPTIONAL",
  selection: "OPT_OUT",
  placement: "BOTH",
  channels: ["ONLINE_STORE"],
  conditions: {},
  icon: DEFAULT_ICON,
  minCharge: "",
  maxCharge: "",
  taxable: true,
  matchMode: "ALL_PRODUCTS",
  scheduleEnabled: false,
  weekdays: [],
  startDate: undefined,
  endDate: undefined,
  countryMode: "ALL",
  marketHandles: [],
  shopperNote: "",
  details: "",
  orderTag: "",
  barcode: "",
};

const val = (e: Event) => (e.target as HTMLInputElement).value;
const checked = (e: Event) => (e.target as HTMLInputElement).checked;
const choice = (e: Event) => (e.target as unknown as { values?: string[] }).values?.[0];
const toNum = (s: string): Num => (s.trim() === "" ? "" : Number(s));
const csv = (xs: readonly string[] | undefined) => (xs ?? []).join(", ");
const splitCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function toDraft(rule?: Partial<FeeRuleInput>): Draft {
  return {
    ...EMPTY,
    ...rule,
    amount: rule?.amount ?? "",
    minCharge: rule?.minCharge ?? "",
    maxCharge: rule?.maxCharge ?? "",
    conditions: { ...rule?.conditions },
    weekdays: [...(rule?.weekdays ?? [])],
    marketHandles: [...(rule?.marketHandles ?? [])],
    channels: [...(rule?.channels ?? EMPTY.channels)],
  };
}

interface Props {
  rule?: Partial<FeeRuleInput>;
  plan: Plan;
  currencyCode: string;
  errors?: FieldErrors;
  submitLabel: string;
}

export function RuleForm({ rule, plan, currencyCode, errors = {}, submitLabel }: Props) {
  const shopify = useAppBridge();
  const saving = useNavigation().state !== "idle";
  const [d, setD] = useState<Draft>(() => toDraft(rule));
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));
  const patchCond = (p: Partial<Conditions>) =>
    setD((prev) => ({ ...prev, conditions: { ...prev.conditions, ...p } }));
  const c = d.conditions;

  const toggleIn = <T,>(xs: T[], x: T, on: boolean) =>
    on ? Array.from(new Set([...xs, x])) : xs.filter((y) => y !== x);

  const pick = async (type: "product" | "collection") => {
    const ids = (type === "product" ? c.productIds : c.collectionIds) ?? [];
    const picked = await shopify.resourcePicker({
      type,
      multiple: true,
      selectionIds: ids.map((id) => ({ id })),
    });
    if (!picked) return;
    const labels = Object.fromEntries(picked.map((p) => [p.id, p.title]));
    patchCond(
      type === "product"
        ? { productIds: picked.map((p) => p.id), productLabels: labels }
        : { collectionIds: picked.map((p) => p.id), collectionLabels: labels },
    );
  };

  const isProduct = d.scope === "PRODUCT";
  const isPct = d.type === "PERCENTAGE";
  const preview: Partial<FeeRuleInput> = {
    ...d,
    amount: Number(d.amount) || 0,
    minCharge: d.minCharge === "" ? undefined : d.minCharge,
    maxCharge: d.maxCharge === "" ? undefined : d.maxCharge,
  };

  return (
    <Form
      method="post"
      data-save-bar
      data-discard-confirmation
      onReset={() => setD(toDraft(rule))}
    >
      {/* Serialized state for the action. Visible controls mirror it for the save bar. */}
      <input type="hidden" name="active" value={String(d.active)} />
      <input type="hidden" name="type" value={d.type} />
      <input type="hidden" name="scope" value={d.scope} />
      <input type="hidden" name="frequency" value={d.frequency} />
      <input type="hidden" name="requirement" value={d.requirement} />
      <input type="hidden" name="selection" value={d.selection} />
      <input type="hidden" name="placement" value={d.placement} />
      <input type="hidden" name="matchMode" value={d.matchMode} />
      <input type="hidden" name="countryMode" value={d.countryMode} />
      <input type="hidden" name="taxable" value={String(d.taxable)} />
      <input type="hidden" name="scheduleEnabled" value={String(d.scheduleEnabled)} />
      {d.channels.map((ch) => <input key={ch} type="hidden" name="channels" value={ch} />)}
      {d.weekdays.map((w) => <input key={w} type="hidden" name="weekdays" value={w} />)}
      <input type="hidden" name="productIds" value={(c.productIds ?? []).join(",")} />
      <input type="hidden" name="productLabels" value={JSON.stringify(c.productLabels ?? {})} />
      <input type="hidden" name="collectionIds" value={(c.collectionIds ?? []).join(",")} />
      <input type="hidden" name="collectionLabels" value={JSON.stringify(c.collectionLabels ?? {})} />

      <s-grid gridTemplateColumns="@container (inline-size > 860px) minmax(0, 2fr) minmax(280px, 1fr), 1fr" gap="base">
        <s-stack direction="block" gap="base">
          {/* ---------------------------------------------------------------- General */}
          <s-section heading="General">
            <s-stack direction="block" gap="base">
              <s-text-field
                label="Fee name"
                name="name"
                value={d.name}
                onInput={(e) => patch({ name: val(e) })}
                error={errors.name}
                placeholder="e.g. Import tariff"
                details="Buyers see this in checkout."
              />
              <s-choice-list
                label="Applies to"
                name="scope-choice"
                values={[d.scope]}
                onChange={(e) => {
                  const v = choice(e) as Draft["scope"] | undefined;
                  if (v) patch({ scope: v });
                }}
                error={errors.scope}
              >
                <s-choice value="PRODUCT">
                  Product fee
                  <s-text slot="details" color="subdued">Attached to matching products, repeated per unit or per product.</s-text>
                </s-choice>
                <s-choice value="CART">
                  Order fee
                  <s-text slot="details" color="subdued">One fee for the whole order.</s-text>
                </s-choice>
              </s-choice-list>

              <IconPicker value={d.icon} onChange={(icon) => patch({ icon })} />

              <s-choice-list
                label="Buyer choice"
                name="requirement-choice"
                values={[d.requirement]}
                onChange={(e) => {
                  const v = choice(e) as Draft["requirement"] | undefined;
                  if (v) patch({ requirement: v });
                }}
                error={errors.requirement}
              >
                <s-choice value="OPTIONAL">
                  Optional
                  <s-text slot="details" color="subdued">Buyers tick or untick a checkbox to add or remove it.</s-text>
                </s-choice>
                <s-choice value="REQUIRED" disabled={!hasFeature(plan, "requiredFees")}>
                  Required
                  <s-text slot="details" color="subdued">
                    {hasFeature(plan, "requiredFees")
                      ? "Buyers tick \"I accept\" in the cart (Fee options embed or block) or in checkout before they can pay."
                      : "Available on Pro."}
                  </s-text>
                </s-choice>
              </s-choice-list>

              {d.requirement === "OPTIONAL" && (
                <s-stack direction="block" gap="base">
                  <s-select
                    label="Checkbox starts"
                    value={d.selection}
                    onChange={(e) => patch({ selection: val(e) as Draft["selection"] })}
                    details={
                      d.selection === "OPT_IN"
                        ? "Not added until the buyer ticks it. Best for add-ons like gift wrap or shipping protection."
                        : "Added automatically; the buyer can untick it to remove the fee."
                    }
                  >
                    <s-option value="OPT_OUT">Ticked (fee added)</s-option>
                    <s-option value="OPT_IN">Unticked (buyer adds it)</s-option>
                  </s-select>
                  <s-select
                    label="Where customers choose this fee"
                    value={d.placement}
                    onChange={(e) => patch({ placement: val(e) as Draft["placement"] })}
                    details={
                      d.placement === "CART"
                        ? "Shown in the Fee options block on the cart page. Add the block in your theme editor."
                        : d.placement === "CHECKOUT"
                          ? "Shown in checkout. Checkout blocks only appear on Shopify Plus stores."
                          : "Cart page block on every plan, plus checkout on Shopify Plus."
                    }
                  >
                    <s-option value="BOTH">Cart page and checkout</s-option>
                    <s-option value="CART">Cart page</s-option>
                    <s-option value="CHECKOUT">Checkout (Shopify Plus)</s-option>
                  </s-select>
                </s-stack>
              )}

              <s-text-field
                label="Internal note"
                name="description"
                value={d.description}
                onInput={(e) => patch({ description: val(e) })}
                details="Only your team sees this."
              />
            </s-stack>
          </s-section>

          {/* ---------------------------------------------------------------- Pricing */}
          <s-section heading="Pricing">
            <s-stack direction="block" gap="base">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-select
                  label="Charge type"
                  value={d.type}
                  onChange={(e) => patch({ type: val(e) as Draft["type"] })}
                  error={errors.type}
                >
                  <s-option value="FIXED">Fixed amount</s-option>
                  <s-option value="PERCENTAGE">Percentage</s-option>
                </s-select>
                {isPct ? (
                  <s-number-field
                    label="Percent"
                    name="amount"
                    value={d.amount === "" ? "" : String(d.amount)}
                    onInput={(e) => patch({ amount: toNum(val(e)) })}
                    error={errors.amount}
                    suffix="%"
                    min={0}
                    max={100}
                    step={0.01}
                  />
                ) : (
                  <s-money-field
                    label={`Amount (${currencyCode})`}
                    name="amount"
                    value={d.amount === "" ? "" : String(d.amount)}
                    onInput={(e) => patch({ amount: toNum(val(e)) })}
                    error={errors.amount}
                    min={0}
                  />
                )}
              </s-grid>

              {isProduct && (
                <s-select
                  label="Charge frequency"
                  value={d.frequency}
                  onChange={(e) => patch({ frequency: val(e) as Draft["frequency"] })}
                  details={
                    d.frequency === "PER_LINE"
                      ? "Charged once per matching product, however many units are ordered."
                      : "Charged for every unit of a matching product."
                  }
                >
                  <s-option value="PER_UNIT">For every unit</s-option>
                  <s-option value="PER_LINE">Once per matching product</s-option>
                </s-select>
              )}

              {isPct && (
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <s-money-field
                    label="Minimum charge"
                    name="minCharge"
                    value={d.minCharge === "" ? "" : String(d.minCharge)}
                    onInput={(e) => patch({ minCharge: toNum(val(e)) })}
                    error={errors.minCharge}
                    details="Optional floor for each charge."
                  />
                  <s-money-field
                    label="Maximum charge"
                    name="maxCharge"
                    value={d.maxCharge === "" ? "" : String(d.maxCharge)}
                    onInput={(e) => patch({ maxCharge: toNum(val(e)) })}
                    error={errors.maxCharge}
                    details="Optional cap for each charge."
                  />
                </s-grid>
              )}

              <s-checkbox
                label="Charge tax on this fee"
                details="When on, Shopify applies the store's tax rules to the fee line."
                checked={d.taxable}
                onChange={(e) => patch({ taxable: checked(e) })}
              />
            </s-stack>
          </s-section>

          {/* ---------------------------------------------------------------- Channels */}
          <s-section heading="Sales channels">
            <s-stack direction="block" gap="small">
              {(["ONLINE_STORE", "POS", "DRAFT_ORDER"] as Channel[]).map((ch) => {
                const locked =
                  (ch === "POS" && !hasFeature(plan, "channelPos")) ||
                  (ch === "DRAFT_ORDER" && !hasFeature(plan, "channelDraftOrder"));
                return (
                  <s-checkbox
                    key={ch}
                    label={locked ? `${CHANNEL_LABEL[ch]} (Pro)` : CHANNEL_LABEL[ch]}
                    checked={d.channels.includes(ch)}
                    disabled={locked}
                    onChange={(e) => patch({ channels: toggleIn(d.channels, ch, checked(e)) })}
                  />
                );
              })}
              {errors.channels && <s-text tone="critical">{errors.channels}</s-text>}
              <s-box background="subdued" borderRadius="base" padding="small">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-icon type="check-circle" tone="success" />
                  <s-text color="subdued">
                    Checkout placement is automatic. No theme or app-embed setup needed.
                  </s-text>
                </s-stack>
              </s-box>
            </s-stack>
          </s-section>

          {/* ---------------------------------------------------------------- Matching */}
          <s-section heading="Matching rules">
            <s-stack direction="block" gap="base">
              <s-paragraph color="subdued">
                {isProduct
                  ? "Which products carry this fee."
                  : "Optional: only charge when the cart contains matching products."}
              </s-paragraph>
              <s-choice-list
                label="Match logic"
                name="match-choice"
                values={[d.matchMode]}
                onChange={(e) => {
                  const v = choice(e) as MatchMode | undefined;
                  if (v) patch({ matchMode: v });
                }}
                error={errors.matchMode}
              >
                <s-choice value="ALL_PRODUCTS">All products</s-choice>
                <s-choice value="ANY">
                  Any rule
                  <s-text slot="details" color="subdued">Matches if the item is any chosen product or in any chosen collection.</s-text>
                </s-choice>
                <s-choice value="ALL">
                  All rules
                  <s-text slot="details" color="subdued">Must be a chosen product (if any) and in every chosen collection.</s-text>
                </s-choice>
              </s-choice-list>
              {d.matchMode !== "ALL_PRODUCTS" && (
                <>
                  <PickerRow
                    label="Products"
                    ids={c.productIds ?? []}
                    labels={c.productLabels ?? {}}
                    onPick={() => pick("product")}
                    onClear={() => patchCond({ productIds: undefined, productLabels: undefined })}
                  />
                  <PickerRow
                    label="Collections"
                    ids={c.collectionIds ?? []}
                    labels={c.collectionLabels ?? {}}
                    onPick={() => pick("collection")}
                    onClear={() => patchCond({ collectionIds: undefined, collectionLabels: undefined })}
                  />
                </>
              )}
            </s-stack>
          </s-section>

          {/* ---------------------------------------------------------------- Schedule */}
          <s-section heading="Schedule">
            <s-stack direction="block" gap="base">
              <s-checkbox
                label="Only charge on certain days"
                details="Weekday and date limits use your store's local time."
                checked={d.scheduleEnabled}
                onChange={(e) => patch({ scheduleEnabled: checked(e) })}
                error={errors.scheduleEnabled}
              />
              {d.scheduleEnabled && (
                <>
                  <s-stack direction="inline" gap="small" alignItems="center">
                    {WEEKDAYS.map((w) => (
                      <s-checkbox
                        key={w.value}
                        label={w.label}
                        checked={d.weekdays.includes(w.value)}
                        onChange={(e) => patch({ weekdays: toggleIn(d.weekdays, w.value, checked(e)) })}
                      />
                    ))}
                  </s-stack>
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <s-date-field
                      label="Start date"
                      name="startDate"
                      value={d.startDate ?? ""}
                      onChange={(e) => patch({ startDate: val(e) || undefined })}
                      error={errors.startDate}
                    />
                    <s-date-field
                      label="End date"
                      name="endDate"
                      value={d.endDate ?? ""}
                      onChange={(e) => patch({ endDate: val(e) || undefined })}
                      error={errors.endDate}
                    />
                  </s-grid>
                </>
              )}
            </s-stack>
          </s-section>

          {/* ---------------------------------------------------------------- Advanced */}
          <s-section heading="Advanced rules">
            <s-stack direction="block" gap="base">
              <s-heading>Cart limits</s-heading>
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-money-field
                  label="Cart subtotal at least"
                  name="minSubtotal"
                  value={c.minSubtotal?.toString() ?? ""}
                  onInput={(e) => patchCond({ minSubtotal: val(e) === "" ? undefined : Number(val(e)) })}
                  error={errors.minSubtotal}
                />
                <s-money-field
                  label="Cart subtotal at most"
                  name="maxSubtotal"
                  value={c.maxSubtotal?.toString() ?? ""}
                  onInput={(e) => patchCond({ maxSubtotal: val(e) === "" ? undefined : Number(val(e)) })}
                  error={errors.maxSubtotal}
                />
                <s-number-field
                  label="Total items at least"
                  name="minQuantity"
                  value={c.minQuantity?.toString() ?? ""}
                  onInput={(e) => patchCond({ minQuantity: val(e) === "" ? undefined : Number(val(e)) })}
                  error={errors.minQuantity}
                />
                <s-number-field
                  label="Cart weight at most (g)"
                  name="maxWeightGrams"
                  value={c.maxWeightGrams?.toString() ?? ""}
                  onInput={(e) => patchCond({ maxWeightGrams: val(e) === "" ? undefined : Number(val(e)) })}
                  error={errors.maxWeightGrams}
                />
              </s-grid>

              <s-divider />
              <s-heading>Country visibility</s-heading>
              <s-paragraph color="subdued">
                Based on the country the buyer is shopping in (their Markets context). The
                shipping address isn&apos;t known while the cart is built.
              </s-paragraph>
              <s-choice-list
                label="Target countries"
                name="country-choice"
                values={[d.countryMode]}
                onChange={(e) => {
                  const v = choice(e) as CountryMode | undefined;
                  if (v) patch({ countryMode: v });
                }}
              >
                <s-choice value="ALL">Visible in all countries</s-choice>
                <s-choice value="ONLY">Visible only in selected countries</s-choice>
                <s-choice value="EXCEPT">Hidden in selected countries</s-choice>
              </s-choice-list>
              {d.countryMode !== "ALL" && (
                <s-text-field
                  label="Countries"
                  name="countries"
                  placeholder="US, CA, GB"
                  details="Two-letter codes, comma separated."
                  value={csv(c.countries)}
                  onInput={(e) => patchCond({ countries: splitCsv(val(e)).map((s) => s.toUpperCase()) })}
                  error={errors.countries}
                />
              )}

              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-heading>Market visibility</s-heading>
                {!hasFeature(plan, "markets") && <s-badge tone="info">Pro</s-badge>}
              </s-stack>
              <s-text-field
                label="Shopify Markets handles"
                name="marketHandles"
                placeholder="eu, north-america"
                details={
                  hasFeature(plan, "markets")
                    ? "Only charge in these markets. Comma separated handles from Settings → Markets."
                    : "Available on Pro."
                }
                disabled={!hasFeature(plan, "markets")}
                value={csv(d.marketHandles)}
                onInput={(e) => patch({ marketHandles: splitCsv(val(e)).map((s) => s.toLowerCase()) })}
                error={errors.marketHandles}
              />

              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-heading>Customer rules</s-heading>
                {!hasFeature(plan, "customerTags") && <s-badge tone="info">Plus</s-badge>}
              </s-stack>
              <s-text-field
                label="Customer tags"
                name="customerTags"
                placeholder="wholesale, vip"
                details={hasFeature(plan, "customerTags") ? "Only charge customers with any of these tags." : "Available on Plus."}
                disabled={!hasFeature(plan, "customerTags")}
                value={csv(c.customerTags)}
                onInput={(e) => patchCond({ customerTags: splitCsv(val(e)) })}
                error={errors.customerTags}
              />
            </s-stack>
          </s-section>

          {/* ---------------------------------------------------------------- Details */}
          <s-section heading="Advanced details">
            <s-stack direction="block" gap="base">
              <s-paragraph color="subdued">
                Optional shopper copy and order bookkeeping.
              </s-paragraph>
              <s-text-field
                label="Shopper note"
                name="shopperNote"
                value={d.shopperNote}
                onInput={(e) => patch({ shopperNote: val(e) })}
                placeholder="e.g. Covers import duties on international goods"
                details="One line under the fee in checkout (140 characters)."
                maxLength={140}
              />
              <s-text-area
                label="Optional details"
                name="details"
                value={d.details}
                onInput={(e) => patch({ details: val(e) })}
                placeholder="Longer explanation buyers can read in checkout"
                details="Plain text, up to 500 characters. Checkout doesn&apos;t render HTML."
                maxLength={500}
                rows={3}
              />
              <s-text-field
                label="Order tag for this fee"
                name="orderTag"
                value={d.orderTag}
                onInput={(e) => patch({ orderTag: val(e) })}
                placeholder="e.g. Rush Processing"
                details="Added to any order that contains this fee, so you can filter and report on them."
                maxLength={40}
              />
              <s-text-field
                label="Fee barcode"
                name="barcode"
                value={d.barcode}
                onInput={(e) => patch({ barcode: val(e) })}
                placeholder="Optional"
                details="Synced to the generated fee product variant for POS and reporting."
                maxLength={64}
              />
            </s-stack>
          </s-section>
        </s-stack>

        {/* ------------------------------------------------------------------ Aside */}
        <s-stack direction="block" gap="base">
          <s-section heading="Status">
            <s-switch
              label="Active"
              details="Inactive fees are saved but never charged."
              checked={d.active}
              onChange={(e) => patch({ active: checked(e) })}
            />
          </s-section>
          <FeePreview rule={preview} currencyCode={currencyCode} />
          <s-button type="submit" variant="primary" loading={saving ? true : undefined}>
            {submitLabel}
          </s-button>
        </s-stack>
      </s-grid>
    </Form>
  );
}

function PickerRow({
  label,
  ids,
  labels,
  onPick,
  onClear,
}: {
  label: string;
  ids: string[];
  labels: Record<string, string>;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <s-box border="base" borderRadius="base" padding="small">
      <s-stack direction="block" gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">{label}</s-text>
          <s-stack direction="inline" gap="small-200">
            {ids.length > 0 && (
              <s-button type="button" variant="tertiary" onClick={onClear}>
                Clear
              </s-button>
            )}
            <s-button type="button" variant="secondary" icon="search" onClick={onPick}>
              {ids.length ? "Change" : "Choose"}
            </s-button>
          </s-stack>
        </s-stack>
        {ids.length > 0 ? (
          <s-stack direction="inline" gap="small-200">
            {ids.map((id) => (
              <s-badge key={id}>{labels[id] ?? id.split("/").pop()}</s-badge>
            ))}
          </s-stack>
        ) : (
          <s-text color="subdued">None chosen.</s-text>
        )}
      </s-stack>
    </s-box>
  );
}
