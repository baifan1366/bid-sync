"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import { createGraphQLClient } from "@/lib/graphql/client"
import { useToast } from "@/components/ui/use-toast"
import { Shield, ShieldOff, Search, X, Calendar, User, FileText } from "lucide-react"
import { format } from "date-fns"

interface ProjectArchive {
  id: string
  projectId: string
  archiveIdentifier: string
  compressedSize: number
  originalSize: number
  compressionRatio: number
  archivedBy: {
    id: string
    email: string
    fullName: string
  }
  archivedAt: string
  retentionUntil: string | null
  legalHold: boolean
  legalHoldReason: string | null
  accessCount: number
  lastAccessedAt: string | null
  project: {
    id: string
    title: string
    description: string
    budget: number | null
    deadline: string | null
    clientId: string
    status: string
  }
}

const SEARCH_ARCHIVES_QUERY = `
  query SearchArchives($query: String!, $limit: Int, $offset: Int) {
    searchArchives(query: $query, limit: $limit, offset: $offset) {
      id
      projectId
      archiveIdentifier
      compressedSize
      originalSize
      compressionRatio
      archivedBy {
        id
        email
        fullName
      }
      archivedAt
      retentionUntil
      legalHold
      legalHoldReason
      accessCount
      lastAccessedAt
      project {
        id
        title
        description
        budget
        deadline
        clientId
        status
      }
    }
  }
`

const APPLY_LEGAL_HOLD_MUTATION = `
  mutation ApplyLegalHold($archiveId: ID!, $reason: String!) {
    applyLegalHold(archiveId: $archiveId, reason: $reason) {
      id
      legalHold
      legalHoldReason
    }
  }
`

const REMOVE_LEGAL_HOLD_MUTATION = `
  mutation RemoveLegalHold($archiveId: ID!) {
    removeLegalHold(archiveId: $archiveId) {
      id
      legalHold
      legalHoldReason
    }
  }
`

export function LegalHoldManagement() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [applyDialogOpen, setApplyDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [selectedArchive, setSelectedArchive] = useState<ProjectArchive | null>(null)
  const [legalHoldReason, setLegalHoldReason] = useState("")

  // Fetch archives
  const { data: archives, isLoading, error } = useQuery({
    queryKey: ['archives', searchQuery],
    queryFn: async () => {
      const client = createGraphQLClient()
      const result = await client.request<{ searchArchives: ProjectArchive[] }>(
        SEARCH_ARCHIVES_QUERY,
        { 
          query: searchQuery || "*",
          limit: 100,
          offset: 0
        }
      )
      return result.searchArchives
    },
    staleTime: 2 * 60 * 1000,
  })

  // Apply legal hold mutation
  const applyLegalHoldMutation = useMutation({
    mutationFn: async ({ archiveId, reason }: { archiveId: string; reason: string }) => {
      const client = createGraphQLClient()
      return await client.request(APPLY_LEGAL_HOLD_MUTATION, { archiveId, reason })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] })
      toast({
        title: "Legal hold applied",
        description: "The archive has been placed under legal hold and cannot be deleted.",
      })
      setApplyDialogOpen(false)
      setLegalHoldReason("")
      setSelectedArchive(null)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  // Remove legal hold mutation
  const removeLegalHoldMutation = useMutation({
    mutationFn: async (archiveId: string) => {
      const client = createGraphQLClient()
      return await client.request(REMOVE_LEGAL_HOLD_MUTATION, { archiveId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archives'] })
      toast({
        title: "Legal hold removed",
        description: "The archive is no longer under legal hold and can be deleted per retention policy.",
      })
      setRemoveDialogOpen(false)
      setSelectedArchive(null)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleApplyLegalHold = (archive: ProjectArchive) => {
    setSelectedArchive(archive)
    setApplyDialogOpen(true)
  }

  const handleRemoveLegalHold = (archive: ProjectArchive) => {
    setSelectedArchive(archive)
    setRemoveDialogOpen(true)
  }

  const confirmApplyLegalHold = () => {
    if (!selectedArchive || !legalHoldReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the legal hold.",
        variant: "destructive"
      })
      return
    }
    applyLegalHoldMutation.mutate({
      archiveId: selectedArchive.id,
      reason: legalHoldReason.trim()
    })
  }

  const confirmRemoveLegalHold = () => {
    if (!selectedArchive) return
    removeLegalHoldMutation.mutate(selectedArchive.id)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const archivesList = archives || []
  const legalHoldCount = archivesList.filter(a => a.legalHold).length
  const totalArchives = archivesList.length

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <section aria-label="Legal hold statistics">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-yellow-400/20">
            <CardHeader className="pb-3">
              <CardDescription>Total Archives</CardDescription>
              <CardTitle className="text-3xl">{totalArchives}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-yellow-400/20">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-yellow-400" />
                Under Legal Hold
              </CardDescription>
              <CardTitle className="text-3xl text-yellow-400">{legalHoldCount}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-yellow-400/20">
            <CardHeader className="pb-3">
              <CardDescription>Available for Deletion</CardDescription>
              <CardTitle className="text-3xl">{totalArchives - legalHoldCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Main Content */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Legal Hold Management
              </CardTitle>
              <CardDescription>
                Manage legal holds on archived projects to prevent deletion
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search archives by project title, identifier, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading archives...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <p className="text-red-500">Error loading archives: {error.message}</p>
            </div>
          )}

          {/* Archives List */}
          {!isLoading && !error && archivesList.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No archives found</p>
            </div>
          )}

          {!isLoading && !error && archivesList.length > 0 && (
            <div className="space-y-4">
              {archivesList.map((archive) => (
                <Card key={archive.id} className="border-yellow-400/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Project Title and Status */}
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{archive.project.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {archive.project.description}
                            </p>
                          </div>
                          {archive.legalHold && (
                            <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                              <Shield className="h-3 w-3 mr-1" />
                              Legal Hold
                            </Badge>
                          )}
                        </div>

                        {/* Archive Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Archive ID</p>
                            <p className="font-mono text-xs">{archive.archiveIdentifier}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Archived
                            </p>
                            <p>{format(new Date(archive.archivedAt), 'MMM d, yyyy')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Archived By
                            </p>
                            <p>{archive.archivedBy.fullName || archive.archivedBy.email}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Size
                            </p>
                            <p>{formatBytes(archive.compressedSize)}</p>
                          </div>
                        </div>

                        {/* Legal Hold Reason */}
                        {archive.legalHold && archive.legalHoldReason && (
                          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-md p-3">
                            <p className="text-sm font-medium mb-1">Legal Hold Reason:</p>
                            <p className="text-sm text-muted-foreground">{archive.legalHoldReason}</p>
                          </div>
                        )}

                        {/* Retention Info */}
                        {archive.retentionUntil && (
                          <div className="text-sm text-muted-foreground">
                            Retention until: {format(new Date(archive.retentionUntil), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {!archive.legalHold ? (
                          <Button
                            onClick={() => handleApplyLegalHold(archive)}
                            className="bg-yellow-400 hover:bg-yellow-500 text-black"
                            size="sm"
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Apply Hold
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleRemoveLegalHold(archive)}
                            variant="outline"
                            className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
                            size="sm"
                          >
                            <ShieldOff className="h-4 w-4 mr-2" />
                            Remove Hold
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Legal Hold Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Legal Hold</DialogTitle>
            <DialogDescription>
              Place this archive under legal hold to prevent deletion. Provide a reason for the hold.
            </DialogDescription>
          </DialogHeader>
          
          {selectedArchive && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-md">
                <p className="font-medium">{selectedArchive.project.title}</p>
                <p className="text-sm text-muted-foreground">
                  Archive ID: {selectedArchive.archiveIdentifier}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Legal Hold *</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Pending litigation - case #12345, Regulatory investigation, etc."
                  value={legalHoldReason}
                  onChange={(e) => setLegalHoldReason(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This reason will be logged and visible to other administrators.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApplyDialogOpen(false)
                setLegalHoldReason("")
                setSelectedArchive(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApplyLegalHold}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
              disabled={!legalHoldReason.trim() || applyLegalHoldMutation.isPending}
            >
              {applyLegalHoldMutation.isPending ? "Applying..." : "Apply Legal Hold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Legal Hold Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Legal Hold</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the legal hold from this archive? 
              The archive will become subject to the retention policy and may be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {selectedArchive && (
            <div className="bg-muted p-3 rounded-md">
              <p className="font-medium">{selectedArchive.project.title}</p>
              <p className="text-sm text-muted-foreground">
                Archive ID: {selectedArchive.archiveIdentifier}
              </p>
              {selectedArchive.legalHoldReason && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs font-medium">Current Hold Reason:</p>
                  <p className="text-xs text-muted-foreground">{selectedArchive.legalHoldReason}</p>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveLegalHold}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
              disabled={removeLegalHoldMutation.isPending}
            >
              {removeLegalHoldMutation.isPending ? "Removing..." : "Remove Legal Hold"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
