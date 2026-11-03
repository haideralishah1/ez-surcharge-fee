/** Admin GraphQL used by the orders/create webhook and the missed-order catch-up. */

export const ORDERS_TO_CHECK = `#graphql
  query OrdersToCheck($query: String!, $after: String) {
    orders(first: 100, after: $after, sortKey: CREATED_AT, query: $query) {
      nodes { id createdAt }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const ORDER_FEE_LINES = `#graphql
  query OrderFeeLines($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      cancelledAt
      currencyCode
      lineItems(first: 100) {
        nodes {
          quantity
          variant { id }
          customAttributes { key value }
          originalUnitPriceSet { shopMoney { amount currencyCode } }
        }
      }
    }
  }
`;

export const TAG_ORDER = `#graphql
  mutation TagOrder($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node { id }
      userErrors { field message }
    }
  }
`;
