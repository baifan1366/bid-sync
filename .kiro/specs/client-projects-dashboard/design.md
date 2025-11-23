# Design Document: Client Projects Dashboard

## Overview

The Client Projects Dashboard is a comprehensive interface for clients to view, manage, and create projects within the BidSync application. The page features a modern, responsive design with statistics widgets, filterable project listings, deadline alerts, trending categories, and a create project dialog. The implementation leverages Next.js 14 App Router, React Query for data fetching, GraphQL for API communication, and shadcn/ui components with full theme support.

## Architecture

### Component Hierarchy

```
ClientProjectsPage (Server Component)
└── ClientProjectsDashboard (Client Component)
    ├── ProjectStatistics
    │   ├── StatCard (Total Projects)
    │   ├── StatCard (By Status)
    │   ├── StatCard (Total Budget)
    │   └── StatCardSkeleton (Loading State)
    ├── DashboardControls
    │   ├── CreateProjectButton → CreateProjectDialog
    │   ├── FilterControls
    │   └── SortControls
    ├── DeadlineAlerts
    │   ├── AlertCard (Upcoming)
    │   ├── AlertCard (Overdue)
    │   └── AlertCardSkeleton (Loading State)
    ├── TrendingCategories
    │   ├── CategoryBadge
    │   └── CategorySkeleton (Loading State)
    └── ProjectGrid
        ├── ProjectCard
        └── ProjectCardSkeleton (Loading State)
```

### Data Flow

1. **Authentication**: Use `useUser()` hook to get authenticated client
2. **Data Fetching**: Use `useGraphQLQuery()` to fetch projects filtered by client_id
3. **State Management**: React Query handles caching, loading, and error states
4. **Mutations**: Use `useGraphQLMutation()` for creating projects with automatic cache invalidation
5. **Local State**: React useState for filters, sorts, and dialog visibility

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **UI Components**: shadcn/ui (Button, Card, Dialog, Badge, Select, Input, Textarea, Skeleton)
- **Styling**: Tailwind CSS with theme variables
- **Data Fetching**: React Query + GraphQL (via graphql-request)
- **Forms**: React Hook Form + Zod validation
- **Theme**: next-themes for dark/light mode
- **Icons**: Lucide React

## Components and Interfaces

### 1. ClientProjectsPage (Server Component)

**Purpose**: Entry point for the projects page route

**File**: `app/(app)/(client)/projects/page.tsx`

```typescript
export default function ClientProjectsPage() {
  return <ClientProjectsDashboard />
}
```

### 2. ClientProjectsDashboard (Client Component)

**Purpose**: Main dashboard container with data fetching and state management

**File**: `app/(app)/(client)/projects/client-dashboard.tsx`

**State**:
- `filterStatus`: ProjectStatus | 'all'
- `sortBy`: 'created_at' | 'deadline' | 'budget'
- `sortOrder`: 'asc' | 'desc'
- `isCreateDialogOpen`: boolean

**Data Fetching**:
```typescript
const { user } = useUser()
const { data, isLoading } = useGraphQLQuery<{ projects: Project[] }>(
  ['projects', user?.id],
  LIST_PROJECTS_BY_CLIENT,
  { client_id: user?.id }
)
```

**Computed Values**:
- `filteredProjects`: Apply status filter
- `sortedProjects`: Apply sorting
- `statistics`: Calculate project counts by status, total budget
- `deadlineAlerts`: Filter projects with deadlines within 7 days or overdue
- `trendingCategories`: Extract and count categories from project descriptions/titles

**Layout**: Grid layout with responsive breakpoints
- Mobile: Single column
- Tablet: 2 columns for stats, 1 column for projects
- Desktop: 4 columns for stats, 2-3 columns for projects

### 3. ProjectStatistics Component

**Purpose**: Display aggregate statistics about client's projects

**File**: `components/client/project-statistics.tsx`

**Props**:
```typescript
interface ProjectStatisticsProps {
  projects: Project[]
  isLoading: boolean
}
```

**Statistics Displayed**:
1. Total Projects (count)
2. Open Projects (count)
3. Closed Projects (count)
4. Total Budget (sum with currency formatting)

**Implementation**:
- Use `Card` component from shadcn/ui
- Display icon, label, and value
- Show `StatCardSkeleton` when loading
- Use theme-aware colors (primary, secondary, accent)

### 4. ProjectCard Component

**Purpose**: Display individual project information

**File**: `components/client/project-card.tsx`

**Props**:
```typescript
interface ProjectCardProps {
  project: Project
}
```

**Content**:
- Title (truncated if too long)
- Description (truncated to 2-3 lines)
- Status badge with color coding
- Budget (formatted currency or "Budget not set")
- Deadline (formatted date or "No deadline")
- Deadline indicator (warning icon if within 7 days, danger if overdue)
- Created date

**Interactions**:
- Click to navigate to project detail page
- Hover effect for better UX

**Theme Support**:
- Card background: `bg-card`
- Text: `text-card-foreground`
- Border: `border-border`
- Status badges: Use appropriate color variants

### 5. CreateProjectDialog Component

**Purpose**: Modal form for creating new projects

**File**: `components/client/create-project-dialog.tsx`

**Props**:
```typescript
interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

**Form Fields**:
1. Title (required, max 200 chars)
2. Description (required, max 2000 chars)
3. Budget (optional, number, min 0)
4. Deadline (optional, date, must be future date)

**Validation Schema** (Zod):
```typescript
const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  budget: z.number().min(0).optional(),
  deadline: z.string().optional().refine(
    (date) => !date || new Date(date) > new Date(),
    "Deadline must be in the future"
  ),
})
```

**Mutation**:
```typescript
const createProject = useGraphQLMutation<CreateProjectResponse, CreateProjectData>(
  CREATE_PROJECT,
  [['projects', user?.id]]
)
```

**Behavior**:
- On success: Close dialog, show success toast, refresh project list
- On error: Display error message in dialog
- Loading state: Disable form and show loading spinner on submit button

### 6. FilterControls Component

**Purpose**: Allow filtering projects by status

**File**: `components/client/filter-controls.tsx`

**Props**:
```typescript
interface FilterControlsProps {
  value: ProjectStatus | 'all'
  onChange: (value: ProjectStatus | 'all') => void
}
```

**Implementation**:
- Use `Select` component from shadcn/ui
- Options: All, Pending Review, Open, Closed, Awarded
- Display count for each status in parentheses

### 7. SortControls Component

**Purpose**: Allow sorting projects by different attributes

**File**: `components/client/sort-controls.tsx`

**Props**:
```typescript
interface SortControlsProps {
  sortBy: 'created_at' | 'deadline' | 'budget'
  sortOrder: 'asc' | 'desc'
  onSortByChange: (value: 'created_at' | 'deadline' | 'budget') => void
  onSortOrderChange: (value: 'asc' | 'desc') => void
}
```

**Implementation**:
- Use `Select` for sort field
- Use `Button` with icon for sort order toggle
- Options: Created Date, Deadline, Budget

### 8. DeadlineAlerts Component

**Purpose**: Display projects with upcoming or overdue deadlines

**File**: `components/client/deadline-alerts.tsx`

**Props**:
```typescript
interface DeadlineAlertsProps {
  projects: Project[]
  isLoading: boolean
}
```

**Logic**:
- Filter projects with deadlines within 7 days or overdue
- Sort by deadline (soonest first)
- Display in compact card format
- Use warning colors for upcoming, danger colors for overdue

### 9. TrendingCategories Component

**Purpose**: Display popular project categories

**File**: `components/client/trending-categories.tsx`

**Props**:
```typescript
interface TrendingCategoriesProps {
  projects: Project[]
  isLoading: boolean
}
```

**Logic**:
- Extract keywords from project titles/descriptions
- Count frequency of each keyword
- Display top 5 categories with counts
- Use `Badge` component for visual representation

**Note**: For MVP, we can use simple keyword extraction. Future enhancement could use ML/NLP.

### 10. Skeleton Components

**Purpose**: Provide loading states for all components

**Files**: 
- `components/client/stat-card-skeleton.tsx`
- `components/client/project-card-skeleton.tsx`
- `components/client/alert-card-skeleton.tsx`
- `components/client/category-skeleton.tsx`

**Implementation**:
- Use `Skeleton` component from shadcn/ui
- Match dimensions and layout of actual components
- Animate with pulse effect
- Theme-aware background colors

## Data Models

### Project Type (Extended)

```typescript
interface Project {
  id: string
  client_id: string
  title: string
  description: string
  status: ProjectStatus
  budget: number | null
  deadline: string | null
  created_at: string
  updated_at: string
}

type ProjectStatus = 'pending_review' | 'open' | 'closed' | 'awarded'
```

### Statistics Type

```typescript
interface ProjectStatistics {
  total: number
  byStatus: {
    pending_review: number
    open: number
    closed: number
    awarded: number
  }
  totalBudget: number
}
```

### Deadline Alert Type

```typescript
interface DeadlineAlert {
  project: Project
  daysUntilDeadline: number
  isOverdue: boolean
}
```

### Category Type

```typescript
interface Category {
  name: string
  count: number
}
```

## GraphQL Queries and Mutations

### Query: LIST_PROJECTS_BY_CLIENT

```graphql
query ListProjectsByClient($client_id: UUID!) {
  projects(
    where: { client_id: { _eq: $client_id } }
    order_by: { created_at: desc }
  ) {
    id
    title
    description
    status
    budget
    deadline
    created_at
    updated_at
  }
}
```

### Mutation: CREATE_PROJECT

```graphql
mutation CreateProject(
  $title: String!
  $description: String!
  $budget: numeric
  $deadline: date
  $client_id: UUID!
) {
  insert_projects_one(
    object: {
      title: $title
      description: $description
      budget: $budget
      deadline: $deadline
      client_id: $client_id
      status: open
    }
  ) {
    id
    title
    description
    status
    budget
    deadline
    created_at
    updated_at
  }
}
```

## Error Handling

### Data Fetching Errors

- Display error message in place of content
- Provide retry button
- Log errors to console for debugging

### Mutation Errors

- Display error toast notification
- Keep dialog open with error message
- Preserve form data for retry

### Authentication Errors

- Redirect to login page if user not authenticated
- Display appropriate error message

### Validation Errors

- Display inline error messages on form fields
- Prevent form submission until valid
- Use Zod error messages

## Testing Strategy

### Unit Tests

1. **Utility Functions**:
   - Date formatting and deadline calculation
   - Budget formatting
   - Category extraction logic
   - Filter and sort functions

2. **Component Logic**:
   - Statistics calculation
   - Deadline alert filtering
   - Category counting

### Integration Tests

1. **Data Fetching**:
   - Mock GraphQL responses
   - Test loading states
   - Test error states
   - Test successful data display

2. **User Interactions**:
   - Filter application
   - Sort application
   - Dialog open/close
   - Form submission

3. **Theme Switching**:
   - Verify components render correctly in light mode
   - Verify components render correctly in dark mode

### E2E Tests (Optional)

1. Complete user flow: View dashboard → Filter projects → Create new project
2. Deadline alert functionality
3. Responsive behavior on different screen sizes

## Theme Implementation

### Color Mapping

**Light Mode**:
- Background: `bg-background` (white/gray-50)
- Card: `bg-card` (white)
- Text: `text-foreground` (gray-900)
- Muted: `text-muted-foreground` (gray-500)
- Border: `border-border` (gray-200)

**Dark Mode**:
- Background: `bg-background` (gray-950)
- Card: `bg-card` (gray-900)
- Text: `text-foreground` (gray-50)
- Muted: `text-muted-foreground` (gray-400)
- Border: `border-border` (gray-800)

### Status Colors

- Pending Review: `bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`
- Open: `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`
- Closed: `bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200`
- Awarded: `bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`

### Deadline Alert Colors

- Upcoming (< 7 days): `bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200`
- Overdue: `bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`

## Responsive Design

### Breakpoints

- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (sm to lg)
- Desktop: > 1024px (lg+)

### Layout Adjustments

**Mobile**:
- Single column layout
- Stack all sections vertically
- Full-width cards
- Simplified statistics (2 columns)
- Collapsible filters

**Tablet**:
- 2-column statistics grid
- 2-column project grid
- Side-by-side filters and sort

**Desktop**:
- 4-column statistics grid
- 3-column project grid
- Horizontal layout for controls
- Sidebar for filters (optional enhancement)

## Performance Considerations

1. **Data Fetching**:
   - Use React Query caching (60s stale time)
   - Implement pagination for large project lists (future enhancement)
   - Prefetch on hover for project details

2. **Rendering**:
   - Memoize expensive calculations (statistics, filtering, sorting)
   - Use React.memo for ProjectCard components
   - Virtualize project list if > 50 items (future enhancement)

3. **Bundle Size**:
   - Tree-shake unused shadcn/ui components
   - Lazy load CreateProjectDialog
   - Optimize icon imports from lucide-react

## Accessibility

1. **Keyboard Navigation**:
   - All interactive elements focusable
   - Logical tab order
   - Dialog trap focus

2. **Screen Readers**:
   - Semantic HTML elements
   - ARIA labels for icons
   - Status announcements for loading/errors

3. **Visual**:
   - Sufficient color contrast (WCAG AA)
   - Focus indicators
   - Text alternatives for visual information

## Future Enhancements

1. **Advanced Filtering**: Multiple filters, date range, budget range
2. **Search**: Full-text search across project titles and descriptions
3. **Bulk Actions**: Select multiple projects for batch operations
4. **Export**: Download project list as CSV/PDF
5. **Analytics**: Charts and graphs for project trends
6. **Notifications**: Real-time updates for project changes
7. **Drag and Drop**: Reorder projects or change status via drag
8. **Project Templates**: Quick create from predefined templates
