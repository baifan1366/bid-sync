/**
 * Invitation Acceptance Page Route
 * 
 * Handles both document collaboration and team invitation acceptance
 * Route: /invitations/[token]
 */

import { InvitationJoinPage } from '@/components/lead/invitation-join-page'

interface PageProps {
  params: {
    token: string
  }
}

export default function InvitationPage({ params }: PageProps) {
  return <InvitationJoinPage token={params.token} />
}
