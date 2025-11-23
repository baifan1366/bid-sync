import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requireAdmin } from '@/lib/auth/admin-guards'
import { AdminManagementSection } from '@/components/admin/admin-management-section'
import { UserManagementSection } from '@/components/admin/user-management-section'
import { ProjectReviewSection } from '@/components/admin/project-review-section'
import { AdminNavigation } from '@/components/admin/admin-navigation'
import { Shield, Users, FileText } from 'lucide-react'

export default async function AdminDashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>
}) {
    // Verify admin access - will redirect if not authorized
    const user = await requireAdmin()
    const params = await searchParams
    const validTabs = ['overview', 'analytics', 'proposals', 'verifications', 'templates', 'settings']
    const defaultTab = validTabs.includes(params.tab || '') ? params.tab : 'overview'
    
    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8">
                {/* Header with admin info */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-400 rounded-lg">
                                <Shield className="h-6 w-6 text-black" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
                                Admin Dashboard
                            </h1>
                        </div>
                    </div>
                    <p className="text-muted-foreground">
                        Welcome, <span className="text-yellow-400 font-medium">{user.email}</span>. 
                        Manage administrators, users, and system settings.
                    </p>
                </div>
                
                {/* Tab navigation */}
                <Tabs defaultValue={defaultTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 bg-white dark:bg-black border border-yellow-400/20">
                        <TabsTrigger 
                            value="overview"
                            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                        >
                            <Shield className="h-4 w-4 mr-2" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger 
                            value="analytics"
                            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Analytics
                        </TabsTrigger>
                        <TabsTrigger 
                            value="proposals"
                            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            Proposals
                        </TabsTrigger>
                        <TabsTrigger 
                            value="verifications"
                            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Verifications
                        </TabsTrigger>
                        <TabsTrigger 
                            value="templates"
                            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            Templates
                        </TabsTrigger>
                        <TabsTrigger 
                            value="settings"
                            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Settings
                        </TabsTrigger>
                    </TabsList>
                    
                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        <AdminManagementSection currentAdminId={user.id} />
                        <UserManagementSection currentAdminId={user.id} />
                    </TabsContent>
                    
                    {/* Analytics Tab */}
                    <TabsContent value="analytics" className="space-y-6">
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">Analytics dashboard coming soon</p>
                        </div>
                    </TabsContent>
                    
                    {/* Proposals Tab */}
                    <TabsContent value="proposals" className="space-y-6">
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">Proposals management coming soon</p>
                        </div>
                    </TabsContent>
                    
                    {/* Verifications Tab */}
                    <TabsContent value="verifications" className="space-y-6">
                        <ProjectReviewSection />
                    </TabsContent>
                    
                    {/* Templates Tab */}
                    <TabsContent value="templates" className="space-y-6">
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">Templates management coming soon</p>
                        </div>
                    </TabsContent>
                    
                    {/* Settings Tab */}
                    <TabsContent value="settings" className="space-y-6">
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">System settings coming soon</p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
