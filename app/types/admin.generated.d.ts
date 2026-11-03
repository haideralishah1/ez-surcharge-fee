/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.js';

export type ListCartTransformsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ListCartTransformsQuery = { cartTransforms: { nodes: Array<Pick<AdminTypes.CartTransform, 'id' | 'functionId' | 'blockOnFailure'>> } };

export type CreateCartTransformMutationVariables = AdminTypes.Exact<{
  functionHandle: AdminTypes.Scalars['String']['input'];
  blockOnFailure: AdminTypes.Scalars['Boolean']['input'];
}>;


export type CreateCartTransformMutation = { cartTransformCreate?: AdminTypes.Maybe<{ cartTransform?: AdminTypes.Maybe<Pick<AdminTypes.CartTransform, 'id' | 'functionId'>>, userErrors: Array<Pick<AdminTypes.CartTransformCreateUserError, 'field' | 'message'>> }> };

export type OptionalFeeOwnersQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type OptionalFeeOwnersQuery = { currentAppInstallation: Pick<AdminTypes.AppInstallation, 'id'>, shop: Pick<AdminTypes.Shop, 'id'> };

export type SetRulesMetafieldMutationVariables = AdminTypes.Exact<{
  metafields: Array<AdminTypes.MetafieldsSetInput> | AdminTypes.MetafieldsSetInput;
}>;


export type SetRulesMetafieldMutation = { metafieldsSet?: AdminTypes.Maybe<{ metafields?: AdminTypes.Maybe<Array<Pick<AdminTypes.Metafield, 'id' | 'key'>>>, userErrors: Array<Pick<AdminTypes.MetafieldsSetUserError, 'field' | 'message' | 'code'>> }> };

export type CreateFeeProductMutationVariables = AdminTypes.Exact<{
  product: AdminTypes.ProductCreateInput;
}>;


export type CreateFeeProductMutation = { productCreate?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<(
      Pick<AdminTypes.Product, 'id'>
      & { variants: { nodes: Array<Pick<AdminTypes.ProductVariant, 'id'>> } }
    )>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type FindFeeProductQueryVariables = AdminTypes.Exact<{
  query: AdminTypes.Scalars['String']['input'];
}>;


export type FindFeeProductQuery = { products: { nodes: Array<(
      Pick<AdminTypes.Product, 'id'>
      & { variants: { nodes: Array<Pick<AdminTypes.ProductVariant, 'id'>> } }
    )> } };

export type ConfigureFeeVariantMutationVariables = AdminTypes.Exact<{
  productId: AdminTypes.Scalars['ID']['input'];
  variants: Array<AdminTypes.ProductVariantsBulkInput> | AdminTypes.ProductVariantsBulkInput;
}>;


export type ConfigureFeeVariantMutation = { productVariantsBulkUpdate?: AdminTypes.Maybe<{ productVariants?: AdminTypes.Maybe<Array<Pick<AdminTypes.ProductVariant, 'id'>>>, userErrors: Array<Pick<AdminTypes.ProductVariantsBulkUpdateUserError, 'field' | 'message'>> }> };

export type UnlistFeeProductMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type UnlistFeeProductMutation = { productUpdate?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<Pick<AdminTypes.Product, 'id'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type ListPublicationsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ListPublicationsQuery = { publications: { nodes: Array<(
      Pick<AdminTypes.Publication, 'id'>
      & { catalog?: AdminTypes.Maybe<Pick<AdminTypes.AppCatalog, 'title'> | Pick<AdminTypes.CompanyLocationCatalog, 'title'> | Pick<AdminTypes.MarketCatalog, 'title'>> }
    )> } };

export type PublishFeeProductMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  input: Array<AdminTypes.PublicationInput> | AdminTypes.PublicationInput;
}>;


export type PublishFeeProductMutation = { publishablePublish?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type DeleteFeeProductMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.ProductDeleteInput;
}>;


export type DeleteFeeProductMutation = { productDelete?: AdminTypes.Maybe<(
    Pick<AdminTypes.ProductDeletePayload, 'deletedProductId'>
    & { userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }
  )> };

export type OrdersToCheckQueryVariables = AdminTypes.Exact<{
  query: AdminTypes.Scalars['String']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type OrdersToCheckQuery = { orders: { nodes: Array<Pick<AdminTypes.Order, 'id' | 'createdAt'>>, pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'> } };

export type OrderFeeLinesQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type OrderFeeLinesQuery = { order?: AdminTypes.Maybe<(
    Pick<AdminTypes.Order, 'id' | 'name' | 'createdAt' | 'cancelledAt' | 'currencyCode'>
    & { lineItems: { nodes: Array<(
        Pick<AdminTypes.LineItem, 'quantity'>
        & { variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>>, customAttributes: Array<Pick<AdminTypes.Attribute, 'key' | 'value'>>, originalUnitPriceSet: { shopMoney: Pick<AdminTypes.MoneyV2, 'amount' | 'currencyCode'> } }
      )> } }
  )> };

export type TagOrderMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  tags: Array<AdminTypes.Scalars['String']['input']> | AdminTypes.Scalars['String']['input'];
}>;


export type TagOrderMutation = { tagsAdd?: AdminTypes.Maybe<{ node?: AdminTypes.Maybe<Pick<AdminTypes.AbandonedCheckout, 'id'> | Pick<AdminTypes.AbandonedCheckoutLineItem, 'id'> | Pick<AdminTypes.Abandonment, 'id'> | Pick<AdminTypes.AddAllProductsOperation, 'id'> | Pick<AdminTypes.AdditionalFee, 'id'> | Pick<AdminTypes.AnalyticsAnnotation, 'id'> | Pick<AdminTypes.AnalyticsTarget, 'id'> | Pick<AdminTypes.App, 'id'> | Pick<AdminTypes.AppCatalog, 'id'> | Pick<AdminTypes.AppCredit, 'id'> | Pick<AdminTypes.AppInstallation, 'id'> | Pick<AdminTypes.AppPurchaseOneTime, 'id'> | Pick<AdminTypes.AppRevenueAttributionRecord, 'id'> | Pick<AdminTypes.AppSubscription, 'id'> | Pick<AdminTypes.AppUsageRecord, 'id'> | Pick<AdminTypes.Article, 'id'> | Pick<AdminTypes.BasicEvent, 'id'> | Pick<AdminTypes.Blog, 'id'> | Pick<AdminTypes.BulkOperation, 'id'> | Pick<AdminTypes.BusinessEntity, 'id'> | Pick<AdminTypes.CalculatedOrder, 'id'> | Pick<AdminTypes.CartTransform, 'id'> | Pick<AdminTypes.CashDrawer, 'id'> | Pick<AdminTypes.CashManagementCustomReasonCode, 'id'> | Pick<AdminTypes.CashManagementDefaultReasonCode, 'id'> | Pick<AdminTypes.CashManagementSystemReasonCode, 'id'> | Pick<AdminTypes.CashTrackingAdjustment, 'id'> | Pick<AdminTypes.CashTrackingSession, 'id'> | Pick<AdminTypes.CatalogCsvOperation, 'id'> | Pick<AdminTypes.Channel, 'id'> | Pick<AdminTypes.ChannelDefinition, 'id'> | Pick<AdminTypes.ChannelInformation, 'id'> | Pick<AdminTypes.CheckoutAndAccountsConfiguration, 'id'> | Pick<AdminTypes.CheckoutAndAccountsConfigurationOverride, 'id'> | Pick<AdminTypes.CheckoutProfile, 'id'> | Pick<AdminTypes.Collection, 'id'> | Pick<AdminTypes.CollectionConditionsSource, 'id'> | Pick<AdminTypes.CollectionSubCollectionsSource, 'id'> | Pick<AdminTypes.Comment, 'id'> | Pick<AdminTypes.CommentEvent, 'id'> | Pick<AdminTypes.Company, 'id'> | Pick<AdminTypes.CompanyAddress, 'id'> | Pick<AdminTypes.CompanyContact, 'id'> | Pick<AdminTypes.CompanyContactRole, 'id'> | Pick<AdminTypes.CompanyContactRoleAssignment, 'id'> | Pick<AdminTypes.CompanyLocation, 'id'> | Pick<AdminTypes.CompanyLocationCatalog, 'id'> | Pick<AdminTypes.CompanyLocationStaffMemberAssignment, 'id'> | Pick<AdminTypes.ConsentPolicy, 'id'> | Pick<AdminTypes.CurrencyExchangeAdjustment, 'id'> | Pick<AdminTypes.Customer, 'id'> | Pick<AdminTypes.CustomerAccountAppExtensionPage, 'id'> | Pick<AdminTypes.CustomerAccountNativePage, 'id'> | Pick<AdminTypes.CustomerPaymentMethod, 'id'> | Pick<AdminTypes.CustomerSegmentMembersQuery, 'id'> | Pick<AdminTypes.CustomerVisit, 'id'> | Pick<AdminTypes.DeliveryCarrierService, 'id'> | Pick<AdminTypes.DeliveryCondition, 'id'> | Pick<AdminTypes.DeliveryCountry, 'id'> | Pick<AdminTypes.DeliveryCustomization, 'id'> | Pick<AdminTypes.DeliveryLocationGroup, 'id'> | Pick<AdminTypes.DeliveryMethod, 'id'> | Pick<AdminTypes.DeliveryMethodDefinition, 'id'> | Pick<AdminTypes.DeliveryParticipant, 'id'> | Pick<AdminTypes.DeliveryProfile, 'id'> | Pick<AdminTypes.DeliveryProfileItem, 'id'> | Pick<AdminTypes.DeliveryPromiseParticipant, 'id'> | Pick<AdminTypes.DeliveryPromiseProvider, 'id'> | Pick<AdminTypes.DeliveryProvince, 'id'> | Pick<AdminTypes.DeliveryRateDefinition, 'id'> | Pick<AdminTypes.DeliveryZone, 'id'> | Pick<AdminTypes.DiscountAutomaticBxgy, 'id'> | Pick<AdminTypes.DiscountAutomaticNode, 'id'> | Pick<AdminTypes.DiscountCodeNode, 'id'> | Pick<AdminTypes.DiscountNode, 'id'> | Pick<AdminTypes.DiscountRedeemCodeBulkCreation, 'id'> | Pick<AdminTypes.Domain, 'id'> | Pick<AdminTypes.DraftOrder, 'id'> | Pick<AdminTypes.DraftOrderLineItem, 'id'> | Pick<AdminTypes.DraftOrderTag, 'id'> | Pick<AdminTypes.Duty, 'id'> | Pick<AdminTypes.ExchangeLineItem, 'id'> | Pick<AdminTypes.ExchangeV2, 'id'> | Pick<AdminTypes.ExternalVideo, 'id'> | Pick<AdminTypes.Fulfillment, 'id'> | Pick<AdminTypes.FulfillmentConstraintRule, 'id'> | Pick<AdminTypes.FulfillmentEvent, 'id'> | Pick<AdminTypes.FulfillmentHold, 'id'> | Pick<AdminTypes.FulfillmentLineItem, 'id'> | Pick<AdminTypes.FulfillmentOrder, 'id'> | Pick<AdminTypes.FulfillmentOrderDestination, 'id'> | Pick<AdminTypes.FulfillmentOrderLineItem, 'id'> | Pick<AdminTypes.FulfillmentOrderMerchantRequest, 'id'> | Pick<AdminTypes.GenericFile, 'id'> | Pick<AdminTypes.GiftCard, 'id'> | Pick<AdminTypes.GiftCardCashOutTransaction, 'id'> | Pick<AdminTypes.GiftCardCreditTransaction, 'id'> | Pick<AdminTypes.GiftCardDebitTransaction, 'id'> | Pick<AdminTypes.IdentityProviderSubject, 'id'> | Pick<AdminTypes.InventoryAdjustmentGroup, 'id'> | Pick<AdminTypes.InventoryItem, 'id'> | Pick<AdminTypes.InventoryItemMeasurement, 'id'> | Pick<AdminTypes.InventoryLevel, 'id'> | Pick<AdminTypes.InventoryPurchaseOrder, 'id'> | Pick<AdminTypes.InventoryPurchaseOrderLineItem, 'id'> | Pick<AdminTypes.InventoryQuantity, 'id'> | Pick<AdminTypes.InventoryShipment, 'id'> | Pick<AdminTypes.InventoryShipmentLineItem, 'id'> | Pick<AdminTypes.InventoryTransfer, 'id'> | Pick<AdminTypes.InventoryTransferLineItem, 'id'> | Pick<AdminTypes.LineItem, 'id'> | Pick<AdminTypes.LineItemGroup, 'id'> | Pick<AdminTypes.Location, 'id'> | Pick<AdminTypes.MailingAddress, 'id'> | Pick<AdminTypes.Market, 'id'> | Pick<AdminTypes.MarketCatalog, 'id'> | Pick<AdminTypes.MarketRegionCountry, 'id'> | Pick<AdminTypes.MarketRegionSubdivision, 'id'> | Pick<AdminTypes.MarketRelationship, 'id'> | Pick<AdminTypes.MarketWebPresence, 'id'> | Pick<AdminTypes.MarketingActivity, 'id'> | Pick<AdminTypes.MarketingEvent, 'id'> | Pick<AdminTypes.MediaImage, 'id'> | Pick<AdminTypes.Menu, 'id'> | Pick<AdminTypes.Metafield, 'id'> | Pick<AdminTypes.MetafieldDefinition, 'id'> | Pick<AdminTypes.Metaobject, 'id'> | Pick<AdminTypes.MetaobjectDefinition, 'id'> | Pick<AdminTypes.Model3d, 'id'> | Pick<AdminTypes.OnlineStoreTheme, 'id'> | Pick<AdminTypes.Order, 'id'> | Pick<AdminTypes.OrderAdjustment, 'id'> | Pick<AdminTypes.OrderAttributionDefinition, 'id'> | Pick<AdminTypes.OrderCancelJobResult, 'id'> | Pick<AdminTypes.OrderCreateMandatePaymentJobResult, 'id'> | Pick<AdminTypes.OrderDisputeSummary, 'id'> | Pick<AdminTypes.OrderEditSession, 'id'> | Pick<AdminTypes.OrderTransaction, 'id'> | Pick<AdminTypes.Page, 'id'> | Pick<AdminTypes.PaymentCustomization, 'id'> | Pick<AdminTypes.PaymentMandate, 'id'> | Pick<AdminTypes.PaymentSchedule, 'id'> | Pick<AdminTypes.PaymentTerms, 'id'> | Pick<AdminTypes.PaymentTermsTemplate, 'id'> | Pick<AdminTypes.PointOfSaleDevice, 'id'> | Pick<AdminTypes.PointOfSaleDevicePaymentSession, 'id'> | Pick<AdminTypes.PriceList, 'id'> | Pick<AdminTypes.Product, 'id'> | Pick<AdminTypes.ProductBundleOperation, 'id'> | Pick<AdminTypes.ProductDeleteOperation, 'id'> | Pick<AdminTypes.ProductDuplicateOperation, 'id'> | Pick<AdminTypes.ProductFeed, 'id'> | Pick<AdminTypes.ProductOption, 'id'> | Pick<AdminTypes.ProductOptionValue, 'id'> | Pick<AdminTypes.ProductSetOperation, 'id'> | Pick<AdminTypes.ProductTaxonomyNode, 'id'> | Pick<AdminTypes.ProductVariant, 'id'> | Pick<AdminTypes.ProductVariantComponent, 'id'> | Pick<AdminTypes.Publication, 'id'> | Pick<AdminTypes.PublicationResourceOperation, 'id'> | Pick<AdminTypes.QuantityPriceBreak, 'id'> | Pick<AdminTypes.Refund, 'id'> | Pick<AdminTypes.RefundShippingLine, 'id'> | Pick<AdminTypes.RequestedOrderEdit, 'id'> | Pick<AdminTypes.RequestedOrderEditLineItem, 'id'> | Pick<AdminTypes.Return, 'id'> | Pick<AdminTypes.ReturnLineItem, 'id'> | Pick<AdminTypes.ReturnPolicyProfile, 'id'> | Pick<AdminTypes.ReturnReasonDefinition, 'id'> | Pick<AdminTypes.ReturnableFulfillment, 'id'> | Pick<AdminTypes.ReverseDelivery, 'id'> | Pick<AdminTypes.ReverseDeliveryLineItem, 'id'> | Pick<AdminTypes.ReverseFulfillmentOrder, 'id'> | Pick<AdminTypes.ReverseFulfillmentOrderDisposition, 'id'> | Pick<AdminTypes.ReverseFulfillmentOrderLineItem, 'id'> | Pick<AdminTypes.Rollout, 'id'> | Pick<AdminTypes.RolloutTreatment, 'id'> | Pick<AdminTypes.SaleAdditionalFee, 'id'> | Pick<AdminTypes.SavedSearch, 'id'> | Pick<AdminTypes.ScriptTag, 'id'> | Pick<AdminTypes.Segment, 'id'> | Pick<AdminTypes.SellingPlan, 'id'> | Pick<AdminTypes.SellingPlanGroup, 'id'> | Pick<AdminTypes.ServerPixel, 'id'> | Pick<AdminTypes.ShippingLabel, 'id'> | Pick<AdminTypes.ShippingLabelPurchaseResult, 'id'> | Pick<AdminTypes.Shop, 'id'> | Pick<AdminTypes.ShopAddress, 'id'> | Pick<AdminTypes.ShopPolicy, 'id'> | Pick<AdminTypes.ShopifyPaymentsAccount, 'id'> | Pick<AdminTypes.ShopifyPaymentsBalanceTransaction, 'id'> | Pick<AdminTypes.ShopifyPaymentsBankAccount, 'id'> | Pick<AdminTypes.ShopifyPaymentsDispute, 'id'> | Pick<AdminTypes.ShopifyPaymentsDisputeEvidence, 'id'> | Pick<AdminTypes.ShopifyPaymentsDisputeFileUpload, 'id'> | Pick<AdminTypes.ShopifyPaymentsDisputeFulfillment, 'id'> | Pick<AdminTypes.ShopifyPaymentsPayout, 'id'> | Pick<AdminTypes.StaffMember, 'id'> | Pick<AdminTypes.StandardMetafieldDefinitionTemplate, 'id'> | Pick<AdminTypes.StoreCreditAccount, 'id'> | Pick<AdminTypes.StoreCreditAccountCreditTransaction, 'id'> | Pick<AdminTypes.StoreCreditAccountDebitRevertTransaction, 'id'> | Pick<AdminTypes.StoreCreditAccountDebitTransaction, 'id'> | Pick<AdminTypes.StorefrontAccessToken, 'id'> | Pick<AdminTypes.SubscriptionBillingAttempt, 'id'> | Pick<AdminTypes.SubscriptionContract, 'id'> | Pick<AdminTypes.SubscriptionDraft, 'id'> | Pick<AdminTypes.TaxonomyAttribute, 'id'> | Pick<AdminTypes.TaxonomyCategory, 'id'> | Pick<AdminTypes.TaxonomyChoiceListAttribute, 'id'> | Pick<AdminTypes.TaxonomyMeasurementAttribute, 'id'> | Pick<AdminTypes.TaxonomyValue, 'id'> | Pick<AdminTypes.TenderTransaction, 'id'> | Pick<AdminTypes.TransactionFee, 'id'> | Pick<AdminTypes.UnverifiedReturnLineItem, 'id'> | Pick<AdminTypes.UrlRedirect, 'id'> | Pick<AdminTypes.UrlRedirectImport, 'id'> | Pick<AdminTypes.Validation, 'id'> | Pick<AdminTypes.Video, 'id'> | Pick<AdminTypes.WebPixel, 'id'> | Pick<AdminTypes.WebhookSubscription, 'id'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type ShopIdQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ShopIdQuery = { shop: Pick<AdminTypes.Shop, 'id'> };

export type ShopLocalesQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ShopLocalesQuery = { shopLocales: Array<Pick<AdminTypes.ShopLocale, 'locale' | 'name' | 'primary' | 'published'>> };

export type OrdersSinceQueryVariables = AdminTypes.Exact<{
  q: AdminTypes.Scalars['String']['input'];
}>;


export type OrdersSinceQuery = { ordersCount?: AdminTypes.Maybe<Pick<AdminTypes.Count, 'count' | 'precision'>> };

export type DeleteCartTransformMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type DeleteCartTransformMutation = { cartTransformDelete?: AdminTypes.Maybe<(
    Pick<AdminTypes.CartTransformDeletePayload, 'deletedId'>
    & { userErrors: Array<Pick<AdminTypes.CartTransformDeleteUserError, 'field' | 'message'>> }
  )> };

export type FeeFulfillmentOrdersQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type FeeFulfillmentOrdersQuery = { order?: AdminTypes.Maybe<{ fulfillmentOrders: { nodes: Array<(
        Pick<AdminTypes.FulfillmentOrder, 'id' | 'status'>
        & { lineItems: { nodes: Array<(
            Pick<AdminTypes.FulfillmentOrderLineItem, 'id' | 'remainingQuantity'>
            & { lineItem: { variant?: AdminTypes.Maybe<Pick<AdminTypes.ProductVariant, 'id'>> } }
          )> } }
      )> } }> };

export type FulfillFeeLinesMutationVariables = AdminTypes.Exact<{
  fulfillment: AdminTypes.FulfillmentInput;
}>;


export type FulfillFeeLinesMutation = { fulfillmentCreate?: AdminTypes.Maybe<{ fulfillment?: AdminTypes.Maybe<Pick<AdminTypes.Fulfillment, 'id' | 'status'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type ListValidationsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ListValidationsQuery = { validations: { nodes: Array<(
      Pick<AdminTypes.Validation, 'id' | 'enabled'>
      & { shopifyFunction: Pick<AdminTypes.ShopifyFunction, 'id'> }
    )> } };

export type CreateValidationMutationVariables = AdminTypes.Exact<{
  validation: AdminTypes.ValidationCreateInput;
}>;


export type CreateValidationMutation = { validationCreate?: AdminTypes.Maybe<{ validation?: AdminTypes.Maybe<Pick<AdminTypes.Validation, 'id' | 'enabled'>>, userErrors: Array<Pick<AdminTypes.ValidationUserError, 'field' | 'message'>> }> };

export type UpdateValidationMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  validation: AdminTypes.ValidationUpdateInput;
}>;


export type UpdateValidationMutation = { validationUpdate?: AdminTypes.Maybe<{ validation?: AdminTypes.Maybe<Pick<AdminTypes.Validation, 'id' | 'enabled'>>, userErrors: Array<Pick<AdminTypes.ValidationUserError, 'field' | 'message'>> }> };

export type QuoteVariantsQueryVariables = AdminTypes.Exact<{
  ids: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type QuoteVariantsQuery = { nodes: Array<AdminTypes.Maybe<(
    Pick<AdminTypes.ProductVariant, 'id' | 'price'>
    & { product: (
      Pick<AdminTypes.Product, 'id'>
      & { collections: { nodes: Array<Pick<AdminTypes.Collection, 'id'>> } }
    ), inventoryItem: { measurement: { weight?: AdminTypes.Maybe<Pick<AdminTypes.Weight, 'value' | 'unit'>> } } }
  )>> };

export type QuoteShopQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type QuoteShopQuery = { shop: Pick<AdminTypes.Shop, 'currencyCode' | 'ianaTimezone'> };

export type AppShellQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type AppShellQuery = { shop: (
    Pick<AdminTypes.Shop, 'name' | 'currencyCode'>
    & { plan: Pick<AdminTypes.ShopPlan, 'partnerDevelopment' | 'shopifyPlus'> }
  ) };

interface GeneratedQueryTypes {
  "#graphql\n  query ListCartTransforms {\n    cartTransforms(first: 25) {\n      nodes {\n        id\n        functionId\n        blockOnFailure\n      }\n    }\n  }\n": {return: ListCartTransformsQuery, variables: ListCartTransformsQueryVariables},
  "#graphql\n  query OptionalFeeOwners {\n    currentAppInstallation { id }\n    shop { id }\n  }\n": {return: OptionalFeeOwnersQuery, variables: OptionalFeeOwnersQueryVariables},
  "#graphql\n  query FindFeeProduct($query: String!) {\n    products(first: 1, query: $query) {\n      nodes {\n        id\n        variants(first: 1) {\n          nodes { id }\n        }\n      }\n    }\n  }\n": {return: FindFeeProductQuery, variables: FindFeeProductQueryVariables},
  "#graphql\n  query ListPublications {\n    publications(first: 20) {\n      nodes {\n        id\n        catalog {\n          title\n        }\n      }\n    }\n  }\n": {return: ListPublicationsQuery, variables: ListPublicationsQueryVariables},
  "#graphql\n  query OrdersToCheck($query: String!, $after: String) {\n    orders(first: 100, after: $after, sortKey: CREATED_AT, query: $query) {\n      nodes { id createdAt }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": {return: OrdersToCheckQuery, variables: OrdersToCheckQueryVariables},
  "#graphql\n  query OrderFeeLines($id: ID!) {\n    order(id: $id) {\n      id\n      name\n      createdAt\n      cancelledAt\n      currencyCode\n      lineItems(first: 100) {\n        nodes {\n          quantity\n          variant { id }\n          customAttributes { key value }\n          originalUnitPriceSet { shopMoney { amount currencyCode } }\n        }\n      }\n    }\n  }\n": {return: OrderFeeLinesQuery, variables: OrderFeeLinesQueryVariables},
  "#graphql\n  query ShopId { shop { id } }\n": {return: ShopIdQuery, variables: ShopIdQueryVariables},
  "#graphql\n  query ShopLocales {\n    shopLocales { locale name primary published }\n  }\n": {return: ShopLocalesQuery, variables: ShopLocalesQueryVariables},
  "#graphql\n  query OrdersSince($q: String!) {\n    ordersCount(query: $q, limit: 10000) { count precision }\n  }\n": {return: OrdersSinceQuery, variables: OrdersSinceQueryVariables},
  "#graphql\n  query FeeFulfillmentOrders($id: ID!) {\n    order(id: $id) {\n      fulfillmentOrders(first: 10) {\n        nodes {\n          id\n          status\n          lineItems(first: 50) {\n            nodes {\n              id\n              remainingQuantity\n              lineItem { variant { id } }\n            }\n          }\n        }\n      }\n    }\n  }\n": {return: FeeFulfillmentOrdersQuery, variables: FeeFulfillmentOrdersQueryVariables},
  "#graphql\n  query ListValidations {\n    validations(first: 25) {\n      nodes {\n        id\n        enabled\n        shopifyFunction { id }\n      }\n    }\n  }\n": {return: ListValidationsQuery, variables: ListValidationsQueryVariables},
  "#graphql\n  query QuoteVariants($ids: [ID!]!) {\n    nodes(ids: $ids) {\n      ... on ProductVariant {\n        id\n        price\n        product { id collections(first: 50) { nodes { id } } }\n        inventoryItem { measurement { weight { value unit } } }\n      }\n    }\n  }\n": {return: QuoteVariantsQuery, variables: QuoteVariantsQueryVariables},
  "#graphql\n  query QuoteShop { shop { currencyCode ianaTimezone } }\n": {return: QuoteShopQuery, variables: QuoteShopQueryVariables},
  "#graphql\n      query AppShell { shop { name currencyCode plan { partnerDevelopment shopifyPlus } } }": {return: AppShellQuery, variables: AppShellQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation CreateCartTransform($functionHandle: String!, $blockOnFailure: Boolean!) {\n    cartTransformCreate(functionHandle: $functionHandle, blockOnFailure: $blockOnFailure) {\n      cartTransform { id functionId }\n      userErrors { field message }\n    }\n  }\n": {return: CreateCartTransformMutation, variables: CreateCartTransformMutationVariables},
  "#graphql\n  mutation SetRulesMetafield($metafields: [MetafieldsSetInput!]!) {\n    metafieldsSet(metafields: $metafields) {\n      metafields { id key }\n      userErrors { field message code }\n    }\n  }\n": {return: SetRulesMetafieldMutation, variables: SetRulesMetafieldMutationVariables},
  "#graphql\n  mutation CreateFeeProduct($product: ProductCreateInput!) {\n    productCreate(product: $product) {\n      product {\n        id\n        variants(first: 1) {\n          nodes { id }\n        }\n      }\n      userErrors { field message }\n    }\n  }\n": {return: CreateFeeProductMutation, variables: CreateFeeProductMutationVariables},
  "#graphql\n  mutation ConfigureFeeVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {\n    productVariantsBulkUpdate(productId: $productId, variants: $variants) {\n      productVariants { id }\n      userErrors { field message }\n    }\n  }\n": {return: ConfigureFeeVariantMutation, variables: ConfigureFeeVariantMutationVariables},
  "#graphql\n  mutation UnlistFeeProduct($id: ID!) {\n    productUpdate(product: { id: $id, status: UNLISTED }) {\n      product { id }\n      userErrors { field message }\n    }\n  }\n": {return: UnlistFeeProductMutation, variables: UnlistFeeProductMutationVariables},
  "#graphql\n  mutation PublishFeeProduct($id: ID!, $input: [PublicationInput!]!) {\n    publishablePublish(id: $id, input: $input) {\n      userErrors { field message }\n    }\n  }\n": {return: PublishFeeProductMutation, variables: PublishFeeProductMutationVariables},
  "#graphql\n  mutation DeleteFeeProduct($input: ProductDeleteInput!) {\n    productDelete(input: $input) {\n      deletedProductId\n      userErrors { field message }\n    }\n  }\n": {return: DeleteFeeProductMutation, variables: DeleteFeeProductMutationVariables},
  "#graphql\n  mutation TagOrder($id: ID!, $tags: [String!]!) {\n    tagsAdd(id: $id, tags: $tags) {\n      node { id }\n      userErrors { field message }\n    }\n  }\n": {return: TagOrderMutation, variables: TagOrderMutationVariables},
  "#graphql\n  mutation DeleteCartTransform($id: ID!) {\n    cartTransformDelete(id: $id) {\n      deletedId\n      userErrors { field message }\n    }\n  }\n": {return: DeleteCartTransformMutation, variables: DeleteCartTransformMutationVariables},
  "#graphql\n  mutation FulfillFeeLines($fulfillment: FulfillmentInput!) {\n    fulfillmentCreate(fulfillment: $fulfillment) {\n      fulfillment { id status }\n      userErrors { field message }\n    }\n  }\n": {return: FulfillFeeLinesMutation, variables: FulfillFeeLinesMutationVariables},
  "#graphql\n  mutation CreateValidation($validation: ValidationCreateInput!) {\n    validationCreate(validation: $validation) {\n      validation { id enabled }\n      userErrors { field message }\n    }\n  }\n": {return: CreateValidationMutation, variables: CreateValidationMutationVariables},
  "#graphql\n  mutation UpdateValidation($id: ID!, $validation: ValidationUpdateInput!) {\n    validationUpdate(id: $id, validation: $validation) {\n      validation { id enabled }\n      userErrors { field message }\n    }\n  }\n": {return: UpdateValidationMutation, variables: UpdateValidationMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
