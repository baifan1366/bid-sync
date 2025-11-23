# Requirements Document

## Introduction

The Proposal Scoring/Ranking System enables clients to systematically evaluate and compare proposals submitted for their projects. The system provides a structured, multi-criteria scoring interface that helps clients make objective, data-driven decisions when selecting bidding teams. By implementing weighted scoring across technical, financial, timeline, and team quality dimensions, clients can rank proposals fairly and transparently.

## Glossary

- **BidSync Platform**: The web-based proposal management system
- **Client**: A user with the role "client" who posts projects and evaluates proposals
- **Proposal**: A bid submission from a bidding team for a specific project
- **Score Card**: A structured evaluation form containing multiple scoring criteria
- **Scoring Criterion**: An individual dimension used to evaluate a proposal (e.g., technical approach, budget, timeline)
- **Weight**: A numerical value (percentage) indicating the relative importance of a scoring criterion
- **Raw Score**: The points assigned to a criterion before weight application (typically 1-10 scale)
- **Weighted Score**: The raw score multiplied by the criterion's weight
- **Total Score**: The sum of all weighted scores for a proposal
- **Ranking**: The ordered position of a proposal relative to other proposals based on total score
- **Score History**: A record of all scoring actions and changes made to a proposal's evaluation

## Requirements

### Requirement 1

**User Story:** As a client, I want to create a custom scoring template for my project, so that I can evaluate proposals based on criteria that matter most to my specific needs.

#### Acceptance Criteria

1. WHEN a client accesses the project detail page for a project with submitted proposals, THE BidSync Platform SHALL display an option to create or configure a scoring template
2. WHEN a client creates a scoring template, THE BidSync Platform SHALL allow the client to add multiple scoring criteria with custom names and descriptions
3. WHEN a client adds a scoring criterion, THE BidSync Platform SHALL require the client to assign a weight percentage to that criterion
4. WHEN a client assigns weights to all criteria, THE BidSync Platform SHALL validate that the sum of all weights equals 100%
5. WHERE a client has not finalized the scoring template, THE BidSync Platform SHALL allow the client to edit, reorder, or remove criteria
6. WHEN a client saves a scoring template, THE BidSync Platform SHALL persist the template configuration to the database

### Requirement 2

**User Story:** As a client, I want to use predefined scoring templates, so that I can quickly start evaluating proposals without creating criteria from scratch.

#### Acceptance Criteria

1. THE BidSync Platform SHALL provide at least four default scoring templates (Technical, Financial, Balanced, Fast-Track)
2. WHEN a client selects a default template, THE BidSync Platform SHALL populate the scoring interface with predefined criteria and weights
3. WHERE a client selects a default template, THE BidSync Platform SHALL allow the client to customize the criteria and weights before finalizing
4. WHEN a client customizes a default template, THE BidSync Platform SHALL save the customized version as a project-specific template

### Requirement 3

**User Story:** As a client, I want to score individual proposals using my scoring template, so that I can systematically evaluate each submission.

#### Acceptance Criteria

1. WHEN a client opens a proposal for scoring, THE BidSync Platform SHALL display all scoring criteria from the project's scoring template
2. WHEN a client scores a criterion, THE BidSync Platform SHALL accept raw scores on a scale of 1 to 10
3. WHEN a client enters a raw score, THE BidSync Platform SHALL calculate and display the weighted score in real-time
4. WHEN a client scores all criteria for a proposal, THE BidSync Platform SHALL calculate and display the total score
5. WHERE a client has partially scored a proposal, THE BidSync Platform SHALL save the draft scores and allow the client to complete scoring later
6. WHEN a client submits final scores for a proposal, THE BidSync Platform SHALL mark the scoring as complete and record the timestamp

### Requirement 4

**User Story:** As a client, I want to add notes and justifications to my scores, so that I can document my reasoning for future reference.

#### Acceptance Criteria

1. WHEN a client scores a criterion, THE BidSync Platform SHALL provide a text field for optional notes
2. WHEN a client enters notes for a criterion, THE BidSync Platform SHALL save the notes with the score
3. WHEN a client views a scored proposal, THE BidSync Platform SHALL display all notes alongside their corresponding scores
4. WHERE a client has added notes, THE BidSync Platform SHALL allow the client to edit the notes without changing the scores

### Requirement 5

**User Story:** As a client, I want to view an automatically ranked list of all proposals, so that I can quickly identify the highest-scoring submissions.

#### Acceptance Criteria

1. WHEN a client accesses the proposals list for a project, THE BidSync Platform SHALL display proposals in descending order by total score
2. WHEN proposals have equal total scores, THE BidSync Platform SHALL rank them by submission date (earlier submissions ranked higher)
3. WHEN a client views the ranked list, THE BidSync Platform SHALL display each proposal's rank number, total score, and scoring status
4. WHERE a proposal has not been scored, THE BidSync Platform SHALL display it with a "Not Scored" status at the bottom of the list
5. WHEN a client updates scores for any proposal, THE BidSync Platform SHALL recalculate rankings for all proposals in real-time

### Requirement 6

**User Story:** As a client, I want to compare scores across multiple proposals side-by-side, so that I can easily identify strengths and weaknesses of each submission.

#### Acceptance Criteria

1. WHEN a client selects multiple proposals (2-4), THE BidSync Platform SHALL display a side-by-side score comparison view
2. WHEN displaying the comparison view, THE BidSync Platform SHALL show all scoring criteria with raw scores and weighted scores for each proposal
3. WHEN displaying criterion scores, THE BidSync Platform SHALL highlight the highest score in green and the lowest score in red
4. WHEN displaying the comparison view, THE BidSync Platform SHALL show total scores and rankings prominently at the top
5. WHERE proposals have different scoring statuses, THE BidSync Platform SHALL indicate which proposals are fully scored versus partially scored

### Requirement 7

**User Story:** As a client, I want to export scoring data and rankings, so that I can share evaluation results with stakeholders or keep records.

#### Acceptance Criteria

1. WHEN a client requests a scoring export, THE BidSync Platform SHALL generate a downloadable report in PDF format
2. WHEN generating the export, THE BidSync Platform SHALL include all proposals with their scores, rankings, and notes
3. WHEN generating the export, THE BidSync Platform SHALL include the scoring template with criteria names, weights, and descriptions
4. WHEN generating the export, THE BidSync Platform SHALL include the export date and the client's name
5. WHERE a client has not scored all proposals, THE BidSync Platform SHALL include a summary indicating which proposals remain unscored

### Requirement 8

**User Story:** As a client, I want to revise scores after initial evaluation, so that I can correct mistakes or update my assessment based on new information.

#### Acceptance Criteria

1. WHERE a client has submitted final scores for a proposal, THE BidSync Platform SHALL allow the client to unlock and edit the scores
2. WHEN a client revises scores, THE BidSync Platform SHALL create a new entry in the score history
3. WHEN a client revises scores, THE BidSync Platform SHALL recalculate the total score and update rankings
4. WHEN a client views score history, THE BidSync Platform SHALL display all previous versions with timestamps and changed values
5. IF a proposal has been accepted or rejected, THEN THE BidSync Platform SHALL prevent score modifications and display a notification explaining why

### Requirement 9

**User Story:** As a bidding lead, I want to see if my proposal has been scored, so that I understand where I stand in the evaluation process.

#### Acceptance Criteria

1. WHEN a bidding lead views their submitted proposal, THE BidSync Platform SHALL display a scoring status indicator
2. WHERE a proposal has been scored, THE BidSync Platform SHALL display the total score and ranking to the bidding lead
3. WHERE a proposal has been scored, THE BidSync Platform SHALL display individual criterion scores without revealing the client's notes
4. WHERE a proposal has not been scored, THE BidSync Platform SHALL display a "Pending Evaluation" status
5. WHEN scores are updated, THE BidSync Platform SHALL send a notification to the bidding lead

### Requirement 10

**User Story:** As an admin, I want to view scoring analytics across the platform, so that I can monitor how clients are using the scoring system and identify trends.

#### Acceptance Criteria

1. WHEN an admin accesses the analytics dashboard, THE BidSync Platform SHALL display aggregate scoring statistics
2. WHEN displaying scoring statistics, THE BidSync Platform SHALL show the percentage of projects using scoring templates
3. WHEN displaying scoring statistics, THE BidSync Platform SHALL show the average number of proposals scored per project
4. WHEN displaying scoring statistics, THE BidSync Platform SHALL show the most commonly used scoring criteria across all projects
5. WHEN displaying scoring statistics, THE BidSync Platform SHALL show the average time taken to complete scoring for a project
