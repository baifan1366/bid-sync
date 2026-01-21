import { gql } from 'graphql-request'

export const CREATE_PROJECT = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
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

export const SEND_MESSAGE = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
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

export const MARK_MESSAGES_AS_READ = gql`
  mutation MarkMessagesAsRead($projectId: ID!, $proposalId: ID) {
    markMessagesAsRead(projectId: $projectId, proposalId: $proposalId)
  }
`

export const ACCEPT_PROPOSAL = gql`
  mutation AcceptProposal($proposalId: ID!, $projectId: ID!) {
    acceptProposal(proposalId: $proposalId, projectId: $projectId) {
      id
      proposalId
      projectId
      decisionType
      decidedBy
      decidedAt
      feedback
    }
  }
`

export const REJECT_PROPOSAL = gql`
  mutation RejectProposal($input: RejectProposalInput!) {
    rejectProposal(input: $input) {
      id
      proposalId
      projectId
      decisionType
      decidedBy
      decidedAt
      feedback
    }
  }
`

export const UPDATE_PROJECT_STATUS = gql`
  mutation UpdateProjectStatus($projectId: ID!, $status: ProjectStatus!, $notes: String) {
    updateProjectStatus(projectId: $projectId, status: $status, notes: $notes) {
      id
      status
      updatedAt
    }
  }
`

export const UPDATE_PROJECT = gql`
  mutation UpdateProject($id: ID!, $input: UpdateProjectInput!) {
    updateProject(id: $id, input: $input) {
      id
      title
      description
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
      updatedAt
    }
  }
`

export const CREATE_PROPOSAL = gql`
  mutation CreateProposal($projectId: ID!) {
    createProposal(projectId: $projectId) {
      id
      projectId
      leadId
      title
      status
      createdAt
      project {
        id
        title
        description
        budget
        deadline
      }
    }
  }
`

export const UPDATE_PROPOSAL = gql`
  mutation UpdateProposal(
    $proposalId: ID!
    $title: String
    $content: String
    $budgetEstimate: Float
    $timelineEstimate: String
    $additionalInfo: JSON
  ) {
    updateProposal(
      proposalId: $proposalId
      title: $title
      content: $content
      budgetEstimate: $budgetEstimate
      timelineEstimate: $timelineEstimate
      additionalInfo: $additionalInfo
    ) {
      id
      title
      content
      status
      budgetEstimate
      timelineEstimate
      additionalInfo
      updatedAt
    }
  }
`

export const SUBMIT_PROPOSAL = gql`
  mutation SubmitProposal($input: SubmitProposalInput!) {
    submitProposal(input: $input) {
      success
      proposalId
      submittedAt
      errors
    }
  }
`

export const ROLLBACK_TO_VERSION = gql`
  mutation RollbackToVersion($documentId: ID!, $versionId: ID!) {
    rollbackToVersion(documentId: $documentId, versionId: $versionId) {
      success
      document {
        id
        content
        updatedAt
      }
      error
    }
  }
`

// ============================================================================
// Document Mutations
// ============================================================================

export const CREATE_WORKSPACE = gql`
  mutation CreateWorkspace($input: CreateWorkspaceInput!) {
    createWorkspace(input: $input) {
      id
      projectId
      leadId
      name
      description
      createdAt
      updatedAt
    }
  }
`

export const CREATE_DOCUMENT = gql`
  mutation CreateDocument($input: CreateDocumentInput!) {
    createDocument(input: $input) {
      success
      document {
        id
        workspaceId
        title
        description
        content
        createdBy
        lastEditedBy
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const UPDATE_DOCUMENT = gql`
  mutation UpdateDocument($documentId: ID!, $input: UpdateDocumentInput!) {
    updateDocument(documentId: $documentId, input: $input) {
      success
      document {
        id
        workspaceId
        title
        description
        content
        createdBy
        lastEditedBy
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($documentId: ID!) {
    deleteDocument(documentId: $documentId)
  }
`

// ============================================================================
// Version Control Mutations
// ============================================================================

export const CREATE_VERSION = gql`
  mutation CreateVersion($documentId: ID!, $changesSummary: String) {
    createVersion(documentId: $documentId, changesSummary: $changesSummary) {
      success
      version {
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
      error
    }
  }
`

// ============================================================================
// Team Management Mutations
// ============================================================================

export const INVITE_MEMBER = gql`
  mutation InviteMember($input: InviteMemberInput!) {
    inviteMember(input: $input) {
      success
      invitation {
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
      error
    }
  }
`

export const ACCEPT_INVITATION = gql`
  mutation AcceptInvitation($token: String!) {
    acceptInvitation(token: $token) {
      success
      collaborator {
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
      error
    }
  }
`

export const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateMemberRole($input: UpdateMemberRoleInput!) {
    updateMemberRole(input: $input) {
      success
      collaborator {
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
      error
    }
  }
`

export const REMOVE_MEMBER = gql`
  mutation RemoveMember($documentId: ID!, $userId: ID!) {
    removeMember(documentId: $documentId, userId: $userId)
  }
`

// ============================================================================
// Collaboration Session Mutations
// ============================================================================

export const JOIN_SESSION = gql`
  mutation JoinSession($input: JoinSessionInput!) {
    joinSession(input: $input) {
      success
      session {
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
      error
    }
  }
`

export const LEAVE_SESSION = gql`
  mutation LeaveSession($sessionId: ID!) {
    leaveSession(sessionId: $sessionId)
  }
`

export const UPDATE_CURSOR_POSITION = gql`
  mutation UpdateCursorPosition($input: UpdateCursorInput!) {
    updateCursorPosition(input: $input)
  }
`

export const UPDATE_PRESENCE = gql`
  mutation UpdatePresence($input: UpdatePresenceInput!) {
    updatePresence(input: $input)
  }
`

export const UPDATE_CURRENT_SECTION = gql`
  mutation UpdateCurrentSection($input: UpdateCurrentSectionInput!) {
    updateCurrentSection(input: $input)
  }
`

// ============================================================================
// Section Management Mutations
// ============================================================================

export const CREATE_SECTION = gql`
  mutation CreateSection($input: CreateSectionInput!) {
    createSection(input: $input) {
      success
      section {
        id
        documentId
        title
        order
        status
        assignedTo
        deadline
        content
        lockedBy
        lockedAt
        lockExpiresAt
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const UPDATE_SECTION = gql`
  mutation UpdateSection($sectionId: ID!, $input: UpdateSectionInput!) {
    updateSection(sectionId: $sectionId, input: $input) {
      success
      section {
        id
        documentId
        title
        order
        status
        assignedTo
        deadline
        content
        lockedBy
        lockedAt
        lockExpiresAt
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const DELETE_SECTION = gql`
  mutation DeleteSection($sectionId: ID!) {
    deleteSection(sectionId: $sectionId)
  }
`

// ============================================================================
// Section Locking Mutations
// ============================================================================

export const ACQUIRE_LOCK = gql`
  mutation AcquireLock($sectionId: ID!) {
    acquireLock(sectionId: $sectionId) {
      success
      lock {
        id
        sectionId
        documentId
        userId
        userName
        acquiredAt
        expiresAt
        lastHeartbeat
      }
      error
      lockedBy
    }
  }
`

export const RELEASE_LOCK = gql`
  mutation ReleaseLock($sectionId: ID!) {
    releaseLock(sectionId: $sectionId)
  }
`

export const HEARTBEAT_LOCK = gql`
  mutation HeartbeatLock($sectionId: ID!) {
    heartbeatLock(sectionId: $sectionId)
  }
`

// ============================================================================
// Progress Tracking Mutations
// ============================================================================

export const UPDATE_SECTION_STATUS = gql`
  mutation UpdateSectionStatus($sectionId: ID!, $status: SectionStatus!) {
    updateSectionStatus(sectionId: $sectionId, status: $status) {
      success
      section {
        id
        documentId
        title
        order
        status
        assignedTo
        deadline
        content
        lockedBy
        lockedAt
        lockExpiresAt
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const ASSIGN_SECTION = gql`
  mutation AssignSection($input: AssignSectionInput!) {
    assignSection(input: $input) {
      success
      section {
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
        lockedAt
        lockExpiresAt
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const UNASSIGN_SECTION = gql`
  mutation UnassignSection($sectionId: ID!) {
    unassignSection(sectionId: $sectionId) {
      success
      section {
        id
        documentId
        title
        order
        status
        assignedTo
        deadline
        content
        lockedBy
        lockedAt
        lockExpiresAt
        createdAt
        updatedAt
      }
      error
    }
  }
`

// ============================================================================
// Deadline Management Mutations
// ============================================================================

export const SET_SECTION_DEADLINE = gql`
  mutation SetSectionDeadline($sectionId: ID!, $input: SetDeadlineInput!) {
    setSectionDeadline(sectionId: $sectionId, input: $input) {
      success
      section {
        id
        documentId
        title
        order
        status
        assignedTo
        deadline
        content
        lockedBy
        lockedAt
        lockExpiresAt
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const SET_DOCUMENT_DEADLINE = gql`
  mutation SetDocumentDeadline($documentId: ID!, $input: SetDeadlineInput!) {
    setDocumentDeadline(documentId: $documentId, input: $input) {
      success
      document {
        id
        workspaceId
        title
        description
        content
        deadline
        createdBy
        lastEditedBy
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const REMOVE_SECTION_DEADLINE = gql`
  mutation RemoveSectionDeadline($sectionId: ID!) {
    removeSectionDeadline(sectionId: $sectionId) {
      success
      section {
        id
        documentId
        title
        order
        status
        assignedTo
        deadline
        content
        lockedBy
        lockedAt
        lockExpiresAt
        createdAt
        updatedAt
      }
      error
    }
  }
`

export const REMOVE_DOCUMENT_DEADLINE = gql`
  mutation RemoveDocumentDeadline($documentId: ID!) {
    removeDocumentDeadline(documentId: $documentId) {
      success
      document {
        id
        workspaceId
        title
        description
        content
        deadline
        createdBy
        lastEditedBy
        createdAt
        updatedAt
      }
      error
    }
  }
`

// ============================================================================
// Proposal Scoring Mutations
// ============================================================================

export const SCORE_PROPOSAL = gql`
  mutation ScoreProposal($input: ScoreProposalInput!) {
    scoreProposal(input: $input) {
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

export const FINALIZE_SCORING = gql`
  mutation FinalizeScoring($input: FinalizeScoringInput!) {
    finalizeScoring(input: $input)
  }
`

export const REVISE_SCORE = gql`
  mutation ReviseScore($input: ReviseScoreInput!) {
    reviseScore(input: $input) {
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

export const EXPORT_SCORING = gql`
  mutation ExportScoring($projectId: ID!) {
    exportScoring(projectId: $projectId) {
      url
      expiresAt
    }
  }
`

// ============================================================================
// Proposal Archival Mutations
// ============================================================================

export const ARCHIVE_PROPOSAL = gql`
  mutation ArchiveProposal($proposalId: ID!, $reason: String) {
    archiveProposal(proposalId: $proposalId, reason: $reason) {
      success
      error
    }
  }
`

export const UNARCHIVE_PROPOSAL = gql`
  mutation UnarchiveProposal($proposalId: ID!) {
    unarchiveProposal(proposalId: $proposalId) {
      success
      error
    }
  }
`

export const BULK_ARCHIVE_PROPOSALS = gql`
  mutation BulkArchiveProposals($proposalIds: [ID!]!) {
    bulkArchiveProposals(proposalIds: $proposalIds) {
      success
      error
    }
  }
`

// ============================================================================
// Multi-Proposal Management Mutations
// ============================================================================

export const SAVE_WORKSPACE_STATE = gql`
  mutation SaveWorkspaceState($proposalId: ID!, $state: JSON!) {
    saveWorkspaceState(proposalId: $proposalId, state: $state) {
      success
      error
    }
  }
`

export const CLEAR_WORKSPACE_STATE = gql`
  mutation ClearWorkspaceState($proposalId: ID!) {
    clearWorkspaceState(proposalId: $proposalId) {
      success
      error
    }
  }
`

// ============================================================================
// Bidding Leader Management Mutations
// ============================================================================

export const GENERATE_INVITATION = gql`
  mutation GenerateInvitation($input: GenerateInvitationInput!) {
    generateInvitation(input: $input) {
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

export const JOIN_TEAM = gql`
  mutation JoinTeam($input: JoinTeamInput!) {
    joinTeam(input: $input) {
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

export const REMOVE_TEAM_MEMBER = gql`
  mutation RemoveTeamMember($input: RemoveTeamMemberInput!) {
    removeTeamMember(input: $input)
  }
`

// ============================================================================
// Project Delivery and Archival Mutations
// ============================================================================

export const UPLOAD_DELIVERABLE = gql`
  mutation UploadDeliverable($input: UploadDeliverableInput!) {
    uploadDeliverable(input: $input) {
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
  }
`

export const DELETE_DELIVERABLE = gql`
  mutation DeleteDeliverable($deliverableId: ID!) {
    deleteDeliverable(deliverableId: $deliverableId)
  }
`

export const MARK_READY_FOR_DELIVERY = gql`
  mutation MarkReadyForDelivery($input: MarkReadyForDeliveryInput!) {
    markReadyForDelivery(input: $input) {
      id
      projectId
      proposalId
      submittedBy {
        id
        email
        fullName
      }
      submittedAt
      reviewStatus
      revisionCount
    }
  }
`

export const REVIEW_COMPLETION = gql`
  mutation ReviewCompletion($input: ReviewCompletionInput!) {
    reviewCompletion(input: $input) {
      id
      projectId
      reviewStatus
      reviewComments
      reviewedBy {
        id
        email
        fullName
      }
      reviewedAt
    }
  }
`

export const ACCEPT_COMPLETION = gql`
  mutation AcceptCompletion($completionId: ID!) {
    acceptCompletion(completionId: $completionId) {
      id
      projectId
      reviewStatus
      completedAt
    }
  }
`

export const REQUEST_REVISION = gql`
  mutation RequestRevision($input: RequestRevisionInput!) {
    requestRevision(input: $input) {
      id
      revisionNumber
      requestedBy {
        id
        email
        fullName
      }
      requestedAt
      revisionNotes
    }
  }
`

export const REQUEST_EXPORT = gql`
  mutation RequestExport($input: RequestExportInput!) {
    requestExport(input: $input) {
      id
      projectId
      requestedBy {
        id
        email
        fullName
      }
      requestedAt
      status
    }
  }
`

export const APPLY_LEGAL_HOLD = gql`
  mutation ApplyLegalHold($archiveId: ID!, $reason: String!) {
    applyLegalHold(archiveId: $archiveId, reason: $reason) {
      id
      projectId
      archiveIdentifier
      legalHold
      legalHoldReason
      retentionUntil
    }
  }
`

export const REMOVE_LEGAL_HOLD = gql`
  mutation RemoveLegalHold($archiveId: ID!) {
    removeLegalHold(archiveId: $archiveId) {
      id
      projectId
      archiveIdentifier
      legalHold
      legalHoldReason
      retentionUntil
    }
  }
`

// ============================================================================
// Submission Draft Mutations
// ============================================================================

export const SAVE_SUBMISSION_DRAFT = gql`
  mutation SaveSubmissionDraft($input: SaveSubmissionDraftInput!) {
    saveSubmissionDraft(input: $input) {
      success
      draftId
      error
    }
  }
`

export const DELETE_SUBMISSION_DRAFT = gql`
  mutation DeleteSubmissionDraft($proposalId: ID!) {
    deleteSubmissionDraft(proposalId: $proposalId) {
      success
      error
    }
  }
`
