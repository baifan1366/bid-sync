# Implementation Plan: Client Projects Dashboard

- [x] 1. Set up GraphQL queries and mutations





  - Create new GraphQL query for fetching projects by client ID with all required fields
  - Create GraphQL mutation for creating new projects with validation
  - Add queries to `lib/graphql/queries.ts` and mutations to `lib/graphql/mutations.ts`
  - _Requirements: 1.1, 1.2, 2.1, 6.3_

- [x] 2. Create utility functions and helpers









  - [x] 2.1 Implement date formatting and deadline calculation utilities

    - Write function to calculate days until deadline
    - Write function to determine if deadline is overdue
    - Write function to format dates for display
    - Add to `lib/utils.ts`
    - _Requirements: 4.1, 4.2_
  
  - [x] 2.2 Implement budget formatting utility


    - Write function to format currency values
    - Handle null/undefined budget values
    - Add to `lib/utils.ts`
    - _Requirements: 1.3, 2.2_
  

  - [x] 2.3 Implement statistics calculation functions

    - Write function to calculate project counts by status
    - Write function to calculate total budget
    - Write function to extract and count categories
    - Add to `lib/utils.ts` or create `lib/project-utils.ts`
    - _Requirements: 1.1, 1.2, 1.3, 5.3_

- [x] 3. Create skeleton loading components





  - [x] 3.1 Create StatCardSkeleton component


    - Use shadcn/ui Skeleton component
    - Match dimensions of actual StatCard
    - Support theme-aware styling
    - Create file `components/client/stat-card-skeleton.tsx`
    - _Requirements: 1.4, 1.5_
  

  - [x] 3.2 Create ProjectCardSkeleton component

    - Use shadcn/ui Skeleton component
    - Match layout of actual ProjectCard
    - Support theme-aware styling
    - Create file `components/client/project-card-skeleton.tsx`
    - _Requirements: 2.3, 2.5_
  
  - [x] 3.3 Create AlertCardSkeleton component


    - Use shadcn/ui Skeleton component
    - Match dimensions of deadline alert cards
    - Support theme-aware styling
    - Create file `components/client/alert-card-skeleton.tsx`
    - _Requirements: 4.4_
  
  - [x] 3.4 Create CategorySkeleton component


    - Use shadcn/ui Skeleton component
    - Match badge dimensions
    - Support theme-aware styling
    - Create file `components/client/category-skeleton.tsx`
    - _Requirements: 5.2, 5.4_

- [x] 4. Implement ProjectStatistics component






  - [x] 4.1 Create StatCard sub-component

    - Display icon, label, and value
    - Support theme-aware colors
    - Make responsive
    - Create file `components/client/stat-card.tsx`
    - _Requirements: 1.5_
  

  - [x] 4.2 Create ProjectStatistics container component

    - Accept projects array and loading state as props
    - Calculate statistics using utility functions
    - Render StatCard components in responsive grid
    - Show StatCardSkeleton when loading
    - Support theme-aware styling
    - Create file `components/client/project-statistics.tsx`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5. Implement ProjectCard component





  - Create ProjectCard component with all project information
  - Display title, description (truncated), status badge, budget, deadline
  - Add deadline indicator (warning/danger icons)
  - Implement hover effects
  - Support theme-aware styling for all elements
  - Handle null/undefined values gracefully
  - Create file `components/client/project-card.tsx`
  - _Requirements: 2.2, 2.4, 2.5, 2.6, 4.1, 4.2, 4.4, 4.5_

- [x] 6. Implement filter and sort controls





  - [x] 6.1 Create FilterControls component


    - Use shadcn/ui Select component
    - Provide options for all project statuses plus "All"
    - Accept value and onChange props
    - Support theme-aware styling
    - Create file `components/client/filter-controls.tsx`
    - _Requirements: 3.1, 3.3, 3.5_
  
  - [x] 6.2 Create SortControls component


    - Use shadcn/ui Select for sort field
    - Use shadcn/ui Button for sort order toggle
    - Provide options for created_at, deadline, budget
    - Accept sortBy, sortOrder, and onChange props
    - Support theme-aware styling
    - Create file `components/client/sort-controls.tsx`
    - _Requirements: 3.2, 3.4, 3.6_


- [x] 7. Implement DeadlineAlerts component




  - Filter projects with deadlines within 7 days or overdue
  - Sort by deadline (soonest first)
  - Display in compact alert card format
  - Use warning colors for upcoming, danger colors for overdue
  - Show AlertCardSkeleton when loading
  - Support theme-aware styling
  - Create file `components/client/deadline-alerts.tsx`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
-

- [x] 8. Implement TrendingCategories component




  - Extract keywords from project titles and descriptions
  - Count frequency of each keyword
  - Display top 5 categories with counts
  - Use shadcn/ui Badge component
  - Show CategorySkeleton when loading
  - Support theme-aware styling
  - Create file `components/client/trending-categories.tsx`
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 9. Implement CreateProjectDialog component



  - [ ] 9.1 Create form schema and validation
    - Define Zod schema for project creation
    - Include validation for title, description, budget, deadline
    - Ensure deadline is in the future
    - Add to component file or separate schema file
    - _Requirements: 6.5_
  
  - [ ] 9.2 Create CreateProjectDialog component
    - Use shadcn/ui Dialog component
    - Implement form with React Hook Form
    - Add form fields: title, description, budget, deadline
    - Implement form submission with GraphQL mutation
    - Handle loading state with disabled form and spinner
    - Display validation errors inline
    - Show success toast on successful creation
    - Display error message on failure
    - Close dialog and refresh project list on success
    - Support theme-aware styling
    - Create file `components/client/create-project-dialog.tsx`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
-

- [ ] 10. Implement main ClientProjectsDashboard component









  - [x] 10.1 Set up data fetching and state management




    - Use useUser hook to get authenticated client
    - Use useGraphQLQuery to fetch projects by client_id
    - Set up local state for filters, sorts, and dialog visibility
    - Implement filter logic to filter projects by status
    - Implement sort logic to sort projects by selected field and order
    - Calculate deadline alerts from filtered projects
    - _Requirements: 2.1, 3.3, 3.4_
  -


  - [x] 10.2 Create responsive layout structure



    - Implement responsive grid for statistics (1/2/4 columns)
    - Implement responsive grid for projects (1/2/3 columns)
    - Create controls section with filters, sorts, and create button
    - Position DeadlineAlerts and TrendingCategories sections
    - Support theme-aware styling throughout
    - Create file `app/(app)/(client)/projects/client-dashboard.tsx`
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 10.3 Wire up all child components


    - Render ProjectStatistics with calculated statistics
    - Render FilterControls and SortControls with state handlers
    - Render CreateProjectDialog with open state
    - Render DeadlineAlerts with filtered projects
    - Render TrendingCategories with all projects
    - Render ProjectCard components in grid with filtered and sorted projects
    - Pass loading states to all components

    - _Requirements: 1.1, 2.1, 3.1, 4.3, 5.1, 6.1_

- [x] 11. Create page entry point






  - Create server component page that renders ClientProjectsDashboard
  - Add proper metadata for SEO
  - Create file `app/(app)/(client)/projects/page.tsx`
  - _Requirements: 2.1_

- [x] 12. Implement responsive behavior




  - Test and adjust breakpoints for mobile, tablet, desktop
  - Ensure all components stack properly on mobile
  - Verify grid layouts adjust correctly at each breakpoint
  - Test dialog responsiveness on mobile devices
  - Ensure controls remain accessible on small screens
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
-

- [ ] 13. Verify theme support across all components



  - Test all components in light mode
  - Test all components in dark mode
  - Verify color contrast meets accessibility standards
  - Ensure smooth theme transitions
  - Verify skeleton loaders adapt to theme
  - _Requirements: 1.5, 2.5, 3.5, 3.6, 4.4, 5.4, 6.6, 8.1, 8.2, 8.3, 8.4, 8.5_
