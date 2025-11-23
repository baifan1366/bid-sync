"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Briefcase, TrendingUp, MapPin, Filter } from "lucide-react"
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
import { LIST_PROJECTS } from "@/lib/graphql/queries"
import { Project } from "@/types/project"

export function PublicMarketplace() {
  const router = useRouter()
  const { user } = useUser()
  const { data, isLoading, error } = useGraphQLQuery<{ projects: Project[] }>(
    ["projects"],
    LIST_PROJECTS
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [recommendedProjects, setRecommendedProjects] = useState<Project[]>([])

  useEffect(() => {
    if (data?.projects) {
      const openProjects = data.projects.filter((p: Project) => 
        p.status?.toLowerCase() === "open" || p.status === "OPEN"
      )
      
      // Set recommended projects (first 3)
      setRecommendedProjects(openProjects.slice(0, 3))
      
      // Apply filters
      let filtered = openProjects
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (p: Project) =>
            p.title.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query)
        )
      }
      
      setFilteredProjects(filtered)
    }
  }, [data, searchQuery, categoryFilter, locationFilter])

  const handleProjectClick = (projectId: string) => {
    if (!user) {
      router.push(`/login?redirect=/projects/${projectId}`)
    } else {
      router.push(`/projects/${projectId}`)
    }
  }

  const handleSearch = () => {
    // Search is already reactive via useEffect
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

                {/* Where - Location */}
                <div className="md:col-span-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Where
                  </label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger className="h-11 border-gray-300 dark:border-zinc-700 dark:bg-zinc-800">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      <SelectItem value="kuala-lumpur">Kuala Lumpur</SelectItem>
                      <SelectItem value="penang">Penang</SelectItem>
                      <SelectItem value="johor">Johor</SelectItem>
                    </SelectContent>
                  </Select>
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

              {/* More Options Link */}
              <div className="mt-3 text-right">
                <button className="text-sm text-yellow-400 hover:text-yellow-500 font-medium inline-flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" />
                  More options
                </button>
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
            {!searchQuery && recommendedProjects.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-yellow-400" />
                  <h2 className="text-xl font-semibold text-black dark:text-white">Recommended</h2>
                  <Badge className="ml-2 bg-yellow-400 text-black hover:bg-yellow-500">Hot</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
                    {searchQuery ? "Search Results" : "All Projects"}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <PublicProjectCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg">
                  <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No projects available</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? "Try adjusting your search criteria" : "Check back later for new projects"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
