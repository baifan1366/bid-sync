/**
 * Enhanced Document Workspace Component
 * 
 * Integrates all collaboration features including:
 * - Section-based editing with locks
 * - Progress dashboard
 * - Deadline management
 * - Section assignments
 * - Enhanced auto-save
 * - Real-time updates
 * - Performance monitoring
 * 
 * Requirements: All (Task 12)
 */

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useUser } from '@/hooks/use-user'
import { useGraphQLQuery, useGraphQLMutation } from '@/hooks/use-graphql'
import { gql } from 'graphql-request'
import {
  FileText,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  Users,
  Clock,
  Loader2,
  AlertCircle,
  Filter,
  X,
  BarChart3,
  Calendar,
  Lock,
  Activity,
} from 'lucide-react'
import { CreateDocumentDialog } from './create-document-dialog'
import { RenameDocumentDialog } from './rename-document-dialog'
import { ProgressDashboard } from './progress-dashboard'
import { DeadlineManager } from './deadline-manager'
import { PerformanceMonitor } from './performance-monitor'

interface Document {
  id: string
  workspaceId: string
  title: string
  description: string | null
  createdBy: string
  lastEditedBy: string
  createdAt: string
  updatedAt: string
  deadline?: string
  collaborators: Array<{
    id: string
    userId: string
    userName: string
    role: string
  }>
  sections?: Array<{
    id: string
    title: string
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
    assignedTo?: string
    deadline?: string
    lockedBy?: string
  }>
}

interface Workspace {
  id: string
  projectId: string
  leadId: string
  name: string
  description: string | null
  documents: Document[]
}

const GET_WORKSPACE_DOCUMENTS = gql`
  query GetWorkspaceDocuments($workspaceId: ID!) {
    workspace(id: $workspaceId) {
      id
      projectId
      leadId
      name
      description
      documents {
        id
        workspaceId
        title
        description
        createdBy
        lastEditedBy
        createdAt
        updatedAt
        deadline
        collaborators {
          id
          userId
          userName
          role
        }
        sections {
          id
          title
          status
          assignedTo
          deadline
          lockedBy
        }
      }
    }
  }
`

const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($id: ID!) {
    deleteDocument(documentId: $id)
  }
`

const DUPLICATE_DOCUMENT = gql`
  mutation DuplicateDocument($id: ID!) {
    duplicateDocument(documentId: $id) {
      success
      document {
        id
        title
      }
    }
  }
`

interface EnhancedDocumentWorkspaceProps {
  workspaceId: string
}

export function EnhancedDocumentWorkspace({ workspaceId }: EnhancedDocumentWorkspaceProps) {
  const router = useRouter()
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [filterRole, setFilterRole] = React.useState<string | null>(null)
  const [filterStatus, setFilterStatus] = React.useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedDocument, setSelectedDocument] = React.useState<Document | null>(null)
  const [activeTab, setActiveTab] = React.useState('documents')

  const { data, isLoading: loading, error, refetch } = useGraphQLQuery<{ workspace: Workspace }>(
    ['workspace', workspaceId],
    GET_WORKSPACE_DOCUMENTS,
    { workspaceId }
  )

  const deleteDocumentMutation = useGraphQLMutation<any, { id: string }>(
    DELETE_DOCUMENT,
    [['workspace', workspaceId]]
  )
  
  const duplicateDocumentMutation = useGraphQLMutation<any, { id: string }>(
    DUPLICATE_DOCUMENT,
    [['workspace', workspaceId]]
  )

  const workspace = data?.workspace
  const documents = workspace?.documents || []

  const filteredDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        searchQuery === '' ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesRole =
        !filterRole ||
        doc.collaborators.some(
          (c) => c.userId === user?.id && c.role === filterRole
        )

      const matchesStatus =
        !filterStatus ||
        (doc.sections && doc.sections.some((s) => s.status === filterStatus))

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [documents, searchQuery, filterRole, filterStatus, user?.id])

  // Calculate workspace-wide statistics
  const workspaceStats = React.useMemo(() => {
    const totalDocuments = documents.length
    const totalSections = documents.reduce((sum, doc) => sum + (doc.sections?.length || 0), 0)
    const completedSections = documents.reduce(
      (sum, doc) =>
        sum + (doc.sections?.filter((s) => s.status === 'COMPLETED').length || 0),
      0
    )
    const lockedSections = documents.reduce(
      (sum, doc) => sum + (doc.sections?.filter((s) => s.lockedBy).length || 0),
      0
    )
    const upcomingDeadlines = documents.filter((doc) => {
      if (!doc.deadline) return false
      const deadline = new Date(doc.deadline)
      const now = new Date()
      const hoursUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
      return hoursUntil > 0 && hoursUntil <= 24
    }).length

    return {
      totalDocuments,
      totalSections,
      completedSections,
      completionPercentage: totalSections > 0 ? (completedSections / totalSections) * 100 : 0,
      lockedSections,
      upcomingDeadlines,
    }
  }, [documents])

  const handleDocumentClick = (documentId: string) => {
    router.push(`/app/editor/${documentId}`)
  }

  const handleRename = (doc: Document) => {
    setSelectedDocument(doc)
    setRenameDialogOpen(true)
  }

  const handleDelete = (doc: Document) => {
    setSelectedDocument(doc)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedDocument) return

    try {
      await deleteDocumentMutation.mutateAsync({ id: selectedDocument.id })
      setDeleteDialogOpen(false)
      setSelectedDocument(null)
      refetch()
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  const handleDuplicate = async (doc: Document) => {
    try {
      await duplicateDocumentMutation.mutateAsync({ id: doc.id })
      refetch()
    } catch (err) {
      console.error('Failed to duplicate document:', err)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getDeadlineStatus = (deadline?: string) => {
    if (!deadline) return null
    
    const deadlineDate = new Date(deadline)
    const now = new Date()
    const hoursUntil = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    if (hoursUntil < 0) {
      return { label: 'Overdue', color: 'bg-red-500 text-white' }
    } else if (hoursUntil <= 24) {
      return { label: 'Due soon', color: 'bg-yellow-400 text-black' }
    }
    return null
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-400 text-black'
      case 'editor':
        return 'bg-yellow-400/80 text-black'
      case 'commenter':
        return 'bg-yellow-400/60 text-black'
      case 'viewer':
        return 'bg-yellow-400/40 text-black'
      default:
        return 'bg-yellow-400/20 text-black'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500 text-white'
      case 'IN_PROGRESS':
        return 'bg-yellow-400 text-black'
      case 'IN_REVIEW':
        return 'bg-blue-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-yellow-400" />
        <p className="text-muted-foreground">Failed to load documents</p>
        <Button onClick={() => refetch()} variant="outline" className="border-yellow-400/20">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{workspace?.name}</h1>
          {workspace?.description && (
            <p className="text-muted-foreground mt-1">{workspace.description}</p>
          )}
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Document
        </Button>
      </div>

      {/* Workspace Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-yellow-400/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">{workspaceStats.totalDocuments}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion</p>
                <p className="text-2xl font-bold">
                  {workspaceStats.completionPercentage.toFixed(0)}%
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Locks</p>
                <p className="text-2xl font-bold">{workspaceStats.lockedSections}</p>
              </div>
              <Lock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due Soon</p>
                <p className="text-2xl font-bold">{workspaceStats.upcomingDeadlines}</p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sections</p>
                <p className="text-2xl font-bold">
                  {workspaceStats.completedSections}/{workspaceStats.totalSections}
                </p>
              </div>
              <Activity className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-yellow-400/20"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-yellow-400/20">
                  <Filter className="h-4 w-4 mr-2" />
                  {filterRole ? filterRole.charAt(0).toUpperCase() + filterRole.slice(1) : 'All Roles'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFilterRole(null)}>
                  All Roles
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterRole('owner')}>Owner</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterRole('editor')}>Editor</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterRole('commenter')}>
                  Commenter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterRole('viewer')}>Viewer</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {(searchQuery || filterRole || filterStatus) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearchQuery('')
                  setFilterRole(null)
                  setFilterStatus(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Documents Grid */}
          {filteredDocuments.length === 0 ? (
            <Card className="p-12 text-center border-yellow-400/20">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No documents found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterRole || filterStatus
                  ? 'Try adjusting your search or filters'
                  : 'Create your first document to get started'}
              </p>
              {!searchQuery && !filterRole && !filterStatus && (
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Document
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc) => {
                const userRole = doc.collaborators.find((c) => c.userId === user?.id)?.role
                const isOwner = userRole === 'owner'
                const deadlineStatus = getDeadlineStatus(doc.deadline)
                const completedSections = doc.sections?.filter((s) => s.status === 'COMPLETED').length || 0
                const totalSections = doc.sections?.length || 0
                const progress = totalSections > 0 ? (completedSections / totalSections) * 100 : 0

                return (
                  <Card
                    key={doc.id}
                    className="p-4 hover:border-yellow-400/40 transition-all cursor-pointer border-yellow-400/20 hover:shadow-lg"
                    onClick={() => handleDocumentClick(doc.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-yellow-400 shrink-0" />
                        <h3 className="font-semibold line-clamp-1">{doc.title}</h3>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDocumentClick(doc.id)
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Open
                          </DropdownMenuItem>
                          {(isOwner || userRole === 'editor') && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRename(doc)
                              }}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDuplicate(doc)
                            }}
                            disabled={duplicateDocumentMutation.isPending}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          {isOwner && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(doc)
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {doc.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {doc.description}
                      </p>
                    )}

                    {/* Progress bar */}
                    {totalSections > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {userRole && (
                        <Badge className={getRoleBadgeColor(userRole)}>{userRole}</Badge>
                      )}
                      {deadlineStatus && (
                        <Badge className={deadlineStatus.color}>{deadlineStatus.label}</Badge>
                      )}
                      {doc.collaborators.length > 1 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {doc.collaborators.length}
                        </div>
                      )}
                      {totalSections > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          {completedSections}/{totalSections}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Updated {formatDate(doc.updatedAt)}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {documents.map((doc) => (
              <ProgressDashboard key={doc.id} documentId={doc.id} />
            ))}
          </div>
        </TabsContent>

        {/* Deadlines Tab */}
        <TabsContent value="deadlines" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {documents.map((doc) => (
              <DeadlineManager key={doc.id} documentId={doc.id} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateDocumentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        workspaceId={workspaceId}
        onSuccess={() => {
          setCreateDialogOpen(false)
          refetch()
        }}
      />

      {selectedDocument && (
        <RenameDocumentDialog
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
          document={selectedDocument}
          onSuccess={() => {
            setRenameDialogOpen(false)
            setSelectedDocument(null)
            refetch()
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDocument?.title}"? This action cannot be
              undone and will remove all versions and collaborator access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteDocumentMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteDocumentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Performance Monitor (only in development) */}
      <PerformanceMonitor />
    </div>
  )
}
