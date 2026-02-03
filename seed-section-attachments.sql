-- Seed some test attachments for sections
-- This will add test attachments to the existing sections

-- First, let's get the section IDs for the proposal
DO $$
DECLARE
  v_section_id UUID;
  v_user_id UUID;
BEGIN
  -- Get a user ID (use the proposal lead or any user)
  SELECT user_id INTO v_user_id
  FROM proposals
  WHERE id = '61a2a5ce-1827-4de4-81e4-62b2c58191a6'
  LIMIT 1;

  -- Get the first section ID
  SELECT ds.id INTO v_section_id
  FROM document_sections ds
  JOIN documents d ON d.id = ds.document_id
  JOIN workspaces w ON w.id = d.workspace_id
  WHERE w.proposal_id = '61a2a5ce-1827-4de4-81e4-62b2c58191a6'
  ORDER BY ds."order"
  LIMIT 1;

  -- Insert test attachments for the first section
  IF v_section_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO section_attachments (
      section_id,
      file_name,
      file_type,
      file_size,
      file_path,
      uploaded_by,
      created_at
    ) VALUES
    (
      v_section_id,
      'Executive_Summary_Draft.pdf',
      'application/pdf',
      245760, -- 240 KB
      'https://example.com/files/executive-summary.pdf',
      v_user_id,
      NOW() - INTERVAL '2 days'
    ),
    (
      v_section_id,
      'Company_Profile.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      512000, -- 500 KB
      'https://example.com/files/company-profile.docx',
      v_user_id,
      NOW() - INTERVAL '1 day'
    ),
    (
      v_section_id,
      'Financial_Overview.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      1048576, -- 1 MB
      'https://example.com/files/financial-overview.xlsx',
      v_user_id,
      NOW() - INTERVAL '3 hours'
    );

    RAISE NOTICE 'Inserted 3 test attachments for section %', v_section_id;
  ELSE
    RAISE NOTICE 'Could not find section or user';
  END IF;

  -- Add attachments to second section as well
  SELECT ds.id INTO v_section_id
  FROM document_sections ds
  JOIN documents d ON d.id = ds.document_id
  JOIN workspaces w ON w.id = d.workspace_id
  WHERE w.proposal_id = '61a2a5ce-1827-4de4-81e4-62b2c58191a6'
  ORDER BY ds."order"
  OFFSET 1
  LIMIT 1;

  IF v_section_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO section_attachments (
      section_id,
      file_name,
      file_type,
      file_size,
      file_path,
      uploaded_by,
      created_at
    ) VALUES
    (
      v_section_id,
      'Technical_Specifications.pdf',
      'application/pdf',
      819200, -- 800 KB
      'https://example.com/files/technical-specs.pdf',
      v_user_id,
      NOW() - INTERVAL '5 hours'
    ),
    (
      v_section_id,
      'Architecture_Diagram.png',
      'image/png',
      204800, -- 200 KB
      'https://example.com/files/architecture.png',
      v_user_id,
      NOW() - INTERVAL '2 hours'
    );

    RAISE NOTICE 'Inserted 2 test attachments for section %', v_section_id;
  END IF;
END $$;

-- Verify the insertions
SELECT 
  ds.title as section_title,
  sa.file_name,
  sa.file_type,
  ROUND(sa.file_size / 1024.0, 1) as size_kb,
  sa.created_at
FROM section_attachments sa
JOIN document_sections ds ON ds.id = sa.section_id
JOIN documents d ON d.id = ds.document_id
JOIN workspaces w ON w.id = d.workspace_id
WHERE w.proposal_id = '61a2a5ce-1827-4de4-81e4-62b2c58191a6'
ORDER BY ds."order", sa.created_at;
