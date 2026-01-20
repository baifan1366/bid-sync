'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  Calendar,
  FileText,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const PENDING_PROJECTS_QUERY = `
  query PendingProjects {
    pendingProjects {
      id
      clientId
      title
      description
      budget
      deadline
      status
      createdAt
      client {
        id
        email
        fullName
      }
      additionalInfoRequirements {
        id
        fieldName
        fieldType
        required
      }
    }
  }
`

const APPROVE_PROJECT_MUTATION = `
  mutation ApproveProject($projectId: ID!, $notes: String) {
    approveProject(projectId: $projectId, notes: $notes) {
      id
      status
    }
  }
`

const REJECT_PROJECT_MUTATION = `
  mutation RejectProject($projectId: ID!, $reason: String!) {
    rejectProject(projectId: $projectId, reason: $reason) {
      id
      status
    }
  }
`

interface Project {
  id: string
  clientId: string
  title: string
  description: string
  budget: number | null
  deadline: string | null
  status: string
  createdAt: string
  client: {
    id: string
    email: string
    fullName: string | null
  } | null
  additionalInfoRequirements: Array<{
    id: string
    fieldName: string
    fieldType: string
    required: boolean
  }>
}

export function ProjectApprovalQueue() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['pendingProjects'],
    queryFn: async () => {
      const client = createGraphQLClient()
      return await client.request<{ pendingProjects: Project[] }>(PENDING_PROJECTS_QUERY)
    }
  })

  const approveMutation = useMutation({
    mutationFn: async ({ projectId, notes }: { projectId: string; notes: string }) => {
      const client = createGraphQLClient()
      return await client.request(APPROVE_PROJECT_MUTATION, { projectId, notes })
    },
    onSuccess: () => {
      toast({
        title: 'Project approved',
        description: 'The project has been approved and is now open for bidding.',
      })
      queryClient.invalidateQueries({ queryKey: ['pendingProjects'] })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast({
        title: 'Approval failed',
        description: error.message || 'Failed to approve project',
        variant: 'destructive',
      })
    }
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ projectId, reason }: { projectId: string; reason: string }) => {
      const client = createGraphQLClient()
      return await client.request(REJECT_PROJECT_MUTATION, { projectId, reason })
    },
    onSuccess: () => {
      toast({
        title: 'Project rejected',
        description: 'The client has been notified of the rejection.',
      })
      queryClient.invalidateQueries({ queryKey: ['pendingProjects'] })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast({
        title: 'Rejection failed',
        description: error.message || 'Failed to reject project',
        variant: 'destructive',
      })
    }
  })

  const handleApprove = (project: Project) => {
    setSelectedProject(project)
    setActionType('approve')
    setNotes('')
  }

  const handleReject = (project: Project) => {
    setSelectedProject(project)
    setActionType('reject')
    setNotes('')
  }

  const handleCloseDialog = () => {
    setSelectedProject(null)
    setActionType(null)
    setNotes('')
  }

  const handleConfirm = () => {
    if (!selectedProject) return

    if (actionType === 'approve') {
      approveMutation.mutate({ projectId: selectedProject.id, notes })
    } else if (actionType === 'reject') {
      if (!notes.trim()) {
        toast({
          title: 'Reason required',
          description: 'Please provide a reason for rejection',
          variant: 'destructive',
        })
        return
      }
      rejectMutation.mutate({ projectId: selectedProject.id, reason: notes })
    }
  }

  if (isLoading) {
    return <ProjectApprovalQueueSkeleton />
  }

  const projects = data?.pendingProjects || []

  if (projects.length === 0) {
    return (
      <Card className="border-yellow-400/20">
        <CardContent className="py-12">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              There are no projects pending approval at the moment.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.id} className="border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2">{project.title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>By {project.client?.fullName || project.client?.email || 'Unknown'}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
                <Badge className="bg-yellow-400 text-black">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending Review
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {project.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {project.budget && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="font-medium">${project.budget.toLocaleString()}</p>
                    </div>
                  </div>
                )}
                {project.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-yellow-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Deadline</p>
                      <p className="font-medium">
                        {new Date(project.deadline).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                {project.additionalInfoRequirements.length > 0 && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-yellow-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Custom Fields</p>
                      <p className="font-medium">
                        {project.additionalInfoRequirements.length} field(s)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => handleApprove(project)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => handleReject(project)}
                  variant="outline"
                  className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedProject} onOpenChange={handleCloseDialog}>
        <DialogContent className="border-yellow-400/20">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Project' : 'Reject Project'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'This project will be published and open for bidding.'
                : 'Please provide a reason for rejecting this project.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">
                {actionType === 'approve' ? 'Notes (Optional)' : 'Rejection Reason *'}
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  actionType === 'approve'
                    ? 'Add any notes for the client...'
                    : 'Explain why this project is being rejected...'
                }
                className="border-yellow-400/20 focus-visible:ring-yellow-400 mt-2"
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCloseDialog}
                variant="outline"
                className="flex-1 border-yellow-400/20"
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className={
                  actionType === 'approve'
                    ? 'flex-1 bg-green-500 hover:bg-green-600 text-white'
                    : 'flex-1 bg-red-500 hover:bg-red-600 text-white'
                }
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                {(approveMutation.isPending || rejectMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {actionType === 'approve' ? 'Approve Project' : 'Reject Project'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
