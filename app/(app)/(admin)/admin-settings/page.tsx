import { requireAdmin } from '@/lib/auth/admin-guards'
import { SystemSettings } from '@/components/admin/system-settings'
import { Settings } from 'lucide-react'

export const metadata = {
  title: "System Settings | Admin Dashboard",
  description: "Configure platform-wide settings",
}

export default async function AdminSettingsPage() {
  await requireAdmin()
  
  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <Settings className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            System Settings
          </h1>
        </div>
        <p className="text-muted-foreground">
          Configure email, notifications, and security settings
        </p>
      </div>
      
      <SystemSettings />
    </>
  )
}
