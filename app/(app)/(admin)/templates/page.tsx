import { requireAdmin } from '@/lib/auth/admin-guards'
import { TemplateManagement } from '@/components/admin/template-management'
import { FileText } from 'lucide-react'

export const metadata = {
  title: "Template Management | Admin Dashboard",
  description: "Manage proposal and checklist templates",
}

export default async function TemplatesPage() {
  await requireAdmin()
  
  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <FileText className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Template Management
          </h1>
        </div>
        <p className="text-muted-foreground">
          Create and manage templates for proposals and checklists
        </p>
      </div>
      
      <TemplateManagement />
    </>
  )
}
