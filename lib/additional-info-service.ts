/**
 * Additional Info Service
 * 
 * Handles validation and storage of client-specified additional information
 * for proposal submissions. Provides type-based validation for different
 * field types and handles file upload validation.
 */

import { createClient } from '@/lib/supabase/server';
import { AdditionalInfoRequirement } from '@/lib/graphql/types';

/**
 * Input for additional info validation and storage
 */
export interface AdditionalInfoInput {
  fieldId: string;
  fieldName: string;
  fieldValue: any;
}

/**
 * Validation result for additional info
 */
export interface AdditionalInfoValidationResult {
  valid: boolean;
  errors: Record<string, string>; // fieldId -> error message
}

/**
 * File upload validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Supported file types for upload
 */
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
];

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Additional Info Service
 * Manages validation and storage of additional information for proposals
 */
export class AdditionalInfoService {
  /**
   * Validate additional info against project requirements
   * Performs type-based validation for each field
   */
  async validateAdditionalInfo(
    projectId: string,
    additionalInfo: AdditionalInfoInput[]
  ): Promise<AdditionalInfoValidationResult> {
    const errors: Record<string, string> = {};

    try {
      // Get project requirements
      const supabase = await createClient();
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('additional_info_requirements')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        return {
          valid: false,
          errors: { _general: 'Project not found' },
        };
      }

      const requirements: AdditionalInfoRequirement[] = 
        project.additional_info_requirements || [];

      // Create a map of provided info for quick lookup
      const providedInfoMap = new Map<string, AdditionalInfoInput>();
      additionalInfo.forEach(info => {
        providedInfoMap.set(info.fieldId, info);
      });

      // Validate each requirement
      for (const requirement of requirements) {
        const providedInfo = providedInfoMap.get(requirement.id);

        // Check if required field is missing
        if (requirement.required && !providedInfo) {
          errors[requirement.id] = `${requirement.fieldName} is required`;
          continue;
        }

        // Skip validation if field is not provided and not required
        if (!providedInfo) {
          continue;
        }

        // Validate based on field type
        const validationError = this.validateFieldByType(
          requirement,
          providedInfo.fieldValue
        );

        if (validationError) {
          errors[requirement.id] = validationError;
        }
      }

      return {
        valid: Object.keys(errors).length === 0,
        errors,
      };
    } catch (error) {
      console.error('Error validating additional info:', error);
      return {
        valid: false,
        errors: { _general: 'Validation failed due to an internal error' },
      };
    }
  }

  /**
   * Validate a field value based on its type
   */
  private validateFieldByType(
    requirement: AdditionalInfoRequirement,
    value: any
  ): string | null {
    const { fieldType, fieldName, options } = requirement;

    // Check for empty values
    if (value === null || value === undefined || value === '') {
      if (requirement.required) {
        return `${fieldName} is required`;
      }
      return null;
    }

    switch (fieldType) {
      case 'text':
      case 'textarea':
        return this.validateTextValue(value, fieldName);

      case 'number':
        return this.validateNumberValue(value, fieldName);

      case 'date':
        return this.validateDateValue(value, fieldName);

      case 'select':
        return this.validateSelectValue(value, fieldName, options);

      case 'file':
        return this.validateFileValue(value, fieldName);

      default:
        return `Unknown field type: ${fieldType}`;
    }
  }

  /**
   * Validate text field value
   */
  private validateTextValue(value: any, fieldName: string): string | null {
    if (typeof value !== 'string') {
      return `${fieldName} must be a text value`;
    }

    if (value.trim().length === 0) {
      return `${fieldName} cannot be empty`;
    }

    if (value.length > 5000) {
      return `${fieldName} must be 5000 characters or less`;
    }

    return null;
  }

  /**
   * Validate number field value
   */
  private validateNumberValue(value: any, fieldName: string): string | null {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (typeof numValue !== 'number' || isNaN(numValue)) {
      return `${fieldName} must be a valid number`;
    }

    if (!isFinite(numValue)) {
      return `${fieldName} must be a finite number`;
    }

    return null;
  }

  /**
   * Validate date field value
   */
  private validateDateValue(value: any, fieldName: string): string | null {
    if (typeof value !== 'string') {
      return `${fieldName} must be a valid date`;
    }

    // Try to parse the date
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return `${fieldName} must be a valid date`;
    }

    return null;
  }

  /**
   * Validate select field value
   */
  private validateSelectValue(
    value: any,
    fieldName: string,
    options?: string[]
  ): string | null {
    if (typeof value !== 'string') {
      return `${fieldName} must be a text value`;
    }

    if (options && options.length > 0) {
      if (!options.includes(value)) {
        return `${fieldName} must be one of: ${options.join(', ')}`;
      }
    }

    return null;
  }

  /**
   * Validate file field value
   */
  private validateFileValue(value: any, fieldName: string): string | null {
    // File value should be an object with url, name, type, and size
    if (typeof value !== 'object' || value === null) {
      return `${fieldName} must be a valid file`;
    }

    const { url, name, type, size } = value;

    if (!url || typeof url !== 'string') {
      return `${fieldName} must have a valid URL`;
    }

    if (!name || typeof name !== 'string') {
      return `${fieldName} must have a valid file name`;
    }

    if (!type || typeof type !== 'string') {
      return `${fieldName} must have a valid file type`;
    }

    if (typeof size !== 'number' || size <= 0) {
      return `${fieldName} must have a valid file size`;
    }

    // Validate file type
    const fileValidation = this.validateFileUpload(type, size);
    if (!fileValidation.valid) {
      return `${fieldName}: ${fileValidation.error}`;
    }

    return null;
  }

  /**
   * Validate file upload based on type and size
   */
  validateFileUpload(fileType: string, fileSize: number): FileValidationResult {
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(fileType)) {
      return {
        valid: false,
        error: `File type ${fileType} is not allowed. Allowed types: PDF, Word, Excel, Images, Text`,
      };
    }

    // Check file size
    if (fileSize > MAX_FILE_SIZE) {
      const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Store additional info for a proposal
   * Uses upsert to handle updates to existing fields
   */
  async storeAdditionalInfo(
    proposalId: string,
    additionalInfo: AdditionalInfoInput[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      // Prepare records for insertion
      const records = additionalInfo.map(info => ({
        proposal_id: proposalId,
        field_id: info.fieldId,
        field_name: info.fieldName,
        field_value: info.fieldValue,
      }));

      // Use upsert to insert or update records
      const { error } = await supabase
        .from('proposal_additional_info')
        .upsert(records, {
          onConflict: 'proposal_id,field_id',
        });

      if (error) {
        console.error('Error storing additional info:', error);
        return {
          success: false,
          error: `Failed to store additional information: ${error.message}`,
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in storeAdditionalInfo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to store additional information: ${errorMessage}`,
      };
    }
  }

  /**
   * Get additional info for a proposal
   */
  async getAdditionalInfo(
    proposalId: string
  ): Promise<AdditionalInfoInput[]> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('proposal_additional_info')
        .select('field_id, field_name, field_value')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching additional info:', error);
        return [];
      }

      return (data || []).map(record => ({
        fieldId: record.field_id,
        fieldName: record.field_name,
        fieldValue: record.field_value,
      }));
    } catch (error) {
      console.error('Error in getAdditionalInfo:', error);
      return [];
    }
  }

  /**
   * Delete additional info for a proposal
   * Useful when resetting or removing a proposal
   */
  async deleteAdditionalInfo(
    proposalId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from('proposal_additional_info')
        .delete()
        .eq('proposal_id', proposalId);

      if (error) {
        console.error('Error deleting additional info:', error);
        return {
          success: false,
          error: `Failed to delete additional information: ${error.message}`,
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in deleteAdditionalInfo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to delete additional information: ${errorMessage}`,
      };
    }
  }
}
