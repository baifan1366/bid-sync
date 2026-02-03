# Testing Guide: Proposal Detail Version History & Documents

## What Was Fixed

The proposal detail page now properly displays:
1. ✅ **Version history** for each section (from `document_versions` table)
2. ✅ **Documents/attachments** for each section (from `section_attachments` table)

## How to Test

### 1. Navigate to Proposal Detail Page

```
http://localhost:3000/client-projects/[projectId]/decision?proposal=[proposalId]
```

Replace `[projectId]` and `[proposalId]` with actual IDs from your database.

### 2. What You Should See

When you expand a section, you should now see **three areas**:

#### A. Section Content (existing)
- The main content of the section
- Rendered as HTML with beautiful markdown styling
- Yellow accent colors throughout

#### B. Attachments Section (NEW)
- Shows all files uploaded to that section
- Displays:
  - File name
  - File type and size
  - Uploader name
  - Upload date
  - Download button (yellow outline)
- Grid layout (2 columns on desktop)
- Yellow icons and borders

#### C. Version History Section (NEW)
- Shows the 3 most recent versions
- Each version displays:
  - Version number badge (yellow)
  - "Current" badge for latest version
  - "Rollback" badge if applicable
  - Change summary
  - Creator name and timestamp
  - "View" button to see full content
  - "Compare" button to compare with current version
- If more than 3 versions exist, shows "+ X more versions" message

### 3. Expected Server Logs

Check your terminal/console for these logs:

```
[proposalDetail] Section versions query: {
  section_id: 'e7b85539-e933-46f6-88ec-5365c05a635b',
  document_id: 'e98e27cd-9192-45e0-ab4c-8b3ca0d0c298',
  versions_count: 23,
  versions_error: null
}

[proposalDetail] Section attachments query: {
  section_id: 'e7b85539-e933-46f6-88ec-5365c05a635b',
  attachments_count: 5,
  attachments_error: null
}

[proposalDetail] Section mapping: {
  section_id: 'e7b85539-e933-46f6-88ec-5365c05a635b',
  document_id: 'e98e27cd-9192-45e0-ab4c-8b3ca0d0c298',
  content_type: 'object',
  converted_content: '<p>aaaaaaaaaaa...</p>',
  versions_count: 23,
  attachments_count: 5
}
```

### 4. Test Cases

#### Test Case 1: Section with Versions
- **Setup**: Section that has been edited multiple times
- **Expected**: Version History section appears with all versions listed
- **Verify**: 
  - Version numbers are correct
  - Creator names are displayed
  - Timestamps are formatted correctly
  - "Current" badge on latest version

#### Test Case 2: Section with Attachments
- **Setup**: Section with uploaded files
- **Expected**: Attachments section appears with all files listed
- **Verify**:
  - File names are correct
  - File sizes are displayed
  - Uploader names are shown
  - Download buttons work

#### Test Case 3: Section with No Versions/Attachments
- **Setup**: New section with no edits or uploads
- **Expected**: Only content area is shown
- **Verify**: No empty version/attachment sections appear

#### Test Case 4: View Version Dialog
- **Setup**: Click "View" button on any version
- **Expected**: Dialog opens showing version content
- **Verify**: Content is properly formatted

#### Test Case 5: Compare Versions Dialog
- **Setup**: Click "Compare" button on any non-current version
- **Expected**: Dialog opens showing diff between versions
- **Verify**: 
  - Added content highlighted in green
  - Removed content highlighted in red
  - Side-by-side comparison works

## Troubleshooting

### Issue: No versions showing
**Check**:
1. Does the section have a `document_id`?
2. Does `document_versions` table have entries for that `document_id`?
3. Check server logs for query errors

**SQL to verify**:
```sql
SELECT dv.* 
FROM document_versions dv
JOIN document_sections ds ON ds.document_id = dv.document_id
WHERE ds.id = '[section_id]'
ORDER BY dv.version_number DESC;
```

### Issue: No attachments showing
**Check**:
1. Does `section_attachments` table have entries for that `section_id`?
2. Check server logs for query errors

**SQL to verify**:
```sql
SELECT * 
FROM section_attachments
WHERE section_id = '[section_id]'
ORDER BY created_at DESC;
```

### Issue: TypeScript errors in IDE
**Solution**: 
- The state variables are properly defined
- Restart TypeScript server: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"
- Or restart your IDE

### Issue: GraphQL errors
**Check**:
1. Browser console for GraphQL errors
2. Network tab for failed requests
3. Server logs for resolver errors

## Database Schema Reference

### document_versions
```sql
- id: uuid
- document_id: uuid (FK to workspace_documents)
- version_number: integer
- content: jsonb (Tiptap JSON)
- created_by: uuid (FK to auth.users)
- changes_summary: text
- is_rollback: boolean
- rolled_back_from: uuid
- created_at: timestamp
- sections_snapshot: jsonb
- attachments_snapshot: jsonb
```

### section_attachments
```sql
- id: uuid
- section_id: uuid (FK to document_sections)
- document_id: uuid (FK to workspace_documents)
- file_name: text
- file_type: text
- file_size: bigint
- file_path: text
- uploaded_by: uuid (FK to auth.users)
- created_at: timestamp
```

## UI Design

All components follow BidSync design system:

### Colors
- Primary accent: `yellow-400` (#FBBF24)
- Borders: `border-yellow-400/20`
- Hover: `border-yellow-400/40`
- Icons: `text-yellow-400`

### Components
- **Badges**: Yellow background, black text
- **Buttons**: Yellow outline, hover to yellow fill
- **Cards**: Yellow border with hover effect
- **Icons**: Lucide React icons in yellow

### Layout
- Responsive grid (1 column mobile, 2 columns desktop)
- Consistent padding: `p-6`
- Proper spacing between sections
- Light/dark theme support

## Success Criteria

✅ Version history displays for all sections with edits
✅ Attachments display for all sections with uploads
✅ Download buttons work for all attachments
✅ View and Compare buttons work for versions
✅ UI follows BidSync design system
✅ No console errors
✅ No TypeScript errors
✅ Responsive on mobile and desktop
✅ Light and dark themes work correctly

## Files Modified

1. ✅ `lib/graphql/resolvers.ts` - Query versions and attachments per section
2. ✅ `lib/graphql/schema.ts` - Add fields to ProposalSection type
3. ✅ `lib/graphql/queries.ts` - Update GET_PROPOSAL_DETAILS query
4. ✅ `lib/graphql/types.ts` - Add DocumentVersion interface
5. ✅ `components/client/proposal-detail-view.tsx` - Render versions and attachments

## Next Steps

If everything works:
1. ✅ Mark task as complete
2. ✅ Update documentation
3. ✅ Consider adding pagination for versions (if > 10)
4. ✅ Consider adding filtering/sorting for attachments

If issues persist:
1. Check database data exists
2. Review server logs for errors
3. Check browser console for GraphQL errors
4. Verify RLS policies allow access to tables
