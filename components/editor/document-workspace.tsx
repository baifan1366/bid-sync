"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useUser } from "@/hooks/use-user"
import { useGraphQLQuery, useGraphQLMutation } from "@/hooks/use-graphql"
import { gql } from "graphql-request"
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
} from "lucide-react"
import { CreateDocumentDialog } from "./create-document-dialog"
import { RenameDocumentDialog } from "./rename-document-dialog"

interface Document {
  id: string
  workspaceId: string
  title: string
  description: string | null
  createdBy: string
  lastEditedBy: string
  createdAt: string
  updatedAt: string
  collaborators: Array<{
    id: string
    userId: string
    userName: string
    role: string
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
        collaborators {
          id
          userId
          userName
          role
        }
      }
    }
  }
`

const DELETE_DOCUMENT = gql`
  mutation DeleteDocument($id: ID!) {
    deleteDocument(id: $id) {
      success
      message
    }
  }
`

const DUPLICATE_DOCUMENT = gql`
  mutation DuplicateDocument($id: ID!) {
    duplicateDocument(id: $id) {
      id
      title
    }
  }
`

interface DocumentWorkspaceProps {
  workspaceId: string
}

/**
 * Legacy Document Workspace Component
 * 
 * This is the original document workspace. For the enhanced version with
 * all collaboration features, use EnhancedDocumentWorkspace instead.
 * 
 * @deprecated Use EnhancedDocumentWorkspace for full feature set
 */
export function DocumentWorkspace({ workspaceId }: DocumentWorkspaceProps) {
  const router = useRouter()
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterRole, setFilterRole] = React.useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedDocument, setSelectedDocument] = React.useState<Document | null>(null)

  const { data, isLoading: loading, error, refetch } = useGraphQLQuery<{ workspace: Workspace }>(
    ["workspace", workspaceId],
    GET_WORKSPACE_DOCUMENTS,
    { workspaceId }
  )

  const deleteDocumentMutation = useGraphQLMutation<any, { id: string }>(DELETE_DOCUMENT, [["workspace", workspaceId]])
  const duplicateDocumentMutation = useGraphQLMutation<any, { id: string }>(DUPLICATE_DOCUMENT, [["workspace", workspaceId]])

  const workspace = data?.workspace
  const documents = workspace?.documents || []

  const filteredDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        searchQuery === "" ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesRole =
        !filterRole ||
        doc.collaborators.some(
          (c) => c.userId === user?.id && c.role === filterRole
        )

      return matchesSearch && matchesRole
    })
  }, [documents, searchQuery, filterRole, user?.id])

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
      console.error("Failed to delete document:", err)
    }
  }

  const handleDuplicate = async (doc: Document) => {
    try {
      await duplicateDocumentMutation.mutateAsync({ id: doc.id })
      refetch()
    } catch (err) {
      console.error("Failed to duplicate document:", err)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-yellow-400 text-black"
      case "editor":
        return "bg-yellow-400/80 text-black"
      case "commenter":
        return "bg-yellow-400/60 text-black"
      case "viewer":
        return "bg-yellow-400/40 text-black"
      default:
        return "bg-yellow-400/20 text-black"
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
              {filterRole ? filterRole.charAt(0).toUpperCase() + filterRole.slice(1) : "All Roles"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilterRole(null)}>
              All Roles
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFilterRole("owner")}>
              Owner
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterRole("editor")}>
              Editor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterRole("commenter")}>
              Commenter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilterRole("viewer")}>
              Viewer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {(searchQuery || filterRole) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchQuery("")
              setFilterRole(null)
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
            {searchQuery || filterRole
              ? "Try adjusting your search or filters"
              : "Create your first document to get started"}
          </p>
          {!searchQuery && !filterRole && (
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
            const isOwner = userRole === "owner"

            return (
              <Card
                key={doc.id}
                className="p-4 hover:border-yellow-400/40 transition-all cursor-pointer border-yellow-400/20 hover:shadow-lg"
                onClick={() => handleDocumentClick(doc.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-yellow-400" />
                    <h3 className="font-semibold line-clamp-1">{doc.title}</h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
                      {(isOwner || userRole === "editor") && (
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

                <div className="flex items-center gap-2 mb-3">
                  {userRole && (
                    <Badge className={getRoleBadgeColor(userRole)}>
                      {userRole}
                    </Badge>
                  )}
                  {doc.collaborators.length > 1 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {doc.collaborators.length}
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
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

