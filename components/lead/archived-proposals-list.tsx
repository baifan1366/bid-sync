"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import {
  Archive,
  ArchiveRestore,
  Search,
  Loader2,
  FileText,
  Calendar,
  User,
  FolderOpen,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface ArchivedProposal {
  id: string
  title: string
  projectId: string
  projectTitle: string
  status: string
  leadId: string
  leadName: string
  submittedAt?: string
  archivedAt?: string
  archivedBy?: string
  createdAt: string
  updatedAt: string
}

interface ArchivedProposalsListProps {
  userId: string
}

export function ArchivedProposalsList({ userId }: ArchivedProposalsListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch archived proposals
  const { data: proposals, isLoading } = useQuery<ArchivedProposal[]>({
    queryKey: ["archived-proposals", userId],
    queryFn: async () => {
      const response = await fetch(
        `/api/proposals/archived?userId=${userId}`
      )

      if (!response.ok) {
        throw new Error("Failed to fetch archived proposals")
      }

      const result = await response.json()
      return result.data || []
    },
  })

  // Unarchive mutation
  const unarchiveMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await fetch("/api/proposals/unarchive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, userId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to unarchive proposal")
      }

      return response.json()
    },
    onSuccess: (_, proposalId) => {
      queryClient.invalidateQueries({ queryKey: ["archived-proposals", userId] })
      queryClient.invalidateQueries({ queryKey: ["proposals"] })
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] })
      queryClient.invalidateQueries({ queryKey: ["archived-count"] })
      toast({
        title: "Proposal Unarchived",
        description: "The proposal has been restored to active proposals.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Unarchive Failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleUnarchive = (proposalId: string) => {
    unarchiveMutation.mutate(proposalId)
  }

  // Filter proposals by search term
  const filteredProposals = proposals?.filter(
    (proposal) =>
      proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proposal.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <Card className="border-yellow-400/20">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-black dark:text-white">
              <Archive className="h-5 w-5 text-yellow-400" />
              Archived Proposals
            </CardTitle>
            <Badge
              variant="outline"
              className="border-yellow-400/30 text-yellow-400"
            >
              {proposals?.length || 0} archived
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search archived proposals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-yellow-400/20 focus-visible:ring-yellow-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* Proposals List */}
      {!filteredProposals || filteredProposals.length === 0 ? (
        <Card className="border-yellow-400/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-black dark:text-white mb-2">
              {searchTerm ? "No matching proposals" : "No archived proposals"}
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              {searchTerm
                ? "Try adjusting your search terms"
                : "Archived proposals will appear here for future reference"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProposals.map((proposal) => (
            <Card
              key={proposal.id}
              className="border-yellow-400/20 hover:border-yellow-400/40 transition-colors"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Title and Project */}
                    <div>
                      <h3 className="text-lg font-semibold text-black dark:text-white mb-1">
                        {proposal.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Project: {proposal.projectTitle}
                      </p>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Archived{" "}
                          {proposal.archivedAt
                            ? formatDistanceToNow(new Date(proposal.archivedAt), {
                                addSuffix: true,
                              })
                            : "recently"}
                        </span>
                      </div>
                      {proposal.submittedAt && (
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-4 w-4" />
                          <span>
                            Submitted{" "}
                            {formatDistanceToNow(new Date(proposal.submittedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        <span>{proposal.leadName}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <Badge
                        variant="outline"
                        className="border-yellow-400/30 text-yellow-400"
                      >
                        Archived
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => handleUnarchive(proposal.id)}
                      disabled={unarchiveMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="border-yellow-400/20 hover:bg-yellow-400/10"
                    >
                      {unarchiveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                          Restore
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
