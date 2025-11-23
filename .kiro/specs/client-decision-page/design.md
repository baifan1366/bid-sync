# Design Document: Client Decision Page

## Overview

The Client Decision Page is a comprehensive, real-time interface that serves as the central hub for clients to evaluate proposals, communicate with bidding teams, and make final selection decisions. The design emphasizes clarity, ease of comparison, and efficient communication while maintaining BidSync's yellow-white aesthetic with full dark/light theme support.

The page combines three main functional areas:
1. **Project Overview & Progress** - Displays project details and current status
2. **Proposals Management** - Lists, compares, and provides detailed views of all submissions
3. **Communication Hub** - Real-time chat interface for Q&A with bidding teams

## Architecture

### High-Level Component Structure

```
ClientDecisionPage (Server Component)
├── ProjectHeader
│   ├── ProjectTitle
│   ├── ProjectMetadata (budget, timeline, deadline)
│   └── ProjectStatus
├── ProgressTracker
│   └── StatusIndicators
├── ProposalsSection
│   ├── ProposalsControls (filters, sorts, comparison toggle)
│   ├── ProposalsList
│   │   └── ProposalCard[] (clickable cards)
│   ├── ProposalDetailView
│   │   ├── ProposalHeader
│   │   ├── TeamInformation
│   │   ├── ProposalContent (sections)
│   │   ├── DocumentsList
│   │   ├── ComplianceStatus
│   │   └── DecisionActions (accept/reject buttons)
│   └── ProposalComparisonView
│       └── ComparisonGrid (side-by-side proposals)
└── ChatSection
    ├── ChatHeader
    ├── MessagesList
    │   └── MessageBubble[]
    └── MessageComposer
```

### Data Flow Architecture

```
Client Browser
    ↓ (GraphQL Query)
Supabase GraphQL API
    ↓ (Query with RLS)
PostgreSQL Database
    ↓ (Real-time subscription)
Supabase Realtime
    ↓ (WebSocket)
Client Browser (live updates)
```

### State Management

- **Server State**: TanStack Query for data fetching, caching, and synchronization
- **UI State**: React useState for local component state (filters, sorts, selected proposals)
- **Real-time State**: Supabase Realtime subscriptions for chat messages and proposal updates
- **Form State**: React Hook Form for message composition and decision forms

## Components and Interfaces

### Core Components

#### 1. ClientDecisionPage (Main Container)

**Purpose**: Server component that fetches initial data and renders the page layout

**Props**:
```typescript
interface ClientDecisionPageProps {
  params: {
    projectId: string
  }
}
```

**Responsibilities**:
- Fetch project data server-side
- Fetch initial proposals data
- Render layout with all child components
- Handle authentication and authorization

#### 2. ProjectHeader

**Purpose**: Displays comprehensive project information

**Props**:
```typescript
interface ProjectHeaderProps {
  project: Project
  proposalsCount: number
}

interface Project {
  id: string
  title: string
  description: string
  budget_min: number | null
  budget_max: number | null
  deadline: string | null
  status: ProjectStatus
  created_at: string
  client_id: string
  documents: ProjectDocument[]
}

type ProjectStatus = 'draft' | 'pending_admin_review' | 'published' | 'in_review' | 'awarded' | 'closed'
```

**Features**:
- Responsive layout (stacks on mobile, horizontal on desktop)
- Status badge with color coding
- Deadline countdown with visual urgency indicators
- Document list with download functionality
- Theme-aware styling with yellow accents

#### 3. ProgressTracker

**Purpose**: Visual representation of project and proposal evaluation progress

**Props**:
```typescript
interface ProgressTrackerProps {
  totalProposals: number
  submittedProposals: number
  underReviewProposals: number
  acceptedProposals: number
  rejectedProposals: number
  projectStatus: ProjectStatus
}
```

**Features**:
- Progress bar showing evaluation completion
- Status counts with icons
- Visual indicators for each stage
- Responsive design

#### 4. ProposalsControls

**Purpose**: Filtering, sorting, and view mode controls

**Props**:
```typescript
interface ProposalsControlsProps {
  filterStatus: ProposalStatus | 'all'
  onFilterChange: (status: ProposalStatus | 'all') => void
  sortBy: 'submission_date' | 'budget' | 'team_size'
  sortOrder: 'asc' | 'desc'
  onSortChange: (field: string, order: string) => void
  viewMode: 'list' | 'comparison'
  onViewModeChange: (mode: 'list' | 'comparison') => void
  selectedProposals: string[]
  onCompareClick: () => void
}

type ProposalStatus = 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
```

**Features**:
- Select dropdown for status filtering
- Select dropdown for sort field
- Toggle button for sort order
- Comparison mode toggle
- Selected proposals counter

#### 5. ProposalCard

**Purpose**: Compact card displaying proposal summary

**Props**:
```typescript
interface ProposalCardProps {
  proposal: ProposalSummary
  isSelected: boolean
  onSelect: (id: string) => void
  onClick: (id: string) => void
}

interface ProposalSummary {
  id: string
  title: string
  bidding_team_name: string
  bidding_lead: {
    id: string
    name: string
    avatar_url: string | null
  }
  team_size: number
  budget_estimate: number | null
  timeline_estimate: string | null
  submission_date: string
  status: ProposalStatus
  compliance_score: number
  unread_messages: number
}
```

**Features**:
- Hover effects with yellow border
- Status badge
- Budget display with formatting
- Team size indicator
- Unread messages badge
- Checkbox for comparison selection
- Click to expand/navigate to detail view

#### 6. ProposalDetailView

**Purpose**: Comprehensive view of a single proposal

**Props**:
```typescript
interface ProposalDetailViewProps {
  proposalId: string
  onClose: () => void
}

interface ProposalDetail {
  id: string
  title: string
  status: ProposalStatus
  submission_date: string
  bidding_team: {
    lead: TeamMember
    members: TeamMember[]
  }
  sections: ProposalSection[]
  documents: ProposalDocument[]
  compliance_checklist: ComplianceItem[]
  versions: ProposalVersion[]
  current_version: number
}

interface ProposalSection {
  id: string
  title: string
  content: string // Rich text JSON
  order: number
}

interface ProposalDocument {
  id: string
  name: string
  file_type: string
  file_size: number
  category: 'technical' | 'financial' | 'legal' | 'other'
  url: string
  uploaded_at: string
  uploaded_by: string
}

interface ComplianceItem {
  id: string
  category: 'technical' | 'financial' | 'legal'
  item: string
  completed: boolean
  completed_by: string | null
  completed_at: string | null
}

interface TeamMember {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: string
  assigned_sections: string[]
}
```

**Features**:
- Tabbed interface (Overview, Sections, Documents, Team, History)
- Rich text rendering for proposal content
- Document download with progress indicators
- Compliance checklist visualization
- Version history with comparison option
- Decision action buttons (Accept/Reject)
- Responsive layout

#### 7. ProposalComparisonView

**Purpose**: Side-by-side comparison of multiple proposals

**Props**:
```typescript
interface ProposalComparisonViewProps {
  proposalIds: string[]
  onClose: () => void
}
```

**Features**:
- Synchronized scrolling across proposals
- Sticky headers
- Highlighted differences
- Budget and timeline comparison charts
- Team size comparison
- Compliance score comparison
- Responsive (stacks on mobile, side-by-side on desktop)

#### 8. ChatSection

**Purpose**: Real-time messaging interface with bidding teams

**Props**:
```typescript
interface ChatSectionProps {
  projectId: string
  proposalId: string | null // null = general project chat
}

interface ChatMessage {
  id: string
  project_id: string
  proposal_id: string | null
  sender_id: string
  sender_name: string
  sender_avatar: string | null
  sender_role: 'client' | 'bidding_lead' | 'bidding_member'
  content: string
  created_at: string
  read: boolean
}
```

**Features**:
- Real-time message updates via Supabase Realtime
- Message grouping by sender and time
- Auto-scroll to latest message
- Typing indicators
- Message timestamps
- Sender avatars
- Theme-aware message bubbles (yellow for client, white/black for others)
- Responsive layout (full-width on mobile, sidebar on desktop)

#### 9. MessageComposer

**Purpose**: Input area for composing and sending messages

**Props**:
```typescript
interface MessageComposerProps {
  projectId: string
  proposalId: string | null
  onMessageSent: () => void
}
```

**Features**:
- Auto-expanding textarea
- Enter to send, Shift+Enter for new line
- Send button with loading state
- Character count (optional)
- Emoji picker (optional)
- File attachment (optional)

#### 10. DecisionActions

**Purpose**: Accept/Reject proposal with confirmation

**Props**:
```typescript
interface DecisionActionsProps {
  proposalId: string
  projectId: string
  currentStatus: ProposalStatus
  onDecisionMade: () => void
}
```

**Features**:
- Accept button (green with yellow accent)
- Reject button (red with yellow accent)
- Confirmation dialogs
- Rejection feedback form
- Loading states
- Success/error notifications

## Data Models

### Database Schema Extensions

```sql
-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  CONSTRAINT chat_messages_project_fk FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT chat_messages_proposal_fk FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  CONSTRAINT chat_messages_sender_fk FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_chat_messages_project ON chat_messages(project_id, created_at DESC);
CREATE INDEX idx_chat_messages_proposal ON chat_messages(proposal_id, created_at DESC);
CREATE INDEX idx_chat_messages_unread ON chat_messages(sender_id, read) WHERE read = FALSE;

-- Proposal decisions table (for audit trail)
CREATE TABLE proposal_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision_type VARCHAR(20) NOT NULL CHECK (decision_type IN ('accepted', 'rejected')),
  decided_by UUID NOT NULL REFERENCES users(id),
  decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  feedback TEXT,
  CONSTRAINT proposal_decisions_proposal_fk FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  CONSTRAINT proposal_decisions_project_fk FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT proposal_decisions_decided_by_fk FOREIGN KEY (decided_by) REFERENCES users(id)
);

-- RLS Policies for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Clients can view messages for their projects
CREATE POLICY "Clients can view project messages"
  ON chat_messages FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id = auth.uid()
    )
  );

-- Clients can send messages for their projects
CREATE POLICY "Clients can send project messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    project_id IN (
      SELECT id FROM projects WHERE client_id = auth.uid()
    )
  );

-- Bidding team members can view messages for their proposals
CREATE POLICY "Team members can view proposal messages"
  ON chat_messages FOR SELECT
  USING (
    proposal_id IN (
      SELECT proposal_id FROM bid_team_members WHERE user_id = auth.uid()
    )
  );

-- Bidding team members can send messages for their proposals
CREATE POLICY "Team members can send proposal messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    proposal_id IN (
      SELECT proposal_id FROM bid_team_members WHERE user_id = auth.uid()
    )
  );
```

### GraphQL Schema Extensions

```graphql
type Query {
  # Get project with all proposals
  projectWithProposals(projectId: ID!): ProjectWithProposals
  
  # Get detailed proposal
  proposalDetail(proposalId: ID!): ProposalDetail
  
  # Get chat messages
  chatMessages(projectId: ID!, proposalId: ID, limit: Int, offset: Int): [ChatMessage!]!
  
  # Get unread message count
  unreadMessageCount(projectId: ID!, proposalId: ID): Int!
}

type Mutation {
  # Send chat message
  sendMessage(input: SendMessageInput!): ChatMessage!
  
  # Mark messages as read
  markMessagesAsRead(projectId: ID!, proposalId: ID): Boolean!
  
  # Accept proposal
  acceptProposal(proposalId: ID!, projectId: ID!): ProposalDecision!
  
  # Reject proposal
  rejectProposal(input: RejectProposalInput!): ProposalDecision!
}

type Subscription {
  # Subscribe to new messages
  messageAdded(projectId: ID!, proposalId: ID): ChatMessage!
  
  # Subscribe to proposal updates
  proposalUpdated(projectId: ID!): Proposal!
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

type ProjectWithProposals {
  project: Project!
  proposals: [ProposalSummary!]!
  totalProposals: Int!
  submittedProposals: Int!
  underReviewProposals: Int!
  acceptedProposals: Int!
  rejectedProposals: Int!
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
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Project data completeness
*For any* project displayed on the decision page, all required fields (title, description, status, created_at) should be present and non-null
**Validates: Requirements 1.1**

### Property 2: Proposals list consistency
*For any* project, the displayed proposals list should contain only proposals that belong to that project and match the current filter criteria
**Validates: Requirements 2.1, 12.1**

### Property 3: Status badge accuracy
*For any* proposal or project, the displayed status badge should exactly match the current status value in the database
**Validates: Requirements 1.4, 2.2, 9.2**

### Property 4: Budget formatting consistency
*For any* displayed budget value, the formatting should be consistent (currency symbol, decimal places, thousands separators) across all components
**Validates: Requirements 1.1, 2.3**

### Property 5: Proposal comparison selection limit
*For any* comparison selection, the system should allow selection of minimum 2 and maximum 4 proposals
**Validates: Requirements 5.1**

### Property 6: Chat message ordering
*For any* chat thread, messages should be displayed in chronological order (oldest to newest) based on created_at timestamp
**Validates: Requirements 6.1**

### Property 7: Message sender identification
*For any* chat message, the displayed sender information (name, avatar, role) should match the sender's current profile data
**Validates: Requirements 6.3**

### Property 8: Real-time message delivery
*For any* new message sent, it should appear in the chat interface for all participants within 2 seconds
**Validates: Requirements 6.2, 11.2**

### Property 9: Decision action exclusivity
*For any* project, when one proposal is accepted, all other proposals for that project should automatically be marked as rejected
**Validates: Requirements 8.3**

### Property 10: Rejection feedback requirement
*For any* proposal rejection, the system should require non-empty feedback text before allowing the rejection to be submitted
**Validates: Requirements 8.4, 8.5**

### Property 11: Document download security
*For any* document download request, the system should verify that the requesting user has permission to access the project before generating a download URL
**Validates: Requirements 13.1, 13.2**

### Property 12: Filter and sort persistence
*For any* applied filter or sort configuration, the settings should persist when navigating between proposal detail views and returning to the list
**Validates: Requirements 12.5**

### Property 13: Theme consistency
*For any* theme switch (light to dark or dark to light), all components should update their colors while maintaining the yellow accent scheme
**Validates: Requirements 1.5, 14.3**

### Property 14: Responsive layout adaptation
*For any* viewport size change, the layout should adapt to the appropriate breakpoint (mobile/tablet/desktop) without content overflow or loss
**Validates: Requirements 10.1, 10.2, 10.3**

### Property 15: Loading state visibility
*For any* data fetching operation, a loading indicator should be visible until the data is successfully loaded or an error occurs
**Validates: Requirements 15.1, 15.2, 15.3**

### Property 16: Keyboard navigation completeness
*For any* interactive element on the page, it should be reachable and operable using only keyboard navigation
**Validates: Requirements 14.1**

### Property 17: Unread message count accuracy
*For any* proposal with unread messages, the displayed unread count should match the number of messages where read = false and sender_id != current_user_id
**Validates: Requirements 11.2**

### Property 18: Proposal version display
*For any* proposal with multiple versions, the detail view should display the latest submitted version by default
**Validates: Requirements 3.5**

### Property 19: Team member role assignment
*For any* displayed team member, their assigned role and sections should match the current assignments in the database
**Validates: Requirements 4.2, 4.3**

### Property 20: Progress tracker accuracy
*For any* project, the progress tracker counts (total, submitted, under review, accepted, rejected) should sum correctly and match the actual proposal statuses
**Validates: Requirements 9.1, 9.4**

## Error Handling

### Error Scenarios and Handling Strategies

1. **Network Errors**
   - Display toast notification with retry option
   - Maintain last known good state
   - Queue messages for retry when connection restored

2. **Authorization Errors**
   - Redirect to login if session expired
   - Display "Access Denied" message if insufficient permissions
   - Log security events for audit

3. **Data Loading Errors**
   - Show error state with retry button
   - Display partial data if available
   - Provide fallback UI

4. **Real-time Connection Errors**
   - Display connection status indicator
   - Attempt automatic reconnection with exponential backoff
   - Fall back to polling if WebSocket fails

5. **File Download Errors**
   - Display error message with specific failure reason
   - Provide retry button
   - Log error for debugging

6. **Form Validation Errors**
   - Display inline error messages
   - Highlight invalid fields
   - Prevent submission until resolved

7. **Mutation Errors**
   - Display error toast with specific message
   - Revert optimistic updates
   - Provide retry option

## Testing Strategy

### Unit Testing

**Framework**: Vitest + React Testing Library

**Test Coverage**:

1. **Component Rendering Tests**
   - Test each component renders with valid props
   - Test conditional rendering based on props
   - Test theme-aware styling

2. **User Interaction Tests**
   - Test button clicks trigger correct callbacks
   - Test form submissions with valid/invalid data
   - Test keyboard navigation

3. **Utility Function Tests**
   - Test budget formatting with various inputs
   - Test date formatting and deadline calculations
   - Test status badge color mapping

4. **Hook Tests**
   - Test custom hooks for chat functionality
   - Test real-time subscription hooks
   - Test form validation hooks

### Integration Testing

**Framework**: Playwright

**Test Scenarios**:

1. **Full Page Load**
   - Test page loads with project data
   - Test proposals list populates
   - Test chat interface initializes

2. **Proposal Selection and Comparison**
   - Test selecting multiple proposals
   - Test comparison view displays correctly
   - Test returning to list view

3. **Chat Functionality**
   - Test sending messages
   - Test receiving messages
   - Test message ordering

4. **Decision Workflow**
   - Test accepting a proposal
   - Test rejecting a proposal with feedback
   - Test status updates after decision

### Property-Based Testing

**Framework**: fast-check (JavaScript property-based testing library)

**Property Tests**:

Each property test should run a minimum of 100 iterations with randomly generated inputs.

1. **Property Test for Budget Formatting (Property 4)**
   - Generate random budget values (positive numbers, null, undefined)
   - Verify formatting is consistent across all components
   - **Feature: client-decision-page, Property 4: Budget formatting consistency**

2. **Property Test for Message Ordering (Property 6)**
   - Generate random arrays of messages with timestamps
   - Verify messages are always sorted chronologically
   - **Feature: client-decision-page, Property 6: Chat message ordering**

3. **Property Test for Filter Consistency (Property 2)**
   - Generate random proposal arrays with various statuses
   - Apply random filters
   - Verify filtered results only contain matching proposals
   - **Feature: client-decision-page, Property 2: Proposals list consistency**

4. **Property Test for Progress Tracker Accuracy (Property 20)**
   - Generate random proposal arrays with various statuses
   - Calculate counts
   - Verify sum equals total and individual counts match status filters
   - **Feature: client-decision-page, Property 20: Progress tracker accuracy**

5. **Property Test for Theme Consistency (Property 13)**
   - Generate random component trees
   - Toggle theme
   - Verify all components update colors correctly
   - **Feature: client-decision-page, Property 13: Theme consistency**

### End-to-End Testing

**Framework**: Playwright

**Critical User Flows**:

1. **Complete Evaluation Flow**
   - Client logs in
   - Navigates to decision page
   - Reviews all proposals
   - Compares 2-3 proposals
   - Chats with bidding team
   - Accepts winning proposal
   - Verifies status updates

2. **Communication Flow**
   - Client sends message
   - Bidding lead receives and responds
   - Client receives response
   - Verify real-time updates

3. **Responsive Design Flow**
   - Test on mobile viewport
   - Test on tablet viewport
   - Test on desktop viewport
   - Verify all features work on each size

## Performance Considerations

### Optimization Strategies

1. **Data Fetching**
   - Use server components for initial data load
   - Implement pagination for large proposal lists (20 per page)
   - Use TanStack Query caching to minimize refetches
   - Prefetch proposal details on card hover

2. **Real-time Updates**
   - Use Supabase Realtime for efficient WebSocket connections
   - Implement message batching for high-frequency updates
   - Debounce typing indicators

3. **Rendering Performance**
   - Virtualize long message lists (react-window)
   - Lazy load proposal detail tabs
   - Memoize expensive calculations
   - Use React.memo for pure components

4. **Bundle Size**
   - Code split by route
   - Lazy load chat interface
   - Lazy load comparison view
   - Tree-shake unused dependencies

5. **Image Optimization**
   - Use Next.js Image component for avatars
   - Implement lazy loading for images
   - Serve WebP format with fallbacks

### Performance Targets

- Initial page load: < 2 seconds
- Time to interactive: < 3 seconds
- Message send latency: < 500ms
- Real-time message delivery: < 2 seconds
- Proposal detail view load: < 1 second

## Security Considerations

### Authentication and Authorization

1. **Row Level Security (RLS)**
   - Enforce RLS policies on all database tables
   - Verify client can only access their own projects
   - Verify team members can only access their proposals

2. **API Security**
   - Validate all GraphQL inputs
   - Rate limit mutations (10 requests per minute per user)
   - Sanitize user-generated content (chat messages)

3. **File Access**
   - Generate signed URLs with expiration (1 hour)
   - Verify user permissions before generating URLs
   - Scan uploaded files for malware

4. **XSS Prevention**
   - Sanitize all user input before rendering
   - Use Content Security Policy headers
   - Escape HTML in chat messages

5. **CSRF Protection**
   - Use Supabase Auth tokens
   - Validate origin headers
   - Implement CSRF tokens for sensitive actions

## Accessibility

### WCAG 2.1 AA Compliance

1. **Keyboard Navigation**
   - All interactive elements accessible via Tab
   - Logical tab order
   - Visible focus indicators (yellow outline)
   - Keyboard shortcuts for common actions

2. **Screen Reader Support**
   - Semantic HTML elements
   - ARIA labels for all interactive elements
   - ARIA live regions for real-time updates
   - Alt text for images

3. **Color Contrast**
   - Minimum 4.5:1 for normal text
   - Minimum 3:1 for large text
   - Yellow accent meets contrast requirements
   - Test both light and dark themes

4. **Responsive Text**
   - Support browser zoom up to 200%
   - Use relative units (rem, em)
   - No horizontal scrolling at 200% zoom

## Deployment and Monitoring

### Deployment Strategy

1. **Staging Environment**
   - Deploy to staging first
   - Run automated tests
   - Manual QA review
   - Performance testing

2. **Production Deployment**
   - Blue-green deployment
   - Gradual rollout (10% → 50% → 100%)
   - Monitor error rates
   - Rollback plan ready

### Monitoring

1. **Error Tracking**
   - Sentry for error reporting
   - Track error rates by component
   - Alert on error spikes

2. **Performance Monitoring**
   - Track Core Web Vitals
   - Monitor API response times
   - Track real-time connection stability

3. **User Analytics**
   - Track feature usage
   - Monitor conversion rates (proposals viewed → decisions made)
   - Track chat engagement

## Future Enhancements

1. **Video Chat Integration**
   - Add video call capability for client-team discussions
   - Screen sharing for proposal walkthroughs

2. **Advanced Comparison**
   - AI-powered proposal analysis
   - Automated scoring and ranking
   - Highlight strengths and weaknesses

3. **Collaborative Decision Making**
   - Multiple stakeholders can review
   - Internal client team discussions
   - Voting mechanism

4. **Mobile Apps**
   - Native iOS and Android apps
   - Push notifications
   - Offline support

5. **Analytics Dashboard**
   - Detailed proposal metrics
   - Response time analytics
   - Team performance insights
