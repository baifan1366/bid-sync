/**
 * Validation Utilities
 * 
 * Centralized validation functions for proposal submission workflow.
 * Provides type-based validation, budget validation, file validation,
 * and error message generation.
 * 
 * Requirements: 3.2, 3.3, 3.5, 4.3, 4.5
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * File validation configuration
 */
export const FILE_VALIDATION_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
  ] as string[],
  allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.txt'] as string[],
}

/**
 * Text field validation limits
 */
export const TEXT_VALIDATION_CONFIG = {
  maxLength: 5000,
  minLength: 1,
} as const

/**
 * Budget validation limits
 */
export const BUDGET_VALIDATION_CONFIG = {
  min: 0,
  max: 1000000000, // 1 billion
} as const

/**
 * Validate required field
 * Checks if a value is present and not empty
 */
export function validateRequired(
  value: any,
  fieldName: string
): ValidationResult {
  if (value === null || value === undefined) {
    return {
      valid: false,
      error: generateErrorMessage('required', fieldName),
    }
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return {
      valid: false,
      error: generateErrorMessage('required', fieldName),
    }
  }

  return { valid: true }
}

/**
 * Validate text field
 * Checks string length and content
 */
export function validateText(
  value: any,
  fieldName: string,
  options: {
    required?: boolean
    minLength?: number
    maxLength?: number
  } = {}
): ValidationResult {
  const {
    required = false,
    minLength = TEXT_VALIDATION_CONFIG.minLength,
    maxLength = TEXT_VALIDATION_CONFIG.maxLength,
  } = options

  // Check if required
  if (required) {
    const requiredCheck = validateRequired(value, fieldName)
    if (!requiredCheck.valid) {
      return requiredCheck
    }
  }

  // Allow empty if not required
  if (!required && (!value || value === '')) {
    return { valid: true }
  }

  // Check type
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: generateErrorMessage('invalidType', fieldName, { expectedType: 'text' }),
    }
  }

  // Check if empty after trim
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return {
      valid: false,
      error: generateErrorMessage('empty', fieldName),
    }
  }

  // Check minimum length
  if (trimmedValue.length < minLength) {
    return {
      valid: false,
      error: generateErrorMessage('minLength', fieldName, { minLength }),
    }
  }

  // Check maximum length
  if (value.length > maxLength) {
    return {
      valid: false,
      error: generateErrorMessage('maxLength', fieldName, { maxLength }),
    }
  }

  return { valid: true }
}

/**
 * Validate number field
 * Checks if value is a valid finite number
 */
export function validateNumber(
  value: any,
  fieldName: string,
  options: {
    required?: boolean
    min?: number
    max?: number
    allowNegative?: boolean
  } = {}
): ValidationResult {
  const {
    required = false,
    min,
    max,
    allowNegative = true,
  } = options

  // Check if required
  if (required) {
    const requiredCheck = validateRequired(value, fieldName)
    if (!requiredCheck.valid) {
      return requiredCheck
    }
  }

  // Allow empty if not required
  if (!required && (value === null || value === undefined || value === '')) {
    return { valid: true }
  }

  // Convert string to number if needed
  const numValue = typeof value === 'string' ? parseFloat(value) : value

  // Check if valid number
  if (typeof numValue !== 'number' || isNaN(numValue)) {
    return {
      valid: false,
      error: generateErrorMessage('invalidType', fieldName, { expectedType: 'number' }),
    }
  }

  // Check if finite
  if (!isFinite(numValue)) {
    return {
      valid: false,
      error: generateErrorMessage('invalidNumber', fieldName),
    }
  }

  // Check if negative when not allowed
  if (!allowNegative && numValue < 0) {
    return {
      valid: false,
      error: generateErrorMessage('negative', fieldName),
    }
  }

  // Check minimum value
  if (min !== undefined && numValue < min) {
    return {
      valid: false,
      error: generateErrorMessage('minValue', fieldName, { min }),
    }
  }

  // Check maximum value
  if (max !== undefined && numValue > max) {
    return {
      valid: false,
      error: generateErrorMessage('maxValue', fieldName, { max }),
    }
  }

  return { valid: true }
}

/**
 * Validate budget field
 * Specialized number validation for budget estimates
 * Requirements: 3.2, 3.3, 3.5
 */
export function validateBudget(
  value: any,
  fieldName: string = 'Budget',
  options: {
    required?: boolean
  } = {}
): ValidationResult {
  const { required = true } = options

  return validateNumber(value, fieldName, {
    required,
    min: BUDGET_VALIDATION_CONFIG.min,
    max: BUDGET_VALIDATION_CONFIG.max,
    allowNegative: false,
  })
}

/**
 * Validate date field
 * Checks if value is a valid date
 */
export function validateDate(
  value: any,
  fieldName: string,
  options: {
    required?: boolean
    minDate?: Date
    maxDate?: Date
  } = {}
): ValidationResult {
  const {
    required = false,
    minDate,
    maxDate,
  } = options

  // Check if required
  if (required) {
    const requiredCheck = validateRequired(value, fieldName)
    if (!requiredCheck.valid) {
      return requiredCheck
    }
  }

  // Allow empty if not required
  if (!required && (!value || value === '')) {
    return { valid: true }
  }

  // Check type
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return {
      valid: false,
      error: generateErrorMessage('invalidType', fieldName, { expectedType: 'date' }),
    }
  }

  // Try to parse date
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) {
    return {
      valid: false,
      error: generateErrorMessage('invalidDate', fieldName),
    }
  }

  // Check minimum date
  if (minDate && date < minDate) {
    return {
      valid: false,
      error: generateErrorMessage('minDate', fieldName, { minDate: minDate.toLocaleDateString() }),
    }
  }

  // Check maximum date
  if (maxDate && date > maxDate) {
    return {
      valid: false,
      error: generateErrorMessage('maxDate', fieldName, { maxDate: maxDate.toLocaleDateString() }),
    }
  }

  return { valid: true }
}

/**
 * Validate select field
 * Checks if value is one of the allowed options
 */
export function validateSelect(
  value: any,
  fieldName: string,
  options: {
    required?: boolean
    allowedOptions?: string[]
  } = {}
): ValidationResult {
  const {
    required = false,
    allowedOptions = [],
  } = options

  // Check if required
  if (required) {
    const requiredCheck = validateRequired(value, fieldName)
    if (!requiredCheck.valid) {
      return requiredCheck
    }
  }

  // Allow empty if not required
  if (!required && (!value || value === '')) {
    return { valid: true }
  }

  // Check type
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: generateErrorMessage('invalidType', fieldName, { expectedType: 'text' }),
    }
  }

  // Check if value is in allowed options
  if (allowedOptions.length > 0 && !allowedOptions.includes(value)) {
    return {
      valid: false,
      error: generateErrorMessage('invalidOption', fieldName, { options: allowedOptions }),
    }
  }

  return { valid: true }
}

/**
 * Validate file upload
 * Checks file type and size
 * Requirements: 4.3, 4.5
 */
export function validateFile(
  file: File | { type: string; size: number; name: string },
  fieldName: string = 'File',
  options: {
    required?: boolean
    maxSize?: number
    allowedTypes?: string[]
  } = {}
): ValidationResult {
  const {
    required = false,
    maxSize = FILE_VALIDATION_CONFIG.maxSize,
    allowedTypes = FILE_VALIDATION_CONFIG.allowedTypes,
  } = options

  // Check if required
  if (required && !file) {
    return {
      valid: false,
      error: generateErrorMessage('required', fieldName),
    }
  }

  // Allow empty if not required
  if (!required && !file) {
    return { valid: true }
  }

  // Check if file object is valid
  if (!file || typeof file !== 'object') {
    return {
      valid: false,
      error: generateErrorMessage('invalidFile', fieldName),
    }
  }

  // Check file type
  if (!file.type || typeof file.type !== 'string') {
    return {
      valid: false,
      error: generateErrorMessage('invalidFile', fieldName),
    }
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: generateErrorMessage('invalidFileType', fieldName, {
        allowedTypes: getFileTypeDescription(allowedTypes),
      }),
    }
  }

  // Check file size
  if (typeof file.size !== 'number' || file.size <= 0) {
    return {
      valid: false,
      error: generateErrorMessage('invalidFile', fieldName),
    }
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: generateErrorMessage('fileTooLarge', fieldName, {
        maxSize: formatFileSize(maxSize),
      }),
    }
  }

  return { valid: true }
}

/**
 * Validate file by stored value
 * For validating file objects that have been uploaded and stored
 */
export function validateFileValue(
  value: any,
  fieldName: string,
  options: {
    required?: boolean
  } = {}
): ValidationResult {
  const { required = false } = options

  // Check if required
  if (required && !value) {
    return {
      valid: false,
      error: generateErrorMessage('required', fieldName),
    }
  }

  // Allow empty if not required
  if (!required && !value) {
    return { valid: true }
  }

  // Check if value is an object with required properties
  if (typeof value !== 'object' || value === null) {
    return {
      valid: false,
      error: generateErrorMessage('invalidFile', fieldName),
    }
  }

  const { url, name, type, size } = value

  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: generateErrorMessage('invalidFile', fieldName),
    }
  }

  if (!name || typeof name !== 'string') {
    return {
      valid: false,
      error: generateErrorMessage('invalidFile', fieldName),
    }
  }

  if (!type || typeof type !== 'string') {
    return {
      valid: false,
      error: generateErrorMessage('invalidFile', fieldName),
    }
  }

  if (typeof size !== 'number' || size <= 0) {
    return {
      valid: false,
      error: generateErrorMessage('invalidFile', fieldName),
    }
  }

  // Validate file type and size
  return validateFile({ type, size, name }, fieldName, { required: false })
}

/**
 * Validate field by type
 * Generic validation function that routes to specific validators
 */
export function validateFieldByType(
  value: any,
  fieldName: string,
  fieldType: 'text' | 'textarea' | 'number' | 'date' | 'file' | 'select',
  options: {
    required?: boolean
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    allowedOptions?: string[]
  } = {}
): ValidationResult {
  switch (fieldType) {
    case 'text':
    case 'textarea':
      return validateText(value, fieldName, options)

    case 'number':
      return validateNumber(value, fieldName, options)

    case 'date':
      return validateDate(value, fieldName, options)

    case 'select':
      return validateSelect(value, fieldName, options)

    case 'file':
      return validateFileValue(value, fieldName, options)

    default:
      return {
        valid: false,
        error: `Unknown field type: ${fieldType}`,
      }
  }
}

/**
 * Error message types
 */
type ErrorMessageType =
  | 'required'
  | 'empty'
  | 'invalidType'
  | 'invalidNumber'
  | 'negative'
  | 'minLength'
  | 'maxLength'
  | 'minValue'
  | 'maxValue'
  | 'invalidDate'
  | 'minDate'
  | 'maxDate'
  | 'invalidOption'
  | 'invalidFile'
  | 'invalidFileType'
  | 'fileTooLarge'

/**
 * Generate validation error message
 * Creates user-friendly error messages for validation failures
 */
export function generateErrorMessage(
  type: ErrorMessageType,
  fieldName: string,
  context?: Record<string, any>
): string {
  switch (type) {
    case 'required':
      return `${fieldName} is required`

    case 'empty':
      return `${fieldName} cannot be empty`

    case 'invalidType':
      return `${fieldName} must be a ${context?.expectedType || 'valid'} value`

    case 'invalidNumber':
      return `${fieldName} must be a valid finite number`

    case 'negative':
      return `${fieldName} must be a positive number`

    case 'minLength':
      return `${fieldName} must be at least ${context?.minLength} characters`

    case 'maxLength':
      return `${fieldName} must be ${context?.maxLength} characters or less`

    case 'minValue':
      return `${fieldName} must be at least ${context?.min}`

    case 'maxValue':
      return `${fieldName} must be ${context?.max} or less`

    case 'invalidDate':
      return `${fieldName} must be a valid date`

    case 'minDate':
      return `${fieldName} must be on or after ${context?.minDate}`

    case 'maxDate':
      return `${fieldName} must be on or before ${context?.maxDate}`

    case 'invalidOption':
      const options = context?.options || []
      return `${fieldName} must be one of: ${options.join(', ')}`

    case 'invalidFile':
      return `${fieldName} must be a valid file`

    case 'invalidFileType':
      return `${fieldName} file type is not allowed. Allowed types: ${context?.allowedTypes || 'PDF, Word, Excel, Images, Text'}`

    case 'fileTooLarge':
      return `${fieldName} size exceeds maximum allowed size of ${context?.maxSize || '10MB'}`

    default:
      return `${fieldName} is invalid`
  }
}

/**
 * Helper: Get human-readable file type description
 */
function getFileTypeDescription(mimeTypes: string[]): string {
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'image/jpeg': 'Images',
    'image/png': 'Images',
    'image/gif': 'Images',
    'text/plain': 'Text',
  }

  const uniqueTypes = new Set(mimeTypes.map(type => typeMap[type] || 'Unknown'))
  return Array.from(uniqueTypes).join(', ')
}

/**
 * Helper: Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Batch validate multiple fields
 * Returns all validation errors
 */
export function validateFields(
  fields: Array<{
    value: any
    fieldName: string
    fieldType: 'text' | 'textarea' | 'number' | 'date' | 'file' | 'select'
    options?: {
      required?: boolean
      minLength?: number
      maxLength?: number
      min?: number
      max?: number
      allowedOptions?: string[]
    }
  }>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  fields.forEach(({ value, fieldName, fieldType, options }) => {
    const result = validateFieldByType(value, fieldName, fieldType, options)
    if (!result.valid && result.error) {
      errors[fieldName] = result.error
    }
  })

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
