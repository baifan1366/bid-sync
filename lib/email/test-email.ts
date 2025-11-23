/**
 * Test script for email notification system
 * Run with: npx tsx lib/email/test-email.ts
 */

import {
  sendAdminInvitationEmail,
  sendVerificationApprovedEmail,
  sendVerificationRejectedEmail,
  sendAccountSuspensionEmail,
} from './index';

async function testEmails() {
  console.log('🧪 Testing BidSync Email Notification System\n');

  // Test 1: Admin Invitation Email
  console.log('Test 1: Admin Invitation Email');
  const result1 = await sendAdminInvitationEmail({
    inviteeEmail: 'newadmin@example.com',
    inviterName: 'John Doe',
    invitationToken: 'test-token-123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  console.log('Result:', result1.success ? '✅ Success' : '❌ Failed', '\n');

  // Test 2: Verification Approval Email
  console.log('Test 2: Verification Approval Email');
  const result2 = await sendVerificationApprovedEmail({
    clientName: 'Jane Smith',
    clientEmail: 'jane@company.com',
  });
  console.log('Result:', result2.success ? '✅ Success' : '❌ Failed', '\n');

  // Test 3: Verification Rejection Email
  console.log('Test 3: Verification Rejection Email');
  const result3 = await sendVerificationRejectedEmail({
    clientName: 'Bob Johnson',
    clientEmail: 'bob@startup.com',
    reason: 'Incomplete business documentation. Please provide your business registration certificate.',
  });
  console.log('Result:', result3.success ? '✅ Success' : '❌ Failed', '\n');

  // Test 4: Account Suspension Email
  console.log('Test 4: Account Suspension Email');
  const result4 = await sendAccountSuspensionEmail({
    userName: 'Alice Williams',
    userEmail: 'alice@example.com',
    reason: 'Multiple violations of platform terms of service',
    suspendedAt: new Date().toISOString(),
  });
  console.log('Result:', result4.success ? '✅ Success' : '❌ Failed', '\n');

  console.log('✅ All email tests completed!');
}

// Run tests
testEmails().catch(console.error);
