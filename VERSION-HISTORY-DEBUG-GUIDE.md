# Version History Debug Guide

## Debug Logs Added

This guide explains all the debug logs added to track version creation and display.

## Log Flow

### 1. Save Triggered (Frontend)

**Location**: `components/editor/collaborative-editor-page.tsx`

**Auto-save logs**:
```
[CollaborativeEditor] 💾 Auto-save triggered with updates: {...}
[CollaborativeEditor] ⏰ Auto-save timer fired, starting save...
[CollaborativeEditor] 📤 Calling updateDocumentMutation...
[CollaborativeEditor] ✅ Document saved successfully: {...}
[CollaborativeEditor] ❌ Failed to save document: {...}
```

**Manual save logs**:
```
[CollaborativeEditor] 🖱️ Manual save triggered
[CollaborativeEditor] 📤 Calling updateDocumentMutation with content...
[CollaborativeEditor] ✅ Manual save successful: {...}
[CollaborativeEditor] ❌ Manual save failed: {...}
```

### 2. Document Update (Backend)

**Location**: `lib/document-service.ts`

```
[updateDocument] 📝 Creating version history entry...
[updateDocument] Version creation input: {
  documentId: string,
  userId: string,
  contentLength: number
}
[updateDocument] 📊 Version creation result: {
  success: boolean,
  error?: string,
  versionId?: string,
  versionNumber?: number
}
[updateDocument] ✅ Version created successfully!
[updateDocument] ⚠️ Version creation failed but continuing: {...}
[updateDocument] ❌ Exception during version creation: {...}
```

### 3. Version Creation (Backend)

**Location**: `lib/version-control-service.ts`

```
[VersionControlService] 🚀 createVersion called with: {
  documentId: string,
  userId: string,
  hasContent: boolean,
  changesSummary?: string
}
[VersionControlService] ✅ Input validated
[VersionControlService] 🔑 Admin client created
[VersionControlService] 🔍 Checking permissions...
[VersionControlService] 🔐 Permission check result: boolean
[VersionControlService] ❌ Insufficient permissions
[VersionControlService] 📝 Changes summary: string
[VersionControlService] 🔄 Attempt X/3 to create version...
[VersionControlService] 🔢 Next version number: number
[VersionControlService] 💾 Inserting version into database...
[VersionControlService] 📊 Insert result: {
  hasVersion: boolean,
  versionId?: string,
  versionNumber?: number,
  error?: any
}
[VersionControlService] ⚠️ Race condition detected, retrying...
[VersionControlService] ✅ Version created successfully!
[VersionControlService] ❌ Error on attempt X: {...}
[VersionControlService] 💥 Failed to create version after retries
[VersionControlService] 💥 No version created after retries
[VersionControlService] 👤 Fetching user details...
[VersionControlService] 👤 User name: string
[VersionControlService] 🎉 Version creation complete: {
  id: string,
  versionNumber: number,
  createdBy: string
}
[VersionControlService] ❌ Validation error: [...]
[VersionControlService] ❌ Unexpected error in createVersion: {...}
```

### 4. Version History Display (Frontend)

**Location**: `components/editor/version-history-sidebar.tsx`

```
[VersionHistorySidebar] 📊 Version history loaded: {
  count: number,
  versions: [{
    id: string,
    number: number,
    createdAt: string
  }]
}
[VersionHistorySidebar] ❌ Failed to load version history: {...}
[VersionHistorySidebar] 🔄 State updated: {
  hasData: boolean,
  versionCount: number,
  isLoading: boolean,
  hasError: boolean,
  documentId: string,
  sectionId?: string,
  sectionTitle?: string
}
```

## How to Debug

### Step 1: Check if Save is Triggered
Look for:
```
[CollaborativeEditor] 💾 Auto-save triggered
```
or
```
[CollaborativeEditor] 🖱️ Manual save triggered
```

**If not present**: Save is not being triggered. Check editor state and permissions.

### Step 2: Check if Document Update Succeeds
Look for:
```
[CollaborativeEditor] ✅ Document saved successfully
```

**If error**: Check the error message. Common issues:
- Network error
- Permission denied
- Invalid data

### Step 3: Check if Version Creation is Attempted
Look for:
```
[updateDocument] 📝 Creating version history entry...
```

**If not present**: Document update succeeded but version creation wasn't attempted. Check document-service.ts logic.

### Step 4: Check Version Creation Process
Look for:
```
[VersionControlService] 🚀 createVersion called with: {...}
```

**Key checkpoints**:
1. ✅ Input validated
2. 🔐 Permission check result: true
3. 🔢 Next version number: X
4. 💾 Inserting version into database...
5. ✅ Version created successfully!

**Common failures**:
- ❌ Insufficient permissions → Check user permissions
- ❌ Failed to get next version number → Check database function
- ⚠️ Race condition detected → Normal, should retry
- 💥 Failed after retries → Database issue

### Step 5: Check if Version History Refreshes
Look for:
```
[VersionHistorySidebar] 📊 Version history loaded: {
  count: X,
  versions: [...]
}
```

**If count doesn't increase**: 
- Check if query invalidation is working
- Check if version was actually created in database
- Check GraphQL resolver

### Step 6: Check Section Filtering
Look for:
```
[VersionHistorySidebar] 🔄 State updated: {
  ...
  sectionId: "xxx",
  sectionTitle: "xxx"
}
```

**If filtering not working**:
- Check if sectionId is being passed correctly
- Check if versions have sectionsSnapshot data
- Check filtering logic

## Common Issues and Solutions

### Issue 1: No versions showing after save
**Symptoms**: Save succeeds but version history is empty

**Debug steps**:
1. Check if `[VersionControlService] 🎉 Version creation complete` appears
2. Check if `[VersionHistorySidebar] 📊 Version history loaded` shows count > 0
3. Check database directly: `SELECT * FROM document_versions WHERE document_id = 'xxx'`

**Solutions**:
- If version created but not showing: Check GraphQL resolver
- If version not created: Check permissions and database function
- If query not refreshing: Check query invalidation

### Issue 2: Version created but sidebar doesn't refresh
**Symptoms**: Version appears in database but not in UI

**Debug steps**:
1. Check if `updateDocumentMutation` invalidates `['versionHistory', documentId]`
2. Check if sidebar is open when save happens
3. Check if `[VersionHistorySidebar] 🔄 State updated` shows new count

**Solutions**:
- Ensure mutation invalidation includes version history query key
- Check if React Query is configured correctly
- Try manual refetch

### Issue 3: Permission denied
**Symptoms**: `[VersionControlService] ❌ Insufficient permissions`

**Debug steps**:
1. Check user ID in logs
2. Check document permissions in database
3. Check RLS policies

**Solutions**:
- Verify user has editor or owner role
- Check `has_document_permission` function
- Verify RLS policies allow version creation

### Issue 4: Race condition failures
**Symptoms**: Multiple `⚠️ Race condition detected` followed by failure

**Debug steps**:
1. Check if retries are happening
2. Check if `get_next_version_number` function is working
3. Check database locks

**Solutions**:
- Usually resolves with retries
- If persistent, check database function implementation
- Verify unique constraint on (document_id, version_number)

## Database Queries for Debugging

### Check if versions exist
```sql
SELECT 
  id,
  version_number,
  created_at,
  created_by,
  changes_summary
FROM document_versions
WHERE document_id = 'YOUR_DOCUMENT_ID'
ORDER BY version_number DESC;
```

### Check version with sections and attachments
```sql
SELECT 
  id,
  version_number,
  jsonb_array_length(COALESCE(sections_snapshot, '[]'::jsonb)) as section_count,
  jsonb_array_length(COALESCE(attachments_snapshot, '[]'::jsonb)) as attachment_count,
  created_at
FROM document_versions
WHERE document_id = 'YOUR_DOCUMENT_ID'
ORDER BY version_number DESC;
```

### Check permissions
```sql
SELECT has_document_permission(
  'YOUR_DOCUMENT_ID'::uuid,
  'YOUR_USER_ID'::uuid,
  'editor'
);
```

### Check next version number
```sql
SELECT get_next_version_number('YOUR_DOCUMENT_ID'::uuid);
```

## Log Symbols Reference

- 🚀 Start of operation
- ✅ Success
- ❌ Error/Failure
- ⚠️ Warning (non-fatal)
- 💾 Save/Write operation
- 📤 Sending data
- 📊 Data received
- 🔄 Update/Refresh
- 🔍 Checking/Searching
- 🔐 Permission check
- 🔑 Authentication
- 🔢 Number/Count
- 👤 User information
- 📝 Creating/Writing
- 💥 Critical failure
- ⏰ Timer/Scheduled
- 🖱️ User action
- 🎉 Complete success

## Tips

1. **Filter logs**: Use browser console filter with `[VersionControlService]` or `[CollaborativeEditor]`
2. **Check timestamps**: Ensure logs appear in correct order
3. **Compare IDs**: Verify document IDs match across logs
4. **Check network tab**: Look for GraphQL mutations and queries
5. **Use React DevTools**: Check query cache state
