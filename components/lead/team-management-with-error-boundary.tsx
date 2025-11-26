"use client"

import { ErrorBoundary } from "./error-boundary"
import { TeamMembersList } from "./team-members-list"
import { TeamInvitationDialog } from "./team-invitation-dialog"
import { TeamStatisticsCard } from "./team-statistics-card"

/**
 * Team Management components wrapped with error boundaries
 * for better error handling and user experience
 */

export function TeamMembersListWithErrorBoundary({ projectId }: { projectId: string }) {
  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <TeamMembersList projectId={projectId} />
    </ErrorBoundary>
  )
}

export function TeamInvitationDialogWithErrorBoundary({
  projectId,
  trigger,
}: {
  projectId: string
  trigger?: React.ReactNode
}) {
  return (
    <ErrorBoundary>
      <TeamInvitationDialog projectId={projectId} trigger={trigger} />
    </ErrorBoundary>
  )
}

export function TeamStatisticsCardWithErrorBoundary({ projectId }: { projectId: string }) {
  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <TeamStatisticsCard projectId={projectId} />
    </ErrorBoundary>
  )
}
