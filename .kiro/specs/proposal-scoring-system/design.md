# Design Document

## Overview

The Proposal Scoring/Ranking System provides clients with a structured, data-driven approach to evaluate and compare proposals submitted for their projects. The system implements a flexible, multi-criteria scoring framework that allows clients to create custom scoring templates or use predefined ones, assign weighted scores across multiple dimensions, and automatically rank proposals based on total scores. The design emphasizes transparency, auditability, and ease of use while maintaining consistency with the existing BidSync platform architecture.

## Architecture

### System Components

The scoring system integrates seamlessly with the existing BidSync architecture:

1. **Database Layer**: PostgreSQL with Supabase for data persistence, RLS policies for security
2. **API Layer**: GraphQL schema and resolvers for all scoring operations
3. **Business Logic Layer**: TypeScript services for score calculations, ranking algorithms, and validation
4. **UI Layer**: React components with shadcn/ui, following the yellow-black design system
5. **Export Layer**: PDF generation service for scoring reports

### Integration Points

- **Projects**: Scoring templates are associated with projects
- **Proposals**: Scores are linked to individual proposals
- **Users**: Clients create scores, leads view their scores
- **Admin Analytics**: Scoring data feeds into platform-wide analytics

## Components and Interfaces

### Database Schema

#### scoring_templates Table
```sql
CREATE TABLE public.scoring_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id) WHERE is_default = false
);
```

#### scoring_criteria Table
```sql
CREATE TABLE public.scoring_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.scoring_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    weight NUMERIC(5,2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT scoring_criteria_order_positive CHECK (order_index >= 0)
);
```

#### proposal_scores Table
```sql
CREATE TABLE public.proposal_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.scoring_criteria(id) ON DELETE CASCADE,
    raw_score NUMERIC(4,2) NOT NULL CHECK (raw_score >= 1 AND raw_score <= 10),
    weighted_score NUMERIC(6,2) NOT NULL,
    notes TEXT,
    scored_by UUID NOT NULL REFERENCES auth.users(id),
    scored_at TIMESTAMPTZ DEFAULT now(),
    is_final BOOLEAN DEFAULT false,
    UNIQUE(proposal_id, criterion_id, is_final) WHERE is_final = true
);
```

#### proposal_score_history Table
```sql
CREATE TABLE public.proposal_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.scoring_criteria(id) ON DELETE CASCADE,
    previous_raw_score NUMERIC(4,2),
    new_raw_score NUMERIC(4,2) NOT NULL,
    previous_notes TEXT,
    new_notes TEXT,
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT
);
```

#### proposal_rankings Table
```sql
CREATE TABLE public.proposal_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    total_score NUMERIC(6,2) NOT NULL,
    rank INT NOT NULL,
    is_fully_scored BOOLEAN DEFAULT false,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, proposal_id)
);
```

### GraphQL Schema

```graphql
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

type Query {
  scoringTemplate(projectId: ID!): ScoringTemplate
  defaultScoringTemplates: [ScoringTemplate!]!
  proposalScores(proposalId: ID!): [ProposalScore!]!
  proposalScoreHistory(proposalId: ID!): [ProposalScoreHistory!]!
  proposalRankings(projectId: ID!): [ProposalRanking!]!
  scoringComparison(projectId: ID!, proposalIds: [ID!]!): ScoringComparison!
}

type Mutation {
  createScoringTemplate(input: CreateScoringTemplateInput!): ScoringTemplate!
  updateScoringTemplate(templateId: ID!, input: UpdateScoringTemplateInput!): ScoringTemplate!
  deleteScoringTemplate(templateId: ID!): Boolean!
  
  scoreProposal(input: ScoreProposalInput!): ProposalScore!
  finalizeScoring(input: FinalizeScoringInput!): Boolean!
  reviseScore(input: ReviseScoreInput!): ProposalScore!
  
  recalculateRankings(projectId: ID!): [ProposalRanking!]!
  exportScoring(projectId: ID!): ScoringExport!
}
```

### React Components

#### ScoringTemplateManager
- Manages creation and editing of scoring templates
- Displays predefined templates for selection
- Validates that criterion weights sum to 100%
- Allows drag-and-drop reordering of criteria

#### ProposalScoringInterface
- Displays all criteria from the project's scoring template
- Provides 1-10 slider inputs for raw scores
- Shows real-time weighted score calculations
- Includes text areas for notes on each criterion
- Displays total score prominently
- Saves draft scores automatically
- Allows finalization of scores

#### ProposalRankingsList
- Displays all proposals sorted by total score
- Shows rank number, proposal title, lead name, total score
- Indicates scoring status (Not Scored, Partially Scored, Fully Scored)
- Updates in real-time when scores change
- Allows filtering by scoring status
- Provides quick navigation to scoring interface

#### ScoringComparisonView
- Side-by-side comparison of 2-4 proposals
- Displays all criteria with scores for each proposal
- Highlights best (green) and worst (red) scores per criterion
- Shows total scores and rankings at the top
- Synchronized scrolling across columns
- Visual progress bars for each criterion
- Responsive design (stacked on mobile, side-by-side on desktop)

#### ScoreHistoryViewer
- Displays all score revisions for a proposal
- Shows previous and new values with timestamps
- Displays who made the change and why
- Allows filtering by criterion
- Provides diff view for notes changes

#### ScoringExportDialog
- Generates PDF report of all scores and rankings
- Includes scoring template details
- Shows all proposals with their scores
- Displays export date and client name
- Provides download link with expiration

## Data Models

### ScoringTemplate
```typescript
interface ScoringTemplate {
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
```

### ScoringCriterion
```typescript
interface ScoringCriterion {
  id: string
  templateId: string
  name: string
  description?: string
  weight: number // 0-100, sum must equal 100
  orderIndex: number
  createdAt: string
}
```

### ProposalScore
```typescript
interface ProposalScore {
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
```

### ProposalRanking
```typescript
interface ProposalRanking {
  id: string
  projectId: string
  proposal: ProposalSummary
  totalScore: number
  rank: number
  isFullyScored: boolean
  calculatedAt: string
}
```

### Default Templates

#### Technical Template
- Technical Approach (30%)
- Innovation & Creativity (20%)
- Feasibility (25%)
- Team Expertise (25%)

#### Financial Template
- Budget Competitiveness (40%)
- Cost Breakdown Clarity (20%)
- Value for Money (25%)
- Payment Terms (15%)

#### Balanced Template
- Technical Approach (25%)
- Budget (25%)
- Timeline (20%)
- Team Quality (20%)
- Communication (10%)

#### Fast-Track Template
- Timeline (40%)
- Team Availability (30%)
- Budget (20%)
- Experience (10%)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Template criterion weights sum to 100%
*For any* scoring template, the sum of all criterion weights must equal exactly 100%
**Validates: Requirements 1.4**

### Property 2: Multiple criteria acceptance
*For any* scoring template, the system should accept and store any number of criteria (minimum 1, maximum 20) with unique names
**Validates: Requirements 1.2**

### Property 3: Criterion weight requirement
*For any* scoring criterion, attempting to create it without a weight value should be rejected by the system
**Validates: Requirements 1.3**

### Property 4: Draft template mutability
*For any* scoring template that is not finalized, all operations (edit, reorder, remove criteria) should succeed and persist changes
**Validates: Requirements 1.5**

### Property 5: Template persistence round-trip
*For any* scoring template, saving it to the database and then retrieving it should return an equivalent template with all criteria intact
**Validates: Requirements 1.6**

### Property 6: Default template customization independence
*For any* default template, customizing it and saving should create a new project-specific template without modifying the original default template
**Validates: Requirements 2.4**

### Property 7: Template criteria completeness
*For any* project with a scoring template, opening the scoring interface for any proposal should display all criteria from that template
**Validates: Requirements 3.1**

### Property 8: Raw score validation
*For any* scoring attempt, raw scores outside the range [1, 10] should be rejected, and scores within the range should be accepted
**Validates: Requirements 3.2**

### Property 9: Weighted score calculation
*For any* raw score and criterion weight, the weighted score should equal raw_score × (weight / 100)
**Validates: Requirements 3.3**

### Property 10: Total score calculation
*For any* fully scored proposal, the total score should equal the sum of all weighted scores for that proposal
**Validates: Requirements 3.4**

### Property 11: Draft scores persistence
*For any* partially scored proposal, saving draft scores and then retrieving them should return the same scores
**Validates: Requirements 3.5**

### Property 12: Finalization marks completion
*For any* proposal, submitting final scores should set is_final to true and record a timestamp
**Validates: Requirements 3.6**

### Property 13: Notes persistence with scores
*For any* criterion score with notes, saving and then retrieving should return the same notes
**Validates: Requirements 4.2**

### Property 14: Notes retrieval completeness
*For any* scored proposal, retrieving scores should include all associated notes
**Validates: Requirements 4.3**

### Property 15: Notes update independence
*For any* scored criterion, updating notes should not change the raw score or weighted score
**Validates: Requirements 4.4**

### Property 16: Ranking sort order
*For any* project with multiple scored proposals, the ranking list should be ordered by total score in descending order
**Validates: Requirements 5.1**

### Property 17: Tie-breaking by submission date
*For any* two proposals with equal total scores, the proposal with the earlier submission date should rank higher
**Validates: Requirements 5.2**

### Property 18: Ranking data completeness
*For any* ranked proposal, the ranking record should include rank number, total score, and scoring status
**Validates: Requirements 5.3**

### Property 19: Unscored proposals placement
*For any* project with both scored and unscored proposals, unscored proposals should appear at the bottom of the ranking list
**Validates: Requirements 5.4**

### Property 20: Ranking recalculation on score update
*For any* proposal score update, all rankings for that project should be recalculated and updated
**Validates: Requirements 5.5**

### Property 21: Comparison view generation
*For any* selection of 2-4 proposals, the system should generate a comparison view containing all selected proposals
**Validates: Requirements 6.1**

### Property 22: Comparison data completeness
*For any* comparison view, all scoring criteria with raw and weighted scores should be included for each proposal
**Validates: Requirements 6.2**

### Property 23: Best and worst score identification
*For any* criterion in a comparison view, the highest score should be identified as best and the lowest as worst
**Validates: Requirements 6.3**

### Property 24: Scoring status indication
*For any* comparison view, each proposal's scoring status (fully scored vs partially scored) should be indicated
**Validates: Requirements 6.5**

### Property 25: Export data completeness
*For any* scoring export, the generated report should include all proposals with their scores, rankings, and notes
**Validates: Requirements 7.2**

### Property 26: Export template inclusion
*For any* scoring export, the report should include the complete scoring template with criteria names, weights, and descriptions
**Validates: Requirements 7.3**

### Property 27: Export metadata inclusion
*For any* scoring export, the report should include the export date and client name
**Validates: Requirements 7.4**

### Property 28: Export unscored summary
*For any* project with unscored proposals, the export should include a summary indicating which proposals remain unscored
**Validates: Requirements 7.5**

### Property 29: Finalized score unlocking
*For any* proposal with finalized scores, the system should allow unlocking and editing those scores
**Validates: Requirements 8.1**

### Property 30: Score revision history logging
*For any* score revision, a new entry should be created in the score history table
**Validates: Requirements 8.2**

### Property 31: Revision triggers recalculation
*For any* score revision, the total score and ranking should be recalculated
**Validates: Requirements 8.3**

### Property 32: History retrieval completeness
*For any* proposal with score revisions, retrieving history should return all previous versions with timestamps
**Validates: Requirements 8.4**

### Property 33: Accepted/rejected proposal locking
*For any* proposal with status "accepted" or "rejected", attempts to modify scores should be rejected
**Validates: Requirements 8.5**

### Property 34: Lead score visibility
*For any* scored proposal, the bidding lead should be able to retrieve the total score and ranking
**Validates: Requirements 9.2**

### Property 35: Lead notes privacy
*For any* scored proposal, the bidding lead should be able to see criterion scores but not the client's notes
**Validates: Requirements 9.3**

### Property 36: Scoring usage percentage calculation
*For any* set of projects, the percentage using scoring templates should equal (projects_with_scoring / total_projects) × 100
**Validates: Requirements 10.2**

### Property 37: Average proposals scored calculation
*For any* set of projects with scoring, the average proposals scored should equal total_scored_proposals / projects_with_scoring
**Validates: Requirements 10.3**

### Property 38: Common criteria identification
*For any* set of scoring templates, the most commonly used criteria should be those appearing in the most templates
**Validates: Requirements 10.4**

### Property 39: Average scoring time calculation
*For any* set of completed scoring sessions, the average time should equal sum_of_durations / number_of_sessions
**Validates: Requirements 10.5**

## Error Handling

### Validation Errors

1. **Invalid Weight Sum**: If criterion weights don't sum to 100%, return error with current sum and required adjustment
2. **Invalid Score Range**: If raw score is outside [1, 10], return error with valid range
3. **Missing Required Fields**: If template name or criterion name is missing, return specific field error
4. **Duplicate Criterion Names**: If criterion names are not unique within a template, return error
5. **Locked Proposal**: If attempting to score an accepted/rejected proposal, return error with explanation

### Business Logic Errors

1. **Template Not Found**: If scoring template doesn't exist for project, offer to create one
2. **Incomplete Scoring**: If attempting to finalize with missing scores, return list of unscored criteria
3. **Concurrent Modification**: If two clients try to score simultaneously, use last-write-wins with notification
4. **Export Generation Failure**: If PDF generation fails, log error and retry up to 3 times
5. **Ranking Calculation Failure**: If ranking calculation fails, log error and mark rankings as stale

### Database Errors

1. **Connection Failure**: Retry database operations up to 3 times with exponential backoff
2. **Constraint Violation**: Catch unique constraint violations and return user-friendly messages
3. **Foreign Key Violation**: Validate references before operations to prevent FK errors
4. **Transaction Rollback**: Wrap multi-step operations in transactions and rollback on failure

### User Experience

1. **Auto-save Failures**: Show toast notification and retry in background
2. **Network Errors**: Display offline indicator and queue operations for retry
3. **Slow Operations**: Show loading states and progress indicators
4. **Validation Feedback**: Provide real-time validation feedback as user types

## Testing Strategy

### Unit Testing

The testing strategy follows a dual approach with both unit tests and property-based tests:

**Unit Tests** will cover:
- Individual score calculation functions (weighted score, total score)
- Weight validation logic (sum equals 100%)
- Score range validation (1-10)
- Ranking algorithm with specific examples
- Tie-breaking logic with equal scores
- Export generation with sample data
- Default template structure verification
- Score history entry creation
- Lock/unlock logic for finalized scores

**Property-Based Tests** will verify:
- All 39 correctness properties defined above
- Each property will run a minimum of 100 iterations
- Properties will use random generators for:
  - Template structures with varying criteria counts
  - Score values across the valid range
  - Weight distributions that sum to 100%
  - Proposal sets with varying scoring states
  - Timestamp sequences for tie-breaking

### Property-Based Testing Framework

We will use **fast-check** (JavaScript/TypeScript property-based testing library) for implementing property tests.

**Configuration**:
```typescript
import fc from 'fast-check'

// Run each property test 100 times minimum
const testConfig = { numRuns: 100 }
```

**Test Tagging**:
Each property-based test will be tagged with a comment referencing the design document:
```typescript
// Feature: proposal-scoring-system, Property 1: Template criterion weights sum to 100%
test('template weights sum to 100%', () => {
  fc.assert(
    fc.property(
      fc.array(fc.float({ min: 0.01, max: 100 }), { minLength: 1, maxLength: 20 }),
      (weights) => {
        const normalized = normalizeWeights(weights)
        const sum = normalized.reduce((a, b) => a + b, 0)
        return Math.abs(sum - 100) < 0.01 // Allow for floating point precision
      }
    ),
    testConfig
  )
})
```

### Integration Testing

- Test complete scoring workflow from template creation to ranking
- Test score revision workflow with history tracking
- Test export generation with real database data
- Test concurrent scoring scenarios
- Test ranking recalculation triggers
- Test lead visibility of scores without notes

### End-to-End Testing

- Test complete client journey: create template → score proposals → view rankings → export
- Test lead journey: submit proposal → view score → see ranking
- Test admin analytics view with scoring data
- Test comparison view with multiple proposals
- Test score revision and history viewing

### Performance Testing

- Test ranking calculation with 100+ proposals
- Test comparison view rendering with 4 proposals
- Test export generation with large datasets
- Test real-time ranking updates under load
- Test concurrent scoring by multiple clients

## Implementation Notes

### Calculation Precision

- Use NUMERIC(6,2) for scores to avoid floating-point precision issues
- Round weighted scores to 2 decimal places
- Round total scores to 2 decimal places
- Use exact decimal arithmetic for weight validation

### Real-time Updates

- Use Supabase Realtime subscriptions for ranking updates
- Debounce auto-save operations to reduce database writes
- Optimistic UI updates with rollback on failure
- Cache rankings and invalidate on score changes

### Security Considerations

- RLS policies ensure clients can only score their own projects
- Leads can view scores but not client notes
- Admins can view all scoring data for analytics
- Score history is immutable (append-only)
- Finalized scores require explicit unlock action

### Scalability

- Index on (project_id, total_score DESC) for fast ranking queries
- Materialize rankings table for quick retrieval
- Batch ranking recalculations for efficiency
- Use database functions for complex calculations
- Cache default templates in application memory

### Accessibility

- Keyboard navigation for scoring interface
- Screen reader support for score values and rankings
- High contrast mode for best/worst score highlighting
- ARIA labels for all interactive elements
- Focus management for modal dialogs

### Mobile Responsiveness

- Stacked layout for comparison view on mobile
- Touch-friendly score sliders
- Collapsible criterion sections
- Responsive tables for rankings
- Mobile-optimized PDF exports

## Dependencies

### External Libraries

- **fast-check**: Property-based testing framework
- **jsPDF**: PDF generation for exports
- **react-beautiful-dnd**: Drag-and-drop for criterion reordering
- **recharts**: Charts for analytics visualization
- **date-fns**: Date formatting and calculations

### Internal Dependencies

- **GraphQL API**: All data operations
- **Supabase**: Database and real-time subscriptions
- **shadcn/ui**: UI components
- **React Query**: Data fetching and caching
- **Zustand**: Client-side state management

### Database Functions

```sql
-- Calculate total score for a proposal
CREATE OR REPLACE FUNCTION calculate_proposal_total_score(p_proposal_id UUID)
RETURNS NUMERIC(6,2) AS $$
DECLARE
  v_total NUMERIC(6,2);
BEGIN
  SELECT COALESCE(SUM(weighted_score), 0)
  INTO v_total
  FROM proposal_scores
  WHERE proposal_id = p_proposal_id AND is_final = true;
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Recalculate rankings for a project
CREATE OR REPLACE FUNCTION recalculate_project_rankings(p_project_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM proposal_rankings WHERE project_id = p_project_id;
  
  INSERT INTO proposal_rankings (project_id, proposal_id, total_score, rank, is_fully_scored, calculated_at)
  SELECT 
    p_project_id,
    p.id,
    calculate_proposal_total_score(p.id),
    ROW_NUMBER() OVER (
      ORDER BY 
        calculate_proposal_total_score(p.id) DESC,
        p.submitted_at ASC
    ),
    (
      SELECT COUNT(*) = COUNT(*) FILTER (WHERE ps.is_final = true)
      FROM scoring_criteria sc
      JOIN scoring_templates st ON sc.template_id = st.id
      LEFT JOIN proposal_scores ps ON ps.criterion_id = sc.id AND ps.proposal_id = p.id
      WHERE st.project_id = p_project_id
    ),
    NOW()
  FROM proposals p
  WHERE p.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- Check if proposal scoring is locked
CREATE OR REPLACE FUNCTION is_proposal_scoring_locked(p_proposal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status proposal_status;
BEGIN
  SELECT status INTO v_status FROM proposals WHERE id = p_proposal_id;
  RETURN v_status IN ('approved', 'rejected');
END;
$$ LANGUAGE plpgsql;
```

### RLS Policies

```sql
-- Scoring Templates
CREATE POLICY "clients_manage_own_templates" ON scoring_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = scoring_templates.project_id 
      AND p.client_id = auth.uid()
    )
  );

-- Proposal Scores
CREATE POLICY "clients_score_own_projects" ON proposal_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM proposals pr
      JOIN projects p ON pr.project_id = p.id
      WHERE pr.id = proposal_scores.proposal_id
      AND p.client_id = auth.uid()
    )
  );

CREATE POLICY "leads_view_own_scores" ON proposal_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM proposals pr
      WHERE pr.id = proposal_scores.proposal_id
      AND pr.lead_id = auth.uid()
    )
  );

-- Proposal Rankings
CREATE POLICY "clients_view_own_rankings" ON proposal_rankings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = proposal_rankings.project_id
      AND p.client_id = auth.uid()
    )
  );

CREATE POLICY "leads_view_own_ranking" ON proposal_rankings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM proposals pr
      WHERE pr.id = proposal_rankings.proposal_id
      AND pr.lead_id = auth.uid()
    )
  );

-- Score History
CREATE POLICY "clients_view_own_history" ON proposal_score_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM proposals pr
      JOIN projects p ON pr.project_id = p.id
      WHERE pr.id = proposal_score_history.proposal_id
      AND p.client_id = auth.uid()
    )
  );
```

## Future Enhancements

### Phase 2 Features

1. **AI-Assisted Scoring**: Suggest scores based on proposal content analysis
2. **Collaborative Scoring**: Multiple stakeholders can score proposals
3. **Weighted Voting**: Different stakeholders have different voting weights
4. **Score Normalization**: Normalize scores across different evaluators
5. **Blind Scoring**: Hide proposal identities during scoring
6. **Score Calibration**: Adjust scores based on evaluator tendencies
7. **Custom Score Scales**: Allow scales other than 1-10 (e.g., 1-5, 1-100)
8. **Score Templates Library**: Share scoring templates across projects
9. **Score Benchmarking**: Compare scores against industry benchmarks
10. **Advanced Analytics**: Deeper insights into scoring patterns

### Technical Debt

1. **Caching Strategy**: Implement Redis for ranking cache
2. **Batch Operations**: Optimize bulk score updates
3. **Audit Logging**: Enhanced logging for compliance
4. **Data Archival**: Archive old scoring data
5. **Performance Monitoring**: Track scoring operation latency
