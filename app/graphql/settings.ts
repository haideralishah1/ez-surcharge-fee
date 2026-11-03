/** Admin GraphQL used by Settings and the orders webhook. */

export const SHOP_ID = `#graphql
  query ShopId { shop { id } }
`;

export const SHOP_LOCALES = `#graphql
  query ShopLocales {
    shopLocales { locale name primary published }
  }
`;

export const ORDERS_COUNT = `#graphql
  query OrdersSince($q: String!) {
    ordersCount(query: $q, limit: 10000) { count precision }
  }
`;

export const DELETE_CART_TRANSFORM = `#graphql
  mutation DeleteCartTransform($id: ID!) {
    cartTransformDelete(id: $id) {
      deletedId
      userErrors { field message }
    }
  }
`;

export const FEE_FULFILLMENT_ORDERS = `#graphql
  query FeeFulfillmentOrders($id: ID!) {
    order(id: $id) {
      fulfillmentOrders(first: 10) {
        nodes {
          id
          status
          lineItems(first: 50) {
            nodes {
              id
              remainingQuantity
              lineItem { variant { id } }
            }
          }
        }
      }
    }
  }
`;

export const FULFILL_FEE_LINES = `#graphql
  mutation FulfillFeeLines($fulfillment: FulfillmentInput!) {
    fulfillmentCreate(fulfillment: $fulfillment) {
      fulfillment { id status }
      userErrors { field message }
    }
  }
`;
