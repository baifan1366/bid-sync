/**
 * ScoringExportDialog Component Example
 * 
 * This example demonstrates how to use the ScoringExportDialog component
 * to export scoring data and rankings as a PDF report.
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScoringExportDialog } from "./scoring-export-dialog"
import { Download } from "lucide-react"

export function ScoringExportDialogExample() {
  const [isOpen, setIsOpen] = useState(false)
  
  // Example project ID - replace with actual project ID
  const projectId = "example-project-id"

  return (
    <div className="p-8 space-y-4">
      <div className="max-w-2xl space-y-4">
        <h2 className="text-2xl font-bold">Scoring Export Dialog Example</h2>
        <p className="text-muted-foreground">
          Click the button below to open the export dialog and generate a PDF report
          of all proposal scores and rankings.
        </p>

        <Button
          onClick={() => setIsOpen(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Scoring Report
        </Button>

        <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
          <h3 className="font-semibold mb-2">Features:</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Preview of export contents before generation</li>
            <li>• Shows project name, proposal counts, and scoring status</li>
            <li>• Generates comprehensive PDF with all scoring data</li>
            <li>• Displays download link with 24-hour expiration notice</li>
            <li>• Success/error toast notifications</li>
            <li>• Loading states during export generation</li>
          </ul>
        </div>
      </div>

      <ScoringExportDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        projectId={projectId}
      />
    </div>
  )
}

/**
 * Usage in a project detail page:
 * 
 * ```tsx
 * import { ScoringExportDialog } from "@/components/client/scoring-export-dialog"
 * 
 * function ProjectDetailPage({ projectId }: { projectId: string }) {
 *   const [showExportDialog, setShowExportDialog] = useState(false)
 * 
 *   return (
 *     <div>
 *       <Button onClick={() => setShowExportDialog(true)}>
 *         Export Scoring
 *       </Button>
 * 
 *       <ScoringExportDialog
 *         open={showExportDialog}
 *         onOpenChange={setShowExportDialog}
 *         projectId={projectId}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
