import { GraphQLClient } from 'graphql-request';

export function createGraphQLClient() {
  // Use absolute URL in browser, relative path on server
  const endpoint = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/graphql`
    : '/api/graphql';
    
  return new GraphQLClient(endpoint, {
    credentials: 'include',
  });
}

// GraphQL queries and mutations
export const PENDING_CLIENT_VERIFICATIONS = /* GraphQL */ `
  query PendingClientVerifications {
    pendingClientVerifications {
      id
      email
      fullName
      role
      verificationStatus
      createdAt
    }
  }
`;

export const VERIFY_CLIENT = /* GraphQL */ `
  mutation VerifyClient($userId: ID!, $approved: Boolean!, $reason: String) {
    verifyClient(userId: $userId, approved: $approved, reason: $reason) {
      id
      email
      fullName
      verificationStatus
      verificationReason
    }
  }
`;

export const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      id
      email
      fullName
      role
      verificationStatus
    }
  }
`;

export const CREATE_PROJECT = /* GraphQL */ `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      title
      description
      status
      budget
      deadline
      createdAt
    }
  }
`;

export const ADMIN_ALL_PROPOSALS = /* GraphQL */ `
  query AdminAllProposals($status: String, $search: String) {
    adminAllProposals(status: $status, search: $search) {
      id
      title
      status
      budgetEstimate
      timelineEstimate
      submissionDate
      project {
        id
        title
      }
      biddingLead {
        id
        fullName
        email
      }
      biddingTeam {
        id
        name
      }
    }
  }
`;

export const ADMIN_ALL_TEMPLATES = /* GraphQL */ `
  query AdminAllTemplates {
    adminAllTemplates {
      id
      name
      description
      type
      content
      createdAt
      updatedAt
    }
  }
`;
