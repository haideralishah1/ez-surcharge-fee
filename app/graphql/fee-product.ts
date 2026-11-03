/** Admin GraphQL used to provision and clean up hidden fee products. */

export const CREATE_FEE_PRODUCT = `#graphql
  mutation CreateFeeProduct($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product {
        id
        variants(first: 1) {
          nodes { id }
        }
      }
      userErrors { field message }
    }
  }
`;

export const FIND_FEE_PRODUCT = `#graphql
  query FindFeeProduct($query: String!) {
    products(first: 1, query: $query) {
      nodes {
        id
        variants(first: 1) {
          nodes { id }
        }
      }
    }
  }
`;

export const CONFIGURE_FEE_VARIANT = `#graphql
  mutation ConfigureFeeVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id }
      userErrors { field message }
    }
  }
`;

/** Unlisted: still purchasable, but kept out of storefront search, collections and recommendations. */
export const UNLIST_FEE_PRODUCT = `#graphql
  mutation UnlistFeeProduct($id: ID!) {
    productUpdate(product: { id: $id, status: UNLISTED }) {
      product { id }
      userErrors { field message }
    }
  }
`;

export const LIST_PUBLICATIONS = `#graphql
  query ListPublications {
    publications(first: 20) {
      nodes {
        id
        catalog {
          title
        }
      }
    }
  }
`;

export const PUBLISH_FEE_PRODUCT = `#graphql
  mutation PublishFeeProduct($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }
`;

export const DELETE_FEE_PRODUCT = `#graphql
  mutation DeleteFeeProduct($input: ProductDeleteInput!) {
    productDelete(input: $input) {
      deletedProductId
      userErrors { field message }
    }
  }
`;
