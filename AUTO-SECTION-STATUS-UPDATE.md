# Auto Section Status Update Feature

## Overview
Automatically updates section status from "not started" to "in progress" when a user begins editing the section content.

## Implementation

### Location
`components/editor/collaborative-editor-page.tsx`

### How It Works

1. **Trigger**: When user types in the editor, the `onUpdate` callback is fired
2. **Check**: System checks if current section status is "not_started"
3. **Update**: If yes, automatically updates status to "in_progress"
4. **UI Update**: Section tab badge updates to show new status

### Code Flow

```typescript
// Editor initialization with onUpdate callback
const editor = useTipTapEditor({
  onUpdate: (content) => {
    updateSectionStatusOnEdit()  // ← Auto-update status
    handleAutoSave({ content })
    collaboration.broadcastUpdate(content)
  },
})

// Auto-update function
const updateSectionStatusOnEdit = useCallback(async () => {
  if (!activeSection || !user?.id) return

  const currentSection = sections.find(s => s.id === activeSection)
  if (!currentSection) return

  // Only update if status is 'not_started'
  if (currentSection.status === 'not_started') {
    try {
      const supabase = createClient()
      
      // Update in database
      const { error } = await supabase
        .from('document_sections')
        .update({ status: 'in_progress' })
        .eq('id', activeSection)

      if (!error) {
        // Update local state
        setSections(prevSections =>
          prevSections.map(s =>
            s.id === activeSection ? { ...s, status: 'in_progress' } : s
          )
        )
      }
    } catch (err) {
      console.error('Error updating section status:', err)
    }
  }
}, [activeSection, sections, user?.id])
```

## Status Flow

```
not_started → in_progress → in_review → completed
     ↑            ↑             ↑           ↑
  (initial)   (auto-update)  (manual)   (manual)
```

### Status Transitions

1. **not_started → in_progress**: ✅ Automatic (when user starts typing)
2. **in_progress → in_review**: Manual (lead/member marks for review)
3. **in_review → completed**: Manual (lead approves)
4. **Any → not_started**: Manual (reset if needed)

## Visual Indicators

### Status Badge Colors

- **not_started**: Gray (`bg-gray-500/20 text-gray-500`)
- **in_progress**: Blue (`bg-blue-500/20 text-blue-500`) ← Auto-updated
- **in_review**: Yellow (`bg-yellow-400/20 text-yellow-400`)
- **completed**: Green (`bg-green-500/20 text-green-500`)

### Tab Display

```
Before typing:
┌─────────────────────────────┐
│ Executive Summary           │
│ not started                 │  ← Gray badge
└─────────────────────────────┘

After typing:
┌─────────────────────────────┐
│ Executive Summary           │
│ in progress                 │  ← Blue badge (auto-updated)
└─────────────────────────────┘
```

## Benefits

1. **Automatic Tracking**: No need to manually update status when starting work
2. **Real-time Updates**: Status changes immediately when typing begins
3. **Team Visibility**: Other team members see when someone starts working
4. **Progress Monitoring**: Leads can see which sections are being worked on
5. **Better UX**: One less manual step for users

## Edge Cases Handled

1. **Multiple Edits**: Only updates once (checks if already "in_progress")
2. **No Active Section**: Safely returns if no section is selected
3. **No User**: Safely returns if user is not authenticated
4. **Database Errors**: Catches and logs errors without breaking UI
5. **Concurrent Edits**: Database update is atomic

## Database Schema

```sql
-- document_sections table
CREATE TABLE document_sections (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES workspace_documents(id),
  title TEXT NOT NULL,
  content JSONB,
  status TEXT DEFAULT 'not_started',
  -- Options: 'not_started', 'in_progress', 'in_review', 'completed'
  assigned_to UUID REFERENCES users(id),
  order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Future Enhancements

### Possible Additions

1. **Auto-complete Detection**: Mark as "completed" when section meets criteria
2. **Idle Detection**: Revert to "not_started" if no edits for X days
3. **Status History**: Track all status changes with timestamps
4. **Notifications**: Notify assigned user when status changes
5. **Analytics**: Track time spent in each status

### Manual Status Updates

Users can still manually change status through:
- Status dropdown menu (if implemented)
- Section settings dialog
- Bulk status updates (for leads)

## Testing Checklist

- [ ] Status updates from "not_started" to "in_progress" on first edit
- [ ] Status does NOT update if already "in_progress"
- [ ] Status does NOT update if "in_review" or "completed"
- [ ] UI badge updates immediately after status change
- [ ] Other collaborators see status change in real-time
- [ ] Works for both assigned and unassigned sections
- [ ] No errors when switching between sections
- [ ] Database update succeeds
- [ ] Local state updates correctly

## Notes

- This feature only handles the "not_started" → "in_progress" transition
- Other status transitions require manual action
- Status updates are per-section, not per-document
- Changes are saved to database immediately
- No undo functionality (can manually change back if needed)
