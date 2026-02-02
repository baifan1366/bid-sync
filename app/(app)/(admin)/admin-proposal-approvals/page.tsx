import { requireAdmin } from '@/lib/auth/admin-guards'
import { ProposalApprovalQueue } from '@/components/admin/proposal-approval-queue'
import { CheckCircle } from 'lucide-react'

export const metadata = {
  title: "Proposal Approvals | Admin Dashboard",
  description: "Review and approve pending proposals",
}

export default async function ProposalApprovalsPage() {
  await requireAdmin()
  
  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <CheckCircle className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Proposal Approvals
          </h1>
        </div>
        <p className="text-muted-foreground">
          Review and approve proposals before they become visible to clients
        </p>
      </div>
      
      <ProposalApprovalQueue />
    </>
  )
}
