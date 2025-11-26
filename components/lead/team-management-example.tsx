/**
 * Team Management Integration Example
 * 
 * This file demonstrates how to integrate all team management components
 * into a cohesive team management interface for bidding leads.
 * 
 * Usage:
 * Import this component into your lead dashboard or create a dedicated
 * team management page.
 */

"use client"

import { useState } from "react"
import { 
  TeamInvitationDialog, 
  TeamMembersList, 
  TeamStatisticsCard 
} from "@/components/lead"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"
import { GET_ACTIVE_INVITATIONS } from "@/lib/graphql/queries"
import { 
  Users, 
  TrendingUp, 
  Link as LinkIcon,
  UserPlus,
  Calendar,
  Hash,
} from "lucide-react"
import { formatDate } from "@/lib/utils"

interface TeamManagementExampleProps {
  projectId: string
  projectTitle?: string
}

export function TeamManagementExample({ 
  projectId, 
  projectTitle = "Project" 
}: TeamManagementExampleProps) {
  const [activeTab, setActiveTab] = useState("members")

  // Fetch active invitations for display
  const { data: invitations } = useQuery({
    queryKey: ["active-invitations", projectId],
    queryFn: async () => {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: GET_ACTIVE_INVITATIONS,
          variables: { projectId },
        }),
      })

      const result = await response.json()
      return result.data?.getActiveInvitations || []
    },
    staleTime: 30 * 1000,
  })

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
              Team Management
            </h1>
            <p className="text-muted-foreground">
              Manage your bidding team for {projectTitle}
            </p>
          </div>
          <TeamInvitationDialog projectId={projectId} />
        </div>

        {/* Active Invitations Banner */}
        {invitations && invitations.length > 0 && (
          <Card className="border-yellow-400/20 bg-yellow-400/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <LinkIcon className="h-5 w-5 text-yellow-400" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-black dark:text-white">
                    {invitations.length} Active Invitation{invitations.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Share invitation codes or links with potential team members
                  </p>
                </div>
                <Badge variant="outline" className="border-yellow-400/30 text-yellow-400">
                  {invitations.length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <LinkIcon className="h-4 w-4" />
            Invitations
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          <TeamMembersList projectId={projectId} />
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-4">
          <TeamStatisticsCard projectId={projectId} />
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations" className="space-y-4">
          <Card className="border-yellow-400/20 bg-white dark:bg-black">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                  <LinkIcon className="h-5 w-5 text-yellow-400" />
                  Active Invitations
                </CardTitle>
                <TeamInvitationDialog 
                  projectId={projectId}
                  trigger={
                    <Button 
                      size="sm" 
                      className="bg-yellow-400 hover:bg-yellow-500 text-black"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      New Invitation
                    </Button>
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              {!invitations || invitations.length === 0 ? (
                <div className="text-center py-12">
                  <LinkIcon className="h-12 w-12 text-yellow-400 mx-auto mb-4 opacity-50" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No active invitations. Generate an invitation to invite team members.
                  </p>
                  <TeamInvitationDialog 
                    projectId={projectId}
                    trigger={
                      <Button className="bg-yellow-400 hover:bg-yellow-500 text-black">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Generate Invitation
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {invitations.map((invitation: any) => (
                    <div
                      key={invitation.id}
                      className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-yellow-400" />
                            <span className="font-mono font-semibold text-black dark:text-white">
                              {invitation.code}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-yellow-400/30 text-yellow-400"
                            >
                              {invitation.isMultiUse ? "Multi-use" : "Single-use"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expires {formatDate(invitation.expiresAt)}
                            </div>
                            {invitation.usedAt && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Used {formatDate(invitation.usedAt)}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const link = `${window.location.origin}/invitations/${invitation.token}`
                            navigator.clipboard.writeText(link)
                          }}
                          className="border-yellow-400/20 hover:bg-yellow-400/10"
                        >
                          Copy Link
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
