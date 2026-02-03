# Fix: Proposal Document and History Not Rendering

## Problem
在 `http://localhost:3000/client-projects/{projectId}/decision?proposal={proposalId}` 页面，proposal 的 document 和 history 无法渲染。

## Root Cause Analysis

### 1. GraphQL Schema Mismatch
GraphQL schema 定义的字段名与数据库字段名不一致：
- Schema 使用: camelCase (e.g., `versionNumber`, `createdBy`)
- Database 使用: snake_case (e.g., `version_number`, `created_by`)

### 2. Missing Schema Fields
GraphQL schema 的 `ProposalVersion` 类型缺少重要字段：
- `sectionsSnapshot` - 章节快照
- `documentsSnapshot` - 文档快照
- `createdByName` - 创建者名字

### 3. Missing Creator Names
Version history 缺少创建者的名字，导致显示 "Unknown"。

### 4. Empty Documents and Sections
当 workspace 中没有数据时，没有正确地从 version snapshots 中获取备用数据。

## Changes Made

### 1. Updated GraphQL Schema (`lib/graphql/schema.ts`)

```graphql
type ProposalVersion {
  id: ID!
  versionNumber: Int!
  content: JSON!              # Changed from String! to JSON!
  sectionsSnapshot: JSON      # Added
  documentsSnapshot: JSON     # Added
  createdBy: String!
  createdByName: String       # Added
  createdAt: String!
}
```

### 2. Updated GraphQL Query (`lib/graphql/queries.ts`)

```graphql
versions {
  id
  versionNumber
  content
  sectionsSnapshot      # Added
  documentsSnapshot     # Added
  createdBy
  createdByName         # Added
  createdAt
}
```

### 3. Updated TypeScript Types (`lib/graphql/types.ts`)

```typescript
export interface ProposalVersion {
  id: string
  versionNumber: number          // Changed from version_number
  content: any
  sectionsSnapshot?: any         // Added
  documentsSnapshot?: any        // Added
  createdBy: string             // Changed from created_by
  createdByName?: string        // Added
  createdAt: string             // Changed from created_at
}
```

### 4. Updated GraphQL Resolver (`lib/graphql/resolvers.ts`)

#### Added Creator Name Fetching
```typescript
// Get creator names for versions
const versionsWithCreators = await Promise.all((versions || []).map(async (v: any) => {
  const { data: creatorData } = await adminClient.auth.admin.getUserById(v.created_by);
  return {
    ...v,
    created_by_name: creatorData?.user?.user_metadata?.full_name || 
                    creatorData?.user?.user_metadata?.name || 
                    creatorData?.user?.email?.split('@')[0] || 
                    'Unknown'
  };
}));
```

#### Added Fallback for Sections from Snapshots
```typescript
// Fallback: try to get sections from latest version's sections_snapshot
if (sections.length === 0 && versionsWithCreators?.[0]?.sections_snapshot) {
  const sectionsSnapshot = versionsWithCreators[0].sections_snapshot;
  if (Array.isArray(sectionsSnapshot)) {
    sections = sectionsSnapshot.map((section: any, index: number) => ({
      id: section.id || `section-${index}`,
      title: section.title || `Section ${index + 1}`,
      content: section.content || '',
      order: section.order ?? index,
    }));
  }
}
```

#### Added Fallback for Documents from Snapshots
```typescript
// If no documents from documents table, try from latest version's documents_snapshot
if (documents.length === 0 && versionsWithCreators?.[0]?.documents_snapshot) {
  const docsSnapshot = versionsWithCreators[0].documents_snapshot;
  if (Array.isArray(docsSnapshot)) {
    documents = docsSnapshot.map((doc: any) => ({
      id: doc.id || `doc-${Math.random()}`,
      name: doc.name || 'document',
      fileType: doc.fileType || doc.file_type || 'unknown',
      fileSize: doc.fileSize || doc.file_size || 0,
      category: doc.category || 'OTHER',
      url: doc.url || '',
      uploadedAt: doc.uploadedAt || doc.uploaded_at || new Date().toISOString(),
      uploadedBy: doc.uploadedBy || doc.uploaded_by || '',
    }));
  }
}
```

#### Updated Version Mapping (camelCase)
```typescript
versions: (versionsWithCreators || []).map((v: any) => ({
  id: v.id,
  versionNumber: v.version_number,
  content: v.content,
  sectionsSnapshot: v.sections_snapshot,
  documentsSnapshot: v.documents_snapshot,
  createdBy: v.created_by,
  createdByName: v.created_by_name,
  createdAt: v.created_at,
})),
```

### 5. Updated Component (`components/client/proposal-detail-view.tsx`)

All references updated to use camelCase:
- `version_number` → `versionNumber`
- `created_by` → `createdBy`
- `created_by_name` → `createdByName`
- `created_at` → `createdAt`

## Data Flow

1. **Workspace Documents** (Primary Source)
   - Fetch from `workspace_documents` and `document_sections`
   - If available, use these as the primary source

2. **Version Snapshots** (Fallback)
   - If workspace data is empty, use `sections_snapshot` and `documents_snapshot` from latest version
   - These snapshots are created when versions are saved

3. **Version Content** (Last Resort)
   - If snapshots are also empty, try to extract from version `content` field

## Testing

To verify the fix:

1. Navigate to: `http://localhost:3000/client-projects/{projectId}/decision?proposal={proposalId}`
2. Click on a proposal to view details
3. Check the "Documents" tab - should show documents
4. Check the "History" tab - should show version history with creator names
5. Verify sections are visible in the "Sections" tab

## Important Notes

- **Naming Convention**: All GraphQL fields now use camelCase consistently
- **Type Safety**: TypeScript types updated to match GraphQL schema
- **Backward Compatibility**: Resolver handles both snake_case (database) and camelCase (GraphQL)
- **Fallback Logic**: Multiple data sources ensure content is always available

## Files Modified

1. `lib/graphql/schema.ts` - Updated ProposalVersion type definition
2. `lib/graphql/queries.ts` - Updated GET_PROPOSAL_DETAILS query
3. `lib/graphql/types.ts` - Updated ProposalVersion interface
4. `lib/graphql/resolvers.ts` - Enhanced proposalDetail resolver
5. `components/client/proposal-detail-view.tsx` - Updated to use camelCase fields

