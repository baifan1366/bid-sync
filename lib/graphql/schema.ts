export const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    email: String!
    emailVerified: Boolean!
    role: UserRole!
    verificationStatus: VerificationStatus!
    verificationReason: String
    fullName: String
    isSuspended: Boolean!
    suspendedReason: String
    suspendedAt: String
    lastActivityAt: String
    createdAt: String!
    updatedAt: String!
  }

  enum UserRole {
    CLIENT
    BIDDING_LEAD
    BIDDING_MEMBER
    CONTENT_COORDINATOR
    ADMIN
  }

  enum VerificationStatus {
    PENDING_VERIFICATION
    VERIFIED
    REJECTED
  }

  type Admin {
    id: ID!
    email: String!
    fullName: String
    createdAt: String!
    lastLoginAt: String
    invitedBy: String
  }

  type AdminInvitation {
    id: ID!
    email: String!
    invitedBy: String!
    token: String!
    expiresAt: String!
    createdAt: String!
  }

  type UserActivityLog {
    id: ID!
    userId: ID!
    action: String!
    resourceType: String
    resourceId: ID
    ipAddress: String
    userAgent: String
    metadata: JSON
    createdAt: String!
  }

  type AdminAction {
    id: ID!
    adminId: ID!
    actionType: String!
    targetUserId: ID
    previousValue: JSON
    newValue: JSON
    reason: String
    createdAt: String!
  }

  type UserListResult {
    users: [User!]!
    totalCount: Int!
    page: Int!
    pageSize: Int!
  }

  type UserStatistics {
    totalUsers: Int!
    totalClients: Int!
    totalLeads: Int!
    totalMembers: Int!
    totalAdmins: Int!
    pendingVerifications: Int!
    verifiedUsers: Int!
    suspendedUsers: Int!
  }

  scalar JSON

  # Collaborative Editor Types
  type Workspace {
    id: ID!
    projectId: ID!
    leadId: ID!
    name: String!
    description: String
    createdAt: String!
    updatedAt: String!
    documents: [Document!]!
  }

  type Document {
    id: ID!
    workspaceId: ID!
    title: String!
    description: String
    content: JSON!
    createdBy: ID!
    lastEditedBy: ID!
    createdAt: String!
    updatedAt: String!
    collaborators: [DocumentCollaborator!]!
    versions: [DocumentVersion!]!
    activeSessions: [CollaborationSession!]!
    sections: [DocumentSection!]!
    deadline: String
  }

  type DocumentVersion {
    id: ID!
    documentId: ID!
    versionNumber: Int!
    content: JSON!
    createdBy: ID!
    createdByName: String!
    changesSummary: String!
    isRollback: Boolean!
    rolledBackFrom: ID
    createdAt: String!
  }

  type DocumentCollaborator {
    id: ID!
    documentId: ID!
    userId: ID!
    userName: String!
    email: String!
    role: CollaboratorRole!
    addedBy: ID!
    addedByName: String!
    addedAt: String!
  }

  enum CollaboratorRole {
    OWNER
    EDITOR
    COMMENTER
    VIEWER
  }

  type CollaborationSession {
    id: ID!
    documentId: ID!
    userId: ID!
    userName: String!
    userColor: String!
    cursorPosition: CursorPosition
    presenceStatus: PresenceStatus!
    currentSection: String
    lastActivity: String!
    joinedAt: String!
  }

  type CursorPosition {
    from: Int!
    to: Int!
  }

  enum PresenceStatus {
    ACTIVE
    IDLE
    AWAY
  }

  # Section-based locking and progress tracking types
  type DocumentSection {
    id: ID!
    documentId: ID!
    title: String!
    order: Int!
    status: SectionStatus!
    assignedTo: ID
    assignedToUser: User
    deadline: String
    content: JSON
    lockedBy: ID
    lockedByUser: User
    lockedAt: String
    lockExpiresAt: String
    createdAt: String!
    updatedAt: String!
  }

  enum SectionStatus {
    NOT_STARTED
    IN_PROGRESS
    IN_REVIEW
    COMPLETED
  }

  type SectionLock {
    id: ID!
    sectionId: ID!
    documentId: ID!
    userId: ID!
    userName: String!
    acquiredAt: String!
    expiresAt: String!
    lastHeartbeat: String!
  }

  type LockResult {
    success: Boolean!
    lock: SectionLock
    error: String
    lockedBy: String
  }

  type LockStatus {
    isLocked: Boolean!
    lockedBy: ID
    lockedByUser: User
    lockedAt: String
    expiresAt: String
  }

  type SectionProgress {
    sectionId: ID!
    title: String!
    status: SectionStatus!
    assignedTo: ID
    assignedToUser: User
    deadline: String
    lastUpdated: String!
    isOverdue: Boolean!
    hoursRemaining: Float
  }

  type OverallProgress {
    documentId: ID!
    totalSections: Int!
    notStarted: Int!
    inProgress: Int!
    inReview: Int!
    completed: Int!
    completionPercentage: Float!
    upcomingDeadlines: [Deadline!]!
  }

  type Deadline {
    sectionId: ID!
    title: String!
    deadline: String!
    assignedTo: ID
    assignedToUser: User
    isOverdue: Boolean!
    hoursRemaining: Float!
    status: SectionStatus!
  }

  type AssignedSection {
    id: ID!
    title: String!
    status: SectionStatus!
    deadline: String
    document: AssignedSectionDocument!
  }

  type AssignedSectionDocument {
    id: ID!
    title: String!
    workspace: AssignedSectionWorkspace!
  }

  type AssignedSectionWorkspace {
    id: ID!
    projectId: ID!
    name: String!
  }

  # Proposal Scoring System Types
  type ScoringTemplate {
    id: ID!
    projectId: ID!
    name: String!
    description: String
    isDefault: Boolean!
    criteria: [ScoringCriterion!]!
    createdBy: ID!
    createdAt: String!
    updatedAt: String!
  }

  type ScoringCriterion {
    id: ID!
    templateId: ID!
    name: String!
    description: String
    weight: Float!
    orderIndex: Int!
    createdAt: String!
  }

  type ProposalScore {
    id: ID!
    proposalId: ID!
    criterion: ScoringCriterion!
    rawScore: Float!
    weightedScore: Float!
    notes: String
    scoredBy: User!
    scoredAt: String!
    isFinal: Boolean!
  }

  type ProposalScoreHistory {
    id: ID!
    proposalId: ID!
    criterion: ScoringCriterion!
    previousRawScore: Float
    newRawScore: Float!
    previousNotes: String
    newNotes: String
    changedBy: User!
    changedAt: String!
    reason: String
  }

  type ProposalRanking {
    id: ID!
    projectId: ID!
    proposal: ProposalSummary!
    totalScore: Float!
    rank: Int!
    isFullyScored: Boolean!
    calculatedAt: String!
  }

  type ScoringComparison {
    proposals: [ProposalWithScores!]!
    criteria: [ScoringCriterion!]!
    bestScores: [BestScore!]!
    worstScores: [WorstScore!]!
  }

  type ProposalWithScores {
    proposal: ProposalSummary!
    scores: [ProposalScore!]!
    totalScore: Float!
    rank: Int!
    isFullyScored: Boolean!
  }

  type BestScore {
    criterionId: ID!
    proposalId: ID!
    score: Float!
  }

  type WorstScore {
    criterionId: ID!
    proposalId: ID!
    score: Float!
  }

  type ScoringExport {
    url: String!
    expiresAt: String!
  }

  input CreateScoringTemplateInput {
    projectId: ID!
    name: String!
    description: String
    criteria: [CreateScoringCriterionInput!]!
  }

  input CreateScoringCriterionInput {
    name: String!
    description: String
    weight: Float!
    orderIndex: Int!
  }

  input UpdateScoringTemplateInput {
    name: String
    description: String
    criteria: [UpdateScoringCriterionInput!]
  }

  input UpdateScoringCriterionInput {
    id: ID
    name: String!
    description: String
    weight: Float!
    orderIndex: Int!
  }

  input ScoreProposalInput {
    proposalId: ID!
    criterionId: ID!
    rawScore: Float!
    notes: String
  }

  input FinalizeScoringInput {
    proposalId: ID!
  }

  input ReviseScoreInput {
    proposalId: ID!
    criterionId: ID!
    newRawScore: Float!
    newNotes: String
    reason: String!
  }

  # Q&A System Types
  type ProjectQuestion {
    id: ID!
    projectId: ID!
    askedBy: User!
    question: String!
    answers: [QuestionAnswer!]!
    createdAt: String!
    updatedAt: String!
  }

  type QuestionAnswer {
    id: ID!
    questionId: ID!
    answeredBy: User!
    answer: String!
    createdAt: String!
  }

  # Analytics Types
  type PlatformAnalytics {
    userGrowth: [DataPoint!]!
    projectStats: ProjectStats!
    proposalStats: ProposalStats!
    revenueData: [DataPoint!]!
    conversionRates: ConversionRates!
  }

  type DataPoint {
    date: String!
    value: Float!
  }

  type ProjectStats {
    total: Int!
    pending: Int!
    open: Int!
    closed: Int!
    awarded: Int!
  }

  type ProposalStats {
    total: Int!
    draft: Int!
    submitted: Int!
    accepted: Int!
    rejected: Int!
  }

  type ConversionRates {
    projectApprovalRate: Float!
    proposalAcceptanceRate: Float!
    clientRetentionRate: Float!
  }

  type ScoringAnalytics {
    scoringUsagePercentage: Float!
    averageProposalsScored: Float!
    mostCommonCriteria: [CriterionUsage!]!
    averageScoringDuration: Float!
  }

  type CriterionUsage {
    name: String!
    count: Int!
    percentage: Float!
  }

  type DocumentInvitation {
    id: ID!
    documentId: ID!
    documentTitle: String!
    email: String!
    role: CollaboratorRole!
    token: String!
    invitedBy: ID!
    invitedByName: String!
    expiresAt: String!
    acceptedAt: String
    acceptedBy: ID
    createdAt: String!
  }

  type Query {
    me: User
    pendingClientVerifications: [User!]!
    user(id: ID!): User
    
    # Project queries
    projects(clientId: ID): [Project!]!
    openProjects: [Project!]!
    pendingProjects: [Project!]!
    project(id: ID!): Project
    projectWithProposals(projectId: ID!): ProjectWithProposals
    proposalDetail(proposalId: ID!): ProposalDetail
    chatMessages(projectId: ID!, proposalId: ID, limit: Int, offset: Int): [ChatMessage!]!
    unreadMessageCount(projectId: ID!, proposalId: ID): Int!
    
    # Q&A queries
    projectQuestions(projectId: ID!): [ProjectQuestion!]!
    
    # Analytics queries
    platformAnalytics(dateFrom: String, dateTo: String): PlatformAnalytics!
    scoringAnalytics(dateFrom: String, dateTo: String): ScoringAnalytics!
    
    # Admin management queries
    allAdmins: [Admin!]!
    adminInvitations: [AdminInvitation!]!
    
    # User management queries
    allUsers(
      page: Int
      pageSize: Int
      role: UserRole
      verificationStatus: VerificationStatus
      searchQuery: String
      dateFrom: String
      dateTo: String
      sortBy: String
      sortOrder: String
    ): UserListResult!
    userStatistics: UserStatistics!
    userActivityLogs(userId: ID!, limit: Int, offset: Int, dateFrom: String, dateTo: String): [UserActivityLog!]!
    adminActions(limit: Int, offset: Int): [AdminAction!]!
    exportUserActivityLogs(userId: ID!, dateFrom: String, dateTo: String): String!
    
    # Proposal submission queries
    getProjectRequirements(projectId: ID!): [AdditionalInfoRequirement!]!
    leadProposals(leadId: ID!): [ProposalWithProject!]!
    
    # Collaborative Editor queries
    workspace(id: ID!): Workspace
    workspaceByProject(projectId: ID!): Workspace
    document(id: ID!): Document
    listDocuments(workspaceId: ID!): [Document!]!
    searchDocuments(workspaceId: ID!, query: String!): [Document!]!
    documentVersionHistory(documentId: ID!): [DocumentVersion!]!
    documentVersion(versionId: ID!): DocumentVersion
    documentCollaborators(documentId: ID!): [DocumentCollaborator!]!
    activeSessions(documentId: ID!): [CollaborationSession!]!
    documentInvitations(documentId: ID!): [DocumentInvitation!]!
    pendingInvitations(email: String!): [DocumentInvitation!]!
    
    # Section locking queries
    getLockStatus(sectionId: ID!): LockStatus!
    getActiveLocks(documentId: ID!): [SectionLock!]!
    
    # Progress tracking queries
    getSectionProgress(documentId: ID!): [SectionProgress!]!
    getOverallProgress(documentId: ID!): OverallProgress!
    getUpcomingDeadlines(documentId: ID!): [Deadline!]!
    getDocumentSections(documentId: ID!): [DocumentSection!]!
    
    # Proposal Scoring queries
    scoringTemplate(projectId: ID!): ScoringTemplate
    defaultScoringTemplates: [ScoringTemplate!]!
    proposalScores(proposalId: ID!): [ProposalScore!]!
    proposalScoreHistory(proposalId: ID!): [ProposalScoreHistory!]!
    proposalRankings(projectId: ID!): [ProposalRanking!]!
    scoringComparison(projectId: ID!, proposalIds: [ID!]!): ScoringComparison!
    
    # Member Dashboard queries
    myAssignedSections: [AssignedSection!]!
    
    # Admin Proposal Oversight queries
    adminAllProposals(status: String, search: String): [AdminProposal!]!
    
    # Admin Template Management queries
    adminAllTemplates: [Template!]!
    
    # Proposal Archival queries
    getProposals(includeArchived: Boolean, archivedOnly: Boolean, projectId: ID, status: ProposalStatus): ProposalListResult!
    isProposalArchived(proposalId: ID!): ArchivedCheckResult!
    getArchivedCount: ArchivedCountResult!
    
    # Multi-Proposal Management queries
    getProposalDashboard(
      filterStatus: ProposalStatus
      filterDeadlineBefore: String
      filterDeadlineAfter: String
      filterProjectId: ID
      sortBy: String
      sortOrder: String
    ): ProposalDashboardResult!
    getWorkspaceState(proposalId: ID!): WorkspaceStateResult!
    getAggregateStatistics: AggregateStatisticsResult!
    
    # Bidding Leader Management queries
    getOpenProjects(filter: ProjectFilterInput): [Project!]!
    searchProjects(query: String!, filter: ProjectFilterInput): [Project!]!
    getProjectDetail(projectId: ID!): ProjectDetail!
    getBidPerformance(leadId: ID!): BidPerformance!
    getTeamMetrics(projectId: ID!): TeamMetrics!
    getTeamMembers(projectId: ID): [BidTeamMember!]!
    getAllProposalTeamMembers: [ProposalTeamInfo!]!
    getActiveInvitations(projectId: ID!): [TeamInvitation!]!
    validateInvitation(codeOrToken: String!): ValidationResult!
    
    # Project Delivery and Archival queries
    deliverables(projectId: ID!): [Deliverable!]!
    projectCompletion(projectId: ID!): ProjectCompletion
    projectArchive(projectId: ID!): ProjectArchive
    projectArchiveByIdentifier(archiveIdentifier: String!): ProjectArchive
    searchArchives(query: String!, limit: Int, offset: Int): [ProjectArchive!]!
    projectExport(exportId: ID!): ProjectExport
    projectExports(projectId: ID!): [ProjectExport!]!
    completionStatistics(dateFrom: String, dateTo: String): CompletionStatistics!
    
    # Notification queries
    notifications(limit: Int, unreadOnly: Boolean): NotificationList!
    unreadNotificationCount: Int!
  }
  
  type AdminProposal {
    id: ID!
    title: String!
    status: ProposalStatus!
    budgetEstimate: Float
    timelineEstimate: String
    submissionDate: String
    project: Project!
    biddingLead: User!
    biddingTeam: BiddingTeam
  }
  
  type BiddingTeam {
    id: ID!
    name: String!
  }
  
  type Template {
    id: ID!
    name: String!
    description: String
    type: TemplateType!
    content: String!
    createdAt: String!
    updatedAt: String!
  }
  
  enum TemplateType {
    PROPOSAL
    CHECKLIST
    CONTRACT
  }

  type Project {
    id: ID!
    clientId: ID!
    client: User
    title: String!
    description: String!
    status: ProjectStatus!
    budget: Float
    deadline: String
    additionalInfoRequirements: [AdditionalInfoRequirement!]!
    createdAt: String!
    updatedAt: String!
  }

  type AdditionalInfoRequirement {
    id: ID!
    fieldName: String!
    fieldType: FieldType!
    required: Boolean!
    helpText: String
    options: [String!]
    order: Int!
  }

  enum FieldType {
    TEXT
    NUMBER
    DATE
    FILE
    TEXTAREA
    SELECT
  }

  enum ProjectStatus {
    PENDING_REVIEW
    OPEN
    CLOSED
    AWARDED
  }

  type ProjectWithProposals {
    project: Project!
    proposals: [ProposalSummary!]!
    totalProposals: Int!
    submittedProposals: Int!
    underReviewProposals: Int!
    acceptedProposals: Int!
    rejectedProposals: Int!
  }

  type ProposalSummary {
    id: ID!
    title: String
    biddingTeamName: String
    biddingLead: TeamMember!
    teamSize: Int!
    budgetEstimate: Float
    timelineEstimate: String
    executiveSummary: String
    submissionDate: String
    status: ProposalStatus!
    complianceScore: Int!
    unreadMessages: Int!
    additionalInfo: [ProposalAdditionalInfo!]!
  }

  type ProposalWithProject {
    id: ID!
    title: String
    content: String
    status: ProposalStatus!
    budgetEstimate: Float
    timelineEstimate: String
    additionalInfo: JSON
    submissionDate: String
    project: Project!
  }

  type ProposalDetail {
    id: ID!
    title: String
    budgetEstimate: Float
    timelineEstimate: String
    executiveSummary: String
    status: ProposalStatus!
    submissionDate: String
    biddingTeam: BiddingTeam!
    sections: [ProposalSection!]!
    documents: [ProposalDocument!]!
    complianceChecklist: [ComplianceItem!]!
    versions: [ProposalVersion!]!
    currentVersion: Int!
    additionalInfo: [ProposalAdditionalInfo!]!
  }

  type ProposalAdditionalInfo {
    id: ID!
    fieldId: String!
    fieldName: String!
    fieldValue: JSON!
  }

  type BiddingTeam {
    lead: TeamMember!
    members: [TeamMember!]!
  }

  type TeamMember {
    id: ID!
    name: String!
    email: String!
    avatarUrl: String
    role: String!
    assignedSections: [String!]!
  }

  type ProposalSection {
    id: ID!
    title: String!
    content: String!
    order: Int!
  }

  type ProposalDocument {
    id: ID!
    name: String!
    fileType: String!
    fileSize: Int!
    category: DocumentCategory!
    url: String!
    uploadedAt: String!
    uploadedBy: String!
  }

  enum DocumentCategory {
    TECHNICAL
    FINANCIAL
    LEGAL
    OTHER
  }

  type ComplianceItem {
    id: ID!
    category: ComplianceCategory!
    item: String!
    completed: Boolean!
    completedBy: String
    completedAt: String
  }

  enum ComplianceCategory {
    TECHNICAL
    FINANCIAL
    LEGAL
  }

  type ProposalVersion {
    id: ID!
    versionNumber: Int!
    content: String!
    createdBy: String!
    createdAt: String!
  }

  enum ProposalStatus {
    DRAFT
    SUBMITTED
    UNDER_REVIEW
    ACCEPTED
    REJECTED
  }

  type ChatMessage {
    id: ID!
    projectId: ID!
    proposalId: ID
    senderId: ID!
    senderName: String!
    senderAvatar: String
    senderRole: String!
    content: String!
    createdAt: String!
    read: Boolean!
  }

  type ProposalDecision {
    id: ID!
    proposalId: ID!
    projectId: ID!
    decisionType: String!
    decidedBy: ID!
    decidedAt: String!
    feedback: String
  }

  type Proposal {
    id: ID!
    projectId: ID!
    leadId: ID!
    title: String
    content: String
    status: ProposalStatus!
    budgetEstimate: Float
    timelineEstimate: String
    executiveSummary: String
    additionalInfo: JSON
    submissionDate: String
    createdAt: String!
    updatedAt: String!
    project: Project!
  }

  input CreateProjectInput {
    title: String!
    description: String!
    budget: Float
    deadline: String
    additionalInfoRequirements: [AdditionalInfoRequirementInput!]
  }

  input UpdateProjectInput {
    title: String
    description: String
    budget: Float
    deadline: String
    additionalInfoRequirements: [AdditionalInfoRequirementInput!]
  }

  input AdditionalInfoRequirementInput {
    id: ID!
    fieldName: String!
    fieldType: FieldType!
    required: Boolean!
    helpText: String
    options: [String!]
    order: Int!
  }

  input SendMessageInput {
    projectId: ID!
    proposalId: ID
    content: String!
  }

  input RejectProposalInput {
    proposalId: ID!
    projectId: ID!
    feedback: String!
  }

  input SubmitProposalInput {
    proposalId: ID!
    projectId: ID!
    title: String!
    budgetEstimate: Float!
    timelineEstimate: String!
    executiveSummary: String!
    additionalInfo: [AdditionalInfoInput!]!
  }

  input AdditionalInfoInput {
    fieldId: String!
    fieldName: String!
    fieldValue: JSON!
  }

  type SubmissionResult {
    success: Boolean!
    proposalId: ID!
    submittedAt: String!
    errors: [String!]
  }

  # Collaborative Editor Inputs
  input CreateWorkspaceInput {
    projectId: ID!
    name: String!
    description: String
  }

  input CreateDocumentInput {
    workspaceId: ID!
    title: String!
    description: String
  }

  input UpdateDocumentInput {
    title: String
    description: String
    content: JSON
  }

  input InviteMemberInput {
    documentId: ID!
    email: String!
    role: CollaboratorRole!
  }

  input UpdateMemberRoleInput {
    documentId: ID!
    userId: ID!
    role: CollaboratorRole!
  }

  input JoinSessionInput {
    documentId: ID!
    userColor: String!
  }

  input UpdateCursorInput {
    sessionId: ID!
    from: Int!
    to: Int!
  }

  input UpdatePresenceInput {
    sessionId: ID!
    status: PresenceStatus!
  }

  input UpdateCurrentSectionInput {
    sessionId: ID!
    sectionId: String
  }

  # Section-based inputs
  input CreateSectionInput {
    documentId: ID!
    title: String!
    order: Int!
    content: JSON
  }

  input UpdateSectionInput {
    title: String
    order: Int
    content: JSON
    status: SectionStatus
  }

  input AssignSectionInput {
    sectionId: ID!
    userId: ID!
  }

  input SetDeadlineInput {
    deadline: String!
  }

  type SectionResult {
    success: Boolean!
    section: DocumentSection
    error: String
  }

  type DocumentOperationResult {
    success: Boolean!
    document: Document
    error: String
  }

  type InvitationResult {
    success: Boolean!
    invitation: DocumentInvitation
    error: String
  }

  type CollaboratorResult {
    success: Boolean!
    collaborator: DocumentCollaborator
    error: String
  }

  type SessionResult {
    success: Boolean!
    session: CollaborationSession
    error: String
  }

  type VersionResult {
    success: Boolean!
    version: DocumentVersion
    error: String
  }

  type ArchivalResult {
    success: Boolean!
    error: String
  }

  type ProposalListResult {
    success: Boolean!
    data: [ProposalSummary!]
    error: String
  }

  type ArchivedCheckResult {
    success: Boolean!
    data: ArchivedCheck
    error: String
  }

  type ArchivedCheck {
    isArchived: Boolean!
    archivedAt: String
    archivedBy: ID
    archivedByName: String
  }

  type ArchivedCountResult {
    success: Boolean!
    count: Int
    error: String
  }

  type ProposalDashboardItem {
    id: ID!
    projectId: ID!
    projectName: String!
    projectDeadline: String
    status: ProposalStatus!
    completionPercentage: Int!
    teamSize: Int!
    unreadMessages: Int!
    lastActivity: String!
    createdAt: String!
    updatedAt: String!
  }

  type ProposalDashboardResult {
    success: Boolean!
    data: [ProposalDashboardItem!]
    error: String
  }

  type WorkspaceState {
    proposalId: ID!
    state: JSON!
    savedAt: String!
  }

  type WorkspaceStateResult {
    success: Boolean!
    data: WorkspaceState
    error: String
  }

  type AggregateStatistics {
    totalProposals: Int!
    activeProposals: Int!
    draftProposals: Int!
    submittedProposals: Int!
    approvedProposals: Int!
    rejectedProposals: Int!
    archivedProposals: Int!
    averageCompletionRate: Int!
    upcomingDeadlines: Int!
    overdueProposals: Int!
    totalTeamMembers: Int!
    averageTeamSize: Int!
  }

  type AggregateStatisticsResult {
    success: Boolean!
    data: AggregateStatistics
    error: String
  }

  type OperationResult {
    success: Boolean!
    error: String
  }

  # Bidding Leader Management Types
  type TeamInvitation {
    id: ID!
    projectId: ID!
    createdBy: ID!
    code: String!
    token: String!
    expiresAt: String!
    usedBy: ID
    usedAt: String
    isMultiUse: Boolean!
    createdAt: String!
  }

  type ValidationResult {
    valid: Boolean!
    invitation: TeamInvitation
    error: String
  }

  type BidTeamMember {
    id: ID!
    projectId: ID!
    userId: ID!
    user: User
    role: String!
    joinedAt: String!
    assignedSections: [AssignedSection!]!
    contributionStats: ContributionStats
  }

  type ProposalTeamInfo {
    proposalId: ID!
    projectId: ID!
    projectTitle: String!
    proposalStatus: ProposalStatus!
    teamMembers: [ProposalTeamMember!]!
  }

  type ProposalTeamMember {
    userId: ID!
    user: ProposalTeamUser
    role: String!
    joinedAt: String!
  }

  type ProposalTeamUser {
    id: ID!
    email: String!
    fullName: String
    avatarUrl: String
  }

  type ContributionStats {
    sectionsAssigned: Int!
    sectionsCompleted: Int!
    lastActivity: String
  }

  type TeamStatistics {
    totalMembers: Int!
    activeMembers: Int!
    leads: Int!
    members: Int!
    totalSectionsAssigned: Int!
    totalSectionsCompleted: Int!
    averageContribution: Float!
  }

  type TeamMetrics {
    totalMembers: Int!
    activeMembers: Int!
    averageContribution: Float!
    topContributors: [Contributor!]!
  }

  type Contributor {
    userId: ID!
    userName: String!
    email: String!
    sectionsCompleted: Int!
    sectionsAssigned: Int!
    completionRate: Float!
  }

  type BidPerformance {
    totalProposals: Int!
    submitted: Int!
    accepted: Int!
    rejected: Int!
    winRate: Float!
    statusBreakdown: StatusBreakdown!
    averageTeamSize: Float!
    averageSectionsCount: Float!
    averageTimeToSubmit: Float!
  }

  type StatusBreakdown {
    draft: Int!
    submitted: Int!
    reviewing: Int!
    approved: Int!
    rejected: Int!
  }

  type ProjectDetail {
    id: ID!
    clientId: ID!
    client: User
    title: String!
    description: String!
    status: ProjectStatus!
    budget: Float
    deadline: String
    additionalInfoRequirements: [AdditionalInfoRequirement!]!
    createdAt: String!
    updatedAt: String!
  }

  input GenerateInvitationInput {
    projectId: ID!
    proposalId: ID
    expirationDays: Int
    isMultiUse: Boolean
  }

  input JoinTeamInput {
    invitationId: ID!
  }

  input RemoveTeamMemberInput {
    projectId: ID!
    userId: ID!
  }

  input ProjectFilterInput {
    budgetMin: Float
    budgetMax: Float
    deadlineBefore: String
    deadlineAfter: String
    category: String
    searchTerm: String
    status: ProjectStatus
  }

  # Notification types
  type Notification {
    id: ID!
    userId: ID!
    type: String!
    title: String!
    body: String
    data: JSON
    read: Boolean!
    readAt: String
    sentViaEmail: Boolean!
    legalHold: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type NotificationList {
    notifications: [Notification!]!
    unreadCount: Int!
  }

  type Mutation {
    verifyClient(userId: ID!, approved: Boolean!, reason: String): User!
    createProject(input: CreateProjectInput!): Project!
    updateProject(id: ID!, input: UpdateProjectInput!): Project!
    updateProjectStatus(projectId: ID!, status: ProjectStatus!, notes: String): Project!
    
    # Admin project approval mutations
    approveProject(projectId: ID!, notes: String): Project!
    rejectProject(projectId: ID!, reason: String!): Project!
    requestProjectChanges(projectId: ID!, changes: String!): Project!
    sendMessage(input: SendMessageInput!): ChatMessage!
    markMessagesAsRead(projectId: ID!, proposalId: ID): Boolean!
    acceptProposal(proposalId: ID!, projectId: ID!): ProposalDecision!
    rejectProposal(input: RejectProposalInput!): ProposalDecision!
    
    # Q&A mutations
    askQuestion(projectId: ID!, question: String!): ProjectQuestion!
    answerQuestion(questionId: ID!, answer: String!): QuestionAnswer!
    deleteQuestion(questionId: ID!): Boolean!
    
    # Proposal creation and submission mutations
    createProposal(projectId: ID!): Proposal!
    updateProposal(
      proposalId: ID!
      title: String
      content: String
      budgetEstimate: Float
      timelineEstimate: String
      additionalInfo: JSON
    ): Proposal!
    submitProposal(input: SubmitProposalInput!): SubmissionResult!
    saveSubmissionDraft(proposalId: ID!, step: Int!, data: JSON!): Boolean!
    
    # Admin management mutations
    inviteAdmin(email: String!): AdminInvitation!
    removeAdminPrivileges(userId: ID!): User!
    acceptAdminInvitation(token: String!): User!
    
    # User management mutations
    changeUserRole(userId: ID!, newRole: UserRole!): User!
    suspendUser(userId: ID!, reason: String!): User!
    reactivateUser(userId: ID!): User!
    
    # Activity logging (called automatically by system)
    logUserActivity(
      userId: ID!
      action: String!
      resourceType: String
      resourceId: ID
      metadata: JSON
    ): UserActivityLog!
    
    # Collaborative Editor mutations
    createWorkspace(input: CreateWorkspaceInput!): Workspace!
    createDocument(input: CreateDocumentInput!): DocumentOperationResult!
    updateDocument(documentId: ID!, input: UpdateDocumentInput!): DocumentOperationResult!
    deleteDocument(documentId: ID!): Boolean!
    
    # Version control mutations
    createVersion(documentId: ID!, changesSummary: String): VersionResult!
    rollbackToVersion(documentId: ID!, versionId: ID!): DocumentOperationResult!
    
    # Team management mutations
    inviteMember(input: InviteMemberInput!): InvitationResult!
    acceptInvitation(token: String!): CollaboratorResult!
    updateMemberRole(input: UpdateMemberRoleInput!): CollaboratorResult!
    removeMember(documentId: ID!, userId: ID!): Boolean!
    
    # Collaboration session mutations
    joinSession(input: JoinSessionInput!): SessionResult!
    leaveSession(sessionId: ID!): Boolean!
    updateCursorPosition(input: UpdateCursorInput!): Boolean!
    updatePresence(input: UpdatePresenceInput!): Boolean!
    updateCurrentSection(input: UpdateCurrentSectionInput!): Boolean!
    
    # Section management mutations
    createSection(input: CreateSectionInput!): SectionResult!
    updateSection(sectionId: ID!, input: UpdateSectionInput!): SectionResult!
    deleteSection(sectionId: ID!): Boolean!
    
    # Section locking mutations
    acquireLock(sectionId: ID!): LockResult!
    releaseLock(sectionId: ID!): Boolean!
    heartbeatLock(sectionId: ID!): Boolean!
    
    # Progress tracking mutations
    updateSectionStatus(sectionId: ID!, status: SectionStatus!): SectionResult!
    assignSection(input: AssignSectionInput!): SectionResult!
    unassignSection(sectionId: ID!): SectionResult!
    
    # Deadline management mutations
    setSectionDeadline(sectionId: ID!, input: SetDeadlineInput!): SectionResult!
    setDocumentDeadline(documentId: ID!, input: SetDeadlineInput!): DocumentOperationResult!
    removeSectionDeadline(sectionId: ID!): SectionResult!
    removeDocumentDeadline(documentId: ID!): DocumentOperationResult!
    
    # Proposal Scoring mutations
    createScoringTemplate(input: CreateScoringTemplateInput!): ScoringTemplate!
    updateScoringTemplate(templateId: ID!, input: UpdateScoringTemplateInput!): ScoringTemplate!
    deleteScoringTemplate(templateId: ID!): Boolean!
    scoreProposal(input: ScoreProposalInput!): ProposalScore!
    finalizeScoring(input: FinalizeScoringInput!): Boolean!
    reviseScore(input: ReviseScoreInput!): ProposalScore!
    recalculateRankings(projectId: ID!): [ProposalRanking!]!
    exportScoring(projectId: ID!): ScoringExport!
    
    # Proposal Archival mutations
    archiveProposal(proposalId: ID!, reason: String): ArchivalResult!
    unarchiveProposal(proposalId: ID!): ArchivalResult!
    bulkArchiveProposals(proposalIds: [ID!]!): ArchivalResult!
    
    # Multi-Proposal Management mutations
    saveWorkspaceState(proposalId: ID!, state: JSON!): OperationResult!
    clearWorkspaceState(proposalId: ID!): OperationResult!
    
    # Bidding Leader Management mutations
    generateInvitation(input: GenerateInvitationInput!): TeamInvitation!
    joinTeam(input: JoinTeamInput!): BidTeamMember!
    removeTeamMember(input: RemoveTeamMemberInput!): Boolean!
    
    # Project Delivery and Archival mutations
    uploadDeliverable(input: UploadDeliverableInput!): Deliverable!
    deleteDeliverable(deliverableId: ID!): Boolean!
    markReadyForDelivery(input: MarkReadyForDeliveryInput!): ProjectCompletion!
    reviewCompletion(input: ReviewCompletionInput!): ProjectCompletion!
    acceptCompletion(completionId: ID!): ProjectCompletion!
    requestRevision(input: RequestRevisionInput!): CompletionRevision!
    requestExport(input: RequestExportInput!): ProjectExport!
    applyLegalHold(archiveId: ID!, reason: String!): ProjectArchive!
    removeLegalHold(archiveId: ID!): ProjectArchive!
    
    # Notification mutations
    markNotificationAsRead(notificationId: ID!): Boolean!
    markAllNotificationsAsRead: Boolean!
    deleteNotification(notificationId: ID!): Boolean!
  }

  # Project Delivery and Archival Types
  type Deliverable {
    id: ID!
    projectId: ID!
    proposalId: ID!
    uploadedBy: User!
    fileName: String!
    filePath: String!
    fileType: String!
    fileSize: Int!
    description: String
    version: Int!
    isFinal: Boolean!
    uploadedAt: String!
    downloadUrl: String!
  }

  type ProjectCompletion {
    id: ID!
    projectId: ID!
    proposalId: ID!
    submittedBy: User!
    submittedAt: String!
    reviewedBy: User
    reviewedAt: String
    reviewStatus: ReviewStatus!
    reviewComments: String
    revisionCount: Int!
    completedAt: String
    deliverables: [Deliverable!]!
    revisions: [CompletionRevision!]!
  }

  enum ReviewStatus {
    PENDING
    ACCEPTED
    REVISION_REQUESTED
  }

  type CompletionRevision {
    id: ID!
    revisionNumber: Int!
    requestedBy: User!
    requestedAt: String!
    revisionNotes: String!
    resolvedBy: User
    resolvedAt: String
  }

  type ProjectArchive {
    id: ID!
    projectId: ID!
    archiveIdentifier: String!
    compressedSize: Int!
    originalSize: Int!
    compressionRatio: Float!
    archivedBy: User!
    archivedAt: String!
    retentionUntil: String
    legalHold: Boolean!
    legalHoldReason: String
    accessCount: Int!
    lastAccessedAt: String
    project: ArchivedProject!
  }

  type ArchivedProject {
    id: ID!
    title: String!
    description: String!
    budget: Float
    deadline: String
    clientId: ID!
    status: String!
    proposals: [ArchivedProposal!]!
    deliverables: [Deliverable!]!
    documents: [ArchivedDocument!]!
    comments: [ArchivedComment!]!
  }

  type ArchivedProposal {
    id: ID!
    leadId: ID!
    status: String!
    submittedAt: String
    versions: [ArchivedVersion!]!
  }

  type ArchivedVersion {
    versionNumber: Int!
    content: String!
    createdBy: ID!
    createdAt: String!
  }

  type ArchivedDocument {
    id: ID!
    title: String!
    content: String!
    createdBy: ID!
    createdAt: String!
  }

  type ArchivedComment {
    id: ID!
    authorId: ID!
    message: String!
    visibility: String!
    createdAt: String!
  }

  type ProjectExport {
    id: ID!
    projectId: ID!
    requestedBy: User!
    requestedAt: String!
    status: ExportStatus!
    exportPath: String
    exportSize: Int
    expiresAt: String
    downloadUrl: String
    errorMessage: String
  }

  enum ExportStatus {
    PENDING
    PROCESSING
    COMPLETED
    FAILED
  }

  type CompletionStatistics {
    totalCompleted: Int!
    averageTimeToCompletion: Float!
    projectsRequiringRevisions: Int!
    totalDeliverablesReceived: Int!
    completionsByMonth: [MonthlyCompletion!]!
  }

  type MonthlyCompletion {
    month: String!
    count: Int!
  }

  input UploadDeliverableInput {
    projectId: ID!
    proposalId: ID!
    fileName: String!
    filePath: String!
    fileType: String!
    fileSize: Int!
    description: String
  }

  input MarkReadyForDeliveryInput {
    projectId: ID!
    proposalId: ID!
  }

  input ReviewCompletionInput {
    completionId: ID!
    reviewStatus: ReviewStatus!
    reviewComments: String
  }

  input RequestRevisionInput {
    completionId: ID!
    revisionNotes: String!
  }

  input RequestExportInput {
    projectId: ID!
  }

  type Subscription {
    # Document content updates
    documentUpdated(documentId: ID!): Document!
    
    # Version control updates
    versionCreated(documentId: ID!): DocumentVersion!
    documentRolledBack(documentId: ID!): Document!
    
    # Collaboration updates
    sessionJoined(documentId: ID!): CollaborationSession!
    sessionLeft(documentId: ID!): CollaborationSession!
    cursorMoved(documentId: ID!): CollaborationSession!
    presenceChanged(documentId: ID!): CollaborationSession!
    
    # Team management updates
    collaboratorAdded(documentId: ID!): DocumentCollaborator!
    collaboratorRemoved(documentId: ID!): DocumentCollaborator!
    collaboratorRoleChanged(documentId: ID!): DocumentCollaborator!
    
    # Section locking subscriptions
    lockAcquired(documentId: ID!): SectionLock!
    lockReleased(documentId: ID!): SectionLock!
    lockExpired(documentId: ID!): SectionLock!
    
    # Progress tracking subscriptions
    sectionStatusChanged(documentId: ID!): DocumentSection!
    sectionAssigned(documentId: ID!): DocumentSection!
    sectionDeadlineChanged(documentId: ID!): DocumentSection!
    progressUpdated(documentId: ID!): OverallProgress!
    
    # Bidding team subscriptions
    teamMemberJoined(projectId: ID!): BidTeamMember!
    teamMemberRemoved(projectId: ID!): BidTeamMember!
    invitationCreated(projectId: ID!): TeamInvitation!
  }
`;
