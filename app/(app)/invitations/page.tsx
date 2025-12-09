/**
 * Invitation Code Entry Page
 * 
 * Allows members to manually enter an invitation code to join a team
 * Route: /invitations
 */

import { InvitationJoinPage } from '@/components/lead/invitation-join-page'

export const metadata = {
  title: "Join Team | BidSync",
  description: "Enter your invitation code to join a bidding team",
}

export default function InvitationsPage() {
  return <InvitationJoinPage />
}
