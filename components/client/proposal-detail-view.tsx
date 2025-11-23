"use client"

import * as React from "react"
import { X, Calendar, DollarSign, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Download, FileText, AlertCircle, Users, Mail, Award, History, Eye, GitCompare, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProposalDetail } from "@/lib/graphql/types"
import { formatProposalBudget } from "@/lib/proposal-utils"
import { ProposalSubmissionWizard } from "./proposal-submission-wizard"
import { useUser } from "@/hooks/use-user"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"

interface ProposalDetailViewProps {
  proposalId: string
  projectId?: string
  onClose: () => void
  onSubmissionComplete?: () => void
}

export function ProposalDetailView({ proposalId, projectId, onClose, onSubmissionComplete }: ProposalDetailViewProps) {
  // TODO: Fetch proposal detail data using GraphQL
  const [isLoading, setIsLoading] = React.useState(true)
  const [proposal, setProposal] = React.useState<ProposalDetail | null>(null)
  const [wizardOpen, setWizardOpen] = React.useState(false)
  const [additionalInfoRequirements, setAdditionalInfoRequirements] = React.useState<AdditionalInfoRequirement[]>([])
  const { user } = useUser()

  React.useEffect(() => {
    // Placeholder for data fetching
    // This will be implemented when GraphQL queries are ready
    // TODO: Fetch proposal data and additional info requirements
    setIsLoading(false)
  }, [proposalId])

  const refreshProposalData = React.useCallback(async () => {
    // TODO: Refetch proposal data from GraphQL
    // This will be called after successful submission
    setIsLoading(true)
    try {
      // Placeholder for refetch logic
      // await refetchProposal()
    } finally {
      setIsLoading(false)
    }
  }, [proposalId])

  // Handle Escape key to close
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !wizardOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, wizardOpen])

  const handleSubmissionComplete = React.useCallback(async (submissionId: string) => {
    console.log("Proposal submitted successfully:", submissionId)
    setWizardOpen(false)
    await refreshProposalData()
    onSubmissionComplete?.()
  }, [refreshProposalData, onSubmissionComplete])

  // Check if current user is the proposal lead
  const isProposalLead = React.useMemo(() => {
    if (!user || !proposal) return false
    return proposal.biddingTeam.lead.id === user.id
  }, [user, proposal])

  // Check if proposal is in draft status
  const isDraftProposal = React.useMemo(() => {
    if (!proposal) return false
    return proposal.status.toLowerCase() === 'draft'
  }, [proposal])

  // Show submit button only for draft proposals and only to the proposal lead
  const showSubmitButton = isDraftProposal && isProposalLead

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-black">
        <div className="flex h-full items-center justify-center">
          <div className="text-muted-foreground">Loading proposal...</div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 z-50 overflow-auto bg-white dark:bg-black"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-detail-title"
    >
      {/* Header with close button */}
      <div className="sticky top-0 z-10 border-b border-yellow-400/20 bg-white dark:bg-black">
        <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <h2 
              id="proposal-detail-title"
              className="text-2xl font-bold text-black dark:text-white"
            >
              Proposal Details
            </h2>
            <div className="flex items-center gap-2">
              {showSubmitButton && (
                <Button
                  onClick={() => setWizardOpen(true)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black"
                  aria-label="Submit proposal"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit Proposal
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-yellow-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
                aria-label="Close proposal details"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6">
        <Card className="border-yellow-400/20">
          <Tabs defaultValue="overview" className="w-full">
            <div className="border-b border-yellow-400/20 px-6 pt-6">
              <TabsList className="bg-transparent">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="sections"
                  className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                >
                  Sections
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                >
                  Documents
                </TabsTrigger>
                <TabsTrigger
                  value="team"
                  className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                >
                  Team
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                >
                  History
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="overview" className="mt-0">
                <OverviewTab proposal={proposal} />
              </TabsContent>

              <TabsContent value="sections" className="mt-0">
                <SectionsTab proposal={proposal} />
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                <DocumentsTab proposal={proposal} />
              </TabsContent>

              <TabsContent value="team" className="mt-0">
                <TeamTab proposal={proposal} />
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <HistoryTab proposal={proposal} />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>

      {/* Proposal Submission Wizard */}
      {showSubmitButton && projectId && (
        <ProposalSubmissionWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          proposalId={proposalId}
          projectId={projectId}
          additionalInfoRequirements={additionalInfoRequirements}
          onComplete={handleSubmissionComplete}
        />
      )}
    </div>
  )
}

// Overview Tab Component
function OverviewTab({ proposal }: { proposal: ProposalDetail | null }) {
  if (!proposal) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No proposal data available</p>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === 'accepted' || statusLower === 'approved') {
      return 'bg-green-500 text-white'
    }
    if (statusLower === 'rejected') {
      return 'bg-red-500 text-white'
    }
    if (statusLower === 'submitted') {
      return 'bg-yellow-400 text-black'
    }
    if (statusLower === 'under_review' || statusLower === 'reviewing') {
      return 'bg-blue-500 text-white'
    }
    return 'bg-gray-500 text-white'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const compliancePercentage = proposal.complianceChecklist.length > 0
    ? Math.round(
        (proposal.complianceChecklist.filter((item) => item.completed).length /
          proposal.complianceChecklist.length) *
          100
      )
    : 0

  return (
    <div className="space-y-6">
      {/* Proposal Summary */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">
          Proposal Summary
        </h3>
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Title</p>
              <p className="font-medium text-black dark:text-white">
                {proposal.title || 'Untitled Proposal'}
              </p>
            </div>
            <Badge className={getStatusColor(proposal.status)}>
              {proposal.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Bidding Lead Information */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">
          Bidding Lead
        </h3>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={proposal.biddingTeam.lead.avatarUrl || undefined} />
            <AvatarFallback className="bg-yellow-400 text-black">
              {getInitials(proposal.biddingTeam.lead.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-black dark:text-white">
              {proposal.biddingTeam.lead.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {proposal.biddingTeam.lead.email}
            </p>
            <p className="text-sm text-muted-foreground">
              Role: {proposal.biddingTeam.lead.role}
            </p>
          </div>
        </div>
      </div>

      {/* Key Information Grid */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">
          Key Information
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Submission Date */}
          <div className="flex items-start gap-3 rounded-lg border border-yellow-400/20 p-4">
            <Calendar className="mt-0.5 h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-sm text-muted-foreground">Submission Date</p>
              <p className="font-medium text-black dark:text-white">
                {formatDate(proposal.submissionDate)}
              </p>
            </div>
          </div>

          {/* Budget Estimate */}
          <div className="flex items-start gap-3 rounded-lg border border-yellow-400/20 p-4">
            <DollarSign className="mt-0.5 h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-sm text-muted-foreground">Budget Estimate</p>
              <p className="font-medium text-black dark:text-white">
                {/* Budget will come from proposal data when available */}
                Not specified
              </p>
            </div>
          </div>

          {/* Timeline Estimate */}
          <div className="flex items-start gap-3 rounded-lg border border-yellow-400/20 p-4">
            <Clock className="mt-0.5 h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-sm text-muted-foreground">Timeline Estimate</p>
              <p className="font-medium text-black dark:text-white">
                {/* Timeline will come from proposal data when available */}
                Not specified
              </p>
            </div>
          </div>

          {/* Compliance Status */}
          <div className="flex items-start gap-3 rounded-lg border border-yellow-400/20 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-sm text-muted-foreground">Compliance Status</p>
              <p className="font-medium text-black dark:text-white">
                {compliancePercentage}% Complete
              </p>
              <p className="text-xs text-muted-foreground">
                {proposal.complianceChecklist.filter((item) => item.completed).length} of{' '}
                {proposal.complianceChecklist.length} items
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Checklist */}
      {proposal.complianceChecklist.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">
            Compliance Checklist
          </h3>
          <div className="space-y-2">
            {proposal.complianceChecklist.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-yellow-400/20 p-3"
              >
                {item.completed ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 text-gray-400" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-black dark:text-white">{item.item}</p>
                    <Badge
                      variant="outline"
                      className="border-yellow-400/40 text-yellow-400"
                    >
                      {item.category}
                    </Badge>
                  </div>
                  {item.completed && item.completedAt && (
                    <p className="text-xs text-muted-foreground">
                      Completed on {formatDate(item.completedAt)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Sections Tab Component
function SectionsTab({ proposal }: { proposal: ProposalDetail | null }) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set())

  if (!proposal) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No proposal data available</p>
      </div>
    )
  }

  if (proposal.sections.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No sections available for this proposal</p>
      </div>
    )
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const expandAll = () => {
    setExpandedSections(new Set(proposal.sections.map((s) => s.id)))
  }

  const collapseAll = () => {
    setExpandedSections(new Set())
  }

  // Sort sections by order
  const sortedSections = [...proposal.sections].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-4">
      {/* Section Navigation */}
      <div className="flex items-center justify-between rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
        <div>
          <h3 className="font-semibold text-black dark:text-white">
            Proposal Sections
          </h3>
          <p className="text-sm text-muted-foreground">
            {sortedSections.length} section{sortedSections.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
            className="border-yellow-400/40 hover:bg-yellow-400/10"
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
            className="border-yellow-400/40 hover:bg-yellow-400/10"
          >
            Collapse All
          </Button>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-3">
        {sortedSections.map((section, index) => {
          const isExpanded = expandedSections.has(section.id)
          
          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-lg border border-yellow-400/20"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between bg-yellow-400/5 p-4 text-left transition-colors hover:bg-yellow-400/10"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-sm font-semibold text-black">
                    {index + 1}
                  </span>
                  <h4 className="font-semibold text-black dark:text-white">
                    {section.title}
                  </h4>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-yellow-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-yellow-400" />
                )}
              </button>

              {/* Section Content */}
              {isExpanded && (
                <div className="border-t border-yellow-400/20 bg-white p-6 dark:bg-black">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {/* Render rich text content */}
                    <div
                      className="text-black dark:text-white"
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick Navigation */}
      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
        <h4 className="mb-3 font-semibold text-black dark:text-white">
          Quick Navigation
        </h4>
        <div className="flex flex-wrap gap-2">
          {sortedSections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => {
                toggleSection(section.id)
                // Scroll to section
                const element = document.getElementById(`section-${section.id}`)
                element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="rounded-md border border-yellow-400/40 bg-white px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-yellow-400 hover:text-black dark:bg-black dark:text-white dark:hover:bg-yellow-400 dark:hover:text-black"
            >
              {index + 1}. {section.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Documents Tab Component
function DocumentsTab({ proposal }: { proposal: ProposalDetail | null }) {
  const [downloadingDocs, setDownloadingDocs] = React.useState<Set<string>>(new Set())
  const [downloadErrors, setDownloadErrors] = React.useState<Map<string, string>>(new Map())

  if (!proposal) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No proposal data available</p>
      </div>
    )
  }

  if (proposal.documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No documents attached to this proposal</p>
      </div>
    )
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleDownload = async (doc: typeof proposal.documents[0]) => {
    setDownloadingDocs((prev) => new Set(prev).add(doc.id))
    setDownloadErrors((prev) => {
      const newMap = new Map(prev)
      newMap.delete(doc.id)
      return newMap
    })

    try {
      // Simulate download - in real implementation, this would fetch from Supabase
      const response = await fetch(doc.url)
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      setDownloadErrors((prev) => {
        const newMap = new Map(prev)
        newMap.set(doc.id, 'Failed to download. Please try again.')
        return newMap
      })
    } finally {
      setDownloadingDocs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(doc.id)
        return newSet
      })
    }
  }

  const retryDownload = (doc: typeof proposal.documents[0]) => {
    handleDownload(doc)
  }

  // Group documents by category
  const groupedDocuments = proposal.documents.reduce((acc, doc) => {
    const category = doc.category || 'other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(doc)
    return acc
  }, {} as Record<string, typeof proposal.documents>)

  const categoryLabels: Record<string, string> = {
    technical: 'Technical Documents',
    financial: 'Financial Documents',
    legal: 'Legal Documents',
    other: 'Other Documents',
  }

  const categoryColors: Record<string, string> = {
    technical: 'bg-blue-500',
    financial: 'bg-green-500',
    legal: 'bg-purple-500',
    other: 'bg-gray-500',
  }

  return (
    <div className="space-y-6">
      {/* Documents Summary */}
      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
        <h3 className="font-semibold text-black dark:text-white">
          Documents Overview
        </h3>
        <p className="text-sm text-muted-foreground">
          {proposal.documents.length} document{proposal.documents.length !== 1 ? 's' : ''} attached
        </p>
      </div>

      {/* Documents by Category */}
      {Object.entries(groupedDocuments).map(([category, docs]) => (
        <div key={category}>
          <div className="mb-3 flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${categoryColors[category]}`} />
            <h4 className="font-semibold text-black dark:text-white">
              {categoryLabels[category]}
            </h4>
            <span className="text-sm text-muted-foreground">({docs.length})</span>
          </div>

          <div className="space-y-2">
            {docs.map((doc) => {
              const isDownloading = downloadingDocs.has(doc.id)
              const error = downloadErrors.get(doc.id)

              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-yellow-400/20 p-4 transition-colors hover:border-yellow-400/40"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 text-yellow-400" />
                    <div>
                      <p className="font-medium text-black dark:text-white">
                        {doc.name}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{doc.fileType.toUpperCase()}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>•</span>
                        <span>Uploaded {formatDate(doc.uploadedAt)}</span>
                      </div>
                      {error && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
                          <AlertCircle className="h-3 w-3" />
                          <span>{error}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {error ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryDownload(doc)}
                        className="border-yellow-400/40 hover:bg-yellow-400/10"
                      >
                        Retry
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        disabled={isDownloading}
                        className="bg-yellow-400 text-black hover:bg-yellow-500"
                      >
                        {isDownloading ? (
                          <>
                            <span className="mr-2">Downloading...</span>
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// Team Tab Component
function TeamTab({ proposal }: { proposal: ProposalDetail | null }) {
  if (!proposal) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No proposal data available</p>
      </div>
    )
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const allMembers = [proposal.biddingTeam.lead, ...proposal.biddingTeam.members]

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-yellow-400" />
          <h3 className="font-semibold text-black dark:text-white">
            Team Overview
          </h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {allMembers.length} team member{allMembers.length !== 1 ? 's' : ''} working on this proposal
        </p>
      </div>

      {/* Bidding Lead */}
      <div>
        <h4 className="mb-4 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
          <Award className="h-5 w-5 text-yellow-400" />
          Bidding Lead
        </h4>
        <div className="rounded-lg border border-yellow-400/20 p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={proposal.biddingTeam.lead.avatarUrl || undefined} />
              <AvatarFallback className="bg-yellow-400 text-lg text-black">
                {getInitials(proposal.biddingTeam.lead.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <button
                className="text-lg font-semibold text-black transition-colors hover:text-yellow-400 dark:text-white dark:hover:text-yellow-400"
                onClick={() => {
                  // TODO: Navigate to profile
                  console.log('Navigate to profile:', proposal.biddingTeam.lead.id)
                }}
              >
                {proposal.biddingTeam.lead.name}
              </button>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a
                  href={`mailto:${proposal.biddingTeam.lead.email}`}
                  className="hover:text-yellow-400"
                >
                  {proposal.biddingTeam.lead.email}
                </a>
              </div>
              <div className="mt-3">
                <Badge className="bg-yellow-400 text-black">
                  {proposal.biddingTeam.lead.role}
                </Badge>
              </div>
              {proposal.biddingTeam.lead.assignedSections.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-black dark:text-white">
                    Assigned Sections:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {proposal.biddingTeam.lead.assignedSections.map((section, idx) => (
                      <span
                        key={idx}
                        className="rounded-md border border-yellow-400/40 bg-yellow-400/10 px-2 py-1 text-xs text-black dark:text-white"
                      >
                        {section}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      {proposal.biddingTeam.members.length > 0 && (
        <div>
          <h4 className="mb-4 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
            <Users className="h-5 w-5 text-yellow-400" />
            Team Members
          </h4>
          <div className="space-y-3">
            {proposal.biddingTeam.members.map((member) => (
              <div
                key={member.id}
                className="rounded-lg border border-yellow-400/20 p-4 transition-colors hover:border-yellow-400/40"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={member.avatarUrl || undefined} />
                    <AvatarFallback className="bg-yellow-400 text-black">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <button
                      className="font-semibold text-black transition-colors hover:text-yellow-400 dark:text-white dark:hover:text-yellow-400"
                      onClick={() => {
                        // TODO: Navigate to profile
                        console.log('Navigate to profile:', member.id)
                      }}
                    >
                      {member.name}
                    </button>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <a
                        href={`mailto:${member.email}`}
                        className="hover:text-yellow-400"
                      >
                        {member.email}
                      </a>
                    </div>
                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        className="border-yellow-400/40 text-yellow-400"
                      >
                        {member.role}
                      </Badge>
                    </div>
                    {member.assignedSections.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1 text-xs font-medium text-black dark:text-white">
                          Assigned Sections:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {member.assignedSections.map((section, idx) => (
                            <span
                              key={idx}
                              className="rounded-md border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-xs text-black dark:text-white"
                            >
                              {section}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Team Members */}
      {proposal.biddingTeam.members.length === 0 && (
        <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-6 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No additional team members assigned to this proposal
          </p>
        </div>
      )}
    </div>
  )
}

// History Tab Component
function HistoryTab({ proposal }: { proposal: ProposalDetail | null }) {
  const [selectedVersions, setSelectedVersions] = React.useState<number[]>([])

  if (!proposal) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No proposal data available</p>
      </div>
    )
  }

  if (proposal.versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <History className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No version history available</p>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleVersionSelect = (versionNumber: number) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionNumber)) {
        return prev.filter((v) => v !== versionNumber)
      }
      if (prev.length >= 2) {
        // Only allow 2 versions to be selected for comparison
        return [prev[1], versionNumber]
      }
      return [...prev, versionNumber]
    })
  }

  const handleViewVersion = (versionNumber: number) => {
    // TODO: Implement version viewing
    console.log('View version:', versionNumber)
  }

  const handleCompareVersions = () => {
    if (selectedVersions.length === 2) {
      // TODO: Implement version comparison
      console.log('Compare versions:', selectedVersions)
    }
  }

  // Sort versions by version number (newest first)
  const sortedVersions = [...proposal.versions].sort(
    (a, b) => b.version_number - a.version_number
  )

  return (
    <div className="space-y-6">
      {/* Version History Overview */}
      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-yellow-400" />
              <h3 className="font-semibold text-black dark:text-white">
                Version History
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {proposal.versions.length} version{proposal.versions.length !== 1 ? 's' : ''} •
              Current: v{proposal.currentVersion}
            </p>
          </div>
          {selectedVersions.length === 2 && (
            <Button
              onClick={handleCompareVersions}
              className="bg-yellow-400 text-black hover:bg-yellow-500"
            >
              <GitCompare className="mr-2 h-4 w-4" />
              Compare Selected
            </Button>
          )}
        </div>
        {selectedVersions.length > 0 && selectedVersions.length < 2 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Select one more version to compare
          </p>
        )}
      </div>

      {/* Version Timeline */}
      <div className="relative space-y-4">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 h-full w-0.5 bg-yellow-400/20" />

        {sortedVersions.map((version, index) => {
          const isCurrentVersion = version.version_number === proposal.currentVersion
          const isSelected = selectedVersions.includes(version.version_number)

          return (
            <div key={version.id} className="relative flex gap-4">
              {/* Timeline dot */}
              <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    isCurrentVersion
                      ? 'border-yellow-400 bg-yellow-400 text-black'
                      : 'border-yellow-400/40 bg-white dark:bg-black'
                  }`}
                >
                  <span className="text-xs font-semibold">
                    {version.version_number}
                  </span>
                </div>
              </div>

              {/* Version card */}
              <div
                className={`flex-1 rounded-lg border p-4 transition-colors ${
                  isSelected
                    ? 'border-yellow-400 bg-yellow-400/10'
                    : 'border-yellow-400/20 hover:border-yellow-400/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-black dark:text-white">
                        Version {version.version_number}
                      </h4>
                      {isCurrentVersion && (
                        <Badge className="bg-yellow-400 text-black">Current</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Created on {formatDate(version.created_at)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      By: {version.created_by}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVersionSelect(version.version_number)}
                      className={`border-yellow-400/40 ${
                        isSelected
                          ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                          : 'hover:bg-yellow-400/10'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewVersion(version.version_number)}
                      className="border-yellow-400/40 hover:bg-yellow-400/10"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>

                {/* Version content preview (if available) */}
                {version.content && (
                  <div className="mt-3 rounded-md border border-yellow-400/20 bg-yellow-400/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      Content preview available
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Comparison Instructions */}
      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
        <h4 className="mb-2 font-semibold text-black dark:text-white">
          How to Compare Versions
        </h4>
        <ol className="space-y-1 text-sm text-muted-foreground">
          <li>1. Select two versions by clicking the "Select" button</li>
          <li>2. Click "Compare Selected" to view differences</li>
          <li>3. Use "View" to see a specific version in detail</li>
        </ol>
      </div>
    </div>
  )
}
