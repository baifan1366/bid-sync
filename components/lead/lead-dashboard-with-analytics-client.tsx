"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnhancedLeadDashboard } from "./enhanced-lead-dashboard"
import { BidPerformanceDashboard } from "./bid-performance-dashboard"
import { ProposalsDashboard } from "./proposals-dashboard"
import { Briefcase, TrendingUp, FileText } from "lucide-react"

interface LeadDashboardWithAnalyticsClientProps {
  leadId: string
}

export function LeadDashboardWithAnalyticsClient({ leadId }: LeadDashboardWithAnalyticsClientProps) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Lead Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage your projects, proposals, and track performance
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList className="bg-white dark:bg-black border border-yellow-400/20">
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Project Discovery
          </TabsTrigger>
          <TabsTrigger value="proposals" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            My Proposals
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-6">
          <EnhancedLeadDashboard />
        </TabsContent>

        <TabsContent value="proposals" className="space-y-6">
          <ProposalsDashboard />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <BidPerformanceDashboard leadId={leadId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
