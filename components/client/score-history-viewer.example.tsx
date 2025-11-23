/**
 * ScoreHistoryViewer Component Example
 * 
 * This example demonstrates how to use the ScoreHistoryViewer component
 * to display the complete revision history of proposal scores.
 */

"use client"

import { ScoreHistoryViewer } from "./score-history-viewer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ScoreHistoryViewerExample() {
  // Example proposal ID - in a real app, this would come from props or route params
  const proposalId = "example-proposal-id"

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Score History Viewer</h1>
        <p className="text-muted-foreground">
          View all score revisions for a proposal with detailed change tracking
        </p>
      </div>

      {/* Basic Usage */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Basic Usage</CardTitle>
          <CardDescription>
            Display score history for a proposal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScoreHistoryViewer proposalId={proposalId} />
        </CardContent>
      </Card>

      {/* In a Tabbed Interface */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Integrated with Tabs</CardTitle>
          <CardDescription>
            Score history as part of a proposal detail view
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="scores" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="scores">Current Scores</TabsTrigger>
              <TabsTrigger value="history">Score History</TabsTrigger>
              <TabsTrigger value="details">Proposal Details</TabsTrigger>
            </TabsList>
            <TabsContent value="scores" className="py-4">
              <p className="text-muted-foreground">Current scores would be displayed here...</p>
            </TabsContent>
            <TabsContent value="history" className="py-4">
              <ScoreHistoryViewer proposalId={proposalId} />
            </TabsContent>
            <TabsContent value="details" className="py-4">
              <p className="text-muted-foreground">Proposal details would be displayed here...</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Features Overview */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Displays all score revisions chronologically (newest first)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Shows previous and new values with visual diff highlighting</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Displays who made changes and when (user name, timestamp)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Shows revision reasons for audit trail</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Filter dropdown to view history by specific criterion</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Diff view for notes changes (highlight additions/deletions)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>ScrollArea for handling long history lists</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Displays both raw scores and weighted scores for context</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Loading and error states with appropriate feedback</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Empty state when no revisions exist</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Usage in a Client Project Detail Page:
 * 
 * import { ScoreHistoryViewer } from "@/components/client/score-history-viewer"
 * 
 * function ProposalDetailPage({ proposalId }: { proposalId: string }) {
 *   return (
 *     <div>
 *       <h2>Score History</h2>
 *       <ScoreHistoryViewer proposalId={proposalId} />
 *     </div>
 *   )
 * }
 */
