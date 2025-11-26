/**
 * Validation utilities for bidding features
 * 
 * Provides validation functions for:
 * - Team invitations
 * - Section assignments
 * - Document uploads
 * - Deadlines
 * - Budget ranges
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate invitation code format (8 digits)
 */
export function validateInvitationCode(code: string): ValidationResult {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: "Invitation code is required" }
  }

  if (!/^\d{8}$/.test(code)) {
    return { valid: false, error: "Invitation code must be exactly 8 digits" }
  }

  return { valid: true }
}

/**
 * Validate expiration days for invitation
 */
export function validateExpirationDays(days: number): ValidationResult {
  if (isNaN(days)) {
    return { valid: false, error: "Expiration days must be a number" }
  }

  if (days < 1) {
    return { valid: false, error: "Expiration must be at least 1 day" }
  }

  if (days > 30) {
    return { valid: false, error: "Expiration cannot exceed 30 days" }
  }

  return { valid: true }
}

/**
 * Validate deadline against project deadline
 */
export function validateDeadline(
  deadline: Date | string,
  projectDeadline?: Date | string
): ValidationResult {
  const deadlineDate = new Date(deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isNaN(deadlineDate.getTime())) {
    return { valid: false, error: "Invalid deadline date" }
  }

  if (deadlineDate < today) {
    return { valid: false, error: "Deadline cannot be in the past" }
  }

  if (projectDeadline) {
    const projectDeadlineDate = new Date(projectDeadline)
    if (deadlineDate > projectDeadlineDate) {
      return {
        valid: false,
        error: "Section deadline must be before project deadline",
      }
    }
  }

  return { valid: true }
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number // in bytes
    allowedTypes?: string[]
  } = {}
): ValidationResult {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg",
      "image/png",
      "image/gif",
      "text/plain",
      "text/csv",
    ],
  } = options

  if (!file) {
    return { valid: false, error: "No file selected" }
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed. Supported types: PDF, Word, Excel, PowerPoint, Images, Text, CSV`,
    }
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0)
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
    return {
      valid: false,
      error: `File size ${fileSizeMB}MB exceeds maximum ${maxSizeMB}MB`,
    }
  }

  // Check file name
  if (file.name.length > 255) {
    return {
      valid: false,
      error: "File name is too long (maximum 255 characters)",
    }
  }

  return { valid: true }
}

/**
 * Validate budget range
 */
export function validateBudgetRange(
  min?: number,
  max?: number
): ValidationResult {
  if (min !== undefined && min < 0) {
    return { valid: false, error: "Minimum budget cannot be negative" }
  }

  if (max !== undefined && max < 0) {
    return { valid: false, error: "Maximum budget cannot be negative" }
  }

  if (min !== undefined && max !== undefined && min > max) {
    return {
      valid: false,
      error: "Minimum budget cannot be greater than maximum budget",
    }
  }

  return { valid: true }
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: "Email address is required" }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Invalid email address format" }
  }

  return { valid: true }
}

/**
 * Validate team member selection
 */
export function validateTeamMemberSelection(userId?: string): ValidationResult {
  if (!userId || userId.trim().length === 0) {
    return { valid: false, error: "Please select a team member" }
  }

  return { valid: true }
}

/**
 * Validate section title
 */
export function validateSectionTitle(title: string): ValidationResult {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: "Section title is required" }
  }

  if (title.length > 200) {
    return { valid: false, error: "Section title is too long (maximum 200 characters)" }
  }

  return { valid: true }
}

/**
 * Validate proposal title
 */
export function validateProposalTitle(title: string): ValidationResult {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: "Proposal title is required" }
  }

  if (title.length < 3) {
    return { valid: false, error: "Proposal title must be at least 3 characters" }
  }

  if (title.length > 200) {
    return { valid: false, error: "Proposal title is too long (maximum 200 characters)" }
  }

  return { valid: true }
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: string): ValidationResult {
  if (!query || query.trim().length === 0) {
    return { valid: false, error: "Search query cannot be empty" }
  }

  if (query.length > 500) {
    return { valid: false, error: "Search query is too long (maximum 500 characters)" }
  }

  return { valid: true }
}
