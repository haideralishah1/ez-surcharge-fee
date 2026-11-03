/** Admin GraphQL for the required-fee checkout validation (fee-guard function). */

export const LIST_VALIDATIONS = `#graphql
  query ListValidations {
    validations(first: 25) {
      nodes {
        id
        enabled
        shopifyFunction { id }
      }
    }
  }
`;

export const CREATE_VALIDATION = `#graphql
  mutation CreateValidation($validation: ValidationCreateInput!) {
    validationCreate(validation: $validation) {
      validation { id enabled }
      userErrors { field message }
    }
  }
`;

export const UPDATE_VALIDATION = `#graphql
  mutation UpdateValidation($id: ID!, $validation: ValidationUpdateInput!) {
    validationUpdate(id: $id, validation: $validation) {
      validation { id enabled }
      userErrors { field message }
    }
  }
`;
