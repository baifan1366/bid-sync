"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Briefcase, TrendingUp, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/layout/header"
import { PublicProjectCard } from "@/components/marketplace/public-project-card"
import { PublicProjectCardSkeleton } from "@/components/marketplace/public-project-card-skeleton"
import { useGraphQLQuery } from "@/hooks/use-graphql"
import { useUser } from "@/hooks/use-user"
import { LIST_OPEN_PROJECTS } from "@/lib/graphql/queries"
import { Project } from "@/types/project"

export function PublicMarketplace() {
  const router = useRouter()
  const { user } = useUser()
  const { data, isLoading, error } = useGraphQLQuery<{ openProjects: Project[] }>(
    ["openProjects"],
    LIST_OPEN_PROJECTS
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [budgetFilter, setBudgetFilter] = useState("all")
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("")
  const [appliedBudgetFilter, setAppliedBudgetFilter] = useState("all")
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [recommendedProjects, setRecommendedProjects] = useState<Project[]>([])
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (data?.openProjects) {
      const now = new Date()
      
      // Filter out overdue projects
      const availableProjects = data.openProjects.filter((p: Project) => {
        // Check if project is overdue
        if (p.deadline) {
          const deadlineDate = new Date(p.deadline)
          const isOverdue = deadlineDate < now
          return !isOverdue
        }
        
        return true
      })
      
      // Set recommended projects (first 3)
      setRecommendedProjects(availableProjects.slice(0, 3))
      
      // Apply filters using applied values (only updated on button click)
      let filtered = availableProjects
      
      if (appliedSearchQuery.trim()) {
        const query = appliedSearchQuery.toLowerCase()
        filtered = filtered.filter(
          (p: Project) =>
            p.title.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query)
        )
      }
      
      // Budget filter
      if (appliedBudgetFilter !== "all") {
        filtered = filtered.filter((p: Project) => {
          if (!p.budget) return appliedBudgetFilter === "not-specified"
          
          const budget = p.budget
          switch (appliedBudgetFilter) {
            case "under-1k":
              return budget < 1000
            case "1k-5k":
              return budget >= 1000 && budget < 5000
            case "5k-10k":
              return budget >= 5000 && budget < 10000
            case "10k-20k":
              return budget >= 10000 && budget < 20000
            case "20k-plus":
              return budget >= 20000
            default:
              return true
          }
        })
      }
      
      setFilteredProjects(filtered)
    }
  }, [data, appliedSearchQuery, appliedBudgetFilter])

  const handleProjectClick = (projectId: string) => {
    if (!user) {
      router.push(`/login?redirect=/client-projects/${projectId}`)
    } else {
      // For now, all users view projects through client-projects route
      router.push(`/client-projects/${projectId}`)
    }
  }

  const handleSearch = () => {
    // Apply the current filter values
    setAppliedSearchQuery(searchQuery)
    setAppliedBudgetFilter(budgetFilter)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <Header />

      {/* Hero Section with Search */}
      <div className="bg-white dark:bg-black border-b border-yellow-400/20">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 text-center sm:text-left text-black dark:text-white">
              Find Your Next <span className="bg-yellow-400 text-black px-2">Project Opportunity</span>
            </h1>
            
            {/* Search Section */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-4 sm:p-6 border border-yellow-400/20">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* What - Search Input */}
                <div className="md:col-span-5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    What
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Enter keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11 border-gray-300 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                </div>

                {/* Budget Filter */}
                <div className="md:col-span-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Budget
                  </label>
                  {isMounted ? (
                    <Select value={budgetFilter} onValueChange={setBudgetFilter}>
                      <SelectTrigger className="h-11 border-gray-300 dark:border-zinc-700 dark:bg-zinc-800">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        <SelectValue placeholder="All budgets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All budgets</SelectItem>
                        <SelectItem value="under-1k">Under RM 1,000</SelectItem>
                        <SelectItem value="1k-5k">RM 1,000 - RM 5,000</SelectItem>
                        <SelectItem value="5k-10k">RM 5,000 - RM 10,000</SelectItem>
                        <SelectItem value="10k-20k">RM 10,000 - RM 20,000</SelectItem>
                        <SelectItem value="20k-plus">RM 20,000+</SelectItem>
                        <SelectItem value="not-specified">Not specified</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-11 flex items-center justify-between rounded-md border border-gray-300 dark:border-zinc-700 bg-background dark:bg-zinc-800 px-3 py-2 text-sm">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="text-muted-foreground">All budgets</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Search Button */}
                <div className="md:col-span-3 flex items-end">
                  <Button 
                    onClick={handleSearch} 
                    className="w-full h-11 bg-yellow-400 hover:bg-yellow-500 text-black font-medium"
                  >
                    SEEK
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Actions for Non-logged Users */}
            {!user && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  size="lg" 
                  onClick={() => router.push("/login")}
                  className="bg-yellow-400 text-black hover:bg-yellow-500 font-medium"
                >
                  Sign in
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={() => router.push("/register")}
                  className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
                >
                  Employer site
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content - Projects */}
          <div className="lg:col-span-3">
            {/* Recommended Section */}
            {!appliedSearchQuery && recommendedProjects.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-yellow-400" />
                  <h2 className="text-xl font-semibold text-black dark:text-white">Recommended</h2>
                  <Badge className="ml-2 bg-yellow-400 text-black hover:bg-yellow-500">Hot</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {recommendedProjects.map((project) => (
                    <PublicProjectCard
                      key={project.id}
                      project={project}
                      onClick={() => handleProjectClick(project.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Projects Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-black dark:text-white">
                    {appliedSearchQuery ? "Search Results" : "All Projects"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isLoading ? "Loading..." : `${filteredProjects.length} projects found`}
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-6">
                  Error loading projects. Please try again later.
                </div>
              )}

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <PublicProjectCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg">
                  <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No projects available</h3>
                  <p className="text-muted-foreground">
                    {appliedSearchQuery ? "Try adjusting your search criteria" : "Check back later for new projects"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {filteredProjects.map((project) => (
                    <PublicProjectCard
                      key={project.id}
                      project={project}
                      onClick={() => handleProjectClick(project.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-6">
              {/* Saved Searches */}
              <div className="bg-card border border-yellow-400/20 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Search className="h-4 w-4 text-yellow-400" />
                  Saved searches
                </h3>
                <p className="text-sm text-muted-foreground">
                  Use the Save search button below the search results to save your search and receive every new project.
                </p>
              </div>

              {/* Saved Projects */}
              <div className="bg-card border border-yellow-400/20 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-yellow-400" />
                  Saved projects
                </h3>
                <p className="text-sm text-muted-foreground">
                  Use the Save button on each project listing to save it for later. You can then access them on all your devices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
