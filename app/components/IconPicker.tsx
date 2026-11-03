import { useState, type JSX } from "react";
import { FEE_ICONS, findIcon } from "../lib/icons";

type IconName = NonNullable<JSX.IntrinsicElements["s-icon"]["type"]>;

/** Small rounded tile with the fee's icon; used in lists, previews and the picker. */
export function IconTile({
  iconKey,
  size = "base",
}: {
  iconKey: string;
  size?: "base" | "large";
}) {
  const icon = findIcon(iconKey);
  return (
    <s-box
      background="subdued"
      border="base"
      borderRadius="base"
      padding={size === "large" ? "base" : "small-200"}
      inlineSize={size === "large" ? "56px" : "36px"}
      blockSize={size === "large" ? "56px" : "36px"}
    >
      <s-stack alignItems="center" justifyContent="center" blockSize="100%">
        <s-icon type={icon.icon as IconName} tone={icon.tone} />
      </s-stack>
    </s-box>
  );
}

const MODAL_ID = "fee-icon-picker";

/** Icon selector: current tile + "Change icon" opening a searchable modal grid. */
export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const [query, setQuery] = useState("");
  const current = findIcon(value);
  const q = query.trim().toLowerCase();
  const visible = FEE_ICONS.filter(
    (i) => !q || i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q),
  );

  const close = () => {
    const el = document.getElementById(MODAL_ID) as (HTMLElement & { hide?: () => void }) | null;
    el?.hide?.();
  };

  return (
    <>
      <input type="hidden" name="icon" value={value} />
      <s-box border="base" borderRadius="base" padding="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <IconTile iconKey={value} size="large" />
            <s-stack direction="block" gap="small-500">
              <s-text type="strong">{current.label}</s-text>
              <s-text color="subdued">Shown next to the fee in your admin and checkout preview.</s-text>
            </s-stack>
          </s-stack>
          <s-button type="button" variant="secondary" commandFor={MODAL_ID} command="--show">
            Change icon
          </s-button>
        </s-stack>
      </s-box>

      <s-modal id={MODAL_ID} heading="Choose an icon" size="large">
        <s-stack direction="block" gap="base">
          <s-search-field
            label="Find an icon"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search by name or group"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
          <s-grid gridTemplateColumns="repeat(auto-fill, minmax(120px, 1fr))" gap="small">
            {visible.map((i) => (
              <s-clickable
                key={i.key}
                border={i.key === value ? "base strong" : "base"}
                borderRadius="base"
                padding="small"
                background={i.key === value ? "subdued" : "base"}
                onClick={() => {
                  onChange(i.key);
                  close();
                }}
              >
                <s-stack direction="block" gap="small-300" alignItems="center">
                  <IconTile iconKey={i.key} size="large" />
                  <s-text>{i.label}</s-text>
                </s-stack>
              </s-clickable>
            ))}
          </s-grid>
          {visible.length === 0 && <s-text color="subdued">No icons match “{query}”.</s-text>}
        </s-stack>
        <s-button slot="secondary-actions" type="button" commandFor={MODAL_ID} command="--hide">
          Cancel
        </s-button>
      </s-modal>
    </>
  );
}
