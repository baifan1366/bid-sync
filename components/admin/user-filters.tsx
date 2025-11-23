"use client"

import { RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X, Filter } from "lucide-react"

export interface UserFilters {
  role: 'all' | 'client' | 'bidding_lead' | 'bidding_member' | 'content_coordinator' | 'admin'
  verificationStatus: 'all' | 'pending_verification' | 'verified' | 'rejected'
  searchQuery: string
  dateFrom: string | null
  dateTo: string | null
}

interface UserFiltersProps {
  filters: UserFilters
  onFiltersChange: (filters: UserFilters) => void
  searchInputRef?: RefObject<HTMLInputElement | null>
}

export function UserFilters({ filters, onFiltersChange, searchInputRef }: UserFiltersProps) {
  const handleRoleChange = (value: string) => {
    onFiltersChange({
      ...filters,
      role: value as UserFilters['role']
    })
  }

  const handleVerificationStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      verificationStatus: value as UserFilters['verificationStatus']
    })
  }

  const handleSearchChange = (value: string) => {
    onFiltersChange({
      ...filters,
      searchQuery: value
    })
  }

  const handleDateFromChange = (value: string) => {
    onFiltersChange({
      ...filters,
      dateFrom: value || null
    })
  }

  const handleDateToChange = (value: string) => {
    onFiltersChange({
      ...filters,
      dateTo: value || null
    })
  }

  const handleClearFilters = () => {
    onFiltersChange({
      role: 'all',
      verificationStatus: 'all',
      searchQuery: '',
      dateFrom: null,
      dateTo: null
    })
  }

  const hasActiveFilters = 
    filters.role !== 'all' || 
    filters.verificationStatus !== 'all' || 
    filters.searchQuery !== '' ||
    filters.dateFrom !== null ||
    filters.dateTo !== null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="ml-auto text-yellow-400 hover:text-yellow-500 hover:bg-yellow-400/10"
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={searchInputRef}
          placeholder="Search by email, name, or company... (Ctrl+K)"
          value={filters.searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 pr-10"
          aria-label="Search users"
        />
        {filters.searchQuery && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Role and Verification Status Filters */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="role-filter" className="text-sm font-medium mb-2 block">Role</label>
          <Select value={filters.role} onValueChange={handleRoleChange}>
            <SelectTrigger id="role-filter" aria-label="Filter by role">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="bidding_lead">Bidding Lead</SelectItem>
              <SelectItem value="bidding_member">Bidding Member</SelectItem>
              <SelectItem value="content_coordinator">Content Coordinator</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="verification-filter" className="text-sm font-medium mb-2 block">Verification Status</label>
          <Select value={filters.verificationStatus} onValueChange={handleVerificationStatusChange}>
            <SelectTrigger id="verification-filter" aria-label="Filter by verification status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_verification">Pending Verification</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="date-from" className="text-sm font-medium mb-2 block">Registration From</label>
          <Input
            id="date-from"
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) => handleDateFromChange(e.target.value)}
            aria-label="Filter by registration date from"
          />
        </div>

        <div>
          <label htmlFor="date-to" className="text-sm font-medium mb-2 block">Registration To</label>
          <Input
            id="date-to"
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) => handleDateToChange(e.target.value)}
            aria-label="Filter by registration date to"
          />
        </div>
      </div>
    </div>
  )
}
