# Proposal Detail Version History & Documents Fix

## Problem
The proposal detail page was not displaying:
1. **Version history** for each section
2. **Documents/attachments** for each section

The data exists in the database (`document_versions` and `section_attachments` tables), but the GraphQL resolver was not querying it properly.

## Root Cause
The `proposalDetail` resolver was:
- Only querying `proposal_versions` table (which is empty - versions are created on edit)
- Not querying `document_versions` table for each section's version history
- Not querying `section_attachments` table for each section's documents

## Solution

### 1. Updated GraphQL Resolver (`lib/graphql/resolvers.ts`)

**Changed the section mapping logic** to query versions and attachments for each section:

```typescript
// For each section, get content, versions, and attachments
sections = await Promise.all((docSections || []).map(async (section: any) => {
  // ... existing content logic ...
  
  // Get all versions for this section's document
  const { data: sectionVersions } = await supabase
    .from('document_versions')
    .select('id, version_number, content, created_by, changes_summary, ...')
    .eq('document_id', section.document_id)
    .order('version_number', { ascending: false });
  
  // Get creator names for versions
  const versionsWithCreators = await Promise.all(...);
  
  // Get attachments for this section
  const { data: sectionAttachments } = await supabase
    .from('section_attachments')
    .select('id, file_name, file_type, file_size, file_path, ...')
    .eq('section_id', section.id)
    .order('created_at', { ascending: false });
  
  // Get uploader names for attachments
  const attachmentsWithUploaders = await Promise.all(...);
  
  return {
    id: section.id,
    title: section.title,
    content: contentStr,
    order: section.order,
    versions: versionsWithCreators,      // NEW
    documents: attachmentsWithUploaders, // NEW
  };
}));
```

### 2. Updated GraphQL Schema (`lib/graphql/schema.ts`)

Added `versions` and `documents` fields to `ProposalSection` type:

```graphql
type ProposalSection {
  id: ID!
  title: String!
  content: String!
  order: Int!
  versions: [DocumentVersion!]!     # NEW
  documents: [ProposalDocument!]!   # NEW
}

type ProposalDocument {
  id: ID!
  name: String!
  fileType: String!
  fileSize: Int!
  category: DocumentCategory!
  url: String!
  uploadedAt: String!
  uploadedBy: String!
  uploaderName: String              # NEW
}
```

### 3. Updated GraphQL Query (`lib/graphql/queries.ts`)

Updated `GET_PROPOSAL_DETAILS` query to fetch versions and documents:

```graphql
sections {
  id
  title
  content
  order
  versions {                        # NEW
    id
    versionNumber
    content
    createdBy
    createdByName
    changesSummary
    isRollback
    rolledBackFrom
    createdAt
    sectionsSnapshot
    attachmentsSnapshot
  }
  documents {                       # NEW
    id
    name
    fileType
    fileSize
    category
    url
    uploadedAt
    uploadedBy
    uploaderName
  }
}
```

### 4. Updated TypeScript Types (`lib/graphql/types.ts`)

Added `DocumentVersion` interface and updated `ProposalSection`:

```typescript
export interface ProposalSection {
  id: string
  title: string
  content: string
  order: number
  versions?: DocumentVersion[]      // NEW
  documents?: ProposalDocument[]    // NEW
}

export interface DocumentVersion {
  id: string
  versionNumber: number
  content: any
  createdBy: string
  createdByName: string
  changesSummary: string
  isRollback: boolean
  rolledBackFrom?: string | null
  createdAt: string
  sectionsSnapshot?: any[]
  attachmentsSnapshot?: any[]
}

export interface ProposalDocument {
  id: string
  name: string
  fileType: string
  fileSize: number
  category: 'technical' | 'financial' | 'legal' | 'other'
  url: string
  uploadedAt: string
  uploadedBy: string
  uploaderName?: string             // NEW
}
```

### 5. Updated Frontend Component (`components/client/proposal-detail-view.tsx`)

Enhanced section rendering to display versions and documents:

```tsx
{/* Section Documents */}
{section.documents && section.documents.length > 0 && (
  <div className="border-t border-yellow-400/20 p-6">
    <div className="flex items-center gap-2 mb-4">
      <FileText className="h-5 w-5 text-yellow-400" />
      <h5 className="font-semibold">Attachments ({section.documents.length})</h5>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {section.documents.map((doc) => (
        <Card key={doc.id} className="border-yellow-400/20 p-3">
          {/* Document card with download button */}
        </Card>
      ))}
    </div>
  </div>
)}

{/* Section Version History */}
{section.versions && section.versions.length > 0 && (
  <div className="border-t border-yellow-400/20 p-6">
    <div className="flex items-center gap-2 mb-4">
      <History className="h-5 w-5 text-yellow-400" />
      <h5 className="font-semibold">Version History ({section.versions.length})</h5>
    </div>
    <div className="space-y-2">
      {section.versions.slice(0, 3).map((version, vIdx) => (
        <Card key={version.id} className="border-yellow-400/20 p-3">
          {/* Version card with View and Compare buttons */}
        </Card>
      ))}
    </div>
  </div>
)}
```

## How It Works

1. **For each section**, the resolver now:
   - Queries `document_versions` table filtered by `document_id`
   - Queries `section_attachments` table filtered by `section_id`
   - Fetches user names for version creators and attachment uploaders
   - Returns versions and documents as part of the section data

2. **The frontend** displays:
   - **Attachments section**: Shows all files uploaded to that section with download buttons
   - **Version History section**: Shows the 3 most recent versions with View and Compare buttons
   - Yellow accent colors following BidSync design system

## Database Tables Used

- `document_sections`: Section metadata (title, order, status)
- `document_versions`: Version history for each document (content, creator, timestamp)
- `section_attachments`: File attachments for each section (file name, type, size, path)
- `proposal_team_members`: Team member information for user names

## Testing

To test the fix:

1. Navigate to: `http://localhost:3000/client-projects/[projectId]/decision?proposal=[proposalId]`
2. Expand any section
3. You should now see:
   - **Attachments** section (if any files were uploaded)
   - **Version History** section (showing all document versions)

## Expected Server Logs

```
[proposalDetail] Section versions query: {
  section_id: '...',
  document_id: '...',
  versions_count: 23,
  versions_error: null
}

[proposalDetail] Section attachments query: {
  section_id: '...',
  attachments_count: 5,
  attachments_error: null
}
```

## Design System Compliance

All UI components follow the BidSync design system:
- Yellow accent color (`yellow-400`) for icons and highlights
- Border colors: `border-yellow-400/20` with hover `border-yellow-400/40`
- Badges: `bg-yellow-400 text-black`
- Buttons: Yellow outline with hover effects
- Light/dark theme support throughout

## Files Modified

1. `lib/graphql/resolvers.ts` - Updated `proposalDetail` resolver
2. `lib/graphql/schema.ts` - Added fields to `ProposalSection` type
3. `lib/graphql/queries.ts` - Updated `GET_PROPOSAL_DETAILS` query
4. `lib/graphql/types.ts` - Added `DocumentVersion` interface
5. `components/client/proposal-detail-view.tsx` - Enhanced section rendering

## Next Steps

If you still don't see versions or documents:

1. **Check database**: Verify data exists in `document_versions` and `section_attachments` tables
2. **Check server logs**: Look for the query logs mentioned above
3. **Check browser console**: Look for GraphQL errors
4. **Verify workspace**: Ensure the proposal has an associated workspace with documents
