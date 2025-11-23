/**
 * Central export file for all type definitions
 * 
 * This file provides a single import point for all types used throughout
 * the collaborative proposal editor feature.
 */

// Re-export all document-related types
export type {
  // Core entity types
  JSONContent,
  Workspace,
  Document,
  DocumentVersion,
  DocumentCollaborator,
  CollaborationSession,
  DocumentInvitation,
  CollaboratorRole,
  
  // Input types
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateVersionInput,
  RollbackVersionInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  JoinSessionInput,
  SearchDocumentsInput,
  CreateWorkspaceInput,
  
  // Response types
  DocumentResponse,
  DocumentsResponse,
  VersionResponse,
  VersionsResponse,
  CollaboratorResponse,
  CollaboratorsResponse,
  InvitationResponse,
  SessionResponse,
  ActiveUsersResponse,
  WorkspaceResponse,
  WorkspacesResponse,
  
  // Collaboration types
  Session,
  ActiveUser,
  CursorPosition,
  UserPresence,
  
  // Version control types
  VersionDiff,
  DiffChange,
  
  // Sync service types
  SyncResult,
  Conflict,
  ConnectionStatus,
  YjsUpdate,
  
  // Permission types
  PermissionCheck,
  DocumentAction,
  PermissionResult,
} from './document'

// Re-export user-related types
export type {
  UserProfile,
  ClientProfile,
  BiddingTeamProfile,
  AdminProfile,
  UserProfileData,
  ProfileUpdateData,
  GetProfileResponse,
  UpdateProfileResponse,
} from './user'

// Re-export project-related types
export type {
  ProjectStatus,
  AdditionalInfoRequirement,
  Project,
  CreateProjectData,
  UpdateProjectData,
  GetProjectsResponse,
  GetProjectResponse,
  CreateProjectResponse,
  UpdateProjectResponse,
} from './project'

// Re-export proposal-related types
export type {
  ProposalStatus,
  Proposal,
  CreateProposalData,
  UpdateProposalData,
  GetProposalsResponse,
  GetProposalResponse,
  CreateProposalResponse,
  UpdateProposalResponse,
} from './proposal'

// Re-export registration-related types
export type {
  ClientType,
  ClientRegistration,
  BiddingTeamRegistration,
  RegistrationData,
  TeamInvitation,
  InvitationValidation,
  CreateInvitationRequest,
  CreateInvitationResponse,
} from './registration'
