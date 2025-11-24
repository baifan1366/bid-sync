import { requireAdmin } from '@/lib/auth/admin-guards'
import { ProjectApprovalQueue } from '@/components/admin/project-approval-queue'
import { ClipboardCheck } from 'lucide-react'

export const metadata = {
  title: "Project Approval | Admin Dashboard",
  description: "Review and approve client projects",
}

export default async function AdminProjectsPage() {
  await requireAdmin()
  
  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <ClipboardCheck className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Project Approval Queue
          </h1>
        </div>
        <p className="text-muted-foreground">
          Review and approve projects before they go live
        </p>
      </div>
      
      <ProjectApprovalQueue />
    </>
  )
}
