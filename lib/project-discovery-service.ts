/**
 * Project Discovery Service
 * 
 * Provides functionality for bidding leads to browse, filter, search, and view
 * project openings in the marketplace.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import type { Project, ProjectStatus } from '@/types/project'

/**
 * Filter criteria for project discovery
 */
export interface ProjectFilter {
  budgetMin?: number
  budgetMax?: number
  deadlineBefore?: Date
  deadlineAfter?: Date
  category?: string
  searchTerm?: string
  status?: ProjectStatus
}

/**
 * Detailed project information including client details
 */
export interface ProjectDetail extends Project {
  client?: {
    id: string
    email: string
    name?: string
  }
}

/**
 * Project Discovery Service
 * 
 * Handles all operations related to discovering and browsing project openings
 */
export class ProjectDiscoveryService {
  /**
   * Get all open projects with optional filtering
   * 
   * Requirement 1.1: Display all projects with status "open"
   * Requirement 1.3: Support filtering by budget range, deadline, and category
   * 
   * @param filter - Optional filter criteria
   * @returns Array of projects matching the filter criteria
   */
  static async getOpenProjects(filter?: ProjectFilter): Promise<Project[]> {
    // Build query parameters
    const params = new URLSearchParams()
    
    if (filter?.status) {
      params.append('status', filter.status)
    }
    if (filter?.budgetMin !== undefined) {
      params.append('budgetMin', filter.budgetMin.toString())
    }
    if (filter?.budgetMax !== undefined) {
      params.append('budgetMax', filter.budgetMax.toString())
    }
    if (filter?.deadlineBefore) {
      params.append('deadlineBefore', filter.deadlineBefore.toISOString())
    }
    if (filter?.deadlineAfter) {
      params.append('deadlineAfter', filter.deadlineAfter.toISOString())
    }
    if (filter?.searchTerm) {
      params.append('searchTerm', filter.searchTerm)
    }

    const response = await fetch(`/api/projects?${params.toString()}`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch open projects')
    }

    const { projects } = await response.json()
    return projects
  }

  /**
   * Search projects across title, description, and requirements
   * 
   * Requirement 1.4: Search across project titles, descriptions, and requirements
   * 
   * @param query - Search query string
   * @param filter - Optional additional filter criteria
   * @returns Array of projects matching the search query
   */
  static async searchProjects(
    query: string,
    filter?: Omit<ProjectFilter, 'searchTerm'>
  ): Promise<Project[]> {
    return this.getOpenProjects({
      ...filter,
      searchTerm: query,
    })
  }

  /**
   * Get complete project details including client information
   * 
   * Requirement 1.2: Display project title, description, budget range, deadline, and client information
   * Requirement 1.5: Display complete project information including required documents and additional info requirements
   * 
   * @param projectId - The ID of the project to retrieve
   * @returns Complete project details with client information
   */
  static async getProjectDetail(projectId: string): Promise<ProjectDetail> {
    const response = await fetch(`/api/projects/${projectId}`)
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch project details')
    }

    const { project } = await response.json()
    return project
  }

}
