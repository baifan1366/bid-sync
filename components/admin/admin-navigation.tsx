"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Shield, 
  Users, 
  FileText, 
  BarChart3, 
  Settings,
  CheckCircle,
  FileStack
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigationItems = [
  {
    title: 'Overview',
    href: '/admin-dashboard',
    icon: Shield,
    description: 'Admin & user management',
  },
  {
    title: 'Analytics',
    href: '/admin-dashboard/analytics',
    icon: BarChart3,
    description: 'Platform metrics & insights',
  },
  {
    title: 'Proposals',
    href: '/admin-dashboard/proposals',
    icon: FileText,
    description: 'View all proposals',
  },
  {
    title: 'Verifications',
    href: '/admin-dashboard/verifications',
    icon: CheckCircle,
    description: 'Client verification queue',
  },
  {
    title: 'Templates',
    href: '/admin-dashboard/templates',
    icon: FileStack,
    description: 'Manage templates',
  },
  {
    title: 'Settings',
    href: '/admin-dashboard/settings',
    icon: Settings,
    description: 'System configuration',
  },
]

export function AdminNavigation() {
  const pathname = usePathname()

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {navigationItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        
        return (
          <Link key={item.href} href={item.href}>
            <Card 
              className={cn(
                "border-yellow-400/20 hover:border-yellow-400/40 transition-all hover:scale-[1.02]",
                isActive && "border-yellow-400 bg-yellow-400/5"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-3 rounded-lg",
                    isActive ? "bg-yellow-400" : "bg-yellow-400/10"
                  )}>
                    <Icon className={cn(
                      "h-6 w-6",
                      isActive ? "text-black" : "text-yellow-400"
                    )} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-black dark:text-white mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
