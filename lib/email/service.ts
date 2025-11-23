/**
 * Email Service for BidSync
 * 
 * This service handles sending emails with retry logic and error handling.
 * In development, emails are logged to console. In production, configure
 * an email provider (Resend, SendGrid, AWS SES, etc.)
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

interface EmailQueueItem extends EmailOptions {
  id: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}

// In-memory queue for email jobs (in production, use a proper queue like Bull or AWS SQS)
const emailQueue: EmailQueueItem[] = [];
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds

/**
 * Send an email
 * @param options Email options including recipient, subject, and content
 * @returns Promise that resolves when email is queued
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const emailId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const queueItem: EmailQueueItem = {
    ...options,
    id: emailId,
    attempts: 0,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    createdAt: new Date(),
    from: options.from || process.env.EMAIL_FROM || 'noreply@bidsync.com',
  };

  // Add to queue
  emailQueue.push(queueItem);

  // Process immediately (in production, this would be handled by a background worker)
  return processEmailQueue(queueItem);
}

/**
 * Process an email from the queue
 */
async function processEmailQueue(item: EmailQueueItem): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
      console.log('━'.repeat(60));
      console.log('Text Content:');
      console.log(item.text);
      console.log('━'.repeat(60));
      console.log(`HTML Content Length: ${item.html.length} characters`);
      console.log('━'.repeat(60) + '\n');

      return { success: true, messageId: item.id };
    }

    // Production email sending
    const result = await sendEmailViaProvider(item);
    
    // Remove from queue on success
    const index = emailQueue.findIndex(e => e.id === item.id);
    if (index > -1) {
      emailQueue.splice(index, 1);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    item.error = errorMessage;

    console.error(`Failed to send email (attempt ${item.attempts}/${item.maxAttempts}):`, errorMessage);

    // Retry if we haven't exceeded max attempts
    if (item.attempts < item.maxAttempts) {
      console.log(`Retrying email ${item.id} in ${RETRY_DELAY_MS}ms...`);
      
      setTimeout(() => {
        processEmailQueue(item);
      }, RETRY_DELAY_MS);

      return { success: false, error: `Failed, will retry (attempt ${item.attempts}/${item.maxAttempts})` };
    } else {
      console.error(`Email ${item.id} failed after ${item.maxAttempts} attempts`);
      
      // Remove from queue after max attempts
      const index = emailQueue.findIndex(e => e.id === item.id);
      if (index > -1) {
        emailQueue.splice(index, 1);
      }

      return { success: false, error: `Failed after ${item.maxAttempts} attempts: ${errorMessage}` };
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
 * Get the current email queue status (for monitoring)
 */
export function getEmailQueueStatus(): {
  queueLength: number;
  pendingEmails: Array<{ id: string; to: string; subject: string; attempts: number; error?: string }>;
} {
  return {
    queueLength: emailQueue.length,
    pendingEmails: emailQueue.map(item => ({
      id: item.id,
      to: item.to,
      subject: item.subject,
      attempts: item.attempts,
      error: item.error,
    })),
  };
}

/**
 * Clear the email queue (for testing purposes)
 */
export function clearEmailQueue(): void {
  emailQueue.length = 0;
}
