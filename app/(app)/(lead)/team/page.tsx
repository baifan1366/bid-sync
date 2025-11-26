import { TeamMembersList } from "@/components/lead/team-members-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"

export const metadata = {
  title: "Team Management | BidSync",
  description: "Manage your bidding team members across all proposals",
}

export default function TeamManagementPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Team Management
        </h1>
        <p className="text-muted-foreground">
          View and manage team members across all your proposals
        </p>
      </div>

      <div className="space-y-6">
        {/* Team Members List - Now shows all proposals */}
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
  )
}
