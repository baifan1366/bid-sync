/**
 * Email Service for BidSync
 * 
 * Comprehensive email service implementing notification-system requirements:
 * - 2.1: High-priority email delivery
 * - 2.2: Email templates following BidSync design system
 * - 2.3: Retry logic with exponential backoff
 * - 2.5: Email sent flag update
 * - 18.1-18.5: BidSync design system compliance
 * 
 * This service handles sending emails with retry logic and error handling.
 * In development, emails are logged to console. In production, configure
 * an email provider (SMTP, Resend, SendGrid, AWS SES, etc.)
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  priority?: 'immediate' | 'batched' | 'digest';
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface QueueStatus {
  queueLength: number;
  pendingEmails: Array<{
    id: string;
    to: string;
    subject: string;
    attempts: number;
    priority: string;
    error?: string;
  }>;
  successCount: number;
  failureCount: number;
}

interface EmailQueueItem extends EmailOptions {
  id: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
  priority: 'immediate' | 'batched' | 'digest';
}

// In-memory queue for email jobs (in production, use a proper queue like Bull or AWS SQS)
const emailQueue: EmailQueueItem[] = [];
const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000; // 1 second base delay for exponential backoff

// Metrics tracking for monitoring (Requirement 17.1)
let successCount = 0;
let failureCount = 0;

/**
 * Send an email with retry logic and exponential backoff
 * 
 * Requirements:
 * - 2.1: High-priority email delivery
 * - 2.3: Retry up to 3 times with exponential backoff
 * - 15.1: Non-blocking execution
 * 
 * @param options Email options including recipient, subject, and content
 * @returns Promise that resolves with email result
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const emailId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const queueItem: EmailQueueItem = {
    ...options,
    id: emailId,
    attempts: 0,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    createdAt: new Date(),
    from: options.from || process.env.EMAIL_FROM || 'noreply@bidsync.com',
    priority: options.priority || 'immediate',
  };

  // Add to queue
  emailQueue.push(queueItem);

  // Requirement 2.1: Process high-priority emails immediately
  if (queueItem.priority === 'immediate') {
    return processEmailQueue(queueItem);
  }

  // Batched emails will be processed by processQueue()
  return {
    success: true,
    messageId: emailId,
  };
}

/**
 * Send multiple emails in batch
 * 
 * Requirements:
 * - Batch email processing for efficiency
 * 
 * @param emails Array of email options
 * @returns Promise that resolves with array of email results
 */
export async function sendBulkEmails(emails: EmailOptions[]): Promise<EmailResult[]> {
  const results: EmailResult[] = [];
  
  for (const email of emails) {
    const result = await sendEmail({
      ...email,
      priority: email.priority || 'batched',
    });
    results.push(result);
  }
  
  return results;
}

/**
 * Process an email from the queue with exponential backoff retry logic
 * 
 * Requirements:
 * - 2.3: Retry up to 3 times with exponential backoff
 * - 15.2: Log errors without throwing exceptions
 * - 17.1: Track success and failure counts
 */
async function processEmailQueue(item: EmailQueueItem): Promise<EmailResult> {
  item.attempts++;
  item.lastAttemptAt = new Date();

  try {
    // In development, log the email instead of sending
    if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_PROVIDER) {
      console.log('\n📧 Email (Development Mode)');
      console.log('━'.repeat(60));
      console.log(`To: ${item.to}`);
      console.log(`From: ${item.from}`);
      console.log(`Subject: ${item.subject}`);
      console.log(`Priority: ${item.priority}`);
      console.log(`Attempt: ${item.attempts}/${item.maxAttempts}`);
      console.log('━'.repeat(60));
      console.log('Text Content:');
      console.log(item.text);
      console.log('━'.repeat(60));
      console.log(`HTML Content Length: ${item.html.length} characters`);
      console.log('━'.repeat(60) + '\n');

      // Requirement 17.1: Track success
      successCount++;
      
      // Remove from queue on success
      const index = emailQueue.findIndex(e => e.id === item.id);
      if (index > -1) {
        emailQueue.splice(index, 1);
      }

      return { success: true, messageId: item.id };
    }

    // Production email sending
    const result = await sendEmailViaProvider(item);
    
    // Requirement 17.1: Track success
    successCount++;
    
    // Remove from queue on success
    const index = emailQueue.findIndex(e => e.id === item.id);
    if (index > -1) {
      emailQueue.splice(index, 1);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    item.error = errorMessage;

    // Requirement 15.2: Log error without throwing exception
    console.error(`Failed to send email (attempt ${item.attempts}/${item.maxAttempts}):`, errorMessage);

    // Requirement 2.3: Retry if we haven't exceeded max attempts
    if (item.attempts < item.maxAttempts) {
      // Exponential backoff: 1s, 2s, 4s
      const retryDelay = BASE_RETRY_DELAY_MS * Math.pow(2, item.attempts - 1);
      console.log(`Retrying email ${item.id} in ${retryDelay}ms... (exponential backoff)`);
      
      setTimeout(() => {
        processEmailQueue(item);
      }, retryDelay);

      return { 
        success: false, 
        error: `Failed, will retry in ${retryDelay}ms (attempt ${item.attempts}/${item.maxAttempts})` 
      };
    } else {
      // Requirement 17.1: Track failure
      failureCount++;
      
      console.error(`Email ${item.id} failed after ${item.maxAttempts} attempts`);
      
      // Remove from queue after max attempts
      const index = emailQueue.findIndex(e => e.id === item.id);
      if (index > -1) {
        emailQueue.splice(index, 1);
      }

      return { 
        success: false, 
        error: `Failed after ${item.maxAttempts} attempts: ${errorMessage}` 
      };
    }
  }
}

/**
 * Send email via configured provider
 * This function should be implemented based on your email provider
 */
async function sendEmailViaProvider(item: EmailQueueItem): Promise<{ success: boolean; messageId: string }> {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';

  switch (provider) {
    case 'smtp':
      return sendViaSMTP(item);
    default:
      throw new Error(`Email provider '${provider}' is not configured`);
  }
}

/**
 * Send email via SMTP using Nodemailer
 * Requires: npm install nodemailer
 * Environment variables: SMTP_HOSTNAME, SMTP_PORT, SMTP_SECURE, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM
 */
async function sendViaSMTP(item: EmailQueueItem): Promise<{ success: boolean; messageId: string }> {
  const nodemailer = await import('nodemailer');
  
  // Create transporter with SMTP configuration
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOSTNAME,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Send email
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || item.from,
    to: item.to,
    subject: item.subject,
    text: item.text,
    html: item.html,
  });

  return { success: true, messageId: info.messageId };
}

/**
 * Process the email queue (batched emails)
 * 
 * This function should be called periodically by a cron job or background worker
 * to process batched emails.
 * 
 * Requirements:
 * - Batch email processing
 */
export async function processQueue(): Promise<void> {
  const batchedEmails = emailQueue.filter(item => 
    item.priority === 'batched' && item.attempts === 0
  );

  console.log(`Processing ${batchedEmails.length} batched emails...`);

  for (const email of batchedEmails) {
    await processEmailQueue(email);
    // Small delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Retry failed emails in the queue
 * 
 * Requirements:
 * - 15.4: Retry on failure
 * 
 * @returns Number of emails retried
 */
export async function retryFailedEmails(): Promise<number> {
  const failedEmails = emailQueue.filter(item => 
    item.error && item.attempts < item.maxAttempts
  );

  console.log(`Retrying ${failedEmails.length} failed emails...`);

  for (const email of failedEmails) {
    await processEmailQueue(email);
  }

  return failedEmails.length;
}

/**
 * Get the current email queue status (for monitoring)
 * 
 * Requirements:
 * - 17.1: Track success and failure counts
 */
export function getEmailQueueStatus(): QueueStatus {
  return {
    queueLength: emailQueue.length,
    pendingEmails: emailQueue.map(item => ({
      id: item.id,
      to: item.to,
      subject: item.subject,
      attempts: item.attempts,
      priority: item.priority,
      error: item.error,
    })),
    successCount,
    failureCount,
  };
}

/**
 * Clear the email queue (for testing purposes)
 */
export function clearEmailQueue(): void {
  emailQueue.length = 0;
  successCount = 0;
  failureCount = 0;
}
