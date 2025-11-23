/**
 * Invitation Acceptance Page Route
 * 
 * Handles document collaboration invitation acceptance
 * Route: /invitations/[token]
 */

import { InvitationAcceptancePage } from '@/components/editor/invitation-acceptance-page'

interface PageProps {
  params: {
    token: string
  }
}

export default function InvitationPage({ params }: PageProps) {
  return <InvitationAcceptancePage token={params.token} />
}
