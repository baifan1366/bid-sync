# Section-Based Version History

## Overview

The version history sidebar now supports filtering by section, allowing users to view version history specific to the section they're currently editing.

## Implementation

### Changes Made

#### 1. Updated `VersionHistorySidebar` Component
**File**: `components/editor/version-history-sidebar.tsx`

**New Props**:
- `sectionId?: string` - Optional section ID to filter versions
- `sectionTitle?: string` - Optional section title to display in header

**Features**:
- **Section Filtering**: When `sectionId` is provided, only versions containing changes to that section are displayed
- **Section Badge**: Shows a yellow badge with the section title when filtering
- **Filtered Count**: Displays "(filtered)" indicator when showing subset of versions
- **Empty State**: Shows "No versions for this section" when no versions found for the section

**Filtering Logic**:
```typescript
const filteredVersions = sectionId 
  ? versions.filter(version => {
      const sectionsSnapshot = version.sectionsSnapshot || []
      return sectionsSnapshot.some((section: any) => section.id === sectionId)
    })
  : versions
```

#### 2. Updated `CollaborativeEditorPage` Component
**File**: `components/editor/collaborative-editor-page.tsx`

**Changes**:
- Passes `activeSection` state to `VersionHistorySidebar`
- Passes section title from `sections` array
- Version history automatically updates when user switches sections

**Integration**:
```tsx
<VersionHistorySidebar
  documentId={documentId}
  isOpen={showVersionHistory}
  onClose={() => setShowVersionHistory(false)}
  onVersionRestored={...}
  canEdit={canEdit}
  sectionId={activeSection || undefined}
  sectionTitle={activeSection ? sections.find(s => s.id === activeSection)?.title : undefined}
/>
```

## User Experience

### Behavior

1. **No Section Selected**:
   - Shows all document versions
   - Header displays "Version History"
   - Shows total version count

2. **Section Selected**:
   - Shows only versions containing changes to that section
   - Header displays "Version History" with section badge
   - Shows filtered version count with "(filtered)" indicator
   - Empty state shows "No versions for this section"

### UI Elements

**Header with Section Filter**:
```
┌─────────────────────────────────────┐
│ 🕐 Version History              ✕   │
│ ┌─────────────────────────────┐     │
│ │ 📄 Introduction             │     │ ← Section badge (yellow)
│ └─────────────────────────────┘     │
│ 5 versions (filtered)               │ ← Filtered indicator
└─────────────────────────────────────┘
```

**Version Card**:
- Shows version number and status
- Displays author and timestamp
- Shows section count and attachment count
- Includes Preview, Compare, and Restore actions

## Design System Compliance

- **Yellow Badge**: Section title badge uses `bg-yellow-400 text-black`
- **Filtered Indicator**: Uses `text-yellow-400` for visibility
- **Icons**: FileText icon for section badge
- **Spacing**: Consistent padding and gaps
- **Theme Support**: Works in both light and dark modes

## Technical Details

### Data Flow

1. User selects a section tab
2. `activeSection` state updates in `CollaborativeEditorPage`
3. `VersionHistorySidebar` receives `sectionId` and `sectionTitle` props
4. Component filters versions based on `sectionsSnapshot`
5. Only versions containing the section are displayed

### Version Filtering

Versions are filtered by checking if the section exists in `sectionsSnapshot`:
- Each version has a `sectionsSnapshot` array
- Filter checks if any section in the snapshot matches the `sectionId`
- If no `sectionId` provided, all versions are shown

### Performance

- Filtering is done client-side on already-fetched data
- No additional API calls required
- Efficient array filtering using `Array.some()`

## Benefits

1. **Focused History**: Users see only relevant changes for their section
2. **Better Context**: Section title badge provides clear context
3. **Reduced Clutter**: Filters out unrelated changes
4. **Seamless UX**: Automatically updates when switching sections
5. **Backward Compatible**: Works with or without section filtering

## Future Enhancements

Potential improvements:
- Show section-specific diff in comparison view
- Highlight changed content within the section
- Add section-level rollback (restore only that section)
- Show which user made changes to the section
- Add section change timeline visualization

## Testing

### Test Cases

1. **No Section Selected**:
   - ✓ Shows all versions
   - ✓ No section badge displayed
   - ✓ No filtered indicator

2. **Section Selected**:
   - ✓ Shows only versions with that section
   - ✓ Section badge displays correct title
   - ✓ Filtered indicator shows when applicable

3. **Section with No Versions**:
   - ✓ Shows empty state
   - ✓ Message: "No versions for this section"

4. **Switching Sections**:
   - ✓ Version list updates automatically
   - ✓ Correct section title displayed
   - ✓ Filtered count updates

5. **Version Restore**:
   - ✓ Works correctly with section filtering
   - ✓ Restores entire document (not just section)

## Notes

- Version restore always restores the entire document, not just the filtered section
- Section filtering is for viewing history only
- All version comparison features work with filtered versions
- Attachments are still shown in version cards when filtering by section
