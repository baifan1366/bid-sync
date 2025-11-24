import { requireAdmin } from '@/lib/auth/admin-guards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, BarChart3, FileText, ClipboardCheck, FileCheck, Settings, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: "Admin Dashboard | BidSync",
  description: "Manage platform administrators, users, and system settings",
}

const adminPages = [
  {
    title: "Overview",
    description: "Manage administrators and users",
    icon: Shield,
    href: "/overview",
    color: "bg-yellow-400",
  },
  {
    title: "Analytics",
    description: "Monitor platform performance and user activity",
    icon: BarChart3,
    href: "/analytics",
    color: "bg-blue-500",
  },
  {
    title: "Projects",
    description: "Review and approve client projects",
    icon: ClipboardCheck,
    href: "/admin-projects",
    color: "bg-green-500",
  },
  {
    title: "Proposals",
    description: "View all proposals with full history",
    icon: FileText,
    href: "/proposals",
    color: "bg-purple-500",
  },
  {
    title: "Verifications",
    description: "Verify bidding teams and their credentials",
    icon: FileCheck,
    href: "/verifications",
    color: "bg-orange-500",
  },
  {
    title: "Templates",
    description: "Manage project templates and requirements",
    icon: FileText,
    href: "/templates",
    color: "bg-pink-500",
  },
  {
    title: "Settings",
    description: "Configure email, notifications, and security",
    icon: Settings,
    href: "/admin-settings",
    color: "bg-gray-500",
  },
]

export default async function AdminDashboardPage() {
  const user = await requireAdmin()
  
  return (
    <>
      {/* Header */}
      <div className="mb-8 sm:mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-yellow-400 rounded-lg">
            <Shield className="h-8 w-8 text-black" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Welcome, <span className="text-yellow-400 font-medium">{user.email}</span>
            </p>
          </div>
        </div>
      </div>
      
      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminPages.map((page) => {
          const Icon = page.icon
          return (
            <Link key={page.href} href={page.href}>
              <Card className="border-yellow-400/20 hover:border-yellow-400/40 hover:shadow-lg transition-all duration-200 h-full group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-3 ${page.color} rounded-lg mb-3`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-yellow-400 group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="text-xl text-black dark:text-white">
                    {page.title}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {page.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-yellow-400 hover:bg-yellow-400/10 hover:text-yellow-500"
                  >
                    Go to {page.title}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
