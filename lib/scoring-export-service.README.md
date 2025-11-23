# Scoring Export Service

This service generates PDF exports of proposal scoring data for clients.

## Setup Requirements

### Supabase Storage Bucket

The export service requires a Supabase Storage bucket named `exports` to store generated PDF files.

**To create the bucket:**

1. Go to your Supabase project dashboard
2. Navigate to Storage
3. Click "Create a new bucket"
4. Name it `exports`
5. Set it as **Private** (files should only be accessible via signed URLs)
6. Save the bucket

**Bucket Configuration:**
- Name: `exports`
- Public: No (Private)
- File size limit: 50MB (recommended)
- Allowed MIME types: `application/pdf`

### Storage Policies

The service uses signed URLs with 24-hour expiration, so no additional RLS policies are needed on the bucket itself. The GraphQL resolver handles access control by verifying the user is the project client before generating the export.

## Usage

The export service is called via the GraphQL `exportScoring` mutation:

```graphql
mutation ExportScoring($projectId: ID!) {
  exportScoring(projectId: $projectId) {
    url
    expiresAt
  }
}
```

**Response:**
- `url`: Signed URL to download the PDF (valid for 24 hours)
- `expiresAt`: ISO timestamp when the URL expires

## Export Contents

The generated PDF includes:

1. **Project Information**
   - Project title and description
   - Client name and email
   - Export date and timestamp

2. **Scoring Template**
   - Template name and description
   - All criteria with weights and descriptions

3. **Proposal Rankings**
   - For each scored proposal:
     - Rank number
     - Proposal title and lead name
     - Team name and budget
     - Total score
     - Individual criterion scores (raw and weighted)
     - Evaluator notes for each criterion

4. **Unscored Proposals Summary**
   - List of proposals that haven't been scored yet

## Implementation Details

- **PDF Library**: jsPDF
- **Storage**: Supabase Storage with signed URLs
- **Expiration**: 24 hours
- **File naming**: `scoring-export-{projectId}-{timestamp}.pdf`

## Error Handling

The service handles the following error cases:

- Project not found or access denied
- Scoring template not found
- Failed to fetch rankings or scores
- Upload failures (retries up to 3 times)
- URL generation failures

All errors are logged and returned as GraphQL errors with appropriate error codes.
