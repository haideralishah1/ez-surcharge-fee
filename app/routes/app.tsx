import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { ensureCartTransform } from "../lib/fee-engine.server";
import { getPlan } from "../lib/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const shopRes = await admin.graphql(
    `#graphql
      query AppShell { shop { name currencyCode plan { partnerDevelopment shopifyPlus } } }`,
  );
  const { data } = await shopRes.json();

  // Registration failing (e.g. function not yet deployed) must not take the
  // whole admin down; the overview page surfaces the status instead.
  let engineError: string | null = null;
  try {
    await ensureCartTransform(admin, session.shop);
  } catch (e) {
    engineError = e instanceof Error ? e.message : String(e);
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: {
      name: data?.shop.name ?? session.shop,
      currencyCode: data?.shop.currencyCode ?? "USD",
      isPlus: Boolean(data?.shop.plan?.shopifyPlus),
    },
    plan: await getPlan(session.shop),
    engineError,
  };
};

export type AppShellData = Awaited<ReturnType<typeof loader>>;

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Fees</s-link>
        <s-link href="/app/analytics">Analytics</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
