# Implementation Plan: Collaborative Proposal Editor

- [x] 1. Set up database schema and migrations





  - Create workspaces, documents, document_versions, document_collaborators, collaboration_sessions, and document_invitations tables
  - Add indexes for performance optimization
  - Configure RLS policies for all new tables
  - Create database functions for common operations
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

-

- [x] 2. Implement core document management service



  - [x] 2.1 Create DocumentService with CRUD operations


    - Implement createDocument, getDocument, updateDocument, deleteDocument methods
    - Implement listDocuments and searchDocuments methods
    - Add input validation using Zod schemas
    - _Requirements: 1.1, 1.2, 1.5, 7.1, 7.2, 7.5_

  - [ ]* 2.2 Write property test for document creation assigns owner
    - **Property 1: Document creation assigns creator as owner**
    - **Validates: Requirements 1.3**

  - [ ]* 2.3 Write property test for document ID uniqueness
    - **Property 2: Document IDs are unique**
    - **Validates: Requirements 1.4**

  - [ ]* 2.4 Write property test for document persistence round-trip
    - **Property 3: Document persistence round-trip**
    - **Validates: Requirements 1.5**

  - [ ]* 2.5 Write property test for workspace document listing
    - **Property 20: Workspace document listing**
    - **Validates: Requirements 7.1**

  - [ ]* 2.6 Write property test for document metadata persistence
    - **Property 21: Document metadata persistence**
    - **Validates: Requirements 7.2**

  - [ ]* 2.7 Write property test for document search accuracy
    - **Property 22: Document search accuracy**

    - **Validates: Requirements 7.5**
-

- [x] 3. Implement version control service





  - [x] 3.1 Create VersionControlService with version management


    - Implement createVersion, getVersionHistory, getVersion methods
    - Implement rollbackToVersion and compareVersions methods
    - Add automatic version creation on document saves
    - Generate change summaries for versions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 6.5_

  - [ ]* 3.2 Write property test for version creation on save
    - **Property 12: Version creation on save**
    - **Validates: Requirements 5.1**

  - [ ]* 3.3 Write property test for version metadata completeness
    - **Property 13: Version metadata completeness**
    - **Validates: Requirements 5.2, 5.3**

  - [ ]* 3.4 Write property test for version content accuracy
    - **Property 14: Version content accuracy**
    - **Validates: Requirements 5.4**

  - [ ]* 3.5 Write property test for version persistence
    - **Property 15: Version persistence**
    - **Validates: Requirements 5.5**

  - [ ]* 3.6 Write property test for rollback creates new version
    - **Property 16: Rollback creates new version**
    - **Validates: Requirements 6.2**

  - [ ]* 3.7 Write property test for rollback preserves history
    - **Property 17: Rollback preserves history**
    - **Validates: Requirements 6.3**

  - [ ]* 3.8 Write property test for rollback marking
    - **Property 19: Rollback marking**
    - **Validates: Requirements 6.5**

- [x] 4. Implement team management service





  - [x] 4.1 Create TeamManagementService for collaborator management



    - Implement inviteMember, updateMemberRole, removeMember methods
    - Implement getCollaborators and acceptInvitation methods
    - Generate secure invitation tokens with expiration
    - Add email notification integration for invitations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3_

  - [ ]* 4.2 Write property test for invitation token uniqueness
    - **Property 4: Invitation tokens are unique**
    - **Validates: Requirements 2.2**

  - [ ]* 4.3 Write property test for invitation role assignment
    - **Property 5: Invitation role assignment**
    - **Validates: Requirements 2.4**

  - [ ]* 4.4 Write property test for collaborator list completeness
    - **Property 6: Collaborator list completeness**
    - **Validates: Requirements 2.5**

  - [ ]* 4.5 Write property test for role change propagation
    - **Property 23: Role change propagation**
    - **Validates: Requirements 8.2**

  - [ ]* 4.6 Write property test for member removal revokes access
    - **Property 24: Member removal revokes access**
    - **Validates: Requirements 8.3**

- [ ] 5. Implement permission system

  - [x] 5.1 Create permission checking utilities





    - Implement role-based permission checks (owner, editor, commenter, viewer)
    - Add middleware for GraphQL resolvers to enforce permissions
    - Create helper functions for common permission patterns
    - _Requirements: 8.4, 8.5, 8.6_

  - [ ]* 5.2 Write property test for editor role permissions
    - **Property 25: Editor role permissions**
    - **Validates: Requirements 8.4**

  - [ ]* 5.3 Write property test for viewer role restrictions
    - **Property 26: Viewer role restrictions**
    - **Validates: Requirements 8.5**

  - [ ]* 5.4 Write property test for commenter role restrictions
    - **Property 27: Commenter role restrictions**
    - **Validates: Requirements 8.6**

- [ ] 6. Set up TipTap editor with extensions

  - [x] 6.1 Configure TipTap editor with required extensions





    - Install and configure StarterKit (bold, italic, headings, lists, etc.)
    - Add Table extension for structured data
    - Add Placeholder extension for empty state
    - Add TaskList extension for checklists
    - Configure undo/redo history
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 6.2 Write property test for undo-redo round-trip
    - **Property 11: Undo-redo round-trip**
    - **Validates: Requirements 4.7**

- [x] 7. Implement Yjs CRDT integration





  - [x] 7.1 Set up Yjs for collaborative editing


    - Install Yjs and y-websocket provider
    - Create Yjs document binding for TipTap
    - Configure WebSocket provider for Supabase Realtime
    - Implement CRDT synchronization logic
    - _Requirements: 3.1, 3.3, 3.5_

  - [ ]* 7.2 Write property test for CRDT convergence
    - **Property 7: CRDT convergence**
    - **Validates: Requirements 3.1**

  - [ ]* 7.3 Write property test for non-overlapping edits
    - **Property 8: Non-overlapping edits preserve both changes**
    - **Validates: Requirements 3.3**

  - [ ]* 7.4 Write property test for new session receives current state
    - **Property 10: New session receives current state**
    - **Validates: Requirements 3.5**

- [-] 8. Implement collaboration service with presence tracking


  - [x] 8.1 Create CollaborationService for real-time features



    - Implement joinSession, leaveSession, getActiveSessions methods
    - Implement cursor position broadcasting
    - Implement presence status tracking (active, idle, away)
    - Assign unique colors to collaborators
    - _Requirements: 3.4, 9.1, 9.3, 9.4, 9.5_

  - [ ]* 8.2 Write property test for cursor position broadcast
    - **Property 9: Cursor position broadcast**
    - **Validates: Requirements 3.4**

  - [ ]* 8.3 Write property test for active collaborator presence
    - **Property 28: Active collaborator presence**
    - **Validates: Requirements 9.1**

  - [ ]* 8.4 Write property test for presence metadata completeness
    - **Property 29: Presence metadata completeness**
    - **Validates: Requirements 9.3**

  - [ ]* 8.5 Write property test for unique collaborator colors
    - **Property 30: Unique collaborator colors**
    - **Validates: Requirements 9.5**

- [x] 9. Implement Supabase Realtime integration




  - [x] 9.1 Set up Realtime channels for document synchronization


    - Create channel for document updates
    - Create channel for presence tracking
    - Create channel for cursor positions
    - Implement broadcast and subscribe logic
    - Add connection status monitoring
    - _Requirements: 3.1, 3.2, 3.4, 9.1, 9.2_

  - [ ]* 9.2 Write property test for rollback notification broadcast
    - **Property 18: Rollback notification broadcast**
    - **Validates: Requirements 6.4**

- [x] 10. Implement offline support and sync service




  - [x] 10.1 Create SyncService for offline functionality


    - Implement local caching using IndexedDB
    - Implement change queue for offline edits
    - Implement sync logic when connection restored
    - Implement conflict detection and resolution
    - Add connection status indicator
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 10.2 Write property test for offline changes cached
    - **Property 31: Offline changes cached**
    - **Validates: Requirements 10.1**

  - [ ]* 10.3 Write property test for cached changes sync on reconnect
    - **Property 32: Cached changes sync on reconnect**
    - **Validates: Requirements 10.2**

  - [ ]* 10.4 Write property test for conflict resolution presents both versions
    - **Property 33: Conflict resolution presents both versions**
    - **Validates: Requirements 10.3**

  - [ ]* 10.5 Write property test for offline editing allowed with warning
    - **Property 34: Offline editing allowed with warning**
    - **Validates: Requirements 10.5**

- [x] 11. Create GraphQL schema extensions




  - [x] 11.1 Add types and operations to GraphQL schema

    - Add Workspace, Document, DocumentVersion types
    - Add DocumentCollaborator, CollaborationSession types
    - A
    
    dd queries for documents, versions, collaborators
    - Add mutations for document operations, invitations, role management
    - Add subscriptions for real-time updates
    - _Requirements: All_

- [x] 12. Implement GraphQL resolvers





  - [x] 12.1 Create resolvers for document operations


    - Implement createDocument, updateDocument, deleteDocument resolvers
    - Implement getDocument, listDocuments, searchDocuments resolvers
    - Add authentication and authorization checks
    - _Requirements: 1.1, 1.2, 1.5, 7.1, 7.2, 7.5_

  - [x] 12.2 Create resolvers for version control

    - Implement getVersionHistory, getVersion resolvers
    - Implement rollbackToVersion resolver
    - Add permission checks for version operations
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [x] 12.3 Create resolvers for team management

    - Implement inviteMember, acceptInvitation resolvers
    - Implement updateMemberRole, removeMember resolvers
    - Implement getCollaborators resolver
    - Add permission checks for team operations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3_

  - [x] 12.4 Create resolvers for collaboration features

    - Implement getActiveSessions resolver
    - Add subscription resolvers for real-time updates
    - _Requirements: 9.1, 9.2_

- [-] 13. Build workspace UI component



  - [x] 13.1 Create workspace page and document list

    - Build workspace layout with sidebar navigation
    - Create document list with search and filters
    - Add "Create New Document" button
    - Display document metadata (title, last modified, collaborators)
    - Implement document actions (rename, duplicate, delete)
    - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 14. Build collaborative editor UI component





  - [x] 14.1 Create editor page with TipTap integration


    - Build editor layout with toolbar
    - Integrate TipTap editor with Yjs
    - Add formatting toolbar (bold, italic, headings, lists, etc.)
    - Add table insertion and editing controls
    - Add link and media insertion controls
    - Display document title and description
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 14.2 Add presence indicators to editor


    - Display active collaborators list with avatars
    - Show cursor positions with user colors
    - Display user names on hover over cursors
    - Add connection status indicator
    - Show typing indicators
    - _Requirements: 3.4, 9.1, 9.2, 9.3, 9.4, 9.5, 10.4_

- [x] 15. Build version history UI component





  - [x] 15.1 Create version history sidebar


    - Display version list with timestamps and authors
    - Show change summaries for each version
    - Add version comparison view
    - Implement version preview
    - Add rollback button with confirmation dialog
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_
-

- [x] 16. Build team management UI component




  - [x] 16.1 Create team management panel


    - Display collaborators list with roles
    - Add "Invite Member" button and dialog
    - Implement role change dropdown
    - Add remove member button with confirmation
    - Show pending invitations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3_

  - [x] 16.2 Create invitation acceptance page


    - Build invitation landing page
    - Display invitation details (document, inviter, role)
    - Add accept/decline buttons
    - Handle expired invitations
    - Redirect to document after acceptance
    - _Requirements: 2.4_

- [x] 17. Implement offline support UI





  - [x] 17.1 Add offline indicators and warnings


    - Display connection status badge
    - Show offline warning banner when disconnected
    - Display sync status during reconnection
    - Show conflict resolution dialog when conflicts occur
    - Add manual sync trigger button
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
-



- [x] 18. Add error handling and validation



  - [x] 18.1 Implement client-side error handling

    - Add error boundaries for React components
    - Display user-friendly error messages
    - Implement retry logic for failed operations
    - Add loading states for async operations
    - _Requirements: All_


  - [x] 18.2 Implement server-side error handling

    - Add try-catch blocks in all resolvers
    - Return structured error responses
    - Log errors with context
    - Implement transaction rollback for failures
    - _Requirements: All_

- [x] 19. Implement email notifications







  - [x] 19.1 Create email templates for invitations




    - Design invitation email template
    - Add document details and invitation link
    - Include expiration information
    - _Requirements: 2.2_


  - [x] 19.2 Create email templates for notifications

    - Design rollback notification template
    - Design role change notification template
    - Design access revocation notification template
    - _Requirements: 6.4, 8.2, 8.3_

- [x] 20. Add TypeScript type definitions




  - [x] 20.1 Create type definitions for all entities


    - Define Workspace, Document, DocumentVersion types
    - Define DocumentCollaborator, CollaborationSession types
    - Define DocumentInvitation type
    - Define input and response types
    - Export types from central location
    - _Requirements: All_

- [ ] 21. Implement custom React hooks





  - [x] 21.1 Create hooks for document operations


    - Create useDocument hook for fetching and updating
    - Create useDocuments hook for listing
    - Create useDocumentSearch hook
    - _Requirements: 1.2, 1.5, 7.1, 7.5_

  - [x] 21.2 Create hooks for collaboration features


    - Create useCollaboration hook for real-time sync
    - Create usePresence hook for active users
    - Create useCursors hook for cursor positions
    - _Requirements: 3.1, 3.4, 9.1, 9.3, 9.4_

  - [x] 21.3 Create hooks for version control


    - Create useVersionHistory hook
    - Create useVersionRollback hook
    - _Requirements: 5.2, 6.2_

  - [x] 21.4 Create hooks for team management


    - Create useCollaborators hook
    - Create useInvitation hook
    - _Requirements: 2.5, 8.1_

  - [x] 21.5 Create hooks for offline support


    - Create useConnectionStatus hook
    - Create useOfflineSync hook
    - _Requirements: 10.1, 10.2, 10.4_

- [ ] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 23. Add performance optimizations
  - [ ] 23.1 Implement client-side optimizations
    - Add virtual scrolling for large documents
    - Implement debouncing for cursor broadcasts
    - Add throttling for presence updates
    - Use React.memo for expensive components
    - Implement lazy loading for version history
    - _Requirements: All_

  - [ ] 23.2 Implement server-side optimizations
    - Add database query optimization
    - Implement connection pooling
    - Add response caching for read operations
    - Optimize Realtime broadcast patterns
    - _Requirements: All_

- [ ] 24. Add monitoring and logging
  - [ ] 24.1 Implement application monitoring
    - Add error tracking (e.g., Sentry)
    - Track document operation latencies
    - Monitor WebSocket connection health
    - Add user engagement metrics
    - _Requirements: All_

  - [ ] 24.2 Implement audit logging
    - Log all document operations
    - Log version control operations
    - Log team management operations
    - Log permission changes
    - _Requirements: All_

- [ ] 25. Create documentation
  - [ ] 25.1 Write API documentation
    - Document GraphQL schema
    - Document service interfaces
    - Add code examples
    - _Requirements: All_

  - [ ] 25.2 Write user documentation
    - Create user guide for collaborative editing
    - Document version control features
    - Document team management features
    - Add troubleshooting guide
    - _Requirements: All_

- [ ] 26. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
