# Workspace Features - Lead Proposal Management

## Overview
The Workspace is a dedicated area for **Bidding Leads** to manage their proposals for client projects.

## Access
- **URL**: `/workspace?proposal={proposalId}`
- **Role Required**: `bidding_lead`

## Features Implemented

### 1. Proposal List (Left Sidebar)
- View all your proposals in one place
- See proposal status with color-coded badges:
  - **Draft** (Gray) - Still editing
  - **Submitted** (Blue) - Waiting for review
  - **Under Review** (Yellow) - Client is reviewing
  - **Accepted** (Green) - Congratulations!
  - **Rejected** (Red) - Not selected
- Quick view of budget estimates
- Click to select and edit/view

### 2. Proposal Editor (Main Area)
When a proposal is in **Draft** status, you can:

#### Basic Information
- **Proposal Title** - Give your proposal a descriptive name
- **Proposal Content** - Detailed description of your approach and methodology
- **Budget Estimate** - Your estimated cost (in dollars)
- **Timeline Estimate** - How long it will take (e.g., "2-3 weeks")

#### Additional Information Requirements
If the client has requested specific information, you'll see custom fields:
- **Text fields** - Short text answers
- **Textarea** - Long-form responses
- **Number fields** - Numeric values
- **Date fields** - Date selection
- **Select dropdowns** - Choose from predefined options
- **File uploads** - Attach documents

Each field shows:
- ✅ **Required** badge (red) - Must be filled
- **Optional** badge (gray) - Can be skipped
- Field type indicator
- Help text from the client

#### Actions
- **Save Draft** - Save your progress without submitting
- **Submit Proposal** - Submit to the client (validates all required fields)

### 3. View Mode Toggle
For draft proposals, switch between:
- **Edit Mode** - Full editor with all fields
- **Preview Mode** - See how your proposal looks to the client

### 4. Read-Only View
For submitted/reviewed proposals:
- View your submitted content
- See all provided information
- Check project requirements
- Cannot edit (proposal is locked)

## User Flow

### Creating a New Proposal
1. Go to **Lead Dashboard** (`/lead-dashboard`)
2. Browse open projects
3. Click **"Submit Proposal"** on a project
4. Automatically redirected to Workspace with new draft proposal

### Editing a Proposal
1. Select proposal from the left sidebar
2. Fill in all required fields (marked with red "Required" badge)
3. Click **"Save Draft"** to save progress
4. Click **"Submit Proposal"** when ready

### After Submission
1. Proposal status changes to "Submitted"
2. Cannot edit anymore
3. Wait for client decision
4. Status will update to "Accepted" or "Rejected"

## Design System Compliance

### Colors
- **Yellow Accent** (`yellow-400`) - Primary actions, highlights
- **Black/White** - Text and backgrounds (theme-aware)
- **Status Colors**:
  - Draft: Gray
  - Submitted: Blue
  - Under Review: Yellow
  - Accepted: Green
  - Rejected: Red

### Components
- Cards with yellow borders (`border-yellow-400/20`)
- Yellow hover effects (`hover:border-yellow-400/40`)
- Primary buttons: Yellow background (`bg-yellow-400`)
- Outline buttons: Yellow border
- Responsive grid layout
- Mobile-friendly design

## Technical Details

### GraphQL Queries
- `GET_LEAD_PROPOSALS` - Fetch all proposals for current lead
- `UPDATE_PROPOSAL` - Save proposal changes
- `SUBMIT_PROPOSAL` - Submit proposal to client

### State Management
- URL-based proposal selection (`?proposal={id}`)
- Local form state with React hooks
- Optimistic UI updates

### Validation
- Required field checking before submission
- Type-specific validation (numbers, dates, etc.)
- User-friendly error messages

## Next Steps (Future Enhancements)
- [ ] Real-time collaboration with team members
- [ ] File upload functionality
- [ ] Rich text editor for proposal content
- [ ] Proposal templates
- [ ] Version history
- [ ] Comments/feedback from clients
- [ ] Notification system for status changes
