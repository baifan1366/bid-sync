/**
 * Project Discovery Service (Server-Side)
 * 
 * Server-side implementation that directly accesses the database.
 * Used by GraphQL resolvers and API routes.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { createClient } from '@/lib/supabase/server'
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
 * Project Discovery Service (Server-Side)
 * 
 * Handles all operations related to discovering and browsing project openings
 */
export class ProjectDiscoveryServiceServer {
  /**
   * Get all open projects with optional filtering
   */
  static async getOpenProjects(filter?: ProjectFilter): Promise<Project[]> {
    const supabase = await createClient()
    
    const dbStatus = filter?.status ? filter.status.toLowerCase() : 'open'
    
    let query = supabase
      .from('projects')
      .select(`
        id,
        client_id,
        title,
        description,
        status,
        budget,
        deadline,
        additional_info_requirements,
        created_at,
        updated_at
      `)
      .eq('status', dbStatus)
      .order('created_at', { ascending: false })

    if (filter?.budgetMin !== undefined) {
      query = query.gte('budget', filter.budgetMin)
    }
    if (filter?.budgetMax !== undefined) {
      query = query.lte('budget', filter.budgetMax)
    }
    if (filter?.deadlineBefore) {
      query = query.lte('deadline', filter.deadlineBefore.toISOString())
    }
    if (filter?.deadlineAfter) {
      query = query.gte('deadline', filter.deadlineAfter.toISOString())
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch open projects: ${error.message}`)
    }

    const projects = (data || []).map(this.mapProjectFromDb)

    if (filter?.searchTerm) {
      return this.filterBySearchTerm(projects, filter.searchTerm)
    }

    return projects
  }

  /**
   * Search projects across title, description, and requirements
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
   */
  static async getProjectDetail(projectId: string): Promise<ProjectDetail> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        client_id,
        title,
        description,
        status,
        budget,
        deadline,
        additional_info_requirements,
        created_at,
        updated_at
      `)
      .eq('id', projectId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch project details: ${error.message}`)
    }

    if (!data) {
      throw new Error('Project not found')
    }

    const { data: clientData, error: clientError } = await supabase
      .from('users')
      .select('id, email, raw_user_meta_data')
      .eq('id', data.client_id)
      .single()

    if (clientError) {
      console.warn(`Failed to fetch client information: ${clientError.message}`)
    }

    const project = this.mapProjectFromDb(data)

    const projectDetail: ProjectDetail = {
      ...project,
      client: clientData
        ? {
            id: clientData.id,
            email: clientData.email,
            name: clientData.raw_user_meta_data?.name || clientData.raw_user_meta_data?.full_name,
          }
        : undefined,
    }

    return projectDetail
  }

  /**
   * Filter projects by search term across multiple fields
   */
  private static filterBySearchTerm(
    projects: Project[],
    searchTerm: string
  ): Project[] {
    const lowerSearchTerm = searchTerm.toLowerCase().trim()

    if (!lowerSearchTerm) {
      return projects
    }

    return projects.filter((project) => {
      if (project.title.toLowerCase().includes(lowerSearchTerm)) {
        return true
      }

      if (project.description.toLowerCase().includes(lowerSearchTerm)) {
        return true
      }

      if (project.additionalInfoRequirements) {
        const requirementsText = project.additionalInfoRequirements
          .map((req) => `${req.fieldName} ${req.helpText || ''}`)
          .join(' ')
          .toLowerCase()

        if (requirementsText.includes(lowerSearchTerm)) {
          return true
        }
      }

      return false
    })
  }

  /**
   * Map database project record to Project type
   */
  private static mapProjectFromDb(dbProject: any): Project {
    return {
      id: dbProject.id,
      clientId: dbProject.client_id,
      title: dbProject.title,
      description: dbProject.description,
      status: dbProject.status.toUpperCase() as ProjectStatus,
      budget: dbProject.budget,
      deadline: dbProject.deadline,
      additionalInfoRequirements: dbProject.additional_info_requirements || [],
      createdAt: dbProject.created_at,
      updatedAt: dbProject.updated_at,
    }
  }
}
