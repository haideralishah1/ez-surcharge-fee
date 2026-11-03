import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  redirect,
  useActionData,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getPlan } from "../lib/billing.server";
import {
  createRule,
  deleteRule,
  getRule,
  updateRule,
} from "../lib/fee-rules.server";
import { deleteFeeProduct, syncRules } from "../lib/fee-engine.server";
import { parseFeeRuleForm, type FeeRuleInput } from "../lib/fee-rules";
import { planAtLeast } from "../lib/plans";
import { findTemplate } from "../lib/templates";
import { RuleForm } from "../components/RuleForm";
import { TemplateGrid } from "../components/TemplateGrid";
import { IconTile } from "../components/IconPicker";
import type { AppShellData } from "./app";

const BLANK: Record<string, Partial<FeeRuleInput>> = {
  PRODUCT: { scope: "PRODUCT", icon: "product-fee", matchMode: "ANY" },
  CART: { scope: "CART", icon: "order-fee" },
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const plan = await getPlan(session.shop);

  if (params.id === "new") {
    const url = new URL(request.url);
    const templateKey = url.searchParams.get("template");
    const type = url.searchParams.get("type");
    const template = findTemplate(templateKey);
    const allowed = template && planAtLeast(plan, template.plan);
    const start: Partial<FeeRuleInput> | null = allowed
      ? template.values
      : type && BLANK[type]
        ? BLANK[type]
        : null;
    return {
      plan,
      rule: null,
      start,
      heading: allowed ? template.title : type === "PRODUCT" ? "New product fee" : "New order fee",
      templateLocked: !!template && !allowed,
      // Nothing chosen yet: show the chooser instead of a blank form.
      choose: start === null,
    };
  }
  const rule = await getRule(session.shop, params.id!);
  if (!rule) throw new Response("Fee not found", { status: 404 });
  return { plan, rule, start: null, heading: rule.name, templateLocked: false, choose: false };
};

async function syncOrRedirect(admin: Parameters<typeof syncRules>[0], shop: string) {
  try {
    await syncRules(admin, shop);
    return redirect("/app");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return redirect(`/app?syncError=${encodeURIComponent(msg)}`);
  }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();

  if (form.get("intent") === "delete" && params.id !== "new") {
    const rule = await getRule(session.shop, params.id!);
    await deleteRule(session.shop, params.id!);
    if (rule?.productId) {
      try {
        await deleteFeeProduct(admin, rule.productId);
      } catch {
        // Orphaned fee product is harmless; Settings lists it for cleanup.
      }
    }
    return syncOrRedirect(admin, session.shop);
  }

  const plan = await getPlan(session.shop);
  const { value, errors } = parseFeeRuleForm(form, plan);
  if (!value) return { errors };

  if (params.id === "new") {
    await createRule(session.shop, value);
  } else {
    const res = await updateRule(session.shop, params.id!, value);
    if (res.count === 0) throw new Response("Fee not found", { status: 404 });
  }
  return syncOrRedirect(admin, session.shop);
};

export default function RuleEditor() {
  const { plan, rule, start, heading, templateLocked, choose } = useLoaderData<typeof loader>();
  const shell = useRouteLoaderData("routes/app") as AppShellData;
  const actionData = useActionData<typeof action>();

  if (choose) {
    return (
      <s-page heading="Create fee">
        <s-link slot="breadcrumb-actions" href="/app">Fees</s-link>
        <s-stack direction="block" gap="base">
          {templateLocked && (
            <s-banner tone="info" heading="That starting point is on a higher plan">
              <s-paragraph>
                Build the same fee from a blank type below, or{" "}
                <s-link href="/app/plans">compare plans</s-link>.
              </s-paragraph>
            </s-banner>
          )}
          <s-paragraph color="subdued">
            Choose what the fee applies to. You&apos;ll set the price and rules next.
          </s-paragraph>
          <s-grid gridTemplateColumns="@container (inline-size > 640px) 1fr 1fr, 1fr" gap="base">
            <TypeCard
              icon="product-fee"
              title="Product fee"
              blurb="Attach a fee to matching products. Best when the fee belongs to an item, like a deposit or protection."
              href="/app/rules/new?type=PRODUCT"
              cta="Start product fee"
            />
            <TypeCard
              icon="order-fee"
              title="Order fee"
              blurb="Add one fee to the whole order. Best for handling, processing or tariff charges."
              href="/app/rules/new?type=CART"
              cta="Start order fee"
            />
          </s-grid>
          <s-section heading="More starting points">
            <s-stack direction="block" gap="base">
              <s-paragraph color="subdued">
                Presets with opinionated defaults. Every field stays editable.
              </s-paragraph>
              <TemplateGrid plan={plan} />
            </s-stack>
          </s-section>
        </s-stack>
      </s-page>
    );
  }

  return (
    <s-page heading={heading}>
      <s-link slot="breadcrumb-actions" href="/app">Fees</s-link>
      {rule && (
        <form method="post" slot="secondary-actions">
          <input type="hidden" name="intent" value="delete" />
          <s-button type="submit" tone="critical" variant="tertiary" icon="delete">
            Delete
          </s-button>
        </form>
      )}
      <s-stack direction="block" gap="base">
        {actionData?.errors && (
          <s-banner tone="critical" heading="Fix the highlighted fields to save">
            <s-paragraph>{Object.values(actionData.errors)[0]}</s-paragraph>
          </s-banner>
        )}
        <RuleForm
          key={rule?.id ?? heading}
          rule={rule ?? start ?? undefined}
          plan={plan}
          currencyCode={shell.shop.currencyCode}
          errors={actionData?.errors}
          submitLabel={rule ? "Save" : "Create fee"}
        />
      </s-stack>
    </s-page>
  );
}

function TypeCard({
  icon,
  title,
  blurb,
  href,
  cta,
}: {
  icon: string;
  title: string;
  blurb: string;
  href: string;
  cta: string;
}) {
  return (
    <s-box border="base" borderRadius="base" padding="base" background="base">
      <s-stack direction="block" gap="small">
        <IconTile iconKey={icon} size="large" />
        <s-heading>{title}</s-heading>
        <s-text color="subdued">{blurb}</s-text>
        <s-button href={href} variant="primary">{cta}</s-button>
      </s-stack>
    </s-box>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (h) => boundary.headers(h);
