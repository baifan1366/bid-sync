import { requireAdmin } from '@/lib/auth/admin-guards'
import { ProposalOversight } from '@/components/admin/proposal-oversight'
import { FileText } from 'lucide-react'

export const metadata = {
  title: "Proposal Oversight | Admin Dashboard",
  description: "View and manage all proposals on the platform",
}

export default async function ProposalsPage() {
  await requireAdmin()
  
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-400 rounded-lg">
              <FileText className="h-6 w-6 text-black" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
              Proposal Oversight
            </h1>
          </div>
          <p className="text-muted-foreground">
            View all proposals, including internal comments and full history
          </p>
        </div>
        
        <ProposalOversight />
      </div>
    </div>
  )
}
