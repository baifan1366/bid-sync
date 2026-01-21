"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Upload, X, FileIcon } from "lucide-react"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface AdditionalInfoStepProps {
  requirements: AdditionalInfoRequirement[]
  initialData: Record<string, any>
  onNext: (data: Record<string, any>) => void
  onBack: () => void
}

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Allowed file types
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
]

/**
 * Build dynamic validation schema based on requirements
 */
function buildValidationSchema(requirements: AdditionalInfoRequirement[]) {
  const schemaFields: Record<string, z.ZodTypeAny> = {}

  requirements.forEach((req) => {
    let fieldSchema: z.ZodTypeAny

    switch (req.fieldType) {
      case 'text':
      case 'textarea':
        if (req.required) {
          fieldSchema = z.string()
            .min(1, `${req.fieldName} is required`)
            .max(5000, `${req.fieldName} must be 5000 characters or less`)
        } else {
          fieldSchema = z.string()
            .max(5000, `${req.fieldName} must be 5000 characters or less`)
            .optional()
            .or(z.literal(''))
        }
        break

      case 'number':
        if (req.required) {
          fieldSchema = z.string()
            .min(1, `${req.fieldName} is required`)
            .refine(
              (val) => !isNaN(Number(val)) && isFinite(Number(val)),
              { message: `${req.fieldName} must be a valid number` }
            )
        } else {
          fieldSchema = z.string()
            .refine(
              (val) => val === '' || (!isNaN(Number(val)) && isFinite(Number(val))),
              { message: `${req.fieldName} must be a valid number` }
            )
            .optional()
            .or(z.literal(''))
        }
        break

      case 'date':
        if (req.required) {
          fieldSchema = z.string()
            .min(1, `${req.fieldName} is required`)
            .refine(
              (val) => !isNaN(new Date(val).getTime()),
              { message: `${req.fieldName} must be a valid date` }
            )
        } else {
          fieldSchema = z.string()
            .refine(
              (val) => val === '' || !isNaN(new Date(val).getTime()),
              { message: `${req.fieldName} must be a valid date` }
            )
            .optional()
            .or(z.literal(''))
        }
        break

      case 'select':
        if (req.required) {
          fieldSchema = z.string()
            .min(1, `${req.fieldName} is required`)
          if (req.options && req.options.length > 0) {
            fieldSchema = (fieldSchema as z.ZodString).refine(
              (val) => req.options!.includes(val),
              { message: `${req.fieldName} must be one of the provided options` }
            )
          }
        } else {
          fieldSchema = z.string()
          if (req.options && req.options.length > 0) {
            fieldSchema = (fieldSchema as z.ZodString).refine(
              (val) => val === '' || req.options!.includes(val),
              { message: `${req.fieldName} must be one of the provided options` }
            )
          }
          fieldSchema = fieldSchema.optional().or(z.literal(''))
        }
        break

      case 'file':
        if (req.required) {
          fieldSchema = z.any().refine(
            (val: any) => val && val.url,
            { message: `${req.fieldName} is required` }
          )
        } else {
          fieldSchema = z.any().optional()
        }
        break

      default:
        fieldSchema = z.any()
    }

    schemaFields[req.id] = fieldSchema
  })

  return z.object(schemaFields)
}

export function AdditionalInfoStep({
  requirements,
  initialData,
  onNext,
  onBack,
}: AdditionalInfoStepProps) {
  // Sort requirements by order
  const sortedRequirements = [...requirements].sort((a, b) => a.order - b.order)

  // Build validation schema
  const validationSchema = buildValidationSchema(sortedRequirements)
  type FormData = z.infer<typeof validationSchema>

  // Initialize form
  const form = useForm<FormData>({
    resolver: zodResolver(validationSchema),
    mode: "onChange",
    defaultValues: sortedRequirements.reduce((acc, req) => {
      const value = initialData[req.id]
      
      // Handle different field types
      if (req.fieldType === 'file') {
        acc[req.id] = value || null
      } else if (req.fieldType === 'number') {
        acc[req.id] = value !== null && value !== undefined ? String(value) : ''
      } else {
        acc[req.id] = value || ''
      }
      
      return acc
    }, {} as Record<string, any>),
  })

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
  } = form

  // Watch all fields
  const watchedFields = watch()

  // File upload states
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({})
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({})

  // Handle file selection
  const handleFileSelect = async (requirementId: string, file: File) => {
    // Clear previous errors
    setFileErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[requirementId]
      return newErrors
    })

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFileErrors(prev => ({
        ...prev,
        [requirementId]: 'File type not allowed. Please upload PDF, Word, Excel, Images, or Text files.',
      }))
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setFileErrors(prev => ({
        ...prev,
        [requirementId]: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      }))
      return
    }

    // Set uploading state
    setUploadingFiles(prev => ({ ...prev, [requirementId]: true }))

    try {
      const supabase = createClient()
      
      // Generate unique file name
      const timestamp = Date.now()
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `${timestamp}_${sanitizedFileName}`
      const filePath = `additional-info/${fileName}`

      // Upload file to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proposal-documents')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('proposal-documents')
        .getPublicUrl(filePath)

      const fileData = {
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
        path: filePath,
      }

      setValue(requirementId, fileData, { shouldValidate: true })
    } catch (error) {
      console.error('Error uploading file:', error)
      setFileErrors(prev => ({
        ...prev,
        [requirementId]: 'Failed to upload file. Please try again.',
      }))
    } finally {
      setUploadingFiles(prev => ({ ...prev, [requirementId]: false }))
    }
  }

  // Handle file removal
  const handleFileRemove = (requirementId: string) => {
    setValue(requirementId, null, { shouldValidate: true })
    setFileErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[requirementId]
      return newErrors
    })
  }

  // Handle form submission
  const onSubmit = (data: FormData) => {
    // Convert form data to the expected format
    const additionalInfo: Record<string, any> = {}

    sortedRequirements.forEach((req) => {
      const value = data[req.id]
      
      // Convert number strings back to numbers
      if (req.fieldType === 'number' && value && value !== '') {
        additionalInfo[req.id] = Number(value)
      } else if (value !== '' && value !== null && value !== undefined) {
        additionalInfo[req.id] = value
      }
    })

    onNext(additionalInfo)
  }

  return (
    <div className="space-y-6" role="form" aria-labelledby="additional-info-title">
      {/* Step Description */}
      <div className="space-y-2">
        <h3 id="additional-info-title" className="text-lg font-semibold text-black dark:text-white">
          Additional Information
        </h3>
        <p className="text-sm text-muted-foreground" id="additional-info-description">
          Please provide the following information as requested by the client.
          Fields marked with * are required.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {sortedRequirements.map((requirement) => (
          <div key={requirement.id} className="space-y-2">
            <DynamicFieldRenderer
              requirement={requirement}
              control={control}
              error={errors[requirement.id]}
              fileError={fileErrors[requirement.id]}
              isUploading={uploadingFiles[requirement.id]}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              value={watchedFields[requirement.id]}
            />
          </div>
        ))}

        {/* Validation Summary */}
        {Object.keys(errors).length > 0 && (
          <div 
            role="alert" 
            aria-live="assertive"
            className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Please fix the following errors to continue:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                  {Object.entries(errors).map(([key, error]) => {
                    const req = sortedRequirements.find(r => r.id === key)
                    return (
                      <li key={key}>
                        {req?.fieldName}: {error?.message as string}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4" role="navigation" aria-label="Step navigation">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="border-yellow-400/40 hover:bg-yellow-400/10 focus-visible:ring-2 focus-visible:ring-yellow-400"
            aria-label="Go to previous step"
          >
            Back
          </Button>

          <Button
            type="submit"
            disabled={!isValid}
            className="bg-yellow-400 hover:bg-yellow-500 text-black disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
            aria-label={isValid ? "Proceed to review step" : "Complete all required fields to proceed"}
          >
            Next Step
          </Button>
        </div>
      </form>
    </div>
  )
}

/**
 * Dynamic Field Renderer
 * Renders different field types based on requirement
 */
interface DynamicFieldRendererProps {
  requirement: AdditionalInfoRequirement
  control: any
  error: any
  fileError?: string
  isUploading?: boolean
  onFileSelect: (requirementId: string, file: File) => void
  onFileRemove: (requirementId: string) => void
  value: any
}

function DynamicFieldRenderer({
  requirement,
  control,
  error,
  fileError,
  isUploading,
  onFileSelect,
  onFileRemove,
  value,
}: DynamicFieldRendererProps) {
  const { id, fieldName, fieldType, required, helpText, options } = requirement

  const labelText = required ? `${fieldName} *` : fieldName
  const hasError = !!error || !!fileError

  return (
    <div className="space-y-2">
      <Label 
        htmlFor={id} 
        className={cn(hasError && "text-red-600 dark:text-red-400")}
      >
        {labelText}
      </Label>

      <Controller
        name={id}
        control={control}
        render={({ field }) => {
          switch (fieldType) {
            case 'text':
              return (
                <Input
                  id={id}
                  placeholder={`Enter ${fieldName.toLowerCase()}`}
                  aria-required={required}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? `${id}-error` : helpText ? `${id}-help` : undefined}
                  {...field}
                  className={cn(hasError && "border-red-500 focus-visible:ring-red-500")}
                />
              )

            case 'textarea':
              return (
                <Textarea
                  id={id}
                  placeholder={`Enter ${fieldName.toLowerCase()}`}
                  rows={4}
                  aria-required={required}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? `${id}-error` : helpText ? `${id}-help` : undefined}
                  {...field}
                  className={cn(hasError && "border-red-500 focus-visible:ring-red-500")}
                />
              )

            case 'number':
              return (
                <Input
                  id={id}
                  type="number"
                  placeholder={`Enter ${fieldName.toLowerCase()}`}
                  aria-required={required}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? `${id}-error` : helpText ? `${id}-help` : undefined}
                  {...field}
                  className={cn(hasError && "border-red-500 focus-visible:ring-red-500")}
                />
              )

            case 'date':
              return (
                <Input
                  id={id}
                  type="date"
                  aria-required={required}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? `${id}-error` : helpText ? `${id}-help` : undefined}
                  {...field}
                  className={cn(hasError && "border-red-500 focus-visible:ring-red-500")}
                />
              )

            case 'select':
              return (
                <Select
                  value={field.value || ''}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id={id}
                    aria-required={required}
                    aria-invalid={hasError}
                    aria-describedby={hasError ? `${id}-error` : helpText ? `${id}-help` : undefined}
                    className={cn(hasError && "border-red-500 focus-visible:ring-red-500")}
                  >
                    <SelectValue placeholder={`Select ${fieldName.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )

            case 'file':
              return (
                <FileUploadField
                  id={id}
                  value={value}
                  isUploading={isUploading}
                  hasError={hasError}
                  onFileSelect={(file) => onFileSelect(id, file)}
                  onFileRemove={() => onFileRemove(id)}
                />
              )

            default:
              return (
                <Input
                  id={id}
                  placeholder={`Enter ${fieldName.toLowerCase()}`}
                  {...field}
                  className={cn(hasError && "border-red-500 focus-visible:ring-red-500")}
                />
              )
          }
        }}
      />

      {/* Help Text */}
      {helpText && !hasError && (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">{helpText}</p>
      )}

      {/* Error Message */}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error.message}
        </p>
      )}

      {/* File Error Message */}
      {fileError && (
        <p id={`${id}-error`} className="text-sm text-red-600 dark:text-red-400" role="alert">
          {fileError}
        </p>
      )}
    </div>
  )
}

/**
 * File Upload Field Component
 */
interface FileUploadFieldProps {
  id: string
  value: any
  isUploading?: boolean
  hasError: boolean
  onFileSelect: (file: File) => void
  onFileRemove: () => void
}

function FileUploadField({
  id,
  value,
  isUploading,
  hasError,
  onFileSelect,
  onFileRemove,
}: FileUploadFieldProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <div>
      {!value ? (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-colors",
            hasError
              ? "border-red-500 hover:border-red-600"
              : "border-yellow-400/40 hover:border-yellow-400/60",
            isUploading && "opacity-50 pointer-events-none"
          )}
        >
          <input
            id={id}
            type="file"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
            aria-label="Upload file"
            aria-describedby={`${id}-upload-help`}
          />
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <Upload className="w-8 h-8 text-yellow-400" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-black dark:text-white">
                {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
              </p>
              <p id={`${id}-upload-help`} className="text-xs text-muted-foreground">
                PDF, Word, Excel, Images, or Text files (max 10MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 border border-yellow-400/40 rounded-lg bg-yellow-400/5" role="group" aria-label="Uploaded file">
          <FileIcon className="w-8 h-8 text-yellow-400 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-black dark:text-white truncate">
              {value.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {(value.size / 1024).toFixed(2)} KB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onFileRemove}
            className="shrink-0 hover:bg-red-500/10 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label={`Remove file ${value.name}`}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
