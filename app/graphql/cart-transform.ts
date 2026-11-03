/** Admin GraphQL used to register the cart transform and push rule config to it. */

export const LIST_CART_TRANSFORMS = `#graphql
  query ListCartTransforms {
    cartTransforms(first: 25) {
      nodes {
        id
        functionId
        blockOnFailure
      }
    }
  }
`;

export const CREATE_CART_TRANSFORM = `#graphql
  mutation CreateCartTransform($functionHandle: String!, $blockOnFailure: Boolean!) {
    cartTransformCreate(functionHandle: $functionHandle, blockOnFailure: $blockOnFailure) {
      cartTransform { id functionId }
      userErrors { field message }
    }
  }
`;

export const OPTIONAL_FEE_OWNERS = `#graphql
  query OptionalFeeOwners {
    currentAppInstallation { id }
    shop { id }
  }
`;

export const SET_RULES_METAFIELD = `#graphql
  mutation SetRulesMetafield($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key }
      userErrors { field message code }
    }
  }
`;
