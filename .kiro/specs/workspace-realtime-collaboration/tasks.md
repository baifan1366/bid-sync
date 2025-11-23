# Implementation Plan: Workspace Real-time Collaboration

## Overview
This implementation plan covers the remaining work needed to complete the workspace real-time collaboration feature. The system already has foundational components including Yjs integration, TipTap editor, collaboration hooks, and database schema. This plan focuses on implementing missing features like section-based locking, progress tracking, deadlines, and enhanced auto-save functionality.

## Status Legend
- [ ] Not started
- [-] In progress  
- [x] Completed

---

## Already Implemented ✅

The following components are already implemented and working:
- ✅ Yjs CRDT integration for document synchronization (`hooks/use-yjs-collaboration.ts`)
- ✅ TipTap rich text editor with all required extensions (`hooks/use-tiptap-editor.ts`, `components/editor/tiptap-editor.tsx`)
- ✅ WebSocket provider for real-time sync (via y-websocket)
- ✅ Basic presence tracking and cursor positions (`hooks/use-collaboration.ts`, `hooks/use-realtime-document.ts`)
- ✅ Collaboration hooks (useCollaboration, useYjsCollaboration, useRealtimeDocument)
- ✅ Database schema for workspaces, documents, collaborators, sessions (migration 009)
- ✅ Version control service and UI (`lib/version-control-service.ts`)
- ✅ Team management service and UI (`lib/team-management-service.ts`)
- ✅ Document service with CRUD operations (`lib/document-service.ts`)
- ✅ Collaborative editor component with auto-save (`components/editor/collaborative-editor.tsx`)
- ✅ Editor toolbar (`components/editor/editor-toolbar.tsx`)
- ✅ Basic auto-save with debouncing (2 second delay in collaborative-editor.tsx)

---

## Phase 1: Database Schema Extensions

- [x] 1. Add section-based locking and progress tracking tables





  - Create migration file `010_section_locking_and_progress.sql`
  - Add `document_sections` table with fields: id, document_id, title, order, status, assigned_to, deadline, content
  - Add `section_locks` table with fields: id, section_id, document_id, user_id, acquired_at, expires_at, last_heartbeat
  - Add indexes for performance on lock queries and section lookups
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 7.1, 7.2, 8.1, 8.2_

- [ ]* 1.1 Write property test for section lock exclusivity
  - **Property 1: Lock exclusivity**
  - **Validates: Requirements 1.2**

---

## Phase 2: Section Lock Manager Service

- [x] 2. Implement section lock manager service





  - Create `lib/section-lock-service.ts` with lock acquisition/release logic
  - Implement database-based distributed locking with TTL (30 seconds)
  - Add lock heartbeat mechanism to prevent stale locks (update every 10 seconds)
  - Implement automatic lock release on disconnect
  - Add lock status broadcasting via Supabase Realtime
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 2.1 Write property test for lock timeout
  - **Property 2: Lock timeout enforcement**
  - **Validates: Requirements 1.4**

- [ ]* 2.2 Write property test for lock release
  - **Property 3: Lock release within 2 seconds**
  - **Validates: Requirements 1.3**

---

## Phase 3: Enhanced Auto-save Service
- [x] 3. Enhance auto-save service with retry logic and offline support









- [ ] 3. Enhance auto-save service with retry logic and offline support

  - Create `lib/auto-save-service.ts` extending existing auto-save functionality
  - Add retry logic with exponential backoff (3 attempts: 1s, 2s, 4s)
  - Implement offline queue management with IndexedDB
  - Add save status tracking (saved/saving/pending/error/offline)
  - Implement automatic sync when connectivity restored
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 3.1 Write property test for save batching
  - **Property 4: Save batching during typing**
  - **Validates: Requirements 4.2**

- [ ]* 3.2 Write property test for retry logic
  - **Property 5: Retry with exponential backoff**
  - **Validates: Requirements 4.3**

---

## Phase 4: Progress Tracker Service
- [x] 4. Implement progress tracking service




- [ ] 4. Implement progress tracking service

  - Create `lib/progress-tracker-service.ts` for section status management
  - Implement automatic status updates (not_started → in_progress on edit)
  - Add progress calculation logic (percentage based on section statuses)
  - Implement deadline tracking with warning/overdue indicators
  - Add notification triggers for upcoming deadlines (24 hours before)
  - Create real-time progress updates via Supabase Realtime
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ]* 4.1 Write property test for status transitions
  - **Property 6: Automatic status progression**
  - **Validates: Requirements 7.2**

- [ ]* 4.2 Write property test for progress calculation
  - **Property 7: Progress percentage accuracy**
  - **Validates: Requirements 7.3**

---

## Phase 5: GraphQL Schema Extensions

- [x] 5. Extend GraphQL schema for new features




  - Update `lib/graphql/schema.ts` to add DocumentSection type with lock and progress fields
  - Add SectionLock type and lock-related mutations (acquireLock, releaseLock, getLockStatus)
  - Add progress tracking queries and mutations (updateSectionStatus, getSectionProgress, setDeadline)
  - Add deadline management mutations (setDocumentDeadline, setSectionDeadline)
  - Add subscriptions for lock changes and progress updates
  - Update existing Document type to include sections array
  - _Requirements: 1.5, 6.1, 6.3, 7.5, 8.5_

---

## Phase 6: GraphQL Resolvers
-

- [x] 6. Implement GraphQL resolvers for new features




  - Update `lib/graphql/resolvers.ts` to add section lock resolvers (acquireLock, releaseLock, getLockStatus)
  - Add progress tracking resolvers (updateSectionStatus, getSectionProgress, setDeadline)
  - Add section assignment resolvers (assignSection, unassignSection)
  - Implement subscription resolvers for real-time updates
  - Add authorization checks for section operations using existing permission helpers
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.4, 7.1, 7.2, 8.1, 8.2_

---

## Phase 7: React Hooks for New Features


- [x] 7. Create React hooks for section locking




  - Create `hooks/use-section-lock.ts` for lock management
  - Implement automatic lock acquisition on focus
  - Implement automatic lock release on blur
  - Add lock status polling and real-time updates via Supabase Realtime
  - Add lock heartbeat mechanism (every 10 seconds)
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 7.1 Create React hooks for enhanced auto-save


  - Create `hooks/use-auto-save.ts` wrapping the auto-save service
  - Implement debounced save with configurable intervals (default 2 seconds)
  - Add save status tracking and callbacks
  - Implement offline queue management
  - Add manual save trigger
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7.2 Create React hooks for progress tracking


  - Create `hooks/use-progress-tracker.ts` for progress management
  - Implement section status updates
  - Add progress calculation and display
  - Implement deadline tracking with notifications
  - Add real-time progress subscriptions via Supabase Realtime
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

---

## Phase 8: UI Components

- [x] 8. Create section-based editor component





  - Create `components/editor/section-editor.tsx` with lock awareness
  - Implement visual lock indicators (locked by user X with yellow accent)
  - Add section assignment display
  - Integrate with TipTap editor and Yjs collaboration
  - Add lock request/release UI interactions
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 6.2_

- [x] 8.1 Create progress dashboard component


  - Create `components/editor/progress-dashboard.tsx`
  - Display all sections with current status (not_started/in_progress/in_review/completed)
  - Show overall completion percentage with yellow accent
  - Display assigned users per section with avatars
  - Add deadline indicators (warning/overdue) with yellow/red colors
  - Implement real-time progress updates
  - _Requirements: 7.3, 7.4, 7.5_


- [x] 8.2 Create deadline management component

  - Create `components/editor/deadline-manager.tsx`
  - Add UI for setting section deadlines with date picker
  - Add UI for setting document deadline
  - Display timeline view of all deadlines
  - Show warning/overdue indicators with appropriate colors
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_


- [x] 8.3 Enhance auto-save status indicator

  - Update `components/editor/collaborative-editor.tsx` status bar
  - Display current save status (saved/saving/pending/error/offline) with icons
  - Show last saved timestamp
  - Add manual save button
  - Display offline queue status when applicable
  - _Requirements: 4.1, 4.4, 4.5_


- [x] 8.4 Create section assignment component

  - Create `components/editor/section-assignment.tsx`
  - Add UI for assigning sections to team members (dropdown with user list)
  - Display current assignments with user avatars
  - Send notifications on assignment via email
  - Allow reassignment with confirmation
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

---

## Phase 9: Enhanced Presence Features

-

- [x] 9. Enhance presence indicators



  - Update `components/editor/active-collaborators.tsx` with idle/away status
  - Add visual distinction for active/idle/away users (green/yellow/gray indicators)
  - Implement 5-minute idle timeout detection (already partially in use-collaboration.ts)
  - Add section-specific presence (show who's editing which section)
  - Display cursor positions with user colors (already supported by Yjs)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 9.1 Write property test for presence updates
  - **Property 8: Presence update propagation**
  - **Validates: Requirements 2.1, 2.5**

---

## Phase 10: Conflict Resolution UI
-

- [x] 10. Enhance conflict resolution interface




  - Update existing `components/editor/conflict-resolution-dialog.tsx`
  - Display both versions side-by-side for manual resolution
  - Add merge conflict indicators in editor
  - Implement conflict logging for audit
  - Add notification system for conflicts
  - _Requirements: 3.3, 3.5_

---

## Phase 11: Performance Optimization

- [x] 11. Optimize for concurrent users



  - Implement connection pooling for WebSocket connections (y-websocket configuration)
  - Add rate limiting for lock operations (max 10 requests per second per user)
  - Optimize GraphQL subscriptions with batching
  - Implement graceful degradation under high load (increase sync intervals)
  - Add performance metrics logging to existing error-logger.ts
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 11.1 Write property test for concurrent lock requests
  - **Property 9: Lock acquisition latency**
  - **Validates: Requirements 10.2**

---

## Phase 12: Integration and Testing

- [x] 12. Integrate all components into document workspace




  - Update `components/editor/document-workspace.tsx` with new features
  - Wire up section-based editing with locks
  - Integrate progress dashboard
  - Add deadline management UI
  - Connect enhanced auto-save service
  - Ensure all real-time updates work together
  - _Requirements: All_

- [x] 12.1 Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise

---

## Phase 13: Documentation and Polish

- [ ] 13. Add user documentation
  - Document section locking behavior for users
  - Document progress tracking features
  - Document deadline management
  - Add tooltips and help text throughout UI
  - Create keyboard shortcuts documentation
  - _Requirements: All_

- [ ] 13.1 Polish UI/UX
  - Apply BidSync design system (yellow-400 accents, theme support)
  - Ensure responsive design for all new components
  - Add loading states and skeleton screens
  - Implement smooth transitions and animations
  - Add accessibility features (ARIA labels, keyboard navigation)
  - _Requirements: All_

---

## Notes

### Key Implementation Details
- Use Supabase database for distributed lock coordination (no Redis needed)
- Use IndexedDB for offline queue storage
- Use Supabase Realtime for real-time updates (already integrated)
- Follow BidSync design system (yellow-400 accents, dark/light theme)
- Ensure all components are accessible and responsive
- Property-based tests should run minimum 100 iterations
- All services should include proper error handling and logging

### Testing Strategy
- Unit tests for service logic and utilities
- Property-based tests for correctness properties (marked with *)
- Integration tests for end-to-end workflows
- Manual testing for UI/UX and real-time collaboration
