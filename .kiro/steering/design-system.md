---
title: BidSync Design System & Style Guide
inclusion: always
---

# BidSync Design System & Style Guide

## Color Palette

### Primary Colors
- **Yellow Accent**: `yellow-400` (#FBBF24) - Primary highlight color
- **Black**: `black` - Primary dark color
- **White**: `white` - Primary light color

### Theme-Specific Colors

#### Light Mode
- Background: White (`bg-white`)
- Text: Black (`text-black`)
- Accent: Yellow 400 (`bg-yellow-400`, `text-yellow-400`)
- Borders: Yellow with opacity (`border-yellow-400/20`)

#### Dark Mode
- Background: Black (`dark:bg-black`)
- Text: White (`dark:text-white`)
- Accent: Yellow 400 (`dark:bg-yellow-400`, `dark:text-yellow-400`)
- Borders: Yellow with opacity (`dark:border-yellow-400/20`)

## Component Styling Guidelines

### Buttons
- **Primary Button**: `bg-yellow-400 hover:bg-yellow-500 text-black`
- **Ghost Button**: `hover:bg-yellow-400/10`
- **Outline Button**: `border-yellow-400 text-yellow-400 hover:bg-yellow-400/10`

### Cards
- Border: `border-yellow-400/20`
- Hover: `hover:border-yellow-400/40`
- Background: Use default card background with theme support

### Badges
- Primary: `bg-yellow-400 text-black hover:bg-yellow-500`
- Use yellow accent for important status indicators

### Headers
- Background: `bg-white dark:bg-black`
- Border: `border-yellow-400/20`
- Logo background: `bg-yellow-400`

### Hero Sections
- Background: `bg-white dark:bg-black`
- Title text: `text-black dark:text-white`
- Highlight text: `bg-yellow-400 text-black px-2`

## Typography

### Headings
- Use bold font weights
- Black text in light mode, white in dark mode
- Yellow highlights for emphasis

### Body Text
- Light mode: `text-gray-700` or `text-black`
- Dark mode: `text-gray-300` or `text-white`
- Muted text: `text-muted-foreground`

## Layout Principles

### Spacing
- Use consistent padding: `p-4 sm:p-6`
- Container max-width: `max-w-[1800px]`
- Grid gaps: `gap-4 sm:gap-6`

### Responsive Design
- Mobile-first approach
- Breakpoints: `sm:`, `md:`, `lg:`
- Grid layouts: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

## Icons
- Use Lucide React icons
- Yellow accent for important icons: `text-yellow-400`
- Muted for secondary icons: `text-muted-foreground`

## Interactive Elements

### Hover States
- Cards: `hover:shadow-lg hover:scale-[1.02]`
- Buttons: Darken yellow (`hover:bg-yellow-500`)
- Links: `hover:text-yellow-400`

### Focus States
- Use yellow outline: `focus-visible:outline-yellow-400`

## Language
- **Primary Language**: English
- Use clear, professional terminology
- Button labels: "Sign in", "Employer site", "SEEK"

## Accessibility
- Maintain proper contrast ratios
- Use semantic HTML
- Include ARIA labels where needed
- Support keyboard navigation

## Design Inspiration
- Reference: JobStreet design patterns
- Clean, professional marketplace aesthetic
- Emphasis on readability and usability

## Component Patterns

### Search Components
- Label structure: "What" / "Where"
- Yellow "SEEK" button
- White/dark card background
- Border with yellow accent

### Project Cards
- Yellow border on hover
- Budget displayed in yellow
- Status badges in yellow
- Clear hierarchy with proper spacing

### Navigation
- Role-based navigation items
- Yellow accent on active states
- Clean, minimal design

## Notes
- Always maintain theme consistency (light/dark)
- Yellow is the signature color - use it strategically
- Keep designs clean and professional
- Prioritize user experience and readability
