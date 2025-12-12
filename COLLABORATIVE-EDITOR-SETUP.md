# Collaborative Editor Setup Guide

## Overview

The collaborative editor now uses **Supabase Realtime** for all real-time collaboration features. No separate WebSocket server is required.

## Issues Fixed

1. **GraphQL "Document not found" Error** - RLS policy fix available

## Setup Steps

### 1. Apply Database RLS Fix

The document query may fail due to RLS (Row Level Security) policies. Apply the fix:

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Open the file `db/migrations/fix-workspace-documents-rls.sql`
4. Copy all the SQL content
5. Paste it into the SQL Editor
6. Click **Run** to execute

**Option B: Using Supabase CLI**
```bash
supabase db push
```

### 2. Enable Supabase Realtime

Ensure Realtime is enabled for your Supabase project:
1. Go to your Supabase Dashboard
2. Navigate to **Database** > **Replication**
3. Enable Realtime for the relevant tables

### 3. Start Your Development Server

```bash
npm run dev
```

## Verification

1. Navigate to a document in the editor: `/editor/[documentId]`
2. Check the browser console - you should see:
   - ✅ No "Document not found" errors
   - ✅ Connection status showing "connected"
3. Open the same document in multiple browser windows to test collaboration

## Production Setup

No additional setup required! Supabase Realtime works automatically in production with your existing Supabase configuration.

## Troubleshooting

### Still seeing "Document not found"?

1. Check if the document exists in your database:
   ```sql
   SELECT * FROM workspace_documents WHERE id = 'your-document-id';
   ```

2. Verify RLS policies were applied:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'workspace_documents';
   ```

3. Check if you have proper collaborator access:
   ```sql
   SELECT * FROM document_collaborators WHERE document_id = 'your-document-id';
   ```

### Connection issues?

1. Verify your Supabase URL and anon key are correct in `.env`
2. Check if Supabase Realtime is enabled in your project
3. Restart your Next.js dev server

## Architecture

The collaborative editor uses:
- **Supabase Realtime Broadcast** - For document updates between collaborators
- **Supabase Realtime Presence** - For tracking active users
- **TipTap Editor** - For rich text editing

## Notes

- No separate WebSocket server is needed
- Collaboration works automatically with Supabase Realtime
- All users connect through Supabase's managed infrastructure
