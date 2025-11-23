/**
 * Example: Proposal Rankings List with Real-time Updates
 * 
 * This example demonstrates the real-time ranking updates feature.
 * 
 * Features demonstrated:
 * - Real-time subscription to ranking changes
 * - Connection status indicator
 * - Automatic reconnection on disconnect
 * - Filter by scoring status
 * - Responsive grid layout
 * 
 * To test real-time updates:
 * 1. Open this component in two browser windows
 * 2. Score a proposal in one window
 * 3. Watch the rankings update in the other window
 * 4. Observe the connection status indicator
 */

"use client"

import { ProposalRankingsList } from "./proposal-rankings-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"

export function ProposalRankingsListExample() {
  // Example project ID - replace with actual project ID
  const projectId = "example-project-id"

  const handleScoreProposal = (proposalId: string) => {
    console.log("Navigate to scoring interface for proposal:", proposalId)
    // In a real app, navigate to: /projects/${projectId}/proposals/${proposalId}/score
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Real-time Proposal Rankings
        </h1>
        <p className="text-muted-foreground">
          Rankings update automatically when scores change
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="border-yellow-400/50 bg-yellow-400/5">
        <Info className="h-4 w-4 text-yellow-400" />
        <AlertDescription className="text-yellow-700 dark:text-yellow-400">
          <strong>Real-time Updates:</strong> This list automatically updates when proposals are scored.
          The connection status indicator shows your real-time connection state.
        </AlertDescription>
      </Alert>

      {/* Features Card */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>
            Real-time updates implementation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">•</span>
              <span>
                <strong>Real-time Subscriptions:</strong> Automatically receives updates when rankings change
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">•</span>
              <span>
                <strong>Connection Status:</strong> Visual indicator shows connection state (connected/connecting/disconnected)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">•</span>
              <span>
                <strong>Automatic Reconnection:</strong> Reconnects automatically with exponential backoff on disconnect
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">•</span>
              <span>
                <strong>Filter by Status:</strong> Filter proposals by scoring status (all, fully scored, partially scored, not scored)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold">•</span>
              <span>
                <strong>Responsive Layout:</strong> Adapts to different screen sizes with grid layout
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Testing Instructions */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-blue-700 dark:text-blue-400">
            Testing Real-time Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong className="text-blue-700 dark:text-blue-400">Step 1:</strong>
            <p className="text-muted-foreground">
              Open this page in two browser windows side by side
            </p>
          </div>
          <div>
            <strong className="text-blue-700 dark:text-blue-400">Step 2:</strong>
            <p className="text-muted-foreground">
              Click "Score Proposal" on any proposal in one window
            </p>
          </div>
          <div>
            <strong className="text-blue-700 dark:text-blue-400">Step 3:</strong>
            <p className="text-muted-foreground">
              Enter scores and save them
            </p>
          </div>
          <div>
            <strong className="text-blue-700 dark:text-blue-400">Step 4:</strong>
            <p className="text-muted-foreground">
              Watch the rankings update automatically in the other window
            </p>
          </div>
          <div>
            <strong className="text-blue-700 dark:text-blue-400">Step 5:</strong>
            <p className="text-muted-foreground">
              Test reconnection by disabling/enabling your network connection
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Rankings List */}
      <ProposalRankingsList
        projectId={projectId}
        onScoreProposal={handleScoreProposal}
      />

      {/* Technical Details */}
      <Card className="border-gray-500/20">
        <CardHeader>
          <CardTitle className="text-sm">Technical Implementation</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <div>
            <strong>Hook:</strong> useRealtimeRankings (hooks/use-realtime-rankings.ts)
          </div>
          <div>
            <strong>Subscription:</strong> Supabase Realtime on proposal_rankings table
          </div>
          <div>
            <strong>Events:</strong> INSERT, UPDATE, DELETE
          </div>
          <div>
            <strong>Reconnection:</strong> Exponential backoff (1s, 2s, 4s, 8s, 16s)
          </div>
          <div>
            <strong>Max Attempts:</strong> 5 automatic reconnections
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
