/**
 * Archive Service
 * 
 * Handles project archival including data collection, compression, storage,
 * retrieval, and search functionality for completed projects.
 * 
 * Implements requirements 6.1, 6.2, 6.3, 6.4, 6.5, 7.3, 7.4 from the 
 * project-delivery-archival spec.
 */

import { createClient } from '@/lib/supabase/server';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { LoggingService } from '@/lib/logging-service';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Default retention period: 7 years
const DEFAULT_RETENTION_YEARS = 7;

export interface ProjectArchive {
  id: string;
  projectId: string;
  archiveIdentifier: string;
  archiveData: ArchiveData;
  compressedSize: number;
  originalSize: number;
  compressionRatio: number;
  archivedBy: string;
  archivedAt: Date;
  retentionUntil?: Date;
  legalHold: boolean;
  legalHoldReason?: string;
  accessCount: number;
  lastAccessedAt?: Date;
}

export interface ArchiveData {
  project: {
    id: string;
    title: string;
    description: string;
    budget?: number;
    deadline?: Date;
    clientId: string;
    status: string;
    createdAt: Date;
    completedAt: Date;
  };
  proposals: Array<{
    id: string;
    leadId: string;
    status: string;
    submittedAt?: Date;
    versions: Array<{
      versionNumber: number;
      content: any;
      createdBy: string;
      createdAt: Date;
    }>;
  }>;
  deliverables: Array<{
    id: string;
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    description?: string;
    uploadedBy: string;
    uploadedAt: Date;
  }>;
  workspaces: Array<{
    id: string;
    name: string;
    documents: Array<{
      id: string;
      title: string;
      content: any;
      createdBy: string;
      createdAt: Date;
    }>;
  }>;
  comments: Array<{
    id: string;
    authorId: string;
    message: string;
    visibility: string;
    createdAt: Date;
  }>;
  metadata: {
    archivedAt: Date;
    archivedBy: string;
    version: string;
  };
}

export interface CreateArchiveResult {
  success: boolean;
  archive?: ProjectArchive;
  error?: string;
  errorCode?: 
    | 'NOT_FOUND'
    | 'INVALID_STATUS'
    | 'UNAUTHORIZED'
    | 'COMPRESSION_FAILED'
    | 'DATABASE_ERROR'
    | 'UNKNOWN';
}

export interface GetArchiveResult {
  success: boolean;
  archive?: ProjectArchive;
  error?: string;
  errorCode?: 
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'DECOMPRESSION_FAILED'
    | 'UNKNOWN';
}

export interface SearchArchivesResult {
  success: boolean;
  archives?: ProjectArchive[];
  error?: string;
}

/**
 * ArchiveService class for managing project archives
 */
export class ArchiveService {
  /**
   * Creates an archive for a completed project
   * 
   * Requirements:
   * - 6.1: Create archive record containing all project data
   * - 6.2: Include project details, proposals, deliverables, documents, comments, version history
   * - 6.3: Generate unique archive identifier
   * - 6.4: Store archive creation timestamp
   * - 6.5: Compress archive data
   * 
   * @param projectId - Project ID to archive
   * @param userId - User ID performing the archival (typically system)
   * @returns CreateArchiveResult with archive data or error
   */
  static async createArchive(
    projectId: string,
    userId: string
  ): Promise<CreateArchiveResult> {
    const timer = LoggingService.startTimer();
    
    try {
      const supabase = await createClient();

      // Verify project exists and is completed
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        return {
          success: false,
          error: 'Project not found',
          errorCode: 'NOT_FOUND',
        };
      }

      if (project.status !== 'completed') {
        return {
          success: false,
          error: `Cannot archive project. Project status is ${project.status}`,
          errorCode: 'INVALID_STATUS',
        };
      }

      // Check if archive already exists
      const { data: existingArchive } = await supabase
        .from('project_archives')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      if (existingArchive) {
        return {
          success: false,
          error: 'Archive already exists for this project',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Requirement 6.2: Collect all project data
      const archiveData = await this.collectProjectData(projectId);

      // Requirement 6.5: Compress archive data
      const compressionResult = await this.compressArchiveData(archiveData);

      if (!compressionResult.success) {
        return {
          success: false,
          error: 'Failed to compress archive data',
          errorCode: 'COMPRESSION_FAILED',
        };
      }

      // Requirement 6.3: Generate unique archive identifier
      const archiveIdentifier = this.generateArchiveIdentifier(projectId);

      // Calculate retention date (7 years from now)
      const retentionUntil = new Date();
      retentionUntil.setFullYear(retentionUntil.getFullYear() + DEFAULT_RETENTION_YEARS);

      // Create archive record
      const { data: archive, error: archiveError } = await supabase
        .from('project_archives')
        .insert({
          project_id: projectId,
          archive_identifier: archiveIdentifier,
          archive_data: compressionResult.compressed,
          compressed_size: compressionResult.compressedSize,
          original_size: compressionResult.originalSize,
          compression_ratio: compressionResult.ratio,
          archived_by: userId,
          archived_at: new Date().toISOString(),
          retention_until: retentionUntil.toISOString(),
          legal_hold: false,
          access_count: 0,
        })
        .select('*')
        .single();

      if (archiveError || !archive) {
        console.error('Error creating archive record:', archiveError);
        
        await LoggingService.logArchiveCreate(
          userId,
          projectId,
          '',
          archiveIdentifier,
          0,
          0,
          0,
          false,
          timer()
        );
        
        return {
          success: false,
          error: 'Failed to create archive record',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Log successful archive creation
      const duration = timer();
      await LoggingService.logArchiveCreate(
        userId,
        projectId,
        archive.id,
        archiveIdentifier,
        archive.compressed_size,
        archive.original_size,
        archive.compression_ratio,
        true,
        duration
      );

      return {
        success: true,
        archive: {
          id: archive.id,
          projectId: archive.project_id,
          archiveIdentifier: archive.archive_identifier,
          archiveData: archiveData,
          compressedSize: archive.compressed_size,
          originalSize: archive.original_size,
          compressionRatio: archive.compression_ratio,
          archivedBy: archive.archived_by,
          archivedAt: new Date(archive.archived_at),
          retentionUntil: archive.retention_until ? new Date(archive.retention_until) : undefined,
          legalHold: archive.legal_hold,
          legalHoldReason: archive.legal_hold_reason,
          accessCount: archive.access_count,
          lastAccessedAt: archive.last_accessed_at ? new Date(archive.last_accessed_at) : undefined,
        },
      };
    } catch (error) {
      console.error('Unexpected error in createArchive:', error);
      
      await LoggingService.logArchiveCreate(
        userId,
        projectId,
        '',
        '',
        0,
        0,
        0,
        false,
        timer()
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Retrieves an archive by project ID
   * 
   * Requirement 7.4: Check user permissions before granting access
   * 
   * @param projectId - Project ID
   * @param userId - User ID requesting access
   * @returns GetArchiveResult with archive data or error
   */
  static async getArchive(
    projectId: string,
    userId: string
  ): Promise<GetArchiveResult> {
    try {
      const supabase = await createClient();

      // Get archive record
      const { data: archive, error: archiveError } = await supabase
        .from('project_archives')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (archiveError || !archive) {
        return {
          success: false,
          error: 'Archive not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Requirement 7.4: Verify user has appropriate permissions
      const hasAccess = await this.verifyArchiveAccess(projectId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'User is not authorized to access this archive',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Decompress archive data
      const decompressResult = await this.decompressArchiveData(archive.archive_data);

      if (!decompressResult.success || !decompressResult.data) {
        return {
          success: false,
          error: 'Failed to decompress archive data',
          errorCode: 'DECOMPRESSION_FAILED',
        };
      }

      // Increment access count
      await this.incrementAccessCount(archive.id);

      // Log archive access
      await LoggingService.logArchiveAccess(
        userId,
        projectId,
        archive.id,
        archive.archive_identifier,
        archive.access_count + 1
      );

      return {
        success: true,
        archive: {
          id: archive.id,
          projectId: archive.project_id,
          archiveIdentifier: archive.archive_identifier,
          archiveData: decompressResult.data,
          compressedSize: archive.compressed_size,
          originalSize: archive.original_size,
          compressionRatio: archive.compression_ratio,
          archivedBy: archive.archived_by,
          archivedAt: new Date(archive.archived_at),
          retentionUntil: archive.retention_until ? new Date(archive.retention_until) : undefined,
          legalHold: archive.legal_hold,
          legalHoldReason: archive.legal_hold_reason,
          accessCount: archive.access_count + 1,
          lastAccessedAt: new Date(),
        },
      };
    } catch (error) {
      console.error('Unexpected error in getArchive:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Retrieves an archive by archive identifier
   * 
   * @param identifier - Archive identifier
   * @param userId - User ID requesting access
   * @returns GetArchiveResult with archive data or error
   */
  static async getArchiveByIdentifier(
    identifier: string,
    userId: string
  ): Promise<GetArchiveResult> {
    try {
      const supabase = await createClient();

      // Get archive record
      const { data: archive, error: archiveError } = await supabase
        .from('project_archives')
        .select('*')
        .eq('archive_identifier', identifier)
        .single();

      if (archiveError || !archive) {
        return {
          success: false,
          error: 'Archive not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Verify user has appropriate permissions
      const hasAccess = await this.verifyArchiveAccess(archive.project_id, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'User is not authorized to access this archive',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Decompress archive data
      const decompressResult = await this.decompressArchiveData(archive.archive_data);

      if (!decompressResult.success || !decompressResult.data) {
        return {
          success: false,
          error: 'Failed to decompress archive data',
          errorCode: 'DECOMPRESSION_FAILED',
        };
      }

      // Increment access count
      await this.incrementAccessCount(archive.id);

      return {
        success: true,
        archive: {
          id: archive.id,
          projectId: archive.project_id,
          archiveIdentifier: archive.archive_identifier,
          archiveData: decompressResult.data,
          compressedSize: archive.compressed_size,
          originalSize: archive.original_size,
          compressionRatio: archive.compression_ratio,
          archivedBy: archive.archived_by,
          archivedAt: new Date(archive.archived_at),
          retentionUntil: archive.retention_until ? new Date(archive.retention_until) : undefined,
          legalHold: archive.legal_hold,
          legalHoldReason: archive.legal_hold_reason,
          accessCount: archive.access_count + 1,
          lastAccessedAt: new Date(),
        },
      };
    } catch (error) {
      console.error('Unexpected error in getArchiveByIdentifier:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Searches archives by query string
   * 
   * Requirement 7.3: Return results matching project title, description, or archive identifier
   * 
   * @param query - Search query
   * @param userId - User ID performing search
   * @param limit - Maximum number of results (default: 50)
   * @param offset - Offset for pagination (default: 0)
   * @returns SearchArchivesResult with matching archives or error
   */
  static async searchArchives(
    query: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SearchArchivesResult> {
    const timer = LoggingService.startTimer();
    
    try {
      const supabase = await createClient();

      // Search archives by identifier
      const { data: archivesByIdentifier, error: identifierError } = await supabase
        .from('project_archives')
        .select('*')
        .ilike('archive_identifier', `%${query}%`)
        .range(offset, offset + limit - 1);

      if (identifierError) {
        console.error('Error searching archives by identifier:', identifierError);
      }

      // Get all archives to search in decompressed data
      // Note: This is not optimal for large datasets. In production, consider:
      // 1. Storing searchable fields separately
      // 2. Using full-text search
      // 3. Implementing a search index
      const { data: allArchives, error: allError } = await supabase
        .from('project_archives')
        .select('*')
        .range(offset, offset + limit - 1);

      if (allError) {
        console.error('Error fetching archives:', allError);
        return {
          success: false,
          error: 'Failed to search archives',
        };
      }

      const matchingArchives: ProjectArchive[] = [];
      const seenIds = new Set<string>();

      // Add archives matching identifier
      if (archivesByIdentifier) {
        for (const archive of archivesByIdentifier) {
          // Verify user has access
          const hasAccess = await this.verifyArchiveAccess(archive.project_id, userId);
          if (!hasAccess) continue;

          seenIds.add(archive.id);

          // Decompress to get full data
          const decompressResult = await this.decompressArchiveData(archive.archive_data);
          if (!decompressResult.success || !decompressResult.data) continue;

          matchingArchives.push({
            id: archive.id,
            projectId: archive.project_id,
            archiveIdentifier: archive.archive_identifier,
            archiveData: decompressResult.data,
            compressedSize: archive.compressed_size,
            originalSize: archive.original_size,
            compressionRatio: archive.compression_ratio,
            archivedBy: archive.archived_by,
            archivedAt: new Date(archive.archived_at),
            retentionUntil: archive.retention_until ? new Date(archive.retention_until) : undefined,
            legalHold: archive.legal_hold,
            legalHoldReason: archive.legal_hold_reason,
            accessCount: archive.access_count,
            lastAccessedAt: archive.last_accessed_at ? new Date(archive.last_accessed_at) : undefined,
          });
        }
      }

      // Search in project title and description
      if (allArchives) {
        for (const archive of allArchives) {
          if (seenIds.has(archive.id)) continue;

          // Verify user has access
          const hasAccess = await this.verifyArchiveAccess(archive.project_id, userId);
          if (!hasAccess) continue;

          // Decompress to search in project data
          const decompressResult = await this.decompressArchiveData(archive.archive_data);
          if (!decompressResult.success || !decompressResult.data) continue;

          const archiveData = decompressResult.data;
          const lowerQuery = query.toLowerCase();

          // Requirement 7.3: Match project title or description
          const titleMatch = archiveData.project.title?.toLowerCase().includes(lowerQuery);
          const descriptionMatch = archiveData.project.description?.toLowerCase().includes(lowerQuery);

          if (titleMatch || descriptionMatch) {
            matchingArchives.push({
              id: archive.id,
              projectId: archive.project_id,
              archiveIdentifier: archive.archive_identifier,
              archiveData: archiveData,
              compressedSize: archive.compressed_size,
              originalSize: archive.original_size,
              compressionRatio: archive.compression_ratio,
              archivedBy: archive.archived_by,
              archivedAt: new Date(archive.archived_at),
              retentionUntil: archive.retention_until ? new Date(archive.retention_until) : undefined,
              legalHold: archive.legal_hold,
              legalHoldReason: archive.legal_hold_reason,
              accessCount: archive.access_count,
              lastAccessedAt: archive.last_accessed_at ? new Date(archive.last_accessed_at) : undefined,
            });
          }
        }
      }

      // Log search operation
      const duration = timer();
      await LoggingService.logArchiveSearch(
        userId,
        query,
        matchingArchives.length,
        duration
      );

      return {
        success: true,
        archives: matchingArchives,
      };
    } catch (error) {
      console.error('Unexpected error in searchArchives:', error);
      
      await LoggingService.logArchiveSearch(
        userId,
        query,
        0,
        timer()
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Increments the access count for an archive
   * 
   * @param archiveId - Archive ID
   */
  static async incrementAccessCount(archiveId: string): Promise<void> {
    try {
      const supabase = await createClient();

      await supabase
        .from('project_archives')
        .update({
          access_count: supabase.rpc('increment', { x: 1 }),
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', archiveId);
    } catch (error) {
      console.error('Error incrementing access count:', error);
    }
  }

  /**
   * Compresses archive data using gzip
   * 
   * Requirement 6.5: Compress archive data to reduce storage size
   * 
   * @param data - Archive data to compress
   * @returns Compression result with compressed data, sizes, and ratio
   */
  static async compressArchiveData(data: ArchiveData): Promise<{
    success: boolean;
    compressed?: string;
    compressedSize?: number;
    originalSize?: number;
    ratio?: number;
    error?: string;
  }> {
    try {
      const jsonString = JSON.stringify(data);
      const originalSize = Buffer.byteLength(jsonString, 'utf8');
      
      const compressed = await gzipAsync(jsonString);
      const compressedSize = compressed.length;
      const ratio = parseFloat((compressedSize / originalSize).toFixed(2));

      return {
        success: true,
        compressed: compressed.toString('base64'),
        compressedSize,
        originalSize,
        ratio,
      };
    } catch (error) {
      console.error('Error compressing archive data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compression failed',
      };
    }
  }

  /**
   * Decompresses archive data
   * 
   * @param compressed - Compressed archive data (base64 string)
   * @returns Decompression result with original data
   */
  static async decompressArchiveData(compressed: string): Promise<{
    success: boolean;
    data?: ArchiveData;
    error?: string;
  }> {
    try {
      const buffer = Buffer.from(compressed, 'base64');
      const decompressed = await gunzipAsync(buffer);
      const jsonString = decompressed.toString('utf8');
      const data = JSON.parse(jsonString);

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error decompressing archive data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Decompression failed',
      };
    }
  }

  /**
   * Collects all project data for archival
   * 
   * Requirement 6.2: Include all project data, proposals, deliverables, documents, comments, version history
   * 
   * @param projectId - Project ID
   * @returns Complete archive data structure
   */
  static async collectProjectData(projectId: string): Promise<ArchiveData> {
    const supabase = await createClient();

    // Get project details
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    // Get completion record for completed_at timestamp
    const { data: completion } = await supabase
      .from('project_completions')
      .select('completed_at')
      .eq('project_id', projectId)
      .maybeSingle();

    // Get all proposals for this project
    const { data: proposals } = await supabase
      .from('proposals')
      .select('*')
      .eq('project_id', projectId);

    // Get proposal versions
    const proposalVersions: Record<string, any[]> = {};
    if (proposals) {
      for (const proposal of proposals) {
        const { data: versions } = await supabase
          .from('proposal_versions')
          .select('*')
          .eq('proposal_id', proposal.id)
          .order('version_number', { ascending: true });

        proposalVersions[proposal.id] = versions || [];
      }
    }

    // Get all deliverables
    const { data: deliverables } = await supabase
      .from('project_deliverables')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: true });

    // Get workspaces and documents
    // Note: Assuming there's a workspaces table linked to proposals
    const workspaces: any[] = [];
    if (proposals) {
      for (const proposal of proposals) {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('*')
          .eq('proposal_id', proposal.id)
          .maybeSingle();

        if (workspace) {
          const { data: documents } = await supabase
            .from('workspace_documents')
            .select('*')
            .eq('workspace_id', workspace.id)
            .order('created_at', { ascending: true });

          workspaces.push({
            id: workspace.id,
            name: workspace.name || 'Workspace',
            documents: (documents || []).map((doc: any) => ({
              id: doc.id,
              title: doc.title,
              content: doc.content,
              createdBy: doc.created_by,
              createdAt: new Date(doc.created_at),
            })),
          });
        }
      }
    }

    // Get comments (assuming there's a project_comments or similar table)
    const { data: comments } = await supabase
      .from('project_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    // Build archive data structure
    const archiveData: ArchiveData = {
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        budget: project.budget,
        deadline: project.deadline ? new Date(project.deadline) : undefined,
        clientId: project.client_id,
        status: project.status,
        createdAt: new Date(project.created_at),
        completedAt: completion?.completed_at ? new Date(completion.completed_at) : new Date(),
      },
      proposals: (proposals || []).map((p: any) => ({
        id: p.id,
        leadId: p.lead_id,
        status: p.status,
        submittedAt: p.submitted_at ? new Date(p.submitted_at) : undefined,
        versions: (proposalVersions[p.id] || []).map((v: any) => ({
          versionNumber: v.version_number,
          content: v.content,
          createdBy: v.created_by,
          createdAt: new Date(v.created_at),
        })),
      })),
      deliverables: (deliverables || []).map((d: any) => ({
        id: d.id,
        fileName: d.file_name,
        filePath: d.file_path,
        fileType: d.file_type,
        fileSize: d.file_size,
        description: d.description,
        uploadedBy: d.uploaded_by,
        uploadedAt: new Date(d.uploaded_at),
      })),
      workspaces,
      comments: (comments || []).map((c: any) => ({
        id: c.id,
        authorId: c.author_id,
        message: c.message,
        visibility: c.visibility || 'public',
        createdAt: new Date(c.created_at),
      })),
      metadata: {
        archivedAt: new Date(),
        archivedBy: 'system',
        version: '1.0',
      },
    };

    return archiveData;
  }

  /**
   * Generates a unique archive identifier
   * 
   * Requirement 6.3: Generate unique archive identifier
   * 
   * @param projectId - Project ID
   * @returns Unique archive identifier
   */
  static generateArchiveIdentifier(projectId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const projectPrefix = projectId.substring(0, 8).toUpperCase();
    
    return `ARCH-${projectPrefix}-${timestamp}-${random}`;
  }

  /**
   * Verifies if a user has access to an archive
   * 
   * Requirement 7.4: Check user permissions
   * 
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns true if user has access, false otherwise
   */
  static async verifyArchiveAccess(projectId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();

      // Check if user is the client
      const { data: project } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', projectId)
        .single();

      if (project && project.client_id === userId) {
        return true;
      }

      // Check if user is a team member of any proposal for this project
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id')
        .eq('project_id', projectId);

      if (proposals && proposals.length > 0) {
        const proposalIds = proposals.map(p => p.id);
        
        const { data: teamMember } = await supabase
          .from('proposal_team_members')
          .select('user_id')
          .in('proposal_id', proposalIds)
          .eq('user_id', userId)
          .maybeSingle();

        if (teamMember) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error verifying archive access:', error);
      return false;
    }
  }
}
