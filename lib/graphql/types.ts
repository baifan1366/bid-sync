export interface Project {
  id: string
  client_id: string
  clientId?: string
  title: string
  description: string
  status: 'draft' | 'pending_admin_review' | 'published' | 'in_review' | 'awarded' | 'closed'
  budget: number | null
  budget_min?: number | null
  budget_max?: number | null
  deadline: string | null
  additional_info_requirements?: AdditionalInfoRequirement[]
  additionalInfoRequirements?: AdditionalInfoRequirement[]
  created_at: string
  createdAt?: string
  updated_at: string
  updatedAt?: string
  documents?: Array<{
    id: string
    name: string
    url: string
    fileType: string
  }>
}

export interface AdditionalInfoRequirement {
  id: string
  fieldName: string
  fieldType: 'text' | 'number' | 'date' | 'file' | 'textarea' | 'select'
  required: boolean
  helpText?: string
  options?: string[]
  optionsString?: string // For UI input handling
  order: number
}

export interface Proposal {
  id: string
  project_id: string
  lead_id: string
  status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected'
  submitted_at: string | null
  created_at: string
  updated_at: string
  proposal_versions: ProposalVersion[]
  documents: Document[]
}

export interface ProposalVersion {
  id: string
  proposal_id: string
  version_number: number
  content: any // JSONB
  created_by: string
  created_at: string
}

export interface Document {
  id: string
  proposal_id: string
  url: string
  doc_type: string | null
  created_by: string
  created_at: string
}

export interface BidTeamMember {
  id: string
  project_id: string
  user_id: string
  role: 'lead' | 'member'
  created_at: string
}

export interface Comment {
  id: string
  proposal_id: string
  author_id: string
  visibility: 'internal' | 'public'
  message: string
  created_at: string
}

export interface ChecklistItem {
  id: string
  proposal_id: string
  label: string
  passed: boolean
  reviewer_id: string | null
  checked_at: string | null
}

export interface ChatMessage {
  id: string
  project_id: string
  proposal_id: string | null
  sender_id: string
  content: string
  created_at: string
  read: boolean
}

export interface ProposalDecision {
  id: string
  proposal_id: string
  project_id: string
  decision_type: 'accepted' | 'rejected'
  decided_by: string
  decided_at: string
  feedback: string | null
}

export interface ProjectWithProposals {
  project: Project
  proposals: ProposalSummary[]
  totalProposals: number
  submittedProposals: number
  underReviewProposals: number
  acceptedProposals: number
  rejectedProposals: number
}

export interface ProposalSummary {
  id: string
  title: string | null
  biddingTeamName: string
  biddingLead: TeamMember
  teamSize: number
  budgetEstimate: number | null
  timelineEstimate: string | null
  executiveSummary: string | null
  submissionDate: string
  status: string
  complianceScore: number
  unreadMessages: number
  additionalInfo: ProposalAdditionalInfo[]
  // Scoring fields
  totalScore?: number | null
  rank?: number | null
  isFullyScored?: boolean
  scoringStatus?: 'not_scored' | 'partially_scored' | 'fully_scored'
}

export interface ProposalDetail {
  id: string
  title: string | null
  budgetEstimate: number | null
  timelineEstimate: string | null
  executiveSummary: string | null
  status: string
  submissionDate: string
  biddingTeam: BiddingTeam
  sections: ProposalSection[]
  documents: ProposalDocument[]
  complianceChecklist: ComplianceItem[]
  versions: ProposalVersion[]
  currentVersion: number
  additionalInfo: ProposalAdditionalInfo[]
}

export interface ProposalAdditionalInfo {
  id: string
  fieldId: string
  fieldName: string
  fieldValue: any
}

export interface BiddingTeam {
  lead: TeamMember
  members: TeamMember[]
}

export interface TeamMember {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
  assignedSections: string[]
}

export interface ProposalSection {
  id: string
  title: string
  content: string
  order: number
}

export interface ProposalDocument {
  id: string
  name: string
  fileType: string
  fileSize: number
  category: 'technical' | 'financial' | 'legal' | 'other'
  url: string
  uploadedAt: string
  uploadedBy: string
}

export interface ComplianceItem {
  id: string
  category: 'technical' | 'financial' | 'legal'
  item: string
  completed: boolean
  completedBy: string | null
  completedAt: string | null
}

// Admin Management Types
export interface Admin {
  id: string
  email: string
  fullName: string | null
  createdAt: string
  lastLoginAt: string | null
  invitedBy: string | null
}

export interface AdminInvitation {
  id: string
  email: string
  invited_by: string
  token: string
  expires_at: string
  used_by: string | null
  used_at: string | null
  created_at: string
}

export interface UserActivityLog {
  id: string
  user_id: string
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, any> | null
  created_at: string
}

export interface AdminAction {
  id: string
  admin_id: string
  action_type: string
  target_user_id: string | null
  previous_value: Record<string, any> | null
  new_value: Record<string, any> | null
  reason: string | null
  created_at: string
}

export interface UserListResult {
  users: User[]
  totalCount: number
  page: number
  pageSize: number
}

export interface User {
  id: string
  email: string
  emailVerified: boolean
  role: 'client' | 'bidding_lead' | 'bidding_member' | 'content_coordinator' | 'admin'
  verificationStatus: 'pending_verification' | 'verified' | 'rejected'
  verificationReason: string | null
  fullName: string | null
  isSuspended: boolean
  suspendedReason: string | null
  suspendedAt: string | null
  lastActivityAt: string | null
  createdAt: string
  updatedAt: string
}

// Proposal Submission Types
export interface SubmitProposalInput {
  proposalId: string
  projectId: string
  title: string
  budgetEstimate: number
  timelineEstimate: string
  executiveSummary: string
  additionalInfo: AdditionalInfoInput[]
}

export interface AdditionalInfoInput {
  fieldId: string
  fieldName: string
  fieldValue: any
}

export interface SubmissionResult {
  success: boolean
  proposalId: string
  submittedAt: string
  errors: string[]
}

// Section-based locking and progress tracking types
export type SectionStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed'

export interface DocumentSection {
  id: string
  documentId: string
  title: string
  order: number
  status: SectionStatus
  assignedTo?: string
  assignedToUser?: User
  deadline?: string
  content?: any
  lockedBy?: string
  lockedByUser?: User
  lockedAt?: string
  lockExpiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface SectionLock {
  id: string
  sectionId: string
  documentId: string
  userId: string
  userName: string
  acquiredAt: string
  expiresAt: string
  lastHeartbeat: string
}

export interface LockResult {
  success: boolean
  lock?: SectionLock
  error?: string
  lockedBy?: string
}

export interface LockStatus {
  isLocked: boolean
  lockedBy?: string
  lockedByUser?: User
  lockedAt?: string
  expiresAt?: string
}

export interface SectionProgress {
  sectionId: string
  title: string
  status: SectionStatus
  assignedTo?: string
  assignedToUser?: User
  deadline?: string
  lastUpdated: string
  isOverdue: boolean
  hoursRemaining?: number
}

export interface OverallProgress {
  documentId: string
  totalSections: number
  notStarted: number
  inProgress: number
  inReview: number
  completed: number
  completionPercentage: number
  upcomingDeadlines: Deadline[]
}

export interface Deadline {
  sectionId: string
  title: string
  deadline: string
  assignedTo?: string
  assignedToUser?: User
  isOverdue: boolean
  hoursRemaining: number
  status: SectionStatus
}

export interface CreateSectionInput {
  documentId: string
  title: string
  order: number
  content?: any
}

export interface UpdateSectionInput {
  title?: string
  order?: number
  content?: any
  status?: SectionStatus
}

export interface AssignSectionInput {
  sectionId: string
  userId: string
}

export interface SetDeadlineInput {
  deadline: string
}

export interface SectionResult {
  success: boolean
  section?: DocumentSection
  error?: string
}

// Proposal Scoring System Types
export interface ScoringTemplate {
  id: string
  projectId: string
  name: string
  description?: string
  isDefault: boolean
  criteria: ScoringCriterion[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ScoringCriterion {
  id: string
  templateId: string
  name: string
  description?: string
  weight: number // 0-100, sum must equal 100
  orderIndex: number
  createdAt: string
}

export interface ProposalScore {
  id: string
  proposalId: string
  criterion: ScoringCriterion
  rawScore: number // 1-10
  weightedScore: number // rawScore * (weight / 100)
  notes?: string
  scoredBy: User
  scoredAt: string
  isFinal: boolean
}

export interface ProposalScoreHistory {
  id: string
  proposalId: string
  criterion: ScoringCriterion
  previousRawScore?: number
  newRawScore: number
  previousNotes?: string
  newNotes?: string
  changedBy: User
  changedAt: string
  reason?: string
}

export interface ProposalRanking {
  id: string
  projectId: string
  proposal: ProposalSummary
  totalScore: number
  rank: number
  isFullyScored: boolean
  calculatedAt: string
}

export interface ScoringComparison {
  proposals: ProposalWithScores[]
  criteria: ScoringCriterion[]
  bestScores: BestScore[]
  worstScores: WorstScore[]
}

export interface ProposalWithScores {
  proposal: ProposalSummary
  scores: ProposalScore[]
  totalScore: number
  rank: number
  isFullyScored: boolean
}

export interface BestScore {
  criterionId: string
  proposalId: string
  score: number
}

export interface WorstScore {
  criterionId: string
  proposalId: string
  score: number
}

export interface ScoringExport {
  url: string
  expiresAt: string
}

export interface CreateScoringTemplateInput {
  projectId: string
  name: string
  description?: string
  criteria: CreateScoringCriterionInput[]
}

export interface CreateScoringCriterionInput {
  name: string
  description?: string
  weight: number
  orderIndex: number
}

export interface UpdateScoringTemplateInput {
  name?: string
  description?: string
  criteria?: UpdateScoringCriterionInput[]
}

export interface UpdateScoringCriterionInput {
  id?: string
  name: string
  description?: string
  weight: number
  orderIndex: number
}

export interface ScoreProposalInput {
  proposalId: string
  criterionId: string
  rawScore: number
  notes?: string
}

export interface FinalizeScoringInput {
  proposalId: string
}

export interface ReviseScoreInput {
  proposalId: string
  criterionId: string
  newRawScore: number
  newNotes?: string
  reason: string
}

// Scoring Analytics Types
export interface ScoringAnalytics {
  scoringUsagePercentage: number
  averageProposalsScored: number
  mostCommonCriteria: CriterionUsage[]
  averageScoringDuration: number
}

export interface CriterionUsage {
  name: string
  count: number
  percentage: number
}

// Lead Dashboard Types
export interface LeadDashboardStats {
  totalProposals: number
  activeProposals: number
  submittedProposals: number
  acceptedProposals: number
  rejectedProposals: number
  winRate: number
  totalBidValue: number
  averageResponseTime: number
}

export interface LeadRecentProposal {
  id: string
  projectTitle: string
  status: string
  submittedAt: string
  budgetEstimate: number
}

// Submission Draft Types
export interface SubmissionDraft {
  id: string
  proposalId: string
  userId: string
  currentStep: number
  draftData: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface SaveSubmissionDraftInput {
  proposalId: string
  currentStep: number
  draftData: Record<string, any>
}

export interface SaveSubmissionDraftResult {
  success: boolean
  draftId?: string
  error?: string
}
