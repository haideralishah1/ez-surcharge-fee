import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/FeeSummary.jsx' {
  const shopify: import('@shopify/ui-extensions/purchase.checkout.reductions.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/FeeAcceptance.jsx' {
  const shopify: import('@shopify/ui-extensions/purchase.checkout.actions.render-before').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/fees.js' {
  const shopify:
    | import('@shopify/ui-extensions/purchase.checkout.reductions.render-after').Api
    | import('@shopify/ui-extensions/purchase.checkout.actions.render-before').Api;
  const globalThis: { shopify: typeof shopify };
}
