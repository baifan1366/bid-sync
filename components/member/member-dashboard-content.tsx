'use client'

import { useQuery } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, 
  Clock, 
  FileText, 
  AlertCircle,
  Calendar,
  Users,
  Loader2,
  ArrowRight
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

const MEMBER_SECTIONS_QUERY = `
  query MemberAssignedSections {
    myAssignedSections {
      id
      title
      status
      deadline
      document {
        id
        title
        workspace {
          id
          projectId
          name
        }
      }
    }
  }
`

export function MemberDashboardContent() {
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ['memberSections'],
    queryFn: async () => {
      const client = createGraphQLClient()
      return await client.request<any>(MEMBER_SECTIONS_QUERY)
    }
  })

  const sections = data?.myAssignedSections || []

  const stats = {
    total: sections.length,
    notStarted: sections.filter((s: any) => s.status === 'NOT_STARTED').length,
    inProgress: sections.filter((s: any) => s.status === 'IN_PROGRESS').length,
    completed: sections.filter((s: any) => s.status === 'COMPLETED').length,
    overdue: sections.filter((s: any) => {
      if (!s.deadline) return false
      return new Date(s.deadline) < new Date() && s.status !== 'COMPLETED'
    }).length
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NOT_STARTED': return 'bg-gray-500 text-white'
      case 'IN_PROGRESS': return 'bg-yellow-400 text-black'
      case 'IN_REVIEW': return 'bg-blue-500 text-white'
      case 'COMPLETED': return 'bg-green-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />
      case 'IN_PROGRESS': return <Clock className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const isOverdue = (deadline: string | null, status: string) => {
    if (!deadline || status === 'COMPLETED') return false
    return new Date(deadline) < new Date()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Member Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your assigned sections and tasks
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sections</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Not Started</p>
                  <p className="text-2xl font-bold">{stats.notStarted}</p>
                </div>
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-red-500">{stats.overdue}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Sections */}
        <Card className="border-yellow-400/20">
          <CardHeader>
            <CardTitle>My Assigned Sections</CardTitle>
          </CardHeader>
          <CardContent>
            {sections.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No sections assigned</h3>
                <p className="text-muted-foreground">
                  You don't have any sections assigned to you yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map((section: any) => (
                  <div
                    key={section.id}
                    className="border border-yellow-400/20 rounded-lg p-4 hover:border-yellow-400/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{section.title}</h3>
                          <Badge className={getStatusColor(section.status)}>
                            {getStatusIcon(section.status)}
                            <span className="ml-1">{section.status.replace('_', ' ')}</span>
                          </Badge>
                          {isOverdue(section.deadline, section.status) && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            <span>{section.document.title}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{section.document.workspace.name}</span>
                          </div>
                          {section.deadline && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                Due {formatDistanceToNow(new Date(section.deadline), { addSuffix: true })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        onClick={() => router.push(`/editor/${section.document.id}`)}
                        className="bg-yellow-400 hover:bg-yellow-500 text-black"
                      >
                        Open
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
