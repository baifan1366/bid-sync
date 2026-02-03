'use client'

import { useQuery } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Users, 
  Crown, 
  Mail,
  Loader2,
  Shield,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MEMBER_TEAMS_QUERY = `
  query MemberTeams {
    myTeams {
      proposalId
      proposalTitle
      projectId
      projectTitle
      role
      joinedAt
      lead {
        id
        name
        email
      }
      members {
        id
        userId
        userName
        email
        role
        joinedAt
      }
    }
  }
`

interface TeamMember {
  id: string
  userId: string
  userName: string
  email: string
  role: string
  joinedAt: string
}

interface Team {
  proposalId: string
  proposalTitle: string
  projectId: string
  projectTitle: string
  role: string
  joinedAt: string
  lead: {
    id: string
    name: string
    email: string
  }
  members: TeamMember[]
}

export function TeamInfoCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['memberTeams'],
    queryFn: async () => {
      const client = createGraphQLClient()
      return await client.request<{ myTeams: Team[] }>(MEMBER_TEAMS_QUERY)
    }
  })

  const teams = data?.myTeams || []

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
        <p className="text-sm text-muted-foreground">
          You haven't been invited to any proposal teams yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4 text-yellow-400" />
        <span>You are part of {teams.length} team{teams.length > 1 ? 's' : ''}</span>
      </div>
      <div>
        {teams.map((team) => (
          <div
            key={team.proposalId}
            className="border border-yellow-400/20 rounded-lg p-4 space-y-4"
          >
            {/* Team Header */}
            <div className="space-y-1">
              <h3 className="font-semibold text-black dark:text-white">
                {team.proposalTitle || 'Untitled Proposal'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Project: {team.projectTitle}
              </p>
              <Badge className="bg-yellow-400 text-black">
                <Shield className="h-3 w-3 mr-1" />
                {team.role}
              </Badge>
            </div>

            {/* Team Lead */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-400" />
                Team Lead
              </h4>
              <div className="flex items-center gap-3 p-3 bg-yellow-400/5 rounded-lg border border-yellow-400/10">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-yellow-400 text-black">
                    {getInitials(team.lead.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-black dark:text-white truncate">
                    {team.lead.name}
                  </p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{team.lead.email}</span>
                  </div>
                </div>
                <Badge className="bg-yellow-400 text-black shrink-0">
                  <Crown className="h-3 w-3 mr-1" />
                  Lead
                </Badge>
              </div>
            </div>

            {/* Team Members */}
            {team.members.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-yellow-400" />
                  Team Members ({team.members.length})
                </h4>
                <div className="space-y-2">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-black rounded-lg border border-yellow-400/10 hover:border-yellow-400/20 transition-colors"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-yellow-400/20 text-yellow-400">
                          {getInitials(member.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-black dark:text-white truncate">
                          {member.userName}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className="text-xs shrink-0"
                      >
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Join Date */}
            <div className="text-xs text-muted-foreground pt-2 border-t border-yellow-400/10">
              Joined {new Date(team.joinedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
