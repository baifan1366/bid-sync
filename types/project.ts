// Project-related types
export type ProjectStatus = 'PENDING_REVIEW' | 'OPEN' | 'CLOSED' | 'AWARDED'

export interface AdditionalInfoRequirement {
  id: string
  fieldName: string
  fieldType: 'text' | 'number' | 'date' | 'file' | 'textarea' | 'select'
  required: boolean
  helpText?: string
  options?: string[]
  order: number
}

export interface Project {
  id: string
  clientId: string
  title: string
  description: string
  status: ProjectStatus
  budget?: number
  deadline?: string
  additionalInfoRequirements?: AdditionalInfoRequirement[]
  createdAt: string
  updatedAt: string
}

export interface CreateProjectData {
  title: string
  description: string
  budget?: number
  deadline?: string
}

export interface UpdateProjectData {
  title?: string
  description?: string
  budget?: number
  deadline?: string
  status?: ProjectStatus
}

// API Response types
export interface GetProjectsResponse {
  success: boolean
  projects?: Project[]
  error?: string
}

export interface GetProjectResponse {
  success: boolean
  project?: Project
  error?: string
}

export interface CreateProjectResponse {
  success: boolean
  project?: Project
  error?: string
}

export interface UpdateProjectResponse {
  success: boolean
  project?: Project
  error?: string
}
