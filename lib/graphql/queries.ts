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
        versions {
          id
          versionNumber
          content
          createdBy
          createdByName
          changesSummary
          isRollback
          rolledBackFrom
          createdAt
          sectionsSnapshot
          attachmentsSnapshot
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
          uploaderName
        }
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
        sectionsSnapshot
        documentsSnapshot
        createdBy
        createdByName
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
      sectionsSnapshot
      attachmentsSnapshot
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

// ============================================================================
// Proposal Archival Queries
// ============================================================================

export const GET_PROPOSALS = gql`
  query GetProposals(
    $includeArchived: Boolean
    $archivedOnly: Boolean
    $projectId: ID
    $status: ProposalStatus
  ) {
    getProposals(
      includeArchived: $includeArchived
      archivedOnly: $archivedOnly
      projectId: $projectId
      status: $status
    ) {
      success
      data {
        id
        title
        projectId
        projectTitle
        status
        leadId
        leadName
        submittedAt
        archivedAt
        archivedBy
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const IS_PROPOSAL_ARCHIVED = gql`
  query IsProposalArchived($proposalId: ID!) {
    isProposalArchived(proposalId: $proposalId) {
      success
      data {
        isArchived
        archivedAt
        archivedBy
        archivedByName
      }
      error
    }
  }
`

export const GET_ARCHIVED_COUNT = gql`
  query GetArchivedCount {
    getArchivedCount {
      success
      count
      error
    }
  }
`

// ============================================================================
// Multi-Proposal Management Queries
// ============================================================================

export const GET_PROPOSAL_DASHBOARD = gql`
  query GetProposalDashboard(
    $filterStatus: ProposalStatus
    $filterDeadlineBefore: String
    $filterDeadlineAfter: String
    $filterProjectId: ID
    $sortBy: String
    $sortOrder: String
  ) {
    getProposalDashboard(
      filterStatus: $filterStatus
      filterDeadlineBefore: $filterDeadlineBefore
      filterDeadlineAfter: $filterDeadlineAfter
      filterProjectId: $filterProjectId
      sortBy: $sortBy
      sortOrder: $sortOrder
    ) {
      success
      data {
        id
        projectId
        projectName
        projectDeadline
        status
        completionPercentage
        teamSize
        unreadMessages
        lastActivity
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const GET_WORKSPACE_STATE = gql`
  query GetWorkspaceState($proposalId: ID!) {
    getWorkspaceState(proposalId: $proposalId) {
      success
      data {
        proposalId
        state
        savedAt
      }
      error
    }
  }
`

export const GET_AGGREGATE_STATISTICS = gql`
  query GetAggregateStatistics {
    getAggregateStatistics {
      success
      data {
        totalProposals
        activeProposals
        draftProposals
        submittedProposals
        approvedProposals
        rejectedProposals
        archivedProposals
        averageCompletionRate
        upcomingDeadlines
        overdueProposals
        totalTeamMembers
        averageTeamSize
      }
      error
    }
  }
`

// ============================================================================
// Bidding Leader Management Queries
// ============================================================================

export const GET_OPEN_PROJECTS = gql`
  query GetOpenProjects($filter: ProjectFilterInput) {
    getOpenProjects(filter: $filter) {
      id
      clientId
      title
      description
      status
      budget
      deadline
      additionalInfoRequirements {
        id
        fieldName
        fieldType
        required
        helpText
        options
        order
      }
      createdAt
      updatedAt
    }
  }
`

export const SEARCH_PROJECTS = gql`
  query SearchProjects($query: String!, $filter: ProjectFilterInput) {
    searchProjects(query: $query, filter: $filter) {
      id
      clientId
      title
      description
      status
      budget
      deadline
      additionalInfoRequirements {
        id
        fieldName
        fieldType
        required
        helpText
        options
        order
      }
      createdAt
      updatedAt
    }
  }
`

export const GET_PROJECT_DETAIL = gql`
  query GetProjectDetail($projectId: ID!) {
    getProjectDetail(projectId: $projectId) {
      id
      clientId
      client {
        id
        email
        fullName
      }
      title
      description
      status
      budget
      deadline
      additionalInfoRequirements {
        id
        fieldName
        fieldType
        required
        helpText
        options
        order
      }
      createdAt
      updatedAt
    }
  }
`

export const GET_BID_PERFORMANCE = gql`
  query GetBidPerformance($leadId: ID!) {
    getBidPerformance(leadId: $leadId) {
      totalProposals
      submitted
      accepted
      rejected
      winRate
      statusBreakdown {
        draft
        submitted
        reviewing
        approved
        rejected
      }
      averageTeamSize
      averageSectionsCount
      averageTimeToSubmit
    }
  }
`

export const GET_TEAM_METRICS = gql`
  query GetTeamMetrics($projectId: ID!) {
    getTeamMetrics(projectId: $projectId) {
      totalMembers
      activeMembers
      averageContribution
      topContributors {
        userId
        userName
        email
        sectionsCompleted
        sectionsAssigned
        completionRate
      }
    }
  }
`

export const GET_TEAM_MEMBERS = gql`
  query GetTeamMembers($projectId: ID) {
    getTeamMembers(projectId: $projectId) {
      id
      projectId
      userId
      user {
        id
        email
        fullName
      }
      role
      joinedAt
      assignedSections {
        id
        title
        status
        deadline
      }
      contributionStats {
        sectionsAssigned
        sectionsCompleted
        lastActivity
      }
    }
  }
`

export const GET_ALL_PROPOSAL_TEAM_MEMBERS = gql`
  query GetAllProposalTeamMembers {
    getAllProposalTeamMembers {
      proposalId
      projectId
      projectTitle
      proposalStatus
      teamMembers {
        userId
        user {
          id
          email
          fullName
          avatarUrl
        }
        role
        joinedAt
      }
    }
  }
`

export const GET_ACTIVE_INVITATIONS = gql`
  query GetActiveInvitations($projectId: ID!) {
    getActiveInvitations(projectId: $projectId) {
      id
      projectId
      createdBy
      code
      token
      expiresAt
      usedBy
      usedAt
      isMultiUse
      createdAt
    }
  }
`

// ============================================================================
// Lead Dashboard Queries
// ============================================================================

export const GET_LEAD_DASHBOARD_STATS = gql`
  query GetLeadDashboardStats($leadId: ID!) {
    leadDashboardStats(leadId: $leadId) {
      totalProposals
      activeProposals
      submittedProposals
      acceptedProposals
      rejectedProposals
      winRate
      totalBidValue
      averageResponseTime
    }
  }
`

export const GET_LEAD_RECENT_PROPOSALS = gql`
  query GetLeadRecentProposals($leadId: ID!, $limit: Int) {
    leadRecentProposals(leadId: $leadId, limit: $limit) {
      id
      projectTitle
      status
      submittedAt
      budgetEstimate
    }
  }
`

export const GET_SUBMISSION_DRAFT = gql`
  query GetSubmissionDraft($proposalId: ID!) {
    submissionDraft(proposalId: $proposalId) {
      id
      proposalId
      userId
      currentStep
      draftData
      createdAt
      updatedAt
    }
  }
`

// ============================================================================
// User Profile Queries
// ============================================================================

export const GET_USER_PROFILE = gql`
  query GetUserProfile($userId: ID!) {
    userProfile(userId: $userId) {
      id
      email
      role
      fullName
      createdAt
      verificationStatus
    }
  }
`

export const VALIDATE_INVITATION = gql`
  query ValidateInvitation($codeOrToken: String!) {
    validateInvitation(codeOrToken: $codeOrToken) {
      valid
      invitation {
        id
        projectId
        code
        token
        expiresAt
        isMultiUse
        usedAt
      }
      error
    }
  }
`

// ============================================================================
// Project Archive Queries
// ============================================================================

export const GET_PROJECT_ARCHIVE = gql`
  query GetProjectArchive($projectId: ID!) {
    projectArchive(projectId: $projectId) {
      id
      projectId
      archiveIdentifier
      compressedSize
      originalSize
      compressionRatio
      archivedBy {
        id
        email
        fullName
      }
      archivedAt
      retentionUntil
      legalHold
      legalHoldReason
      accessCount
      lastAccessedAt
      project {
        id
        title
        description
        budget
        deadline
        clientId
        status
        proposals {
          id
          leadId
          status
          submittedAt
          versions {
            versionNumber
            content
            createdBy
            createdAt
          }
        }
        deliverables {
          id
          projectId
          proposalId
          uploadedBy {
            id
            email
            fullName
          }
          fileName
          filePath
          fileType
          fileSize
          description
          version
          isFinal
          uploadedAt
          downloadUrl
        }
        documents {
          id
          title
          content
          createdBy
          createdAt
        }
        comments {
          id
          authorId
          message
          visibility
          createdAt
        }
      }
    }
  }
`

export const GET_PROJECT_ARCHIVE_BY_IDENTIFIER = gql`
  query GetProjectArchiveByIdentifier($archiveIdentifier: String!) {
    projectArchiveByIdentifier(archiveIdentifier: $archiveIdentifier) {
      id
      projectId
      archiveIdentifier
      compressedSize
      originalSize
      compressionRatio
      archivedBy {
        id
        email
        fullName
      }
      archivedAt
      retentionUntil
      legalHold
      legalHoldReason
      accessCount
      lastAccessedAt
      project {
        id
        title
        description
        budget
        deadline
        clientId
        status
        proposals {
          id
          leadId
          status
          submittedAt
          versions {
            versionNumber
            content
            createdBy
            createdAt
          }
        }
        deliverables {
          id
          projectId
          proposalId
          uploadedBy {
            id
            email
            fullName
          }
          fileName
          filePath
          fileType
          fileSize
          description
          version
          isFinal
          uploadedAt
          downloadUrl
        }
        documents {
          id
          title
          content
          createdBy
          createdAt
        }
        comments {
          id
          authorId
          message
          visibility
          createdAt
        }
      }
    }
  }
`

export const SEARCH_ARCHIVES = gql`
  query SearchArchives($query: String!, $limit: Int, $offset: Int) {
    searchArchives(query: $query, limit: $limit, offset: $offset) {
      id
      projectId
      archiveIdentifier
      compressedSize
      originalSize
      compressionRatio
      archivedBy {
        id
        email
        fullName
      }
      archivedAt
      retentionUntil
      legalHold
      legalHoldReason
      accessCount
      lastAccessedAt
      project {
        id
        title
        description
        budget
        deadline
        clientId
        status
      }
    }
  }
`
