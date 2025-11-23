# Bidsync — Product Specification & Implementation Plan

> A complete requirements + implementation blueprint for the **Bidsync** project bidding & proposal management system.

---

## 1. Product summary

**Bidsync** is a web platform for managing project openings, collaborative proposal drafting, versioning, compliance checks and client-side selection workflows. It supports role-based collaboration (Client, Bidding Member, Bidding Lead, Content Coordinator/Admin) and integrates AI assistance for drafting and review.

**Primary goals:**

* Make proposal collaboration fast, auditable and versioned.
* Provide clients with clear comparison, feedback and selection flows.
* Provide leads with team & deadline controls and AI-assisted authoring.
* Ensure compliance (technical/financial/legal) before submission.

---

## 2. Actors & high-level use cases

(Provided by stakeholder; included here for completeness and traceability)

* **Client**: create/edit/close project openings, view proposals, select winner, reject with feedback, track progress, Q&A with bidding teams.
* **Bidding Member**: contribute content, upload docs, view assignments, draft internal comments, track deadlines.
* **Bidding Lead**: form & manage team, assign responsibilities, set internal deadlines, draft & submit proposals, run AI assistance, validate compliance.
* **Content Coordinator (Admin)**: manage users/roles, system config, templates, global analytics, review proposals and compliance.

---

## 3. MVP scope (prioritized)

### Must-have (MVP):

1. User registration with role selection
2. Project openings CRUD (Client)
3. System/AI initial project check
4. Admin project approval workflow
5. Proposal workspace per project with multi-user editing (section-based locking)
6. File upload & attachments (documents, financials)
7. Proposal versioning + restore + compare (diff view)
8. Role-based access control (RBAC)
9. Bidding Lead: create team, assign members, set deadlines
10. Client: view proposals, provide feedback, select winner
11. Internal comments (private) vs client-visible comments
12. Basic compliance checklist per proposal
13. Dashboard for Leads & Clients (status, deadlines)
14. Email notifications for key events
15. Private communication channel between Client & Lead

### Nice-to-have (v1.1):

* Auto-matching system for Project Leaders
* AI assistance (auto-draft, rewrite, summarize, compliance check)
* Rich proposal templates and template manager
* Q&A (clarification) threads between client and bidding lead
* Enhanced notifications (email + in-app)
* Audit/logging and activity feed
* Scoring and ranking system for proposals

### Stretch features (v1.2+):

* Contract generation with e-signature integration
* Project execution: auto-generate tasks, milestones, Gantt charts
* Payment escrow system with milestone-based release
* Mutual ratings and reviews system
* Dispute center for Admin
* Rich comparison matrix with weighted criteria
* Budget/financial modelling and Excel/CSV exports
* Final proposal/document archiving system
* Integrations: Slack / MS Teams / Jira

---

## 4. Technology & infra (recommended)

**Frontend**: Next.js (TypeScript) + React + TailwindCSS — supports server-side rendering and good DX.
**State**: TanStack Query.
**Editor**: Rich text editor (TipTap or ProseMirror) for structured sections.
**Backend**: Next API routes + graphql.
**Database**: PostgreSQL + supabase.
**File Storage**: Supabase Storage.
**Cache & Jobs**: Redis + QStash (already in user context).
**AI**: OpenAI or local embeddings for assist features.
**Auth**: supabase auth.
**Observability**: Sentry + Prometheus + basic audit logs.

---
## 7. Frontend screens & key components

**Pages:**

* Dashboard (for each role, filters and KPIs).
* Projects list (filter by client, status).
* Project detail + proposals list (client-facing).
* Proposal workspace (section tree, editor, attachments pane, version history, diff view).
* Team management (invite members, roles).
* Q&A/Clarification thread.
* Templates & Compliance manager (admin).

**Core components:**

* `ProposalEditor` (TipTap + structured sections)
* `VersionTimeline` (list versions, restore button)
* `CompareModal` (side-by-side diff + highlights)
* `AssignmentCard` (who's doing which section)
* `ComplianceChecklist` (toggle and validation)
* `AI Assist` panel (prompts, suggestions, apply changes)

**UX considerations:**

* Section-level locking: when a user edits a section, soft-lock so others see “editing by X”.
* Autosave per section -> creates a draft version blob frequently, but version snapshots are explicit saves.
* Clear separation between internal (private) comments and client-visible comments.

---

## 8. Versioning & diff strategy

* Keep every explicit save as a `ProposalVersion` (incremental integer).
* For autosaves, store ephemeral drafts in Redis with `draft:{proposalId}:{userId}`; they do not create a version until the user clicks *save version*.
* Diff algorithm: store `contentJson` as an array of sections; diff at section-level using text diff (jsdiff) and render inline highlights.

---

## 9. AI Assistance integration

**Use-cases:** auto-draft a section from brief, rewrite selected text, generate executive summary, produce compliance suggestions.

**Architecture:**

1. Frontend sends `ai_jobs` request to backend with prompt + `section` context.
2. Backend queues job (Redis / QStash) and calls external AI (OpenAI) or internal model.
3. Result returned to user and optionally saved as a new version on acceptance.

**Safety/Moderation:** all AI outputs pass a lightweight filter (toxicity/legal checks) before showing to user.

---

## 10. Permissions matrix (quick)

* **Client**: create/edit own projects; view proposals for own project; give feedback; select winner.
* **Member**: read assigned projects/proposals; edit assigned sections; upload docs; see private comments for team only.
* **Lead**: full proposal edit; manage assignments; submit proposal; view analytics for their bids.
* **Admin**: full system access.

Enforce with middleware that checks `user.role` and resource-level relationships (e.g. project.clientId === user.id).

---

## 11. Notifications & workflows

**Events to notify about:** assignment created, deadline change, proposal submitted, comment added, client feedback, proposal accepted/rejected.
Send email for high-priority events and in-app toast + activity feed for everything else.

---

## 12. Security & compliance

* RBAC and resource-level authorization.
* File size limits & virus scanning on upload.
* Rate limiting & Redis-based anti-bruteforce for endpoints.
* Audit logging for all proposal actions and version restores.
* Data retention policy & GDPR considerations (export/delete user data).

---

## 13. Testing & QA

* Unit tests for backend services and DB layer (Prisma).
* Integration tests for API endpoints (supertest / Playwright).
* E2E tests for main flows (create project -> lead creates proposal -> submit -> client accepts).
* Load testing for document upload and versioning patterns.

---

## 14. Deployment & scaling

* Start with a single region Postgres (Supabase).
* Use CDN for static assets and files.
* Autoscaling for API workers; separate CPU-heavy AI workers.
* Background job processing (QStash or Redis + BullMQ) for AI/offline tasks.

---

## 15. Roadmap & milestones (suggested)

**Phase 1 (Week 0–2)**: 
* Project scaffolding, auth, core DB models
* User registration with role selection
* Projects CRUD, basic UI
* Admin approval workflow

**Phase 2 (Week 3–5)**: 
* Proposal workspace, editor, file uploads
* Team creation and assignments
* Real-time collaboration
* Private communication channels

**Phase 3 (Week 6–8)**: 
* Versioning, compare/restore
* Client review flows, dashboards
* Scoring and ranking system
* Email notifications

**Phase 4 (Week 9–11)**: 
* AI assist MVP (draft, compliance check)
* Compliance checklist
* Enhanced notifications
* Audit logging

**Phase 5 (Week 12–14)**:
* Auto-matching system
* Contract generation
* E-signature integration
* Ratings and reviews

**Phase 6 (Week 15+)**: 
* Project execution management (tasks, milestones, Gantt)
* Payment escrow system
* Dispute center
* Security hardening and polish

---

## 16. Acceptance criteria (example)

* Client can create a project and invite a bidding lead.
* Lead can create a proposal, add at least 3 versions and restore older version.
* Client can view proposals, provide feedback, and mark winner.
* System stores an audit trail for all proposal submissions and restores.

---

## 17. Deliverables I can produce for you next (pick one):

* Full Prisma schema + migration SQL.
* REST API controllers (TypeScript + Prisma) for Projects & Proposals.
* React components for Proposal workspace (editor + version timeline).
* Sequence diagrams and minimal Figma wireframes.
* CI/CD and deployment scripts (Docker + Render/Vercel).

---

If you'd like, I can immediately generate any of the deliverables above — tell me which and I will produce code, DB models or UI components next.

## System Flow — BidSync (Updated)

### 1. Client Flow

* Register/Login via Supabase Auth.
* Admin verifies client authenticity before they can post any project.
* Client creates **Project Opening** with:

  * Project concept
  * Rough scope/features
  * Budget range
  * Timeline
  * Required documents
* Client publishes project.
* Client can:

  * View all submitted proposals
  * Open proposal version history
  * Compare proposals side‑by‑side
  * Accept winning option
  * Reject proposals with structured feedback
  * Communicate through Q&A/Clarification section
  * Track project status after awarding

### 2. Bidding Lead Flow

* Views all verified project openings.
* Clicks **Submit Proposal** to start a bid.
* Creates a **Bidding Team Invite**:

  * Generates **join link** or **join code**
  * Members join and appear in bidding workspace
* Lead manages team:

  * Add/remove members
  * Assign sections (Technical / Financial / Compliance)
  * Set internal deadlines
* Lead manages proposal:

  * Create/edit proposal content
  * Upload documents
  * Run AI tools (draft, rewrite, summarize)
  * Generate proposal versions
  * Compare + restore versions
  * Run compliance checks
  * Submit final proposal to client
* Track bid performance via dashboard.

### 3. Bidding Member Flow

* Joins via invite link or code.
* Inside workspace:

  * View assigned tasks
  * Write/edit content for assigned sections
  * Upload supporting documents
  * View internal comments
  * Respond to lead’s feedback
  * See version history (read-only)
* Monitor submission progress and deadlines.

### 4. Content Coordinator (Admin) Flow

* Validate newly registered clients (identity / business docs).
* Manage all users and roles.
* Manage project openings (approve/flag/suspend).
* Configure system settings:

  * AI settings
  * Document storage
  * Compliance templates
* Full visibility into:

  * All proposals
  * All comments
  * All approvals
* Review submitted proposals (optional company workflow).
* Add structured feedback.
* Manage proposal templates and compliance checklists.
* Access platform-wide analytics and dashboards.

### 5. Core End‑to‑End Flow Summary

1. **User Registration → Role Selection**
2. **Client publishes project → System/AI initial check → Admin review**
3. **After approval → System auto-matches suitable Project Leaders**
4. **Project Leader creates proposal in Workspace → Realtime collaboration → Version history**
5. **Submit proposal (AI compliance check + email notification)**
6. **Client reviews proposals → Scoring / Ranking**
7. **Client decides winner → Generate Contract (with e-signature support)**
8. **Project starts → Auto-generate tasks, milestones, Gantt chart**
9. **Payment escrow / Milestone release**
10. **Client & Lead private communication area**
11. **Project delivery → Final proposal/document archiving**
12. **Mutual ratings**
13. **Admin can view audit log + dispute center**

---

## 6. Enhanced Feature Set (Based on Complete Flow)

### 6.1 Auto-Matching System
* After project approval, system automatically suggests suitable Project Leaders
* Matching based on:
  * Skills and expertise
  * Past performance ratings
  * Availability
  * Budget compatibility

### 6.2 Contract Generation & E-Signature
* Automatic contract generation when winner is selected
* Integration with e-signature providers (DocuSign, HelloSign)
* Contract templates managed by Admin
* Legal compliance validation

### 6.3 Project Execution Management
* Auto-generate tasks from accepted proposal
* Milestone tracking with payment release triggers
* Gantt chart visualization
* Progress tracking dashboard

### 6.4 Payment Escrow System
* Secure payment holding
* Milestone-based release
* Dispute resolution workflow
* Payment history and invoicing

### 6.5 Private Communication Channels
* Dedicated chat between Client and Lead
* Separate from public Q&A
* File sharing within chat
* Message history and search

### 6.6 Ratings & Reviews System
* Mutual rating after project completion
* Rating categories:
  * Communication
  * Quality of work
  * Timeliness
  * Professionalism
* Public profile display of ratings

### 6.7 Dispute Center (Admin)
* Dispute filing system
* Evidence submission
* Admin mediation tools
* Resolution tracking
* Refund/payment adjustment capabilities

### 6.8 Enhanced Audit System
* Complete activity logging
* Admin audit log viewer
* Compliance tracking
* Security event monitoring
* Export capabilities for legal/compliance

---

Additional sections (architecture diagrams, page lists, AI prompt spec) can be added on request.

## Functional Logic Architecture (Full System)

This section covers **end-to-end logic**, **data flow**, **component responsibilities**, and **cross-actor interactions** for BidSync. It is designed to support: Supabase Auth, Supabase SQL, GraphQL resolvers, TanStack Query, and Next.js App Router.

---

# 1. High-Level Logical Architecture

### **Core Domains**

1. **Authentication & Roles** — Managed entirely by Supabase Auth.
2. **Project Opening Management** — Client → Admin verification → Public listing.
3. **Bidding Workspace** — Lead + Members collaborating on proposals.
4. **Proposal Versioning** — Auto snapshots, manual versions, diff, restoration.
5. **Collaboration & Communication** — Internal comments & Client Q&A.
6. **Admin Oversight** — User verification, project approval, compliance, templates.
7. **AI Assistance Engine** — Drafting, rewriting, summarization, compliance scoring.
8. **Analytics Dashboard** — Bid performance, client activity, admin insights.

---

# 2. Actor-Centric Logic Architecture

## **2.1 Client Logic Flow**

```
Client registers → Admin verifies → Client can publish project
```

### After verification, Client can:

#### **(A) Create Project Opening**

* Fill in project concept, features, budget, timeline
* Upload reference docs
* Submit → Status = "pending_admin_review"

#### **(B) Wait for Admin Approval**

* Admin approves → Status = "published"

#### **(C) Manage Project**

* Edit / close project
* View all submitted proposals
* View proposal versions
* Compare proposals across versions/submissions
* Accept winning proposal → project_status = "awarded"
* Reject proposals with structured feedback

#### **(D) Communication Logic**

* Post clarification question
* Receive replies from bidding team

---

## **2.2 Bidding Lead Logic Flow**

### **(A) Discover & Start a Bid**

* View all published projects
* Click **Submit Proposal** → creates a new `bid` record
* Status begins as `draft`

### **(B) Team Creation Logic**

* Lead generates **invite link / code**
* Members join → Added to `bid_team_members`
* Lead assigns role & proposal sections

### **(C) Proposal Workspace Logic**

Lead can:

* Edit proposal content (per section)
* Upload documents
* Trigger AI assistance actions
* Set internal deadlines

### **(D) Versioning Logic**

* Manual versions: `Create Version`
* Auto versions when:

  * Big content change
  * File uploaded
  * Section approved by Lead
* Version comparison uses JSON diff + doc metadata comparison
* Lead can restore any version → workspace state updated

### **(E) Final Submission**

* Validate compliance checklists (technical/legal/financial)
* Submit proposal → status = "submitted"

---

## **2.3 Bidding Member Logic Flow**

### Member joins via link or code:

```
Join → Added to team → Assigned sections → Starts editing
```

Members can:

* Contribute proposal content
* Upload supporting docs
* Leave internal-only comments
* Respond to Lead feedback
* View version history (readonly)

Members cannot:

* Submit final proposal
* Restore versions
* Manage team

---

## **2.4 Admin Logic Flow**

### **(A) User & Client Verification**

* View pending client registrations
* Verify identity or business docs
* Approve → User gains `role = client`

### **(B) Project Approval**

* Review new project openings
* Approve / Reject / Request changes

### **(C) Oversight Capability**

Admin can view:

* Any proposal
* Any comment
* Any version
* Any user profile
* Any activity logs

### **(D) Template & Compliance Management**

Admin manages:

* Proposal templates
* Compliance checklist templates
* AI output guidelines

### **(E) Platform Analytics**

* Number of projects
* Number of bids
* Client activity
* Win rates
* Team participation

---

# 3. System Components & Logic Responsibilities

## **3.1 Authentication Module (Supabase Auth)**

* Stores `role`, `permissions`, `verified_status`
* `supabase.auth.getUser()` provides all Client/Admin/Lead roles
* Row Level Security ensures only related bids/projects accessible

---

## **3.2 Project Management Module**

### Responsibilities:

* Create/Edit/Close project
* Set visibility
* Store reference documents
* Admin approval lifecycle
* Q&A communication channel

### Internal Logic

1. Projects default to `pending_admin_review`
2. After approval → becomes visible in client marketplace
3. If Client closes → marked `closed`

---

## **3.3 Bidding Workspace Module**

This is the largest module.

### Responsibilities:

* Team creation
* Permission rules (Lead vs Member)
* Editor & content storage
* File uploads
* Auto-saving
* Versioning
* Internal-only comments
* AI assistance integration

### Internal Data Structures:

* `proposal_sections` (Technical, Executive Summary, Budget...)
* `proposal_content` stored as JSON
* `proposal_documents`
* `proposal_versions`
* `internal_comments`
* `client_comments`

### Versioning Logic:

* Snapshot of each section
* Snapshot of files
* Full metadata snapshot

---

# 4. Collaboration Logic

## **4.1 Internal Comments (Team Only)**

* Only visible to Bidding Lead + Members
* Attached to a proposal section or line range
* Stored separately from client comments

## **4.2 Client Clarification Comments**

* Visible to Client + Bidding Lead + Members
* Cannot be deleted once answered

---

# 5. AI Assistance Module

### Tasks performed by AI:

* Auto-draft proposal section based on project opening
* Rewrite for professionalism
* Auto-summary for executive summary
* Compliance scoring
* Risk identification
* Proposal improvement suggestions

### Trigger Points

* User clicks "AI Rewrite"
* User clicks "Generate Draft"
* System autosuggest improvements after inactivity

### Output Structure

```
{
  sectionId: string,
  action: "draft" | "rewrite" | "summary" | "compliance",
  content: string,
  metadata: {...}
}
```

---

# 6. Proposal Evaluation Logic

### For Clients:

* Compare 2–3 proposals
* Compare across versions
* Highlight differences
* View team information
* View compliance score
* View timeline & cost breakdown

### For Admin:

* Oversight for quality
* Approve technical/legal compliance

---

# 7. Analytics & Dashboard Logic

## **Client Dashboard**

* Number of active projects
* Proposal submissions
* Project progress tracking

## **Bidding Lead Dashboard**

* Bid success rate
* Team performance
* Section completion

## **Admin Dashboard**

* Platform health
* Growth charts
* Fraud detection signals
* Client verification status

---

# 8. Full End-to-End Logic Pipeline Summary

```
Client registers → Admin verifies → Client posts project → Project published

→ Bidding Lead browses → Creates bid → Forms team → Collaborates

→ Members contribute → Lead creates versions → Lead submits final

→ Client compares proposals → Selects winner → Awards project

→ Admin monitors everything
```

---

This is the finalized **complete functional + logical architecture** for BidSync.
