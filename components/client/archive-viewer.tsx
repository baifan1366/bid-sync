'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Archive,
  Download,
  FileText,
  Calendar,
  DollarSign,
  User,
  Clock,
  Shield,
  AlertCircle,
  Package,
  MessageSquare,
  FileCode,
} from 'lucide-react'
import { formatBudget, formatDate, cn } from '@/lib/utils'

interface ArchivedProject {
  id: string
  title: string
  description: string
  budget?: number
  deadline?: string
  clientId: string
  status: string
  proposals: ArchivedProposal[]
  deliverables: ArchivedDeliverable[]
  documents: ArchivedDocument[]
  comments: ArchivedComment[]
}

interface ArchivedProposal {
  id: string
  leadId: string
  status: string
  submittedAt?: string
  versions: ArchivedVersion[]
}

interface ArchivedVersion {
  versionNumber: number
  content: string
  createdBy: string
  createdAt: string
}

interface ArchivedDeliverable {
  id: string
  projectId: string
  proposalId: string
  uploadedBy: {
    id: string
    email: string
    fullName: string
  }
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  description?: string
  version: number
  isFinal: boolean
  uploadedAt: string
  downloadUrl: string
}

interface ArchivedDocument {
  id: string
  title: string
  content: string
  createdBy: string
  createdAt: string
}

interface ArchivedComment {
  id: string
  authorId: string
  message: string
  visibility: string
  createdAt: string
}

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
  retentionUntil?: string
  legalHold: boolean
  legalHoldReason?: string
  accessCount: number
  lastAccessedAt?: string
  project: ArchivedProject
}

interface ArchiveViewerProps {
  archive: ProjectArchive
}

export function ArchiveViewer({ archive }: ArchiveViewerProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const { project } = archive

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Archive Status Banner */}
      <Card className="border-yellow-400/40 bg-yellow-400/5">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Archive className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-black dark:text-white">
                  Archived Project
                </h3>
                <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                  Read-Only
                </Badge>
                {archive.legalHold && (
                  <Badge variant="outline" className="border-red-600 text-red-600 dark:border-red-400 dark:text-red-400">
                    <Shield className="h-3 w-3 mr-1" />
                    Legal Hold
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                This project has been archived and is in read-only mode. All data is preserved for reference.
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Archived {formatDate(archive.archivedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  By {archive.archivedBy.fullName}
                </span>
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  ID: {archive.archiveIdentifier}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deliverables">
            Deliverables ({project.deliverables.length})
          </TabsTrigger>
          <TabsTrigger value="proposals">
            Proposals ({project.proposals.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({project.documents.length})
          </TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle className="text-black dark:text-white">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white mb-2">
                  {project.title}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {project.description}
                </p>
              </div>

              <Separator className="bg-yellow-400/20" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {project.budget && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="font-semibold text-yellow-400">
                        {formatBudget(project.budget)}
                      </p>
                    </div>
                  </div>
                )}

                {project.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Deadline</p>
                      <p className="font-medium text-black dark:text-white">
                        {formatDate(project.deadline)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                      {project.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Deliverables</p>
                    <p className="font-medium text-black dark:text-white">
                      {project.deliverables.length} files
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-yellow-400/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">
                    {project.proposals.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Proposals</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-400/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">
                    {project.deliverables.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Deliverables</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-400/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">
                    {project.documents.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Documents</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-400/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">
                    {project.comments.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables" className="space-y-4">
          {project.deliverables.length === 0 ? (
            <Card className="border-yellow-400/20">
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No deliverables in this archive</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {project.deliverables.map((deliverable) => (
                <Card key={deliverable.id} className="border-yellow-400/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-yellow-400" />
                          <h4 className="font-semibold text-black dark:text-white">
                            {deliverable.fileName}
                          </h4>
                          {deliverable.isFinal && (
                            <Badge className="bg-yellow-400 text-black hover:bg-yellow-500 text-xs">
                              Final
                            </Badge>
                          )}
                        </div>

                        {deliverable.description && (
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {deliverable.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span>{formatFileSize(deliverable.fileSize)}</span>
                          <span>{deliverable.fileType}</span>
                          <span>Version {deliverable.version}</span>
                          <span>Uploaded {formatDate(deliverable.uploadedAt)}</span>
                          <span>By {deliverable.uploadedBy.fullName}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="border-yellow-400/40 hover:bg-yellow-400/10 hover:border-yellow-400"
                        onClick={() => window.open(deliverable.downloadUrl, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals" className="space-y-4">
          {project.proposals.length === 0 ? (
            <Card className="border-yellow-400/20">
              <CardContent className="p-8 text-center">
                <FileCode className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No proposals in this archive</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {project.proposals.map((proposal) => (
                <Card key={proposal.id} className="border-yellow-400/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-black dark:text-white">
                        Proposal {proposal.id.slice(0, 8)}
                      </CardTitle>
                      <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                        {proposal.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {proposal.submittedAt && (
                      <p className="text-sm text-muted-foreground">
                        Submitted {formatDate(proposal.submittedAt)}
                      </p>
                    )}

                    {proposal.versions.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-black dark:text-white mb-2">
                          Versions ({proposal.versions.length})
                        </h5>
                        <ScrollArea className="h-[200px] rounded-md border border-yellow-400/20 p-3">
                          <div className="space-y-2">
                            {proposal.versions.map((version) => (
                              <div
                                key={version.versionNumber}
                                className="text-xs p-2 rounded bg-yellow-400/5 border border-yellow-400/20"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-black dark:text-white">
                                    Version {version.versionNumber}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatDate(version.createdAt)}
                                  </span>
                                </div>
                                <p className="text-muted-foreground line-clamp-2">
                                  {typeof version.content === 'string'
                                    ? version.content
                                    : JSON.stringify(version.content).slice(0, 100)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          {project.documents.length === 0 ? (
            <Card className="border-yellow-400/20">
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No documents in this archive</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {project.documents.map((document) => (
                <Card key={document.id} className="border-yellow-400/20">
                  <CardHeader>
                    <CardTitle className="text-base text-black dark:text-white">
                      {document.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Created {formatDate(document.createdAt)}
                    </p>
                    <ScrollArea className="h-[150px] rounded-md border border-yellow-400/20 p-3">
                      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {typeof document.content === 'string'
                          ? document.content
                          : JSON.stringify(document.content, null, 2)}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-4">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle className="text-black dark:text-white">Archive Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Archive ID</p>
                  <p className="font-mono text-sm text-black dark:text-white">
                    {archive.id}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Archive Identifier</p>
                  <p className="font-mono text-sm text-yellow-400">
                    {archive.archiveIdentifier}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Archived By</p>
                  <p className="text-sm text-black dark:text-white">
                    {archive.archivedBy.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {archive.archivedBy.email}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Archived At</p>
                  <p className="text-sm text-black dark:text-white">
                    {formatDate(archive.archivedAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Original Size</p>
                  <p className="text-sm text-black dark:text-white">
                    {formatFileSize(archive.originalSize)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Compressed Size</p>
                  <p className="text-sm text-yellow-400">
                    {formatFileSize(archive.compressedSize)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Compression Ratio</p>
                  <p className="text-sm text-black dark:text-white">
                    {(archive.compressionRatio * 100).toFixed(1)}%
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Access Count</p>
                  <p className="text-sm text-black dark:text-white">
                    {archive.accessCount} times
                  </p>
                </div>

                {archive.lastAccessedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Last Accessed</p>
                    <p className="text-sm text-black dark:text-white">
                      {formatDate(archive.lastAccessedAt)}
                    </p>
                  </div>
                )}

                {archive.retentionUntil && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Retention Until</p>
                    <p className="text-sm text-black dark:text-white">
                      {formatDate(archive.retentionUntil)}
                    </p>
                  </div>
                )}
              </div>

              {archive.legalHold && (
                <>
                  <Separator className="bg-yellow-400/20" />
                  <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-600 dark:text-red-400 mb-1">
                          Legal Hold Active
                        </h4>
                        {archive.legalHoldReason && (
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {archive.legalHoldReason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
