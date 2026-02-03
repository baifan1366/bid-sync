/**
 * Type definitions for collaborative document editing
 */

// TipTap JSONContent type (from @tiptap/core)
export interface JSONContent {
  type?: string
  attrs?: Record<string, any>
  content?: JSONContent[]
  marks?: {
    type: string
    attrs?: Record<string, any>
    [key: string]: any
  }[]
  text?: string
  [key: string]: any
}

export interface Workspace {
  id: string
  projectId: string
  leadId: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  workspaceId: string
  title: string
  description?: string
  content: JSONContent
  createdBy: string
  lastEditedBy: string
  createdAt: string
  updatedAt: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  versionNumber: number
  content: JSONContent
  createdBy: string
  createdByName: string
  changesSummary: string
  isRollback: boolean
  rolledBackFrom?: string
  createdAt: string
  sectionsSnapshot?: any[]
  attachmentsSnapshot?: any[]
}

export interface DocumentCollaborator {
  id: string
  documentId: string
  userId: string
  userName: string
  email: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  addedBy: string
  addedAt: string
}

export interface CollaborationSession {
  id: string
  documentId: string
  userId: string
  userName: string
  userColor: string
  cursorPosition?: { from: number; to: number }
  presenceStatus: 'active' | 'idle' | 'away'
  currentSection?: string
  lastActivity: string
  joinedAt: string
}

export interface DocumentInvitation {
  id: string
  documentId: string
  email: string
  role: 'editor' | 'commenter' | 'viewer'
  token: string
  invitedBy: string
  expiresAt: string
  acceptedAt?: string
  acceptedBy?: string
  createdAt: string
}

export type CollaboratorRole = 'owner' | 'editor' | 'commenter' | 'viewer'

// ============================================================================
// Input Types
// ============================================================================

export interface CreateDocumentInput {
  workspaceId: string
  title: string
  description?: string
  createdBy: string
}

export interface UpdateDocumentInput {
  title?: string
  description?: string
  content?: JSONContent
}

export interface CreateVersionInput {
  documentId: string
  content: JSONContent
  userId: string
  changesSummary?: string
}

export interface RollbackVersionInput {
  documentId: string
  versionId: string
  userId: string
}

export interface InviteMemberInput {
  documentId: string
  email: string
  role: Exclude<CollaboratorRole, 'owner'>
  invitedBy: string
}

export interface UpdateMemberRoleInput {
  documentId: string
  userId: string
  role: CollaboratorRole
}

export interface JoinSessionInput {
  documentId: string
  userId: string
  userName: string
}

export interface SearchDocumentsInput {
  query: string
  workspaceId: string
}

export interface CreateWorkspaceInput {
  projectId: string
  leadId: string
  name: string
  description?: string
}

// ============================================================================
// Response Types
// ============================================================================

export interface DocumentResponse {
  success: boolean
  document?: Document
  error?: string
}

export interface DocumentsResponse {
  success: boolean
  documents?: Document[]
  error?: string
}

export interface VersionResponse {
  success: boolean
  version?: DocumentVersion
  error?: string
}

export interface VersionsResponse {
  success: boolean
  versions?: DocumentVersion[]
  error?: string
}

export interface CollaboratorResponse {
  success: boolean
  collaborator?: DocumentCollaborator
  error?: string
}

export interface CollaboratorsResponse {
  success: boolean
  collaborators?: DocumentCollaborator[]
  error?: string
}

export interface InvitationResponse {
  success: boolean
  invitation?: DocumentInvitation
  error?: string
}

export interface SessionResponse {
  success: boolean
  session?: CollaborationSession
  error?: string
}

export interface ActiveUsersResponse {
  success: boolean
  activeUsers?: ActiveUser[]
  error?: string
}

export interface WorkspaceResponse {
  success: boolean
  workspace?: Workspace
  error?: string
}

export interface WorkspacesResponse {
  success: boolean
  workspaces?: Workspace[]
  error?: string
}

export interface VersionResult {
  success: boolean
  version?: DocumentVersion
  error?: string
}

export interface InvitationResult {
  success: boolean
  invitation?: DocumentInvitation
  error?: string
}

export interface CollaboratorResult {
  success: boolean
  collaborator?: DocumentCollaborator
  error?: string
}

// ============================================================================
// Collaboration Types
// ============================================================================

export interface Session {
  id: string
  documentId: string
  userId: string
  userName: string
  userColor: string
  joinedAt: string
}

export interface ActiveUser {
  userId: string
  userName: string
  userColor: string
  cursorPosition?: CursorPosition
  lastActive: string
}

export interface CursorPosition {
  from: number
  to: number
}

export interface UserPresence {
  status: 'active' | 'idle' | 'away'
  lastActivity: string
}

// ============================================================================
// Version Control Types
// ============================================================================

export interface VersionDiff {
  additions: number
  deletions: number
  changes: DiffChange[]
}

export interface DiffChange {
  type: 'add' | 'remove' | 'modify'
  path: string
  oldValue?: any
  newValue?: any
}

// ============================================================================
// Sync Service Types
// ============================================================================

export interface SyncResult {
  success: boolean
  conflicts: SyncConflict[]
  syncedAt: string
  error?: string
}

export interface Conflict {
  path: string
  localValue: any
  serverValue: any
  resolvedValue?: any
}

export interface SyncConflict {
  id: string
  documentId: string
  localVersion: JSONContent
  serverVersion: JSONContent
  localContent: JSONContent
  serverContent: JSONContent
  timestamp: string
  resolved: boolean
}

export interface QueuedChange {
  id: string
  documentId: string
  userId?: string
  changeType: string
  content?: JSONContent
  data?: any
  timestamp: string
  retryCount: number
}

export interface CachedDocument {
  documentId: string
  content: JSONContent
  /** @deprecated No longer using Yjs - kept for backward compatibility */
  yjsState?: Uint8Array
  lastModified: string
  syncedAt?: string
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'syncing'

/**
 * @deprecated No longer using Yjs - kept for backward compatibility
 */
export interface YjsUpdate {
  update: Uint8Array
  origin?: any
}

// ============================================================================
// Permission Types
// ============================================================================

export interface PermissionCheck {
  userId: string
  documentId: string
  action: DocumentAction
}

export type DocumentAction = 
  | 'read'
  | 'write'
  | 'comment'
  | 'invite'
  | 'manage_roles'
  | 'delete'
  | 'rollback'

export interface PermissionResult {
  allowed: boolean
  reason?: string
}
