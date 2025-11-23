# Design Document: Workspace Real-time Collaboration

## Overview

The workspace real-time collaboration system enables multiple team members to simultaneously work on proposal documents with section-based locking, presence awareness, and automatic conflict resolution. The system is built on a CRDT (Conflict-free Replicated Data Type) architecture using Yjs for operational transformation, TipTap as the rich text editor, and WebSocket connections for real-time synchronization.

The architecture leverages existing infrastructure including:
- **TipTap** with collaboration extensions for rich text editing
- **Yjs** for CRDT-based conflict-free merging
- **y-websocket** for real-time synchronization
- **GraphQL** with subscriptions for presence and metadata updates
- **Supabase** for persistent storage and authentication

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   TipTap     │  │   Presence   │  │   Progress   │     │
│  │   Editor     │  │   Manager    │  │   Tracker    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│  ┌──────▼──────────────────▼──────────────────▼───────┐    │
│  │           Collaboration Client Layer               │    │
│  │  (Yjs Provider, Lock Manager, Auto-save)          │    │
│  └──────┬──────────────────┬──────────────────┬───────┘    │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          │ WebSocket        │ GraphQL          │ GraphQL
          │ (Yjs sync)       │ Subscriptions    │ Mutations
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼────────────┐
│                     Server Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  WebSocket   │  │   GraphQL    │  │   Lock       │     │
│  │  Server      │  │   Yoga       │  │   Service    │     │
│  │  (y-websocket)│  │   Server     │  │   (Redis)    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│  ┌──────▼──────────────────▼──────────────────▼───────┐    │
│  │              Persistence Layer                     │    │
│  │  (Supabase PostgreSQL + Storage)                  │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

1. **TipTap Editor**: Rich text editing with formatting, lists, links, tables
2. **Yjs Provider**: CRDT-based document synchronization and conflict resolution
3. **Lock Manager**: Section-level locking coordination
4. **Presence Manager**: User presence tracking and cursor position sharing
5. **Auto-save Service**: Periodic persistence of document state
6. **Progress Tracker**: Section status and deadline management
7. **WebSocket Server**: Real-time bidirectional communication
8. **GraphQL Server**: Metadata operations and subscriptions
9. **Lock Service**: Distributed lock coordination using Redis
10. **Persistence Layer**: Document storage and version history

## Components and Interfaces

### 1. TipTap Editor Component

**Purpose**: Provide rich text editing capabilities with real-time collaboration

**Key Features**:
- StarterKit extensions (bold, italic, lists, headings, etc.)
- Collaboration extension for Yjs integration
- CollaborationCursor for showing other users' cursors
- Placeholder extension for empty sections
- Table extensions for structured data
- TaskList extensions for checklists

**Interface**:
```typescript
interface EditorProps {
  documentId: string;
  sectionId: string;
  initialContent: JSONContent;
  isLocked: boolean;
  onContentChange: (content: JSONContent) => void;
  onLockRequest: () => Promise<boolean>;
  onLockRelease: () => Promise<void>;
}

interface EditorRef {
  getContent: () => JSONContent;
  setContent: (content: JSONContent) => void;
  focus: () => void;
  blur: () => void;
  isEditable: () => boolean;
}
```

### 2. Yjs Collaboration Provider

**Purpose**: Synchronize document state across clients using CRDT

**Key Features**:
- WebSocket-based synchronization
- Automatic conflict resolution
- Offline support with local persistence
- Awareness protocol for presence

**Interface**:
```typescript
interface CollaborationProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getDocument(): Y.Doc;
  getAwareness(): Awareness;
  onSync(callback: (synced: boolean) => void): void;
  onConnectionStatus(callback: (status: ConnectionStatus) => void): void;
}

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
```

### 3. Section Lock Manager

**Purpose**: Coordinate exclusive editing access to document sections

**Key Features**:
- Acquire/release locks with timeout
- Automatic lock release on disconnect
- Lock status broadcasting
- Lock queue management

**Interface**:
```typescript
interface LockManager {
  acquireLock(sectionId: string): Promise<LockResult>;
  releaseLock(sectionId: string): Promise<void>;
  getLockStatus(sectionId: string): Promise<LockStatus>;
  onLockChange(callback: (event: LockChangeEvent) => void): void;
  heartbeat(): Promise<void>;
}

interface LockResult {
  success: boolean;
  lockId?: string;
  lockedBy?: string;
  expiresAt?: Date;
}

interface LockStatus {
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: Date;
  expiresAt?: Date;
}

interface LockChangeEvent {
  sectionId: string;
  action: 'acquired' | 'released' | 'expired';
  userId: string;
  timestamp: Date;
}
```

### 4. Presence Manager

**Purpose**: Track and display active users and their editing locations

**Key Features**:
- Real-time presence updates
- Cursor position tracking
- Idle/away status detection
- User color assignment

**Interface**:
```typescript
interface PresenceManager {
  joinDocument(documentId: string, userInfo: UserInfo): Promise<void>;
  leaveDocument(): Promise<void>;
  updateCursor(position: CursorPosition): Promise<void>;
  updateStatus(status: PresenceStatus): Promise<void>;
  getActiveUsers(): Promise<ActiveUser[]>;
  onPresenceChange(callback: (event: PresenceChangeEvent) => void): void;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  color: string;
}

interface ActiveUser extends UserInfo {
  status: PresenceStatus;
  cursorPosition?: CursorPosition;
  lastActivity: Date;
}

interface PresenceChangeEvent {
  type: 'joined' | 'left' | 'cursor-moved' | 'status-changed';
  user: ActiveUser;
}
```

### 5. Auto-save Service

**Purpose**: Automatically persist document changes without user intervention

**Key Features**:
- Debounced save operations
- Retry logic with exponential backoff
- Offline queue management
- Save status indicators

**Interface**:
```typescript
interface AutoSaveService {
  start(documentId: string, getContent: () => JSONContent): void;
  stop(): void;
  forceSave(): Promise<SaveResult>;
  getSaveStatus(): SaveStatus;
  onSaveStatusChange(callback: (status: SaveStatus) => void): void;
}

interface SaveResult {
  success: boolean;
  savedAt?: Date;
  error?: string;
}

type SaveStatus = 'saved' | 'saving' | 'pending' | 'error' | 'offline';
```

### 6. Progress Tracker

**Purpose**: Monitor section completion and deadline adherence

**Key Features**:
- Section status management
- Progress calculation
- Deadline tracking
- Notification triggers

**Interface**:
```typescript
interface ProgressTracker {
  updateSectionStatus(sectionId: string, status: SectionStatus): Promise<void>;
  getSectionProgress(documentId: string): Promise<SectionProgress[]>;
  getOverallProgress(documentId: string): Promise<number>;
  setDeadline(sectionId: string, deadline: Date): Promise<void>;
  getUpcomingDeadlines(): Promise<Deadline[]>;
  onProgressChange(callback: (event: ProgressChangeEvent) => void): void;
}

type SectionStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed';

interface SectionProgress {
  sectionId: string;
  title: string;
  status: SectionStatus;
  assignedTo?: string;
  deadline?: Date;
  lastUpdated: Date;
}

interface Deadline {
  sectionId: string;
  title: string;
  deadline: Date;
  assignedTo?: string;
  isOverdue: boolean;
  hoursRemaining: number;
}
```

## Data Models

### Document Structure

```typescript
interface Document {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  content: JSONContent;  // TipTap JSON format
  sections: DocumentSection[];
  createdBy: string;
  lastEditedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentSection {
  id: string;
  documentId: string;
  title: string;
  order: number;
  status: SectionStatus;
  assignedTo?: string;
  deadline?: Date;
  lockedBy?: string;
  lockedAt?: Date;
  lockExpiresAt?: Date;
}
```

### Collaboration Session

```typescript
interface CollaborationSession {
  id: string;
  documentId: string;
  userId: string;
  userName: string;
  userColor: string;
  cursorPosition?: CursorPosition;
  presenceStatus: PresenceStatus;
  lastActivity: Date;
  joinedAt: Date;
}

interface CursorPosition {
  from: number;  // Character offset
  to: number;    // Character offset
}

type PresenceStatus = 'active' | 'idle' | 'away';
```

### Lock Record

```typescript
interface LockRecord {
  id: string;
  sectionId: string;
  documentId: string;
  userId: string;
  acquiredAt: Date;
  expiresAt: Date;
  lastHeartbeat: Date;
}
```

### Version History

```typescript
interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  content: JSONContent;
  createdBy: string;
  createdByName: string;
  changesSummary: string;
  isRollback: boolean;
  rolledBackFrom?: string;
  createdAt: Date;
}
```

### Auto-save State

```typescript
interface AutoSaveState {
  documentId: string;
  lastSavedAt?: Date;
  lastSavedContent?: JSONContent;
  pendingChanges: boolean;
  saveInProgress: boolean;
  offlineQueue: QueuedChange[];
  retryCount: number;
}

interface QueuedChange {
  timestamp: Date;
  content: JSONContent;
  attemptCount: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Section Locking Properties

**Property 1: Lock acquisition on edit**
*For any* section and any user, when that user begins editing the section, an ex