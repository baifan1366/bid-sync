import { requireAdmin } from '@/lib/auth/admin-guards'
import { AdminManagementSection } from '@/components/admin/admin-management-section'
import { UserManagementSection } from '@/components/admin/user-management-section'
import { Shield } from 'lucide-react'

export const metadata = {
  title: "Overview | Admin Dashboard",
  description: "Manage administrators and users",
}

export default async function OverviewPage() {
  const user = await requireAdmin()
  
  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <Shield className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Admin Overview
          </h1>
        </div>
        <p className="text-muted-foreground">
          Welcome, <span className="text-yellow-400 font-medium">{user.email}</span>. 
          Manage administrators and users.
        </p>
      </div>
      
      <div className="space-y-6">
        <AdminManagementSection currentAdminId={user.id} />
        <UserManagementSection currentAdminId={user.id} />
      </div>
    </>
  )
}
