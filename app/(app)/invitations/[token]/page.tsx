/**
 * Invitation Acceptance Page Route
 * 
 * Handles both document collaboration and team invitation acceptance
 * Route: /invitations/[token]
 */

import { InvitationJoinPage } from '@/components/lead/invitation-join-page'

interface PageProps {
  params: Promise<{
    token: string
  }>
}

export default async function InvitationPage({ params }: PageProps) {
  const { token } = await params
  return <InvitationJoinPage token={token} />
}
