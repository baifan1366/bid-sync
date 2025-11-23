/**
 * ScoreRevisionDialog Component Example
 * 
 * This example demonstrates how to use the ScoreRevisionDialog component
 * to allow clients to revise scores after initial evaluation.
 */

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScoreRevisionDialog } from "./score-revision-dialog"
import { Edit } from "lucide-react"
import type { ProposalScore, ScoringCriterion } from "@/lib/graphql/types"

export function ScoreRevisionDialogExample() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Example data
  const exampleCriterion: ScoringCriterion = {
    id: "criterion-1",
    templateId: "template-1",
    name: "Technical Approach",
    description: "Evaluate the technical feasibility and innovation of the proposed solution",
    weight: 30,
    orderIndex: 0,
    createdAt: new Date().toISOString(),
  }

  const exampleScore: ProposalScore = {
    id: "score-1",
    proposalId: "proposal-123",
    criterion: exampleCriterion,
    rawScore: 7.5,
    weightedScore: 2.25, // 7.5 * 30 / 100
    notes: "Good technical approach with some innovative ideas. Could improve on scalability considerations.",
    scoredBy: {
      id: "user-1",
      email: "client@example.com",
      fullName: "Jane Client",
      role: "client",
      emailVerified: true,
      verificationStatus: "verified",
      verificationReason: null,
      isSuspended: false,
      suspendedReason: null,
      suspendedAt: null,
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    scoredAt: new Date().toISOString(),
    isFinal: true,
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Score Revision Dialog Example</h1>
        <p className="text-muted-foreground">
          Click the button below to open the score revision dialog and see how it works.
        </p>
      </div>

      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{exampleCriterion.name}</span>
            <Button
              onClick={() => setIsDialogOpen(true)}
              variant="outline"
              size="sm"
              className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
            >
              <Edit className="mr-2 h-4 w-4" />
              Revise Score
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Raw Score</div>
              <div className="text-2xl font-bold text-yellow-400">
                {exampleScore.rawScore.toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Weight</div>
              <div className="text-2xl font-bold">
                {exampleCriterion.weight}%
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Weighted Score</div>
              <div className="text-2xl font-bold">
                {exampleScore.weightedScore.toFixed(2)}
              </div>
            </div>
          </div>

          {exampleScore.notes && (
            <div>
              <div className="text-sm font-medium mb-1">Notes</div>
              <div className="text-sm text-muted-foreground">
                {exampleScore.notes}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ScoreRevisionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        proposalId={exampleScore.proposalId}
        criterion={exampleCriterion}
        currentScore={exampleScore}
        onRevisionComplete={() => {
          console.log("Score revision completed!")
        }}
      />

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-lg">Features Demonstrated</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Display current score with weighted calculation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Interactive slider for adjusting raw score (1-10 scale)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Optional notes field for evaluation comments</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Required reason field for audit trail</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Warning alert for accepted/rejected proposals</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Change summary showing before/after values</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Real-time weighted score calculation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Validation to ensure reason is provided</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>Automatic cache invalidation after successful revision</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader>
          <CardTitle className="text-lg">Usage Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong className="text-green-700 dark:text-green-400">Integration:</strong>
            <p className="text-muted-foreground mt-1">
              This component can be integrated into any scoring interface where clients need to revise
              previously submitted scores. It automatically handles score history logging and ranking
              recalculation.
            </p>
          </div>
          <div>
            <strong className="text-green-700 dark:text-green-400">Validation:</strong>
            <p className="text-muted-foreground mt-1">
              The component enforces that a reason must be provided for all revisions. This ensures
              proper audit trails and accountability for score changes.
            </p>
          </div>
          <div>
            <strong className="text-green-700 dark:text-green-400">Locked Proposals:</strong>
            <p className="text-muted-foreground mt-1">
              When a proposal has been accepted or rejected, the dialog displays a warning to ensure
              clients understand the implications of revising scores after a decision has been made.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
