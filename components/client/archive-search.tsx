'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Search,
  Archive,
  Calendar,
  Package,
  Loader2,
  AlertCircle,
  Shield,
  Clock,
  User,
  ChevronRight,
} from 'lucide-react'
import { formatDate, formatBudget, cn } from '@/lib/utils'
import { createGraphQLClient } from '@/lib/graphql/client'
import { SEARCH_ARCHIVES } from '@/lib/graphql/queries'

interface ArchivedProject {
  id: string
  title: string
  description: string
  budget?: number
  deadline?: string
  clientId: string
  status: string
}

interface ProjectArchive {
  id: string
  projectId: string
  archiveIdentifier: string
  compressedSize: number
  originalSize: number
  compressionRatio: number
  archivedBy: {
    id: string
    email: string
    fullName: string
  }
  archivedAt: string
  retentionUntil?: string
  legalHold: boolean
  legalHoldReason?: string
  accessCount: number
  lastAccessedAt?: string
  project: ArchivedProject
}

interface ArchiveSearchProps {
  onSelectArchive?: (archive: ProjectArchive) => void
}

export function ArchiveSearch({ onSelectArchive }: ArchiveSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [results, setResults] = useState<ProjectArchive[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Debounced search function
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([])
        setHasSearched(false)
        return
      }

      setIsSearching(true)
      setError(null)
      setHasSearched(true)

      try {
        const client = createGraphQLClient()
        const data = await client.request<{ searchArchives: ProjectArchive[] }>(
          SEARCH_ARCHIVES,
          {
            query: query.trim(),
            limit: 50,
            offset: 0,
          }
        )

        if (data?.searchArchives) {
          // Filter by date range if specified
          let filteredResults = data.searchArchives

          if (dateFrom || dateTo) {
            filteredResults = filteredResults.filter((archive) => {
              const archivedDate = new Date(archive.archivedAt)
              const fromDate = dateFrom ? new Date(dateFrom) : null
              const toDate = dateTo ? new Date(dateTo) : null

              if (fromDate && archivedDate < fromDate) return false
              if (toDate && archivedDate > toDate) return false

              return true
            })
          }

          setResults(filteredResults)
        } else {
          setResults([])
        }
      } catch (err) {
        console.error('Search error:', err)
        setError('Failed to search archives. Please try again.')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [dateFrom, dateTo]
  )

  // Handle search button click
  const handleSearch = () => {
    performSearch(searchQuery)
  }

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Clear filters
  const handleClearFilters = () => {
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
    setResults([])
    setHasSearched(false)
    setError(null)
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Search Controls */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle className="text-black dark:text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-yellow-400" />
            Search Archives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="search-query" className="text-black dark:text-white">
              Search Query
            </Label>
            <div className="flex gap-2">
              <Input
                id="search-query"
                placeholder="Search by project title, description, or archive ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 border-yellow-400/20 focus:border-yellow-400"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from" className="text-black dark:text-white">
                Archived From
              </Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border-yellow-400/20 focus:border-yellow-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-to" className="text-black dark:text-white">
                Archived To
              </Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border-yellow-400/20 focus:border-yellow-400"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {(searchQuery || dateFrom || dateTo) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="border-yellow-400/40 hover:bg-yellow-400/10 hover:border-yellow-400"
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-red-400/40 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-600 dark:text-red-400 mb-1">
                  Search Error
                </h4>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {hasSearched && (
        <Card className="border-yellow-400/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-black dark:text-white">
                Search Results
              </CardTitle>
              <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-center py-8">
                <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No archives found matching your search criteria
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search query or date range
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((archive) => (
                  <Card
                    key={archive.id}
                    className={cn(
                      'border-yellow-400/20 transition-all duration-200',
                      onSelectArchive &&
                        'cursor-pointer hover:shadow-lg hover:scale-[1.01] hover:border-yellow-400/40'
                    )}
                    onClick={() => onSelectArchive?.(archive)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Title and Badges */}
                          <div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold text-black dark:text-white">
                                {archive.project.title}
                              </h4>
                              {archive.legalHold && (
                                <Badge
                                  variant="outline"
                                  className="border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
                                >
                                  <Shield className="h-3 w-3 mr-1" />
                                  Legal Hold
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                              {archive.project.description}
                            </p>
                          </div>

                          {/* Archive Info */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {archive.archiveIdentifier}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(archive.archivedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {archive.archivedBy.fullName}
                            </span>
                          </div>

                          {/* Project Details */}
                          <div className="flex items-center gap-4 text-xs flex-wrap">
                            {archive.project.budget && (
                              <span className="text-yellow-400 font-semibold">
                                {formatBudget(archive.project.budget)}
                              </span>
                            )}
                            {archive.project.deadline && (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(archive.project.deadline)}
                              </span>
                            )}
                            <Badge className="bg-yellow-400 text-black hover:bg-yellow-500 text-xs">
                              {archive.project.status}
                            </Badge>
                          </div>

                          {/* Storage Info */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              Size: {formatFileSize(archive.compressedSize)}
                            </span>
                            <span>
                              Compression: {(archive.compressionRatio * 100).toFixed(1)}%
                            </span>
                            <span>Accessed: {archive.accessCount} times</span>
                          </div>
                        </div>

                        {onSelectArchive && (
                          <ChevronRight className="h-5 w-5 text-yellow-400 shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
