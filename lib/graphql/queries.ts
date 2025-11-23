import { gql } from 'graphql-request'

export const LIST_PROJECTS = gql`
  query ListProjects {
    projects {
      id
      title
      description
      status
      budget
      deadline
      clientId
      createdAt
    }
  }
`

export const LIST_OPEN_PROJECTS = gql`
  query ListOpenProjects {
    openProjects {
      id
      title
      description
      status
      budget
      deadline
      clientId
      createdAt
      additionalInfoRequirements {
        id
        fieldName
        fieldType
        required
        helpText
        options
        order
      }
    }
  }
`

export const GET_PROJECT = gql`
  query GetProject($id: ID!) {
    project(id: $id) {
      id
      title
      description
      status
      budget
      deadline
      clientId
      createdAt
      additionalInfoRequirements {
        id
        fieldName
        fieldType
        required
        helpText
        options
        order
      }
    }
  }
`

export const GET_PROPOSALS_FOR_PROJECT = gql`
  query GetProposalsForProject($projectId: ID!) {
    projectWithProposals(projectId: $projectId) {
      project {
        id
        title
        description
        status
        budget
        deadline
        clientId
        createdAt
      }
      proposals {
        id
        title
        biddingTeamName
        biddingLead {
          id
          name
          email
          avatarUrl
        }
        teamSize
        budgetEstimate
        submissionDate
        status
        complianceScore
        unreadMessages
      }
      totalProposals
      submittedProposals
      underReviewProposals
      acceptedProposals
      rejectedProposals
    }
  }
`

export const GET_PROPOSAL_DETAILS = gql`
  query GetProposalDetails($proposalId: ID!) {
    proposalDetail(proposalId: $proposalId) {
      id
      title
      status
      submissionDate
      biddingTeam {
        lead {
          id
          name
          email
          avatarUrl
          role
        }
        members {
          id
          name
          email
          avatarUrl
          role
        }
      }
      sections {
        id
        title
        content
        order
      }
      documents {
        id
        name
        fileType
        fileSize
        category
        url
        uploadedAt
        uploadedBy
      }
      complianceChecklist {
        id
        category
        item
        completed
        completedBy
        completedAt
      }
      versions {
        id
        versionNumber
        content
        createdBy
        createdAt
      }
      currentVersion
    }
  }
`

export const LIST_PROJECTS_BY_CLIENT = gql`
  query ListProjectsByClient($clientId: ID!) {
    projects(clientId: $clientId) {
      id
      clientId
      title
      description
      status
      budget
      deadline
      createdAt
      updatedAt
      additionalInfoRequirements {
        id
        fieldName
        fieldType
        required
        helpText
        options
        order
      }
    }
  }
`

export const GET_CHAT_MESSAGES = gql`
  query GetChatMessages(
    $projectId: ID!
    $proposalId: ID
    $limit: Int
    $offset: Int
  ) {
    chatMessages(
      projectId: $projectId
      proposalId: $proposalId
      limit: $limit
      offset: $offset
    ) {
      id
      projectId
      proposalId
      senderId
      senderName
      senderAvatar
      senderRole
      content
      createdAt
      read
    }
  }
`

export const GET_UNREAD_MESSAGE_COUNT = gql`
  query GetUnreadMessageCount($projectId: ID!, $proposalId: ID) {
    unreadMessageCount(projectId: $projectId, proposalId: $proposalId)
  }
`

export const GET_VERSION_HISTORY = gql`
  query GetVersionHistory($documentId: ID!) {
    documentVersionHistory(documentId: $documentId) {
      id
      documentId
      versionNumber
      content
      createdBy
      createdByName
      changesSummary
      isRollback
      rolledBackFrom
      createdAt
    }
  }
`

export const GET_VERSION = gql`
  query GetVersion($versionId: ID!) {
    documentVersion(versionId: $versionId) {
      id
      documentId
      versionNumber
      content
      createdBy
      createdByName
      changesSummary
      isRollback
      rolledBackFrom
      createdAt
    }
  }
`

// ============================================================================
// Document Queries
// ============================================================================

export const GET_DOCUMENT = gql`
  query GetDocument($id: ID!) {
    document(id: $id) {
      id
      workspaceId
      title
      description
      content
      createdBy
      lastEditedBy
      createdAt
      updatedAt
      collaborators {
        id
        userId
        userName
        email
        role
        addedBy
        addedByName
        addedAt
      }
    }
  }
`

export const LIST_DOCUMENTS = gql`
  query ListDocuments($workspaceId: ID!) {
    listDocuments(workspaceId: $workspaceId) {
      id
      workspaceId
      title
      description
      createdBy
      lastEditedBy
      createdAt
      updatedAt
      collaborators {
        id
        userId
        userName
        role
      }
    }
  }
`

export const SEARCH_DOCUMENTS = gql`
  query SearchDocuments($workspaceId: ID!, $query: String!) {
    searchDocuments(workspaceId: $workspaceId, query: $query) {
      id
      workspaceId
      title
      description
      createdBy
      lastEditedBy
      createdAt
      updatedAt
      collaborators {
        id
        userId
        userName
        role
      }
    }
  }
`

export const GET_WORKSPACE = gql`
  query GetWorkspace($id: ID!) {
    workspace(id: $id) {
      id
      projectId
      leadId
      name
      description
      createdAt
      updatedAt
      documents {
        id
        title
        description
        createdBy
        lastEditedBy
        createdAt
        updatedAt
      }
    }
  }
`

export const GET_WORKSPACE_BY_PROJECT = gql`
  query GetWorkspaceByProject($projectId: ID!) {
    workspaceByProject(projectId: $projectId) {
      id
      projectId
      leadId
      name
      description
      createdAt
      updatedAt
      documents {
        id
        title
        description
        createdBy
        lastEditedBy
        createdAt
        updatedAt
      }
    }
  }
`

// ============================================================================
// Collaborator Queries
// ============================================================================

export const GET_DOCUMENT_COLLABORATORS = gql`
  query GetDocumentCollaborators($documentId: ID!) {
    documentCollaborators(documentId: $documentId) {
      id
      documentId
      userId
      userName
      email
      role
      addedBy
      addedByName
      addedAt
    }
  }
`

export const GET_DOCUMENT_INVITATIONS = gql`
  query GetDocumentInvitations($documentId: ID!) {
    documentInvitations(documentId: $documentId) {
      id
      documentId
      documentTitle
      email
      role
      token
      invitedBy
      invitedByName
      expiresAt
      acceptedAt
      acceptedBy
      createdAt
    }
  }
`

export const GET_PENDING_INVITATIONS = gql`
  query GetPendingInvitations($email: String!) {
    pendingInvitations(email: $email) {
      id
      documentId
      documentTitle
      email
      role
      token
      invitedBy
      invitedByName
      expiresAt
      createdAt
    }
  }
`

// ============================================================================
// Collaboration Session Queries
// ============================================================================

export const GET_ACTIVE_SESSIONS = gql`
  query GetActiveSessions($documentId: ID!) {
    activeSessions(documentId: $documentId) {
      id
      documentId
      userId
      userName
      userColor
      cursorPosition {
        from
        to
      }
      presenceStatus
      lastActivity
      joinedAt
    }
  }
`

// ============================================================================
// Section Locking Queries
// ============================================================================

export const GET_LOCK_STATUS = gql`
  query GetLockStatus($sectionId: ID!) {
    getLockStatus(sectionId: $sectionId) {
      isLocked
      lockedBy
      lockedByUser {
        id
        email
        fullName
      }
      lockedAt
      expiresAt
    }
  }
`

export const GET_ACTIVE_LOCKS = gql`
  query GetActiveLocks($documentId: ID!) {
    getActiveLocks(documentId: $documentId) {
      id
      sectionId
      documentId
      userId
      userName
      acquiredAt
      expiresAt
      lastHeartbeat
    }
  }
`

// ============================================================================
// Progress Tracking Queries
// ============================================================================

export const GET_SECTION_PROGRESS = gql`
  query GetSectionProgress($documentId: ID!) {
    getSectionProgress(documentId: $documentId) {
      sectionId
      title
      status
      assignedTo
      assignedToUser {
        id
        email
        fullName
      }
      deadline
      lastUpdated
      isOverdue
      hoursRemaining
    }
  }
`

export const GET_OVERALL_PROGRESS = gql`
  query GetOverallProgress($documentId: ID!) {
    getOverallProgress(documentId: $documentId) {
      documentId
      totalSections
      notStarted
      inProgress
      inReview
      completed
      completionPercentage
      upcomingDeadlines {
        sectionId
        title
        deadline
        assignedTo
        assignedToUser {
          id
          email
          fullName
        }
        isOverdue
        hoursRemaining
        status
      }
    }
  }
`

export const GET_UPCOMING_DEADLINES = gql`
  query GetUpcomingDeadlines($documentId: ID!) {
    getUpcomingDeadlines(documentId: $documentId) {
      sectionId
      title
      deadline
      assignedTo
      assignedToUser {
        id
        email
        fullName
      }
      isOverdue
      hoursRemaining
      status
    }
  }
`

export const GET_DOCUMENT_SECTIONS = gql`
  query GetDocumentSections($documentId: ID!) {
    getDocumentSections(documentId: $documentId) {
      id
      documentId
      title
      order
      status
      assignedTo
      assignedToUser {
        id
        email
        fullName
      }
      deadline
      content
      lockedBy
      lockedByUser {
        id
        email
        fullName
      }
      lockedAt
      lockExpiresAt
      createdAt
      updatedAt
    }
  }
`

// ============================================================================
// Proposal Scoring Queries
// ============================================================================

export const GET_SCORING_TEMPLATE = gql`
  query GetScoringTemplate($projectId: ID!) {
    scoringTemplate(projectId: $projectId) {
      id
      projectId
      name
      description
      isDefault
      criteria {
        id
        templateId
        name
        description
        weight
        orderIndex
        createdAt
      }
      createdBy
      createdAt
      updatedAt
    }
  }
`

export const GET_PROPOSAL_SCORES = gql`
  query GetProposalScores($proposalId: ID!) {
    proposalScores(proposalId: $proposalId) {
      id
      proposalId
      criterion {
        id
        templateId
        name
        description
        weight
        orderIndex
        createdAt
      }
      rawScore
      weightedScore
      notes
      scoredBy {
        id
        email
        fullName
      }
      scoredAt
      isFinal
    }
  }
`

export const GET_PROPOSAL_RANKINGS = gql`
  query GetProposalRankings($projectId: ID!) {
    proposalRankings(projectId: $projectId) {
      id
      projectId
      proposal {
        id
        title
        biddingTeamName
        biddingLead {
          id
          name
          email
        }
        budgetEstimate
        submissionDate
        status
      }
      totalScore
      rank
      isFullyScored
      calculatedAt
    }
  }
`

export const GET_SCORING_COMPARISON = gql`
  query GetScoringComparison($projectId: ID!, $proposalIds: [ID!]!) {
    scoringComparison(projectId: $projectId, proposalIds: $proposalIds) {
      proposals {
        proposal {
          id
          title
          biddingTeamName
          biddingLead {
            id
            name
            email
          }
          budgetEstimate
          submissionDate
          status
        }
        scores {
          id
          proposalId
          criterion {
            id
            templateId
            name
            description
            weight
            orderIndex
            createdAt
          }
          rawScore
          weightedScore
          notes
          scoredBy {
            id
            email
            fullName
          }
          scoredAt
          isFinal
        }
        totalScore
        rank
        isFullyScored
      }
      criteria {
        id
        templateId
        name
        description
        weight
        orderIndex
        createdAt
      }
      bestScores {
        criterionId
        proposalId
        score
      }
      worstScores {
        criterionId
        proposalId
        score
      }
    }
  }
`

export const GET_PROPOSAL_SCORE_HISTORY = gql`
  query GetProposalScoreHistory($proposalId: ID!) {
    proposalScoreHistory(proposalId: $proposalId) {
      id
      proposalId
      criterion {
        id
        templateId
        name
        description
        weight
        orderIndex
        createdAt
      }
      previousRawScore
      newRawScore
      previousNotes
      newNotes
      changedBy {
        id
        email
        fullName
      }
      changedAt
      reason
    }
  }
`
