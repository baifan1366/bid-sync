-- ============================================================
-- SEED: NOTIFICATION DUMMY DATA
-- ============================================================
-- Run this script to add test notifications for development

-- First, get a user ID to use (you may need to replace this with an actual user ID)
-- This script assumes you have at least one user in the system

DO $$
DECLARE
    v_user_id UUID;
    v_admin_id UUID;
    v_client_id UUID;
    v_lead_id UUID;
BEGIN
    -- Get first admin user
    SELECT id INTO v_admin_id 
    FROM auth.users 
    WHERE raw_user_meta_data->>'role' = 'admin' 
    LIMIT 1;

    -- Get first client user
    SELECT id INTO v_client_id 
    FROM auth.users 
    WHERE raw_user_meta_data->>'role' = 'client' 
    LIMIT 1;

    -- Get first bidding lead user
    SELECT id INTO v_lead_id 
    FROM auth.users 
    WHERE raw_user_meta_data->>'role' IN ('bidding_lead', 'bidding_member') 
    LIMIT 1;

    -- Use admin if available, otherwise any user
    v_user_id := COALESCE(v_admin_id, v_client_id, v_lead_id);

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'No users found in the system. Please create a user first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Creating notifications for user: %', v_user_id;

    -- Insert sample notifications
    INSERT INTO public.notification_queue (user_id, type, title, body, data, read, created_at) VALUES
    -- Project notifications
    (v_user_id, 'project_created', '🎉 New Project Created', 'Your project "Enterprise Software Development" has been created and is pending review.', '{"projectId": "00000000-0000-0000-0000-000000000001", "projectTitle": "Enterprise Software Development"}'::jsonb, false, NOW() - INTERVAL '5 minutes'),
    
    (v_user_id, 'project_approved', '✅ Project Approved', 'Your project "Mobile App Development" has been approved and is now open for proposals.', '{"projectId": "00000000-0000-0000-0000-000000000002", "projectTitle": "Mobile App Development"}'::jsonb, false, NOW() - INTERVAL '1 hour'),
    
    (v_user_id, 'project_awarded', '🏆 Project Awarded', 'Congratulations! Your proposal for "Cloud Migration Project" has been accepted.', '{"projectId": "00000000-0000-0000-0000-000000000003", "proposalId": "00000000-0000-0000-0000-000000000010"}'::jsonb, false, NOW() - INTERVAL '2 hours'),

    -- Proposal notifications
    (v_user_id, 'proposal_submitted', '📝 New Proposal Received', 'Team Alpha has submitted a proposal for your project "Website Redesign".', '{"projectId": "00000000-0000-0000-0000-000000000004", "proposalId": "00000000-0000-0000-0000-000000000011", "teamName": "Team Alpha"}'::jsonb, false, NOW() - INTERVAL '3 hours'),
    
    (v_user_id, 'proposal_scored', '⭐ Proposal Scored', 'Your proposal has been scored. Total score: 85/100, Rank: #2', '{"proposalId": "00000000-0000-0000-0000-000000000012", "totalScore": 85, "rank": 2}'::jsonb, false, NOW() - INTERVAL '4 hours'),
    
    (v_user_id, 'all_proposals_scored', '📊 All Proposals Scored', 'All 5 proposals for "Data Analytics Platform" have been scored. Review the rankings now.', '{"projectId": "00000000-0000-0000-0000-000000000005", "proposalCount": 5}'::jsonb, true, NOW() - INTERVAL '1 day'),

    -- Team notifications
    (v_user_id, 'team_member_joined', '👋 New Team Member', 'John Smith has joined your team for "API Integration Project".', '{"projectId": "00000000-0000-0000-0000-000000000006", "memberName": "John Smith"}'::jsonb, true, NOW() - INTERVAL '2 days'),
    
    (v_user_id, 'team_invitation_created', '📨 Invitation Sent', 'Team invitation has been created. Share the code: ABC123 with your team members.', '{"invitationCode": "ABC123", "projectId": "00000000-0000-0000-0000-000000000007"}'::jsonb, true, NOW() - INTERVAL '3 days'),

    -- Completion notifications
    (v_user_id, 'ready_for_delivery', '📦 Ready for Delivery', 'Team Beta has marked "E-commerce Platform" as ready for delivery with 8 deliverables.', '{"projectId": "00000000-0000-0000-0000-000000000008", "deliverableCount": 8}'::jsonb, false, NOW() - INTERVAL '6 hours'),
    
    (v_user_id, 'completion_accepted', '🎊 Project Completed', 'The client has accepted the delivery for "CRM System Development". Great work!', '{"projectId": "00000000-0000-0000-0000-000000000009", "completionId": "00000000-0000-0000-0000-000000000020"}'::jsonb, true, NOW() - INTERVAL '5 days'),
    
    (v_user_id, 'revision_requested', '🔄 Revision Requested', 'The client has requested revisions for "Marketing Dashboard". Please review the feedback.', '{"projectId": "00000000-0000-0000-0000-000000000010", "revisionNotes": "Please update the color scheme and fix the chart labels."}'::jsonb, false, NOW() - INTERVAL '8 hours'),

    -- Message notifications
    (v_user_id, 'message_received', '💬 New Message', 'Sarah Johnson sent you a message about "Healthcare App": "Can we schedule a call to discuss..."', '{"projectId": "00000000-0000-0000-0000-000000000011", "senderId": "00000000-0000-0000-0000-000000000030", "senderName": "Sarah Johnson"}'::jsonb, false, NOW() - INTERVAL '30 minutes'),

    -- Q&A notifications
    (v_user_id, 'qa_question_posted', '❓ New Question', 'A bidding team asked: "What is the expected timeline for phase 2?"', '{"projectId": "00000000-0000-0000-0000-000000000012", "questionId": "00000000-0000-0000-0000-000000000040"}'::jsonb, false, NOW() - INTERVAL '45 minutes'),
    
    (v_user_id, 'qa_answer_posted', '💡 Question Answered', 'The client answered your question about "Budget allocation for testing phase".', '{"questionId": "00000000-0000-0000-0000-000000000041", "projectId": "00000000-0000-0000-0000-000000000013"}'::jsonb, true, NOW() - INTERVAL '1 day'),

    -- Section notifications
    (v_user_id, 'section_assigned', '📋 Section Assigned', 'You have been assigned to work on "Technical Requirements" section. Deadline: Jan 15, 2026', '{"sectionId": "00000000-0000-0000-0000-000000000050", "sectionTitle": "Technical Requirements", "deadline": "2026-01-15"}'::jsonb, false, NOW() - INTERVAL '2 hours'),
    
    (v_user_id, 'section_completed', '✔️ Section Completed', 'Mike Chen has completed the "Executive Summary" section for review.', '{"sectionId": "00000000-0000-0000-0000-000000000051", "sectionTitle": "Executive Summary", "completedBy": "Mike Chen"}'::jsonb, true, NOW() - INTERVAL '4 days'),

    -- Deadline reminders
    (v_user_id, 'project_deadline_approaching', '⏰ Deadline Approaching', 'Project "Financial System Upgrade" deadline is in 3 days. Make sure to complete all deliverables.', '{"projectId": "00000000-0000-0000-0000-000000000014", "daysRemaining": 3}'::jsonb, false, NOW() - INTERVAL '12 hours'),
    
    (v_user_id, 'section_deadline_approaching', '⏰ Section Deadline', 'Your assigned section "Implementation Plan" is due in 2 days.', '{"sectionId": "00000000-0000-0000-0000-000000000052", "sectionTitle": "Implementation Plan", "daysRemaining": 2}'::jsonb, false, NOW() - INTERVAL '1 hour');

    -- If we have a client user, add client-specific notifications
    IF v_client_id IS NOT NULL AND v_client_id != v_user_id THEN
        INSERT INTO public.notification_queue (user_id, type, title, body, data, read, created_at) VALUES
        (v_client_id, 'proposal_submitted', '📝 New Proposal', 'You received a new proposal from Team Delta for your project.', '{"projectId": "00000000-0000-0000-0000-000000000015"}'::jsonb, false, NOW() - INTERVAL '20 minutes'),
        (v_client_id, 'verification_approved', '✅ Account Verified', 'Your account has been verified. You can now create projects.', '{}'::jsonb, true, NOW() - INTERVAL '7 days');
    END IF;

    -- If we have a lead user, add lead-specific notifications
    IF v_lead_id IS NOT NULL AND v_lead_id != v_user_id THEN
        INSERT INTO public.notification_queue (user_id, type, title, body, data, read, created_at) VALUES
        (v_lead_id, 'proposal_accepted', '🎉 Proposal Accepted!', 'Your proposal for "Inventory Management System" has been accepted!', '{"projectId": "00000000-0000-0000-0000-000000000016", "proposalId": "00000000-0000-0000-0000-000000000060"}'::jsonb, false, NOW() - INTERVAL '10 minutes'),
        (v_lead_id, 'proposal_rejected', '📋 Proposal Update', 'Your proposal was not selected for "HR Portal". Check feedback for details.', '{"projectId": "00000000-0000-0000-0000-000000000017", "feedback": "Budget constraints"}'::jsonb, true, NOW() - INTERVAL '3 days');
    END IF;

    RAISE NOTICE 'Successfully created notification dummy data!';
END $$;

-- Verify the notifications were created
SELECT 
    type,
    title,
    read,
    created_at
FROM public.notification_queue 
ORDER BY created_at DESC 
LIMIT 20;
