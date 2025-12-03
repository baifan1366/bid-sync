import { requireAdmin } from '@/lib/auth/admin-guards'
import { LegalHoldManagement } from '@/components/admin/legal-hold-management'
import { Shield } from 'lucide-react'

export const metadata = {
  title: "Legal Hold Management | Admin Dashboard",
  description: "Manage legal holds on archived projects",
}

export default async function LegalHoldsPage() {
  await requireAdmin()
  
  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <Shield className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Legal Hold Management
          </h1>
        </div>
        <p className="text-muted-foreground">
          Manage legal holds on archived projects to prevent deletion during retention policy enforcement
        </p>
      </div>
      
      <LegalHoldManagement />
    </>
  )
}
