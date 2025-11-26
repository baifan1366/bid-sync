"use client"

import * as React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { SectionManager } from "./section-manager"
import { SectionAssignmentDialog } from "./section-assignment-dialog"
import { DocumentUploader } from "./document-uploader"
import { DocumentList } from "./document-list"
import { DeadlineManager } from "./deadline-manager"
import { ProposalEditor } from "./proposal-editor"
import type { DocumentSection } from "@/lib/section-management-service"
import type { ProposalDocument } from "@/lib/document-service"
import {
  FileText,
  Users,
  Upload,
  Calendar,
  Edit,
} from "lucide-react"

/**
 * ProposalManagementExample Component
 * 
 * Comprehensive example demonstrating the integration of all proposal management components:
 * - ProposalEditor: Edit proposal content and metadata
 * - SectionManager: Manage proposal sections (add, edit, delete, reorder)
 * - SectionAssignmentDialog: Assign sections to team members
 * - DocumentUploader: Upload proposal documents
 * - DocumentList: View and manage uploaded documents
 * - DeadlineManager: Set and track section deadlines
 * 
 * This example shows how these components work together to provide a complete
 * proposal management interface for bidding leads.
 * 
 * Requirements: 6.1, 6.2, 7.1, 8.1, 8.3, 8.4, 8.5, 9.1, 9.3, 9.4
 */
export function ProposalManagementExample() {
  // Mock data
  const [sections, setSections] = React.useState<DocumentSection[]>([
    {
      id: "1",
      documentId: "doc-1",
      title: "Executive Summary",
      order: 0,
      status: "completed",
      assignedTo: "user-1",
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      content: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "2",
      documentId: "doc-1",
      title: "Technical Approach",
      order: 1,
      status: "in_progress",
      assignedTo: "user-2",
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      content: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "3",
      documentId: "doc-1",
      title: "Budget Breakdown",
      order: 2,
      status: "not_started",
      content: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ])

  const [documents, setDocuments] = React.useState<ProposalDocument[]>([
    {
      id: "doc-1",
      proposalId: "proposal-1",
      url: "https://example.com/document.pdf",
      docType: "application/pdf",
      fileName: "Company_Profile.pdf",
      fileSize: 2048576,
      uploadedBy: "user-1",
      uploadedAt: new Date().toISOString(),
      isRequired: true,
    },
    {
      id: "doc-2",
      proposalId: "proposal-1",
      url: "https://example.com/certificate.pdf",
      docType: "application/pdf",
      fileName: "ISO_Certificate.pdf",
      fileSize: 1024000,
      uploadedBy: "user-2",
      uploadedAt: new Date().toISOString(),
      isRequired: false,
    },
  ])

  const teamMembers = [
    { id: "user-1", name: "John Doe", email: "john@example.com", assignedSections: 1 },
    { id: "user-2", name: "Jane Smith", email: "jane@example.com", assignedSections: 1 },
    { id: "user-3", name: "Bob Johnson", email: "bob@example.com", assignedSections: 0 },
  ]

  const [assignmentDialogOpen, setAssignmentDialogOpen] = React.useState(false)
  const [selectedSectionForAssignment, setSelectedSectionForAssignment] = React.useState<string | null>(null)

  const projectDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Handlers
  const handleAddSection = async (title: string) => {
    console.log("Adding section:", title)
    const newSection: DocumentSection = {
      id: `section-${Date.now()}`,
      documentId: "doc-1",
      title,
      order: sections.length,
      status: "not_started",
      content: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setSections([...sections, newSection])
  }

  const handleUpdateSection = async (sectionId: string, updates: any) => {
    console.log("Updating section:", sectionId, updates)
    setSections(
      sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
      )
    )
  }

  const handleDeleteSection = async (sectionId: string) => {
    console.log("Deleting section:", sectionId)
    setSections(sections.filter((s) => s.id !== sectionId))
  }

  const handleReorderSections = async (reorders: Array<{ sectionId: string; newOrder: number }>) => {
    console.log("Reordering sections:", reorders)
    const updatedSections = sections.map((section) => {
      const reorder = reorders.find((r) => r.sectionId === section.id)
      return reorder ? { ...section, order: reorder.newOrder } : section
    })
    setSections(updatedSections)
  }

  const handleAssignSection = async (userId: string, deadline?: string) => {
    if (!selectedSectionForAssignment) return
    console.log("Assigning section:", selectedSectionForAssignment, "to:", userId, "deadline:", deadline)
    setSections(
      sections.map((s) =>
        s.id === selectedSectionForAssignment
          ? { ...s, assignedTo: userId, deadline, updatedAt: new Date().toISOString() }
          : s
      )
    )
    setAssignmentDialogOpen(false)
    setSelectedSectionForAssignment(null)
  }

  const handleSetDeadline = async (sectionId: string, deadline: string) => {
    console.log("Setting deadline for section:", sectionId, deadline)
    setSections(
      sections.map((s) =>
        s.id === sectionId ? { ...s, deadline, updatedAt: new Date().toISOString() } : s
      )
    )
  }

  const handleUploadDocument = async (file: File, metadata: any) => {
    console.log("Uploading document:", file.name, metadata)
    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 1500))
    
    const newDoc: ProposalDocument = {
      id: `doc-${Date.now()}`,
      proposalId: "proposal-1",
      url: URL.createObjectURL(file),
      docType: metadata.fileType,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      uploadedBy: "current-user",
      uploadedAt: new Date().toISOString(),
      isRequired: metadata.isRequired || false,
    }
    setDocuments([...documents, newDoc])
  }

  const handleDeleteDocument = async (documentId: string) => {
    console.log("Deleting document:", documentId)
    setDocuments(documents.filter((d) => d.id !== documentId))
  }

  const handleSaveProposal = async (data: any) => {
    console.log("Saving proposal:", data)
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const handleSubmitProposal = async (data: any) => {
    console.log("Submitting proposal:", data)
    // Simulate submit
    await new Promise((resolve) => setTimeout(resolve, 1500))
    alert("Proposal submitted successfully!")
  }

  const openAssignmentDialog = (sectionId: string) => {
    setSelectedSectionForAssignment(sectionId)
    setAssignmentDialogOpen(true)
  }

  const selectedSection = sections.find((s) => s.id === selectedSectionForAssignment)

  // Convert sections to deadline format
  const sectionsWithDeadlines = sections.map((section) => ({
    sectionId: section.id,
    sectionTitle: section.title,
    deadline: section.deadline,
    assignedTo: section.assignedTo,
    assigneeName: teamMembers.find((m) => m.id === section.assignedTo)?.name,
    status: section.status,
  }))

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Proposal Management
        </h1>
        <p className="text-muted-foreground">
          Manage your proposal content, sections, documents, and deadlines
        </p>
      </div>

      <Tabs defaultValue="editor" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="sections" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sections
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="deadlines" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Deadlines
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card className="p-6 border-yellow-400/20">
            <ProposalEditor
              proposalId="proposal-1"
              projectId="project-1"
              initialData={{
                title: "Website Redesign Proposal",
                content: "We propose a comprehensive website redesign...",
                budgetEstimate: 50000,
                timelineEstimate: "3 months",
              }}
              requirements={[]}
              onSave={handleSaveProposal}
              onSubmit={handleSubmitProposal}
            />
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <SectionManager
            documentId="doc-1"
            sections={sections}
            teamMembers={teamMembers}
            onAddSection={handleAddSection}
            onUpdateSection={handleUpdateSection}
            onDeleteSection={handleDeleteSection}
            onReorderSections={handleReorderSections}
            onAssignSection={openAssignmentDialog}
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card className="p-6 border-yellow-400/20">
            <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
              Upload Documents
            </h3>
            <DocumentUploader
              proposalId="proposal-1"
              onUpload={handleUploadDocument}
            />
          </Card>

          <Card className="p-6 border-yellow-400/20">
            <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
              Uploaded Documents
            </h3>
            <DocumentList
              documents={documents}
              onDelete={handleDeleteDocument}
            />
          </Card>
        </TabsContent>

        <TabsContent value="deadlines" className="space-y-4">
          <DeadlineManager
            sections={sectionsWithDeadlines}
            projectDeadline={projectDeadline}
            onSetDeadline={handleSetDeadline}
          />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card className="p-6 border-yellow-400/20">
            <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
              Team Members
            </h3>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20"
                >
                  <div>
                    <p className="font-medium text-black dark:text-white">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {member.assignedSections} section(s) assigned
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Section Assignment Dialog */}
      {selectedSection && (
        <SectionAssignmentDialog
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          sectionId={selectedSection.id}
          sectionTitle={selectedSection.title}
          currentAssignee={selectedSection.assignedTo}
          currentDeadline={selectedSection.deadline}
          teamMembers={teamMembers}
          projectDeadline={projectDeadline}
          onAssign={handleAssignSection}
        />
      )}
    </div>
  )
}
