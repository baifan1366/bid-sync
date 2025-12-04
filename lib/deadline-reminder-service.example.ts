/**
 * Example Usage: Deadline Reminder Service
 * 
 * This file demonstrates how the deadline reminder system works
 */

import { DeadlineReminderService } from './deadline-reminder-service';

/**
 * Example 1: Send all deadline reminders (called by cron job)
 */
async function example1_SendAllReminders() {
  console.log('Example 1: Sending all deadline reminders...');
  
  const result = await DeadlineReminderService.sendAllDeadlineReminders();
  
  console.log('Result:', {
    success: result.success,
    projectReminders: result.projectReminders,
    sectionReminders: result.sectionReminders,
    totalReminders: result.projectReminders + result.sectionReminders,
    errors: result.errors,
  });
  
  // Expected output:
  // {
  //   success: true,
  //   projectReminders: 5,
  //   sectionReminders: 12,
  //   totalReminders: 17,
  //   errors: []
  // }
}

/**
 * Example 2: Send only project deadline reminders
 */
async function example2_SendProjectReminders() {
  console.log('Example 2: Sending project deadline reminders...');
  
  const result = await DeadlineReminderService.sendProjectDeadlineReminders();
  
  console.log('Result:', {
    remindersSent: result.remindersSent,
    errors: result.errors,
  });
  
  // This will:
  // 1. Find all projects with deadlines within 7 days
  // 2. Send notification to project client
  // 3. If project is awarded, send notifications to all team members
  // 4. Include days remaining in each notification
}

/**
 * Example 3: Send only section deadline reminders
 */
async function example3_SendSectionReminders() {
  console.log('Example 3: Sending section deadline reminders...');
  
  const result = await DeadlineReminderService.sendSectionDeadlineReminders();
  
  console.log('Result:', {
    remindersSent: result.remindersSent,
    errors: result.errors,
  });
  
  // This will:
  // 1. Find all document sections with deadlines within 3 days
  // 2. Send notification to assigned team member
  // 3. Include days remaining in each notification
}

/**
 * Example 4: Understanding the notification data
 */
function example4_NotificationData() {
  console.log('Example 4: Understanding notification data...');
  
  // Project deadline notification data:
  const projectNotificationData = {
    projectId: 'uuid-123',
    projectTitle: 'Website Revamp',
    deadline: '2024-01-15',
    daysRemaining: 5,
    proposalId: 'uuid-456', // Only for team member notifications
  };
  
  // Section deadline notification data:
  const sectionNotificationData = {
    documentId: 'uuid-789',
    documentTitle: 'Proposal Draft',
    sectionId: 'uuid-101',
    sectionTitle: 'Executive Summary',
    deadline: '2024-01-12',
    daysRemaining: 2,
    workspaceId: 'uuid-112',
  };
  
  console.log('Project notification data:', projectNotificationData);
  console.log('Section notification data:', sectionNotificationData);
}

/**
 * Example 5: Deadline calculation logic
 */
function example5_DeadlineCalculation() {
  console.log('Example 5: Understanding deadline calculation...');
  
  // Project deadlines: within 7 days
  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  
  console.log('Project deadline window:');
  console.log('  From:', today.toISOString().split('T')[0]);
  console.log('  To:', sevenDaysFromNow.toISOString().split('T')[0]);
  
  // Section deadlines: within 3 days
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);
  
  console.log('Section deadline window:');
  console.log('  From:', today.toISOString().split('T')[0]);
  console.log('  To:', threeDaysFromNow.toISOString().split('T')[0]);
  
  // Days remaining calculation:
  // - Rounded up to ensure full days notice
  // - Never negative (returns 0 if deadline has passed)
}

/**
 * Example 6: Priority escalation
 */
function example6_PriorityEscalation() {
  console.log('Example 6: Understanding priority escalation...');
  
  // Project deadlines:
  // - MEDIUM priority: 3-7 days remaining
  // - HIGH priority: 0-2 days remaining
  
  // Section deadlines:
  // - MEDIUM priority: 2-3 days remaining
  // - HIGH priority: 0-1 days remaining
  
  console.log('Priority levels:');
  console.log('  Projects: HIGH if <= 2 days, MEDIUM otherwise');
  console.log('  Sections: HIGH if <= 1 day, MEDIUM otherwise');
}

/**
 * Example 7: Error handling
 */
async function example7_ErrorHandling() {
  console.log('Example 7: Understanding error handling...');
  
  const result = await DeadlineReminderService.sendAllDeadlineReminders();
  
  // Errors are collected but don't stop processing
  if (result.errors.length > 0) {
    console.log('Some reminders failed:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  // Partial success is possible
  if (result.projectReminders > 0 || result.sectionReminders > 0) {
    console.log('Some reminders were sent successfully');
  }
}

// Export examples for documentation
export const examples = {
  example1_SendAllReminders,
  example2_SendProjectReminders,
  example3_SendSectionReminders,
  example4_NotificationData,
  example5_DeadlineCalculation,
  example6_PriorityEscalation,
  example7_ErrorHandling,
};
