# Version Control Attachments Implementation Summary

## ✅ Completed Changes

### Phase 1: Database Migration ✅

**File**: `db/migrations/047_add_attachments_snapshot_to_versions.sql`

**Changes**:
- Added `attachments_snapshot` JSONB column to `proposal_versions` table
- Created GIN index for faster queries
- Added verification queries
- Included rollback instructions

**To Apply**:
```bash
# Run the migration
psql -d your_database < db/migrations/047_add_attachments_snapshot_to_versions.sql
```

### Phase 2: Backend Service Updates ✅

**File**: `lib/version-service.ts`

**Changes Made**:

#### 1. Updated `ProposalVersion` Interface
```typescript
export interface ProposalVersion {
  // ... existing fields
  attachmentsSnapshot: any[];  // ← NEW
}
```

#### 2. Updated `VersionComparison` Interface
```typescript
export interface VersionComparison {
  diff: {
    // ... existing fields
    attachmentsAdded: any[];     // ← NEW
    attachmentsRemoved: any[];   // ← NEW
  };
}
```

#### 3. Enhanced `createVersion()` Method
- ✅ Captures section attachments snapshot
- ✅ Includes file metadata (name, path, type, size, description)
- ✅ Handles cases where sections have no attachments
- ✅ Doesn't fail if attachment capture fails (logs error)

**Code Added**:
```typescript
// Capture section attachments snapshot
let attachments: any[] = [];
if (sections && sections.length > 0) {
  const sectionIds = sections.map((s: any) => s.id);
  const { data: attachmentsData, error: attachmentsError } = await supabase
    .from('section_attachments')
    .select(`
      id, section_id, document_id, uploaded_by,
      file_name, file_path, file_type, file_size,
      description, created_at
    `)
    .in('section_id', sectionIds);
  
  if (!attachmentsError) {
    attachments = attachmentsData || [];
  }
}
```

#### 4. Enhanced `getVersionHistory()` Method
- ✅ Retrieves `attachments_snapshot` from database
- ✅ Defaults to empty array for old versions without attachments

#### 5. Enhanced `getVersion()` Method
- ✅ Retrieves `attachments_snapshot` for specific version
- ✅ Defaults to empty array if not present

#### 6. Enhanced `compareVersions()` Method
- ✅ Compares attachments between versions
- ✅ Identifies added attachments
- ✅ Identifies removed attachments
- ✅ Returns attachment changes in diff

**Code Added**:
```typescript
// Compare attachments
const oldAttachments = oldVersion.attachmentsSnapshot || [];
const newAttachments = newVersion.attachmentsSnapshot || [];

const oldAttachmentIds = new Set(oldAttachments.map((a: any) => a.id));
const newAttachmentIds = new Set(newAttachments.map((a: any) => a.id));

const attachmentsAdded = newAttachments.filter((a: any) => !oldAttachmentIds.has(a.id));
const attachmentsRemoved = oldAttachments.filter((a: any) => !newAttachmentIds.has(a.id));
```

#### 7. Enhanced `restoreVersion()` Method
- ✅ Restores section attachments when rolling back
- ✅ Maps old section IDs to new section IDs
- ✅ Recreates attachments with correct section references
- ✅ Handles missing attachments gracefully

**Code Added**:
```typescript
// Map old section IDs to new section IDs
const sectionIdMap = new Map<string, string>();
versionToRestore.sectionsSnapshot.forEach((oldSection: any, index: number) => {
  if (restoredSections[index]) {
    sectionIdMap.set(oldSection.id, restoredSections[index].id);
  }
});

// Restore attachments with new section IDs
const attachmentsToRestore = (versionToRestore.attachmentsSnapshot || [])
  .map((a: any) => {
    const newSectionId = sectionIdMap.get(a.section_id);
    if (!newSectionId) return null;
    
    return {
      section_id: newSectionId,
      document_id: document.id,
      uploaded_by: a.uploaded_by,
      file_name: a.file_name,
      file_path: a.file_path,
      file_type: a.file_type,
      file_size: a.file_size,
      description: a.description,
    };
  })
  .filter((a: any) => a !== null);
```

#### 8. Enhanced `getLatestVersion()` Method
- ✅ Retrieves `attachments_snapshot` for latest version
- ✅ Defaults to empty array if not present

## ✅ Phase 3: UI Updates - COMPLETE

**File Updated**: `components/editor/version-history-sidebar.tsx`

**Changes Implemented**:

1. ✅ **Added Icons**:
   - `Paperclip` icon for attachments
   - `FileText` icon for sections

2. ✅ **Updated Interface**:
   ```typescript
   interface DocumentVersion {
     // ... existing fields
     sectionsSnapshot?: any[];
     attachmentsSnapshot?: any[];
   }
   ```

3. ✅ **Content Statistics in Version Cards**:
   - Shows section count with FileText icon
   - Shows attachment count with Paperclip icon (yellow highlight)
   - Only displays when sections/attachments exist
   ```tsx
   {(version.sectionsSnapshot || version.attachmentsSnapshot) && (
     <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
       {version.sectionsSnapshot && version.sectionsSnapshot.length > 0 && (
         <div className="flex items-center gap-1">
           <FileText className="h-3 w-3" />
           <span>{version.sectionsSnapshot.length} sections</span>
         </div>
       )}
       {version.attachmentsSnapshot && version.attachmentsSnapshot.length > 0 && (
         <div className="flex items-center gap-1">
           <Paperclip className="h-3 w-3 text-yellow-400" />
           <span className="text-yellow-400">{version.attachmentsSnapshot.length} attachments</span>
         </div>
       )}
     </div>
   )}
   ```

4. ✅ **Attachment Changes in Comparison View**:
   - Shows "Attachment Changes" section with yellow badge
   - Lists added attachments with green badges and backgrounds
   - Lists removed attachments with red badges and backgrounds
   - Displays file name, size, and type for each attachment
   - Uses `formatFileSize()` helper function for readable file sizes
   - Only shows when there are attachment changes between versions
   ```tsx
   {(() => {
     const v1Attachments = compareVersions.version1?.attachmentsSnapshot || []
     const v2Attachments = compareVersions.version2?.attachmentsSnapshot || []
     
     const addedAttachments = v2Attachments.filter(
       (a2: any) => !v1Attachments.some((a1: any) => a1.id === a2.id)
     )
     const removedAttachments = v1Attachments.filter(
       (a1: any) => !v2Attachments.some((a2: any) => a2.id === a1.id)
     )
     
     const hasChanges = addedAttachments.length > 0 || removedAttachments.length > 0
     
     if (!hasChanges) return null
     
     // ... render attachment changes
   })()}
   ```

**UI Features**:
- Attachment count badge appears in yellow in version cards
- Comparison view shows added/removed attachments before side-by-side content
- Green background for added attachments
- Red background with strikethrough for removed attachments
- File metadata (size, type) displayed for each attachment
- Follows BidSync design system (yellow-400 accent, black/white contrast)

## 🔄 Next Steps (Phase 4)

### Phase 4: Testing (Not Yet Implemented)

**Test Cases Needed**:
- [ ] Version creation with attachments
- [ ] Version creation without attachments
- [ ] Version rollback with attachments
- [ ] Version rollback without attachments
- [ ] Version comparison showing attachment changes
- [ ] Handling of deleted files in storage
- [ ] Large number of attachments (performance)
- [ ] Concurrent version creation

## 📊 Data Flow

### Version Creation Flow
```
1. User saves proposal
2. System captures:
   - Proposal content
   - Sections snapshot
   - Documents snapshot
   - Attachments snapshot ← NEW
3. Creates version record with all snapshots
4. Returns version with attachment count
```

### Version Rollback Flow
```
1. User selects version to restore
2. System retrieves version with attachments
3. Restores:
   - Proposal content
   - Sections (with new IDs)
   - Attachments (mapped to new section IDs) ← NEW
4. Creates new version marking the rollback
5. Notifies collaborators
```

### Version Comparison Flow
```
1. User selects two versions
2. System compares:
   - Content changes
   - Section changes
   - Document changes
   - Attachment changes ← NEW
3. Returns diff with:
   - Attachments added
   - Attachments removed
4. UI displays changes with file metadata
```

## 🔒 Important Notes

### File Storage Considerations
- **Metadata Only**: We store attachment metadata in versions, not actual files
- **File References**: Attachments reference files in Supabase Storage
- **Deleted Files**: If a file is deleted from storage, rollback will restore metadata but file may be missing
- **Storage Path**: Files remain at original storage path (`section-attachments/...`)

### Section ID Mapping
- When restoring a version, sections get new IDs
- Attachments must be mapped to new section IDs
- The mapping is done using section order as the key
- This ensures attachments are restored to correct sections

### Backward Compatibility
- Old versions without `attachments_snapshot` default to empty array
- No data migration needed for existing versions
- New versions will include attachments automatically

### Performance Considerations
- GIN index on `attachments_snapshot` for fast queries
- Attachment capture doesn't fail version creation
- Large attachment lists are handled efficiently
- No file duplication (only metadata stored)

## 🧪 Testing Commands

### Verify Migration
```sql
-- Check column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'proposal_versions' 
AND column_name = 'attachments_snapshot';

-- Check index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'proposal_versions' 
AND indexname = 'idx_proposal_versions_attachments_snapshot';

-- View sample data
SELECT 
  id,
  version_number,
  jsonb_array_length(COALESCE(attachments_snapshot, '[]'::jsonb)) as attachment_count
FROM proposal_versions
ORDER BY created_at DESC
LIMIT 5;
```

### Test Version Creation
```typescript
// Create a version with attachments
const result = await VersionService.createVersion(
  proposalId,
  userId,
  'Test version with attachments'
);

console.log('Attachments captured:', result.version?.attachmentsSnapshot.length);
```

### Test Version Comparison
```typescript
// Compare two versions
const comparison = await VersionService.compareVersions(
  oldVersionId,
  newVersionId
);

console.log('Attachments added:', comparison?.diff.attachmentsAdded.length);
console.log('Attachments removed:', comparison?.diff.attachmentsRemoved.length);
```

### Test Version Rollback
```typescript
// Rollback to a version
const result = await VersionService.restoreVersion(
  versionId,
  userId
);

console.log('Version restored with attachments');
```

## 📝 Documentation Updates Needed

- [ ] Update API documentation for version endpoints
- [ ] Add attachment versioning to user guide
- [ ] Document rollback behavior with attachments
- [ ] Add troubleshooting guide for missing files
- [ ] Update developer documentation

## 🎯 Success Criteria

- [x] Database schema updated
- [x] Backend service captures attachments
- [x] Backend service restores attachments
- [x] Backend service compares attachments
- [x] UI shows attachment counts
- [x] UI displays attachment changes
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Database migration applied to production

## 🚀 Deployment Checklist

- [ ] Run database migration on staging
- [ ] Test version creation on staging
- [ ] Test version rollback on staging
- [ ] Verify no performance issues
- [ ] Run database migration on production
- [ ] Monitor error logs
- [ ] Verify version creation works
- [ ] Verify rollback works
- [ ] Update user documentation

## 📞 Support

If issues arise:
1. Check database migration was applied
2. Verify `attachments_snapshot` column exists
3. Check error logs for attachment capture failures
4. Verify section ID mapping in rollback
5. Check file storage for missing files

## 🔄 Rollback Plan

If issues occur, rollback using:
```sql
-- Remove attachments_snapshot column
ALTER TABLE proposal_versions 
DROP COLUMN IF EXISTS attachments_snapshot;

-- Remove index
DROP INDEX IF EXISTS idx_proposal_versions_attachments_snapshot;
```

Then revert code changes in `lib/version-service.ts`.
