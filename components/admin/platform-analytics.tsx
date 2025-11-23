"use client"

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, FileText, Briefcase, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface PlatformStats {
  totalUsers: number
  totalProjects: number
  totalProposals: number
  activeUsers: number
  pendingVerifications: number
  approvedProjects: number
  usersByRole: {
    admin: number
    client: number
    bidding_lead: number
    bidding_member: number
  }
  recentActivity: {
    newUsersToday: number
    newProjectsToday: number
    newProposalsToday: number
  }
  trends: {
    usersGrowth: number
    projectsGrowth: number
    proposalsGrowth: number
  }
}

async function fetchPlatformStats(): Promise<PlatformStats> {
  const response = await fetch('/api/admin/analytics')
  if (!response.ok) throw new Error('Failed to fetch analytics')
  return response.json()
}

export function PlatformAnalytics() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['platform-analytics'],
    queryFn: fetchPlatformStats,
    refetchInterval: 60000, // Refetch every minute
  })

  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  if (error || !stats) {
    return (
      <Card className="border-red-500/20">
        <CardContent className="pt-6">
          <p className="text-red-500">Failed to load analytics data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          trend={stats.trends.usersGrowth}
          subtitle={`+${stats.recentActivity.newUsersToday} today`}
        />
        <MetricCard
          title="Total Projects"
          value={stats.totalProjects}
          icon={Briefcase}
          trend={stats.trends.projectsGrowth}
          subtitle={`+${stats.recentActivity.newProjectsToday} today`}
        />
        <MetricCard
          title="Total Proposals"
          value={stats.totalProposals}
          icon={FileText}
          trend={stats.trends.proposalsGrowth}
          subtitle={`+${stats.recentActivity.newProposalsToday} today`}
        />
        <MetricCard
          title="Active Users"
          value={stats.activeUsers}
          icon={TrendingUp}
          subtitle="Last 7 days"
        />
      </div>

      {/* Detailed Stats */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-white dark:bg-black border border-yellow-400/20">
          <TabsTrigger 
            value="users"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            Users
          </TabsTrigger>
          <TabsTrigger 
            value="projects"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            Projects
          </TabsTrigger>
          <TabsTrigger 
            value="activity"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle>User Distribution by Role</CardTitle>
              <CardDescription>Breakdown of users across different roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <RoleDistribution
                  role="Admins"
                  count={stats.usersByRole.admin}
                  total={stats.totalUsers}
                  color="bg-yellow-400"
                />
                <RoleDistribution
                  role="Clients"
                  count={stats.usersByRole.client}
                  total={stats.totalUsers}
                  color="bg-blue-500"
                />
                <RoleDistribution
                  role="Bidding Leads"
                  count={stats.usersByRole.bidding_lead}
                  total={stats.totalUsers}
                  color="bg-green-500"
                />
                <RoleDistribution
                  role="Bidding Members"
                  count={stats.usersByRole.bidding_member}
                  total={stats.totalUsers}
                  color="bg-purple-500"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
              <CardDescription>Client verification overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm">Pending Verifications</span>
                </div>
                <span className="text-2xl font-bold text-yellow-400">
                  {stats.pendingVerifications}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle>Project Status</CardTitle>
              <CardDescription>Overview of project states</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Approved Projects</span>
                </div>
                <span className="text-2xl font-bold text-green-500">
                  {stats.approvedProjects}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Activity in the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActivityItem
                label="New Users"
                value={stats.recentActivity.newUsersToday}
                icon={Users}
              />
              <ActivityItem
                label="New Projects"
                value={stats.recentActivity.newProjectsToday}
                icon={Briefcase}
              />
              <ActivityItem
                label="New Proposals"
                value={stats.recentActivity.newProposalsToday}
                icon={FileText}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
}: {
  title: string
  value: number
  icon: any
  trend?: number
  subtitle?: string
}) {
  return (
    <Card className="border-yellow-400/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-yellow-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-black dark:text-white">{value.toLocaleString()}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend !== undefined && (
          <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RoleDistribution({
  role,
  count,
  total,
  color,
}: {
  role: string
  count: number
  total: number
  color: string
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{role}</span>
        <span className="font-medium text-black dark:text-white">
          {count} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function ActivityItem({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: any
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-yellow-400" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-semibold text-black dark:text-white">{value}</span>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-yellow-400/20">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
