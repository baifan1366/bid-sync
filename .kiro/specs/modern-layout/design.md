# Design Document

## Overview

This design implements a modern, responsive navigation system for BidSync with a fixed header and collapsible sidebar. The design follows contemporary UI patterns with smooth animations, theme support, and mobile-first responsive behavior. The layout uses Next.js 14+ app router conventions with nested layouts to apply navigation only to authenticated routes.

## Architecture

### Component Hierarchy

```
RootLayout (app/layout.tsx)
├── Providers (theme, query client)
└── Children
    ├── AuthLayout (app/(auth)/layout.tsx) - No navigation
    └── AppLayout (app/(app)/layout.tsx) - With navigation
        ├── Header
        │   ├── Logo
        │   ├── NavigationTabs
        │   ├── NotificationBell
        │   └── UserMenu
        ├── Sidebar
        │   ├── NavigationItems
        │   └── UserProfile
        └── MainContent
```

### Route Structure Refactoring

To apply the layout consistently, we'll create a new route group:

```
app/
├── layout.tsx (root)
├── page.tsx (landing/home)
├── (auth)/
│   ├── login/
│   ├── register/
│   └── callback/
└── (app)/
    ├── layout.tsx (with Header + Sidebar)
    ├── dashboard/
    ├── projects/
    ├── workspace/
    ├── team/
    ├── profile/
    └── admin/
```

## Components and Interfaces

### 1. AppLayout Component

**Location:** `app/(app)/layout.tsx`

**Purpose:** Wraps all authenticated pages with Header and Sidebar

**Props:**
```typescript
interface AppLayoutProps {
  children: React.ReactNode;
}
```

**Structure:**
```tsx
<div className="flex h-screen overflow-hidden">
  <Sidebar />
  <div className="flex flex-1 flex-col">
    <Header />
    <main className="flex-1 overflow-y-auto">
      {children}
    </main>
  </div>
</div>
```

### 2. Header Component

**Location:** `components/layout/header.tsx`

**Purpose:** Top navigation bar with logo, tabs, notifications, and user menu

**Props:**
```typescript
interface HeaderProps {
  className?: string;
}
```

**Features:**
- Fixed positioning at top
- Horizontal navigation tabs with active state
- Notification bell with badge
- User avatar with dropdown menu
- Mobile hamburger menu toggle
- Theme toggle button

**Styling:**
- Height: 64px
- Background: `bg-card` with `border-b`
- Padding: `px-6`
- Flex layout with space-between

**Sub-components:**
- `HeaderLogo`: BidSync logo with icon
- `HeaderNav`: Horizontal tab navigation
- `HeaderActions`: Notifications, theme toggle, user menu

### 3. Sidebar Component

**Location:** `components/layout/sidebar.tsx`

**Purpose:** Left navigation panel with primary navigation links

**Props:**
```typescript
interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}
```

**Features:**
- Fixed positioning on left
- Collapsible on mobile (slide in/out)
- Active route highlighting
- Hover effects
- User profile section at bottom
- Smooth transitions

**Styling:**
- Width: 240px (desktop), 64px (collapsed), full overlay (mobile)
- Background: `bg-card` with `border-r`
- Padding: `p-4`

**Navigation Items:**
```typescript
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { label: 'Projects', href: '/projects', icon: FolderIcon },
  { label: 'Workspace', href: '/workspace', icon: BriefcaseIcon },
  { label: 'Team', href: '/team', icon: UsersIcon },
];
```

### 4. SidebarUserProfile Component

**Location:** `components/layout/sidebar-user-profile.tsx`

**Purpose:** Display user info at bottom of sidebar

**Props:**
```typescript
interface SidebarUserProfileProps {
  collapsed?: boolean;
}
```

**Features:**
- Avatar with user image
- User name and role
- "Active Session" status
- Sticky positioning at bottom

### 5. MobileNav Component

**Location:** `components/layout/mobile-nav.tsx`

**Purpose:** Mobile overlay navigation using Sheet component

**Props:**
```typescript
interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Features:**
- Uses existing `Sheet` component
- Full-screen overlay on mobile
- Same navigation items as Sidebar
- Slide-in animation from left

## Data Models

### User Context

```typescript
interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: 'admin' | 'client' | 'bidding_lead';
}
```

Uses existing `useUser` hook from `hooks/use-user.ts`

### Navigation State

```typescript
interface NavigationState {
  isSidebarOpen: boolean;
  activeRoute: string;
  notifications: Notification[];
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}
```

## Responsive Behavior

### Breakpoints

- **Mobile:** < 768px
  - Sidebar hidden by default
  - Hamburger menu in header
  - Full-screen overlay when opened
  
- **Tablet:** 768px - 1024px
  - Sidebar visible
  - Slightly reduced padding
  
- **Desktop:** > 1024px
  - Full sidebar with icons and labels
  - Maximum content width

### Mobile Interactions

1. User taps hamburger icon → Sidebar slides in from left
2. User taps outside sidebar → Sidebar closes
3. User taps navigation item → Navigate and close sidebar
4. User swipes left on sidebar → Sidebar closes

## Styling and Theming

### Color Scheme

Uses existing CSS custom properties from `globals.css`:

**Light Mode:**
- Header/Sidebar background: `bg-card` (white)
- Active item: `bg-primary` with `text-primary-foreground`
- Hover: `bg-accent`
- Border: `border-border`

**Dark Mode:**
- Header/Sidebar background: `bg-card` (dark gray)
- Active item: `bg-primary` (yellow)
- Hover: `bg-accent`
- Border: `border-border`

### Animations

```css
/* Sidebar slide-in */
.sidebar-enter {
  transform: translateX(-100%);
}
.sidebar-enter-active {
  transform: translateX(0);
  transition: transform 200ms ease-out;
}

/* Active item highlight */
.nav-item-active {
  transition: background-color 150ms ease-in-out;
}
```

### Icons

Use `lucide-react` icons (already in project):
- Home
- Folder
- Briefcase
- Users
- Bell
- Menu
- X (close)
- ChevronDown
- Sun/Moon (theme toggle)

## Error Handling

### No User Session

```typescript
if (!user && !loading) {
  redirect('/login');
}

if (loading) {
  return <LayoutSkeleton />;
}
```

### Navigation Errors

- Invalid routes → Show 404 page
- Failed user fetch → Show error toast and retry
- Network errors → Cache last known user state

## Testing Strategy

### Component Tests

1. **Header Component**
   - Renders logo and navigation tabs
   - Highlights active tab based on current route
   - Shows notification badge when notifications exist
   - Opens user menu on avatar click
   - Toggles mobile menu on hamburger click

2. **Sidebar Component**
   - Renders all navigation items
   - Highlights active route
   - Shows hover effects
   - Displays user profile at bottom
   - Collapses on mobile breakpoint

3. **Responsive Behavior**
   - Sidebar hidden on mobile by default
   - Hamburger menu visible on mobile
   - Sidebar overlay works on mobile
   - Layout adapts at breakpoints

### Integration Tests

1. **Navigation Flow**
   - Click sidebar item → Navigate to correct page
   - Active state updates on route change
   - Mobile menu closes after navigation

2. **Theme Switching**
   - Toggle theme → Colors update across layout
   - Theme persists across page navigation

3. **User Session**
   - Logged in user → Show user info in sidebar
   - No session → Redirect to login
   - Session expires → Redirect to login

### Accessibility Tests

1. Keyboard navigation works for all interactive elements
2. Focus indicators visible on all focusable elements
3. ARIA labels present for icon-only buttons
4. Color contrast meets WCAG AA standards
5. Screen reader announces navigation changes

## Implementation Notes

### Performance Considerations

1. **Code Splitting:** Layout components loaded once, cached across routes
2. **Memoization:** Use `React.memo` for Sidebar and Header to prevent unnecessary re-renders
3. **Lazy Loading:** User avatar images lazy loaded
4. **Optimistic UI:** Navigation state updates immediately, don't wait for route change

### Accessibility

1. **Semantic HTML:** Use `<nav>`, `<header>`, `<aside>` elements
2. **ARIA Labels:** Add labels to icon-only buttons
3. **Focus Management:** Trap focus in mobile menu when open
4. **Keyboard Shortcuts:** Support Cmd/Ctrl+K for search (future)

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid and Flexbox
- CSS Custom Properties
- No IE11 support needed

## Migration Strategy

Since we need to move existing routes into the new `(app)` group:

1. Create `app/(app)/layout.tsx` with Header + Sidebar
2. Move existing route folders into `(app)`:
   - `(admin)` → `(app)/admin`
   - `(client)` → `(app)/client`  
   - `(project)` → `(app)/project`
   - `profile` → `(app)/profile`
3. Update internal links to new paths (if needed)
4. Test all routes still work
5. Remove old route folders

## Future Enhancements

1. **Search Bar:** Global search in header (Cmd+K)
2. **Breadcrumbs:** Show current location hierarchy
3. **Favorites:** Pin frequently used pages
4. **Notifications Panel:** Dropdown with notification list
5. **User Settings:** Quick access to preferences
6. **Sidebar Resize:** Drag to resize sidebar width
7. **Multi-level Navigation:** Nested menu items with expand/collapse
