# Admin Panel Routes

## Overview

The admin panel has been restructured to use separate page routes instead of tabs. Each section is now accessible via its own URL.

## Route Structure

```
/admin-dashboard          → Main dashboard with navigation cards
├── /overview            → Admin & user management
├── /analytics           → Platform analytics and insights
├── /admin-projects      → Project approval queue
├── /admin-proposals     → Proposal oversight
├── /verifications       → Team verification queue
├── /templates           → Template management
└── /admin-settings      → System settings
```

## Pages

### Main Dashboard (`/admin-dashboard`)
- Landing page with navigation cards
- Quick access to all admin sections
- Visual overview of available features

### Overview (`/overview`)
- Admin management section
- User management section
- Previously the "Overview" tab

### Analytics (`/analytics`)
- Platform performance metrics
- User activity monitoring
- Analytics dashboard

### Projects (`/admin-projects`)
- Project approval queue
- Review and approve client projects
- Previously at `/admin-dashboard/projects`

### Proposals (`/admin-proposals`)
- View all proposals across the platform
- Filter by status (draft, submitted, under review, accepted, rejected)
- Search by title, team, or project
- View full proposal details
- Access to internal comments and history
- Uses GraphQL API for efficient data fetching

### Verifications (`/verifications`)
- Team verification queue
- Credential verification
- Approval workflow

### Templates (`/templates`)
- Project template management
- Requirement templates
- Template configuration

### Settings (`/admin-settings`)
- System configuration
- Email settings
- Notification settings
- Security settings
- Previously at `/admin-dashboard/settings`

## Navigation

Admin navigation is integrated into the main header (`components/layout/header-nav.tsx`). When an admin user is logged in, they see:
- An "ADMIN" badge with Shield icon
- Full navigation menu with all admin sections
- Horizontal scrolling on smaller screens
- Active page highlighting with yellow accent

## Layout Structure

All admin pages use the standard `(app)` layout which includes:
- Main header with navigation
- User actions (theme toggle, notifications, user menu)
- Responsive design with max-width container
- Consistent padding and spacing

Admin pages only contain their content (no duplicate headers or layouts).

## Design Consistency

All admin pages follow the same design pattern:
- Yellow accent color scheme (#FBBF24)
- Consistent page header with icon and title
- Descriptive subtitle text
- Content area with proper spacing
- Dark mode support
- Responsive design (mobile-first)
