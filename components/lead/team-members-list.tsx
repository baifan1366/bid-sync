"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GET_ALL_PROPOSAL_TEAM_MEMBERS } from "@/lib/graphql/queries"
import { RemoveTeamMemberDialog } from "./remove-team-member-dialog"
import {
  Users,
  Crown,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Briefcase,
} from "lucide-react"
import { cn, formatDate } from "@/lib/utils"

interface ProposalTeamMember {
  userId: string
  user?: {
    id: string
    email: string
    fullName?: string
    avatarUrl?: string
  }
  role: string
  joinedAt: string
}

interface ProposalTeamInfo {
  proposalId: string
  projectId: string
  projectTitle: string
  proposalStatus: string
  teamMembers: ProposalTeamMember[]
}

interface TeamMembersListProps {
  projectId?: string // Optional now - if not provided, shows all proposals
}

export function TeamMembersList({ projectId }: TeamMembersListProps) {
  const [memberToRemove, setMemberToRemove] = useState<{
    member: ProposalTeamMember
    proposalId: string
  } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ["all-proposal-team-members"],
    queryFn: async () => {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: GET_ALL_PROPOSAL_TEAM_MEMBERS,
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to fetch team members")
      }

      return result.data.getAllProposalTeamMembers as ProposalTeamInfo[]
    },
    staleTime: 30 * 1000, // 30 seconds
  })

  // Filter by projectId if provided
  const proposals = projectId 
    ? (data || []).filter((p) => p.projectId === projectId)
    : (data || [])

  if (isLoading) {
    return (
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Failed to load team members</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return "?"
  }

  const totalMembers = proposals.reduce((sum, p) => sum + p.teamMembers.length, 0)

  return (
    <>
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-black dark:text-white">
              <Users className="h-5 w-5 text-yellow-400" />
              Team Members
              <Badge
                variant="outline"
                className="ml-2 border-yellow-400/30 text-yellow-400"
              >
                {totalMembers}
              </Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {proposals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-yellow-400 mx-auto mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No proposals yet. Create a proposal to build your team.
              </p>
            </div>
          ) : (
            <>
              {/* Group by Proposal */}
              {proposals.map((proposal) => (
                <div key={proposal.proposalId} className="space-y-3">
                  {/* Proposal Header */}
                  <div className="flex items-center gap-3 pb-2 border-b border-yellow-400/20">
                    <Briefcase className="h-4 w-4 text-yellow-400" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-black dark:text-white">
                        {proposal.projectTitle}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Proposal ID: {proposal.proposalId.slice(0, 8)}...
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        proposal.proposalStatus === "DRAFT" && "border-gray-400/30 text-gray-400",
                        proposal.proposalStatus === "SUBMITTED" && "border-blue-400/30 text-blue-400",
                        proposal.proposalStatus === "APPROVED" && "border-green-400/30 text-green-400",
                        proposal.proposalStatus === "REJECTED" && "border-red-400/30 text-red-400"
                      )}
                    >
                      {proposal.proposalStatus}
                    </Badge>
                  </div>

                  {/* Team Members for this Proposal */}
                  <div className="space-y-2 pl-4">
                    {proposal.teamMembers.map((member) => {
                      const isLead = member.role.toLowerCase() === "lead"
                      return (
                        <ProposalMemberCard
                          key={member.userId}
                          member={member}
                          proposalId={proposal.proposalId}
                          onRemove={setMemberToRemove}
                          getInitials={getInitials}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Remove Member Dialog */}
      {memberToRemove && (
        <RemoveTeamMemberDialog
          member={memberToRemove.member}
          proposalId={memberToRemove.proposalId}
          open={!!memberToRemove}
          onOpenChange={(open) => !open && setMemberToRemove(null)}
        />
      )}
    </>
  )
}

interface ProposalMemberCardProps {
  member: ProposalTeamMember
  proposalId: string
  onRemove: (data: { member: ProposalTeamMember; proposalId: string }) => void
  getInitials: (name?: string, email?: string) => string
}

function ProposalMemberCard({
  member,
  proposalId,
  onRemove,
  getInitials,
}: ProposalMemberCardProps) {
  const isLead = member.role.toLowerCase() === "lead"

  return (
    <div className="p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5 hover:bg-yellow-400/10 transition-colors">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Avatar className="h-10 w-10 border-2 border-yellow-400/30">
          {member.user?.avatarUrl && (
            <AvatarImage src={member.user.avatarUrl} alt={member.user.fullName || member.user.email} />
          )}
          <AvatarFallback className="bg-yellow-400 text-black font-semibold text-sm">
            {getInitials(member.user?.fullName, member.user?.email)}
          </AvatarFallback>
        </Avatar>

        {/* Member Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-sm text-black dark:text-white truncate">
              {member.user?.fullName || member.user?.email || "Unknown User"}
            </p>
            <Badge
              variant="outline"
              className={cn(
                "text-xs shrink-0",
                isLead
                  ? "border-yellow-400 text-yellow-400 bg-yellow-400/10"
                  : "border-yellow-400/30 text-yellow-400"
              )}
            >
              {isLead ? (
                <>
                  <Crown className="h-3 w-3 mr-1" />
                  Lead
                </>
              ) : (
                "Member"
              )}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {member.user?.email && member.user?.fullName && (
              <span className="truncate">{member.user.email}</span>
            )}
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              Joined {formatDate(member.joinedAt)}
            </span>
          </div>
        </div>

        {/* Remove Button */}
        {!isLead && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove({ member, proposalId })}
            className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
