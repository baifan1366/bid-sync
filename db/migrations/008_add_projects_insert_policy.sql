-- ============================================================
-- Migration: Add INSERT policy for projects table
-- ============================================================

-- Allow authenticated clients to create their own projects
CREATE POLICY "projects_insert" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = client_id);

-- Also add DELETE policy for completeness (clients can delete their own projects)
CREATE POLICY "projects_delete" ON public.projects
FOR DELETE TO authenticated
USING (auth.uid() = client_id);
