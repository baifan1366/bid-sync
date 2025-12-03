# Collaborative Editor Setup Guide

## Issues Fixed

1. **Yjs WebSocket Connection Error** - WebSocket server configuration added
2. **GraphQL "Document not found" Error** - RLS policy fix available

## Setup Steps

### 1. Apply Database RLS Fix

The document query is failing due to RLS (Row Level Security) policies. You need to apply the fix:

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

### 2. Start the WebSocket Server

The collaborative editor requires a WebSocket server for real-time synchronization.

**For Development:**

Open a new terminal and run:
```bash
npm run yjs:server
```

This will start the y-websocket server on `ws://localhost:1234`

**Keep this terminal running** while you're working with the collaborative editor.

### 3. Restart Your Development Server

After applying the database fix and starting the WebSocket server:

```bash
npm run dev
```

## Verification

1. Navigate to a document in the editor: `/editor/[documentId]`
2. Check the browser console - you should see:
   - ✅ No WebSocket connection errors
   - ✅ No "Document not found" errors
   - ✅ Connection status showing "connected"

## Production Setup

For production, you'll need to:

1. **Deploy a WebSocket server** - Options include:
   - Self-hosted y-websocket server
   - Supabase Realtime (requires custom integration)
   - Third-party services like Liveblocks or PartyKit

2. **Update environment variable**:
   ```bash
   NEXT_PUBLIC_YJS_WEBSOCKET_URL=wss://your-production-websocket-server.com
   ```

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

### WebSocket still not connecting?

1. Ensure the WebSocket server is running: `npm run yjs:server`
2. Check if port 1234 is available
3. Verify the environment variable is set correctly
4. Restart your Next.js dev server

## Notes

- The WebSocket server must be running for collaborative features to work
- Each user needs their own connection to the WebSocket server
- The server handles conflict resolution and synchronization automatically
