# Member Attachment Access Implementation

## Overview
Implemented functionality to allow team members to view and download section attachments, with proper permission controls and improved UI.

## Changes Made

### 1. Component Updates (`components/editor/section-attachment-panel.tsx`)

#### Added `canUpload` Prop
- New optional prop `canUpload?: boolean` to control upload button visibility
- Defaults to `true` (RLS policies handle actual permission enforcement)
- Upload area only renders when `canUpload` is true

#### Improved UI/UX
- **Clickable File Names**: File names are now clickable buttons that trigger download
- **Prominent Download Button**: Large, yellow-outlined "Download" button with icon and text
- **Clear Delete Button**: Red "Delete" button (only visible to uploader/lead)
- **Vertical Button Layout**: Buttons stacked vertically for better visibility
- **Hover Effects**: File names change to yellow on hover
- **Tooltips**: Added title attributes for accessibility

#### Button Visibility
```
All Users (including members):
  ✅ Download button (yellow outline)
  ✅ Clickable file name

Owner/Lead/Uploader only:
  ✅ Delete button (red)
```

#### Permission Logic
- **View & Download**: All team members (viewers, commenters, editors, owners, proposal team members)
- **Upload**: Document editors/owners and proposal team members (controlled by RLS)
- **Delete**: Only uploader, document owner, or proposal lead

### 2. Service Updates (`lib/section-attachment-service.ts`)

#### Simplified Permission Checks
- Removed client-side permission validation for upload
- Removed client-side permission validation for delete
- Added comments explaining RLS policy enforcement
- All permissions now handled by database RLS policies

#### Benefits
- Single source of truth (database RLS)
- Consistent permission enforcement
- Reduced code complexity
- Better security (can't bypass client-side checks)

### 3. Database RLS Policies (`db/migrations/029_fix_section_attachments_rls.sql`)

Already in place - no changes needed:

#### SELECT Policy (`section_attachments_team_select`)
Allows viewing by:
- Document collaborators (any role)
- Proposal team members (any role)

#### INSERT Policy (`section_attachments_team_insert`)
Allows uploading by:
- Document collaborators with editor/owner role
- Proposal team members (any role)

#### DELETE Policy (`section_attachments_team_delete`)
Allows deletion by:
- Attachment uploader (own files)
- Document owner
- Proposal lead

### 4. Parent Component Updates

#### `collaborative-editor-page.tsx`
```tsx
<SectionAttachmentPanel
  sectionId={activeSection}
  documentId={documentId}
  currentUserId={user.id}
  isLead={isLead}
  canUpload={canEdit} // Based on document collaborator role
  onClose={...}
/>
```

#### `section-tabs-editor.tsx`
```tsx
<SectionAttachmentPanel
  sectionId={section.id}
  documentId={documentId}
  currentUserId={currentUserId}
  isLead={isLead}
  canUpload={canUpload} // Passed from parent, defaults to true
  onClose={...}
/>
```

## UI Improvements

### Before
- Small icon-only download button (hard to see)
- Download button hidden in dropdown menu
- Not obvious that files are downloadable

### After
- **Large "Download" button** with yellow outline (brand color)
- **Clickable file names** that turn yellow on hover
- **Clear visual hierarchy** with vertical button layout
- **Separate Delete button** (red) for authorized users
- **Better accessibility** with tooltips and clear labels

### Visual Layout
```
┌─────────────────────────────────────────────┐
│ [Icon] File Name (clickable)                │
│        194.29 KB • pavra                    │
│        2/3/2026, 4:28:58 PM                 │
│                                             │
│                          [Download] ← Yellow│
│                          [Delete]   ← Red   │
└─────────────────────────────────────────────┘
```

## User Experience

### For Members (Viewers/Commenters)
✅ Can view all attachments in their sections
✅ Can download any attachment via:
  - Clicking the file name
  - Clicking the "Download" button
❌ Cannot upload new attachments (no upload button shown)
❌ Cannot delete attachments (no delete button shown)

### For Editors
✅ Can view all attachments
✅ Can download any attachment
✅ Can upload new attachments (upload button visible)
✅ Can delete their own attachments
❌ Cannot delete others' attachments (unless owner/lead)

### For Owners/Leads
✅ Can view all attachments
✅ Can download any attachment
✅ Can upload new attachments
✅ Can delete any attachment

## Security

All permissions are enforced at the database level through RLS policies:
- Client-side checks only control UI visibility
- Server-side RLS policies prevent unauthorized actions
- No way to bypass permissions through API manipulation

## Design System Compliance

All changes follow the BidSync design system:
- **Yellow accent** (`yellow-400`) for primary actions (Download button)
- **Red** for destructive actions (Delete button)
- **Hover states** with yellow highlight
- **Consistent spacing** and padding
- **Clear visual hierarchy**
- **Accessible** with proper contrast and tooltips

## Testing Checklist

- [ ] Member can view attachments in assigned sections
- [ ] Member can download attachments by clicking file name
- [ ] Member can download attachments by clicking Download button
- [ ] Member cannot see upload button (if viewer/commenter)
- [ ] Member cannot see delete button
- [ ] Editor can upload attachments
- [ ] Editor can delete own attachments
- [ ] Editor cannot delete others' attachments
- [ ] Lead can delete any attachment
- [ ] RLS policies block unauthorized upload attempts
- [ ] RLS policies block unauthorized delete attempts
- [ ] Download button is clearly visible with yellow outline
- [ ] File names change color on hover
- [ ] Buttons have proper tooltips

## Notes

- The `canUpload` prop provides UI-level control
- RLS policies provide security-level control
- This dual-layer approach improves UX while maintaining security
- All team members benefit from transparent file sharing
- Improved UI makes download functionality obvious and accessible

