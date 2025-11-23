import { Project } from "@/types/project"
import { StatCard } from "./stat-card"
import { StatCardSkeleton } from "./stat-card-skeleton"
import { 
  calculateProjectCountsByStatus, 
  calculateTotalBudget, 
  formatBudget 
} from "@/lib/utils"
import { 
  FolderKanban, 
  FolderOpen, 
  FolderCheck, 
  DollarSign 
} from "lucide-react"

interface ProjectStatisticsProps {
  projects: Project[]
  isLoading: boolean
}

export function ProjectStatistics({ projects, isLoading }: ProjectStatisticsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    )
  }

  const stats = calculateProjectCountsByStatus(projects)
  const totalBudget = calculateTotalBudget(projects)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={FolderKanban}
        label="Total Projects"
        value={stats.total}
        iconColor="text-blue-600 dark:text-blue-400"
      />
      <StatCard
        icon={FolderOpen}
        label="Open Projects"
        value={stats.open}
        iconColor="text-green-600 dark:text-green-400"
      />
      <StatCard
        icon={FolderCheck}
        label="Closed Projects"
        value={stats.closed}
        iconColor="text-gray-600 dark:text-gray-400"
      />
      <StatCard
        icon={DollarSign}
        label="Total Budget"
        value={formatBudget(totalBudget)}
        iconColor="text-emerald-600 dark:text-emerald-400"
      />
    </div>
  )
}
