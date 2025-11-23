/**
 * Example usage of ScoringComparisonView component
 * 
 * This component provides a side-by-side comparison of 2-4 proposals
 * with their scores across all criteria.
 */

"use client"

import { useState } from "react"
import { ScoringComparisonView } from "./scoring-comparison-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

// Example: Client project detail page with proposal comparison
export function ClientProjectDetailWithComparison() {
  const projectId = "project-123"
  const [selectedProposals, setSelectedProposals] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)

  // Mock proposals for selection
  const proposals = [
    { id: "proposal-1", title: "Proposal A", lead: "Team Alpha" },
    { id: "proposal-2", title: "Proposal B", lead: "Team Beta" },
    { id: "proposal-3", title: "Proposal C", lead: "Team Gamma" },
    { id: "proposal-4", title: "Proposal D", lead: "Team Delta" },
  ]

  const handleProposalToggle = (proposalId: string) => {
    setSelectedProposals((prev) =>
      prev.includes(proposalId)
        ? prev.filter((id) => id !== proposalId)
        : [...prev, proposalId]
    )
  }

  const canCompare = selectedProposals.length >= 2 && selectedProposals.length <= 4

  return (
    <div className="space-y-6">
      {/* Proposal selection */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Select Proposals to Compare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="flex items-center space-x-2 p-3 rounded-lg border border-yellow-400/20 hover:border-yellow-400/40"
              >
                <Checkbox
                  id={proposal.id}
                  checked={selectedProposals.includes(proposal.id)}
                  onCheckedChange={() => handleProposalToggle(proposal.id)}
                />
                <Label
                  htmlFor={proposal.id}
                  className="flex-1 cursor-pointer"
                >
                  <div className="font-medium">{proposal.title}</div>
                  <div className="text-sm text-muted-foreground">
                    by {proposal.lead}
                  </div>
                </Label>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-yellow-400/20">
            <div className="text-sm text-muted-foreground">
              {selectedProposals.length === 0 && "Select 2-4 proposals to compare"}
              {selectedProposals.length === 1 && "Select at least 1 more proposal"}
              {selectedProposals.length >= 2 &&
                selectedProposals.length <= 4 &&
                `${selectedProposals.length} proposals selected`}
              {selectedProposals.length > 4 && "Maximum 4 proposals allowed"}
            </div>
            <Button
              onClick={() => setShowComparison(true)}
              disabled={!canCompare}
              className="bg-yellow-400 text-black hover:bg-yellow-500"
            >
              Compare Proposals
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison view */}
      {showComparison && canCompare && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Comparison View</h2>
            <Button
              variant="outline"
              onClick={() => setShowComparison(false)}
              className="border-yellow-400/40"
            >
              Close Comparison
            </Button>
          </div>
          <ScoringComparisonView
            projectId={projectId}
            proposalIds={selectedProposals}
          />
        </div>
      )}
    </div>
  )
}

// Example: Simple comparison with pre-selected proposals
export function SimpleComparisonExample() {
  const projectId = "project-456"
  const proposalIds = ["proposal-1", "proposal-2", "proposal-3"]

  return (
    <div className="container mx-auto py-8">
      <ScoringComparisonView
        projectId={projectId}
        proposalIds={proposalIds}
      />
    </div>
  )
}

// Example: Comparison from rankings list
export function ComparisonFromRankings() {
  const projectId = "project-789"
  const [compareMode, setCompareMode] = useState(false)
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([])

  // Mock rankings
  const rankings = [
    { id: "1", proposalId: "proposal-1", rank: 1, score: 85.5 },
    { id: "2", proposalId: "proposal-2", rank: 2, score: 82.3 },
    { id: "3", proposalId: "proposal-3", rank: 3, score: 78.9 },
  ]

  const handleToggleCompareMode = () => {
    setCompareMode(!compareMode)
    setSelectedForComparison([])
  }

  const handleSelectForComparison = (proposalId: string) => {
    setSelectedForComparison((prev) =>
      prev.includes(proposalId)
        ? prev.filter((id) => id !== proposalId)
        : prev.length < 4
        ? [...prev, proposalId]
        : prev
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Proposal Rankings</h2>
        <Button
          onClick={handleToggleCompareMode}
          variant={compareMode ? "default" : "outline"}
          className={
            compareMode
              ? "bg-yellow-400 text-black hover:bg-yellow-500"
              : "border-yellow-400/40"
          }
        >
          {compareMode ? "Cancel Comparison" : "Compare Proposals"}
        </Button>
      </div>

      {compareMode && (
        <Card className="border-yellow-400/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Select 2-4 proposals to compare ({selectedForComparison.length}/4)
              </p>
              {selectedForComparison.length >= 2 && (
                <Button
                  size="sm"
                  className="bg-yellow-400 text-black hover:bg-yellow-500"
                >
                  View Comparison
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rankings list with selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rankings.map((ranking) => (
          <Card
            key={ranking.id}
            className={`border-yellow-400/20 cursor-pointer ${
              selectedForComparison.includes(ranking.proposalId)
                ? "border-yellow-400 bg-yellow-400/5"
                : ""
            }`}
            onClick={() =>
              compareMode && handleSelectForComparison(ranking.proposalId)
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-yellow-400">
                  #{ranking.rank}
                </div>
                <div className="text-xl font-semibold">{ranking.score}</div>
              </div>
              {compareMode && (
                <Checkbox
                  checked={selectedForComparison.includes(ranking.proposalId)}
                  className="mt-2"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Show comparison when ready */}
      {selectedForComparison.length >= 2 && (
        <ScoringComparisonView
          projectId={projectId}
          proposalIds={selectedForComparison}
        />
      )}
    </div>
  )
}
