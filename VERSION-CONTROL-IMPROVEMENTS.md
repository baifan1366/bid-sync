# Version Control Improvements for Sections & Attachments

## Current State Analysis

### ✅ What's Working

#### Proposal-Level Version Control (`version-service.ts`)
- **Sections**: ✅ Fully supported
  - Captures complete section snapshots
  - Includes: title, order, status, content, assigned_to, deadline
  - Restores sections when rolling back
  - Shows section changes in version comparison

- **Documents**: ✅ Partially supported
  - Captures proposal-level documents (uploaded files)
  - Shows document additions/removals in comparison

#### Document-Level Version Control (`version-control-service.ts`)
- **Content**: ✅ Supported
  - Tracks document content changes
  - Version comparison and rollback

### ❌ What's Missing

#### 1. Section Attachments Not Tracked
**Problem**: `section_attachments` table is not included in version snapshots

**Impact**:
- When rolling back a version, attachments are lost
- Version comparison doesn't show attachment changes
- No way to restore deleted attachments

**Affected Tables**:
```sql
section_attachments (
  id,
  section_id,
  document_id,
  uploaded_by,
  file_name,
  file_path,
  file_type,
  file_size,
  description,
  created_at
)
```

#### 2. Document-Level Version Control Ignores Sections
**Problem**: `version-control-service.ts` only tracks document content, not sections

**Impact**:
- Document versions don't include section structure
- Rolling back a document doesn't restore sections
- Can't see section changes in document history

## Recommended Improvements

### Priority 1: Add Section Attachments to Proposal Versions

#### Update `version-service.ts`

**1. Add Attachments Snapshot Field**
```typescript
export interface ProposalVersion {
  id: string;
  proposalId: string;
  versionNumber: number;
  content: any;
  sectionsSnapshot: any[];
  documentsSnapshot: any[];
  attachmentsSnapshot: any[];  // ← NEW
  changeSummary?: string;
  createdBy: string;
  createdAt: string;
}
```

**2. Capture Attachments in `createVersion()`**
```typescript
// After capturing sections snapshot
const { data: attachments, error: attachmentsError } = await supabase
  .from('section_attachments')
  .select(`
    id,
    section_id,
    document_id,
    uploaded_by,
    file_name,
    file_path,
    file_type,
    file_size,
    description,
    created_at
  `)
  .in('section_id', sections.map(s => s.id));

if (attachmentsError) {
  console.error('Error capturing attachments snapshot:', attachmentsError);
  // Don't fail - attachments are optional
}

// Include in version record
const { data: version, error: versionError } = await supabase
  .from('proposal_versions')
  .insert({
    proposal_id: proposalId,
    version_number: versionNumber || 1,
    content: proposal.content || {},
    sections_snapshot: sections || [],
    documents_snapshot: documents || [],
    attachments_snapshot: attachments || [],  // ← NEW
    change_summary: changeSummary,
    created_by: userId,
  })
```

**3. Restore Attachments in `restoreVersion()`**
```typescript
// After restoring sections
if (document) {
  // Delete current attachments
  await supabase
    .from('section_attachments')
    .delete()
    .in('section_id', sectionsToRestore.map(s => s.id));

  // Restore attachments from snapshot
  const attachmentsToRestore = versionToRestore.attachmentsSnapshot.map((a: any) => ({
    section_id: a.section_id,
    document_id: document.id,
    uploaded_by: a.uploaded_by,
    file_name: a.file_name,
    file_path: a.file_path,
    file_type: a.file_type,
    file_size: a.file_size,
    description: a.description,
  }));

  if (attachmentsToRestore.length > 0) {
    await supabase
      .from('section_attachments')
      .insert(attachmentsToRestore);
  }
}
```

**4. Compare Attachments in `compareVersions()`**
```typescript
// Compare attachments
const oldAttachments = oldVersion.attachmentsSnapshot || [];
const newAttachments = newVersion.attachmentsSnapshot || [];

const oldAttachmentIds = new Set(oldAttachments.map((a: any) => a.id));
const newAttachmentIds = new Set(newAttachments.map((a: any) => a.id));

const attachmentsAdded = newAttachments.filter((a: any) => !oldAttachmentIds.has(a.id));
const attachmentsRemoved = oldAttachments.filter((a: any) => !newAttachmentIds.has(a.id));

return {
  oldVersion,
  newVersion,
  diff: {
    contentChanges,
    sectionsAdded,
    sectionsRemoved,
    sectionsModified,
    documentsAdded,
    documentsRemoved,
    attachmentsAdded,    // ← NEW
    attachmentsRemoved,  // ← NEW
  },
};
```

### Priority 2: Update Database Schema

**Add Column to `proposal_versions` Table**
```sql
ALTER TABLE proposal_versions 
ADD COLUMN attachments_snapshot JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN proposal_versions.attachments_snapshot IS 
'Snapshot of section attachments at the time of version creation';
```

### Priority 3: Update UI to Show Attachment Changes

**Update `version-history-sidebar.tsx`**

**1. Show Attachment Count in Version Card**
```tsx
<div className="text-xs text-muted-foreground">
  {version.sectionsSnapshot?.length || 0} sections • 
  {version.documentsSnapshot?.length || 0} documents •
  {version.attachmentsSnapshot?.length || 0} attachments
</div>
```

**2. Show Attachment Changes in Comparison**
```tsx
{/* Attachments Changes */}
{compareVersions.diff.attachmentsAdded.length > 0 && (
  <div className="mb-4">
    <Badge className="bg-green-400 text-white mb-2">
      {compareVersions.diff.attachmentsAdded.length} Attachments Added
    </Badge>
    <ul className="list-disc list-inside text-sm">
      {compareVersions.diff.attachmentsAdded.map((a: any) => (
        <li key={a.id} className="text-green-600">
          {a.file_name} ({formatFileSize(a.file_size)})
        </li>
      ))}
    </ul>
  </div>
)}

{compareVersions.diff.attachmentsRemoved.length > 0 && (
  <div className="mb-4">
    <Badge className="bg-red-400 text-white mb-2">
      {compareVersions.diff.attachmentsRemoved.length} Attachments Removed
    </Badge>
    <ul className="list-disc list-inside text-sm">
      {compareVersions.diff.attachmentsRemoved.map((a: any) => (
        <li key={a.id} className="text-red-600 line-through">
          {a.file_name} ({formatFileSize(a.file_size)})
        </li>
      ))}
    </ul>
  </div>
)}
```

### Priority 4: Document-Level Version Control Enhancement

**Update `version-control-service.ts` to Include Sections**

This is lower priority since most versioning happens at the proposal level, but for completeness:

```typescript
export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  content: JSONContent;
  sectionsSnapshot?: any[];      // ← NEW
  attachmentsSnapshot?: any[];   // ← NEW
  createdBy: string;
  createdByName: string;
  changesSummary: string;
  isRollback: boolean;
  rolledBackFrom?: string;
  createdAt: string;
}
```

## Implementation Plan

### Phase 1: Database (Week 1)
- [ ] Add `attachments_snapshot` column to `proposal_versions` table
- [ ] Create migration script
- [ ] Test migration on staging

### Phase 2: Backend (Week 1-2)
- [ ] Update `VersionService.createVersion()` to capture attachments
- [ ] Update `VersionService.restoreVersion()` to restore attachments
- [ ] Update `VersionService.compareVersions()` to compare attachments
- [ ] Add unit tests for attachment versioning

### Phase 3: UI (Week 2)
- [ ] Update version history sidebar to show attachment counts
- [ ] Update version comparison to show attachment changes
- [ ] Add attachment preview in version details
- [ ] Test rollback with attachments

### Phase 4: Testing (Week 3)
- [ ] Test version creation with attachments
- [ ] Test version rollback with attachments
- [ ] Test version comparison with attachments
- [ ] Test edge cases (deleted files, large files, etc.)

## Storage Considerations

### File Storage
**Issue**: Attachments are stored in Supabase Storage, not in the database

**Options**:
1. **Keep References Only** (Recommended)
   - Store file metadata in version snapshot
   - Keep actual files in storage
   - Pros: No duplicate storage, faster versioning
   - Cons: Files can be deleted independently

2. **Duplicate Files**
   - Copy files to version-specific storage path
   - Pros: Complete version isolation
   - Cons: High storage cost, slow versioning

3. **Hybrid Approach**
   - Keep references for recent versions
   - Archive old version files to cold storage
   - Pros: Balance of cost and completeness
   - Cons: More complex implementation

**Recommendation**: Start with Option 1 (references only) and add file archiving later if needed.

### File Deletion Protection
```typescript
// Add soft delete to section_attachments
ALTER TABLE section_attachments 
ADD COLUMN deleted_at TIMESTAMPTZ;

// Update delete operations to soft delete
UPDATE section_attachments 
SET deleted_at = NOW() 
WHERE id = $1;

// Filter out deleted attachments in queries
SELECT * FROM section_attachments 
WHERE deleted_at IS NULL;
```

## Testing Checklist

### Version Creation
- [ ] Creates version with section attachments
- [ ] Handles sections without attachments
- [ ] Handles large number of attachments
- [ ] Captures correct file metadata

### Version Rollback
- [ ] Restores attachments correctly
- [ ] Handles missing files gracefully
- [ ] Updates attachment counts
- [ ] Notifies users of restored attachments

### Version Comparison
- [ ] Shows added attachments
- [ ] Shows removed attachments
- [ ] Shows attachment metadata changes
- [ ] Handles empty attachment lists

### Edge Cases
- [ ] Deleted files in storage
- [ ] Duplicate file names
- [ ] Very large files (>100MB)
- [ ] Concurrent version creation
- [ ] Rollback with modified files

## Documentation Updates

- [ ] Update API documentation
- [ ] Update user guide for version control
- [ ] Add examples of attachment versioning
- [ ] Document storage considerations
- [ ] Add troubleshooting guide

## Monitoring & Alerts

- [ ] Track version creation success rate
- [ ] Monitor storage usage for versions
- [ ] Alert on failed attachment restorations
- [ ] Track rollback frequency
- [ ] Monitor version comparison performance

## Future Enhancements

1. **Attachment Diff Viewer**
   - Show file content changes (for text files)
   - Image comparison (for images)
   - PDF diff viewer

2. **Selective Restore**
   - Restore only specific sections
   - Restore only specific attachments
   - Cherry-pick changes

3. **Version Branching**
   - Create alternative versions
   - Merge versions
   - Conflict resolution

4. **Automated Versioning**
   - Auto-create versions on milestones
   - Schedule periodic snapshots
   - Version on status changes

## Notes

- Attachments are critical for proposal completeness
- Version control without attachments is incomplete
- Storage costs should be monitored
- File deletion protection is important
- User education on versioning is key
