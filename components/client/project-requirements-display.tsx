"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, AlertCircle, Info } from "lucide-react"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"

interface ProjectRequirementsDisplayProps {
  requirements: AdditionalInfoRequirement[]
  className?: string
}

const fieldTypeLabels: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  file: "File Upload",
  textarea: "Long Text",
  select: "Selection",
}

const fieldTypeIcons: Record<string, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  number: <FileText className="h-4 w-4" />,
  date: <FileText className="h-4 w-4" />,
  file: <FileText className="h-4 w-4" />,
  textarea: <FileText className="h-4 w-4" />,
  select: <FileText className="h-4 w-4" />,
}

export function ProjectRequirementsDisplay({ requirements, className }: ProjectRequirementsDisplayProps) {
  if (!requirements || requirements.length === 0) {
    return null
  }

  // Sort requirements by order
  const sortedRequirements = [...requirements].sort((a, b) => a.order - b.order)

  return (
    <Card className="p-6 border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-400/10 rounded-lg">
            <Info className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-black dark:text-white mb-1">
              Additional Information Requirements
            </h3>
            <p className="text-sm text-muted-foreground">
              The client has specified the following additional information that must be provided when submitting a proposal.
            </p>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {sortedRequirements.map((requirement) => (
            <div
              key={requirement.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-black border border-yellow-400/10 hover:border-yellow-400/20 transition-colors"
            >
              <div className="mt-0.5 text-yellow-400">
                {fieldTypeIcons[requirement.fieldType]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-black dark:text-white">
                    {requirement.fieldName}
                  </span>
                  <Badge
                    variant={requirement.required ? "default" : "outline"}
                    className={
                      requirement.required
                        ? "bg-yellow-400 text-black hover:bg-yellow-500"
                        : "border-yellow-400/20 text-muted-foreground"
                    }
                  >
                    {requirement.required ? "Required" : "Optional"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-yellow-400/20 text-muted-foreground"
                  >
                    {fieldTypeLabels[requirement.fieldType] || requirement.fieldType}
                  </Badge>
                </div>
                {requirement.helpText && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {requirement.helpText}
                  </p>
                )}
                {requirement.options && requirement.options.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Options:</p>
                    <div className="flex flex-wrap gap-1">
                      {requirement.options.map((option, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-xs border-yellow-400/10"
                        >
                          {option}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {sortedRequirements.some((r) => r.required) && (
          <div className="flex items-start gap-2 p-3 bg-yellow-400/5 rounded-lg border border-yellow-400/20 mt-4">
            <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              All required fields must be completed during the proposal submission process.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
