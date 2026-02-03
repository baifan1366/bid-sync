"use client"

import { useUser } from "@/hooks/use-user"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Loader2, AlertCircle } from "lucide-react"
import { TeamMembersList } from "@/components/lead/team-members-list"
import { TeamInfoCard } from "@/components/member/team-info-card"

export function TeamPageContent() {
  const { user, loading } = useUser()
  
  const isBiddingLead = user?.user_metadata?.role === 'bidding_lead'
  const isBiddingMember = user?.user_metadata?.role === 'bidding_member'

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          </div>
        </div>
      </div>
    )
  }

  if (!user || (!isBiddingLead && !isBiddingMember)) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
        <div className="max-w-[1800px] mx-auto">
          <Card className="p-6 border-yellow-400/20">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <p className="text-muted-foreground">
                Team management is only available for bidding team members.
              </p>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Lead view - manage team members across proposals
  if (isBiddingLead) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
        <div className="max-w-[1800px] mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
              Team Management
            </h1>
            <p className="text-muted-foreground">
              View and manage team members across all your proposals
            </p>
          </div>

          <div className="space-y-6">
            {/* Team Members List - Shows all proposals */}
            <TeamMembersList />

            {/* Info Card */}
            <Card className="border-yellow-400/20 bg-yellow-400/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                  <Users className="h-5 w-5 text-yellow-400" />
                  About Team Management
                </CardTitle>
                <CardDescription>
                  Team members are organized by proposal. Each proposal has its own independent team.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  • <strong>Leads</strong> can invite members and manage their proposal teams
                </p>
                <p>
                  • <strong>Members</strong> can collaborate on assigned sections
                </p>
                <p>
                  • Each proposal maintains separate team membership
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Member view - view team memberships
  return (
    <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            Team Management
          </h1>
          <p className="text-muted-foreground">
            View your team memberships and collaborate with your colleagues
          </p>
        </div>

        {/* Team Information */}
        <Card className="border-yellow-400/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-yellow-400" />
              My Teams
            </CardTitle>
            <CardDescription>
              Teams you're part of across different proposals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamInfoCard />
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-yellow-400/20 bg-yellow-400/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black dark:text-white">
              <Users className="h-5 w-5 text-yellow-400" />
              About Team Collaboration
            </CardTitle>
            <CardDescription>
              Work together with your team on proposal sections
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              • <strong>Team Lead</strong> manages the proposal and assigns sections
            </p>
            <p>
              • <strong>Team Members</strong> collaborate on their assigned sections
            </p>
            <p>
              • Each proposal has its own independent team structure
            </p>
            <p>
              • Access your assigned work through the Member Dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
