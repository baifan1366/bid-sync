"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, CheckCircle, XCircle, Clock, Ban, UserCog, Activity, ArrowUpDown } from "lucide-react"
import { SearchHighlight } from "./search-highlight"
import type { User } from "@/lib/graphql/types"

export type UserAction = 
  | { type: 'verify'; approved: boolean; reason?: string }
  | { type: 'changeRole'; newRole: User['role'] }
  | { type: 'suspend'; reason: string }
  | { type: 'reactivate' }
  | { type: 'viewActivity' }

interface UserTableProps {
  users: User[]
  totalCount: number
  page: number
  pageSize: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
  searchQuery?: string
  onPageChange: (page: number) => void
  onUserAction: (userId: string, action: UserAction) => void
  onSort: (column: string) => void
}

export function UserTable({
  users,
  totalCount,
  page,
  pageSize,
  sortBy,
  sortOrder,
  searchQuery = '',
  onPageChange,
  onUserAction,
  onSort
}: UserTableProps) {
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (page - 1) * pageSize + 1
  const endIndex = Math.min(page * pageSize, totalCount)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return "Today"
    if (diffInDays === 1) return "Yesterday"
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
    return formatDate(dateString)
  }

  const getRoleBadgeColor = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-400 text-black hover:bg-yellow-500'
      case 'client':
        return 'bg-blue-500 text-white hover:bg-blue-600'
      case 'bidding_lead':
        return 'bg-green-500 text-white hover:bg-green-600'
      case 'bidding_member':
        return 'bg-purple-500 text-white hover:bg-purple-600'
      case 'content_coordinator':
        return 'bg-orange-500 text-white hover:bg-orange-600'
      default:
        return 'bg-gray-500 text-white hover:bg-gray-600'
    }
  }

  const getVerificationBadge = (status: User['verificationStatus']) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'verified':
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        )
      case 'pending_verification':
        return (
          <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      default:
        return (
          <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        )
    }
  }

  const formatRoleLabel = (role: User['role']) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const SortButton = ({ column, label }: { column: string; label: string }) => (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-1 hover:text-yellow-400 transition-colors"
      aria-label={`Sort by ${label} ${sortBy === column ? (sortOrder === 'asc' ? 'descending' : 'ascending') : ''}`}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortBy === column ? 'text-yellow-400' : ''}`} aria-hidden="true" />
    </button>
  )

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No users found matching your filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border border-yellow-400/20 rounded-lg overflow-hidden">
        <div className="overflow-x-auto" role="region" aria-label="Scrollable user table" tabIndex={0}>
          <table className="w-full min-w-[800px]" role="table" aria-label="User management table">
            <thead className="bg-yellow-400/5 border-b border-yellow-400/20">
              <tr>
                <th className="text-left p-4 font-semibold" scope="col">
                  <SortButton column="email" label="Email" />
                </th>
                <th className="text-left p-4 font-semibold" scope="col">
                  <SortButton column="full_name" label="Name" />
                </th>
                <th className="text-left p-4 font-semibold" scope="col">
                  <SortButton column="role" label="Role" />
                </th>
                <th className="text-left p-4 font-semibold" scope="col">Status</th>
                <th className="text-left p-4 font-semibold" scope="col">
                  <SortButton column="created_at" label="Registered" />
                </th>
                <th className="text-left p-4 font-semibold" scope="col">
                  <SortButton column="last_activity_at" label="Last Activity" />
                </th>
                <th className="text-right p-4 font-semibold" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr 
                  key={user.id}
                  className={`border-b border-yellow-400/10 hover:bg-yellow-400/5 transition-colors ${
                    index === users.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="p-4">
                    <div className="font-medium">
                      <SearchHighlight text={user.email} searchQuery={searchQuery} />
                    </div>
                  </td>
                  <td className="p-4">
                    <div>
                      {user.fullName ? (
                        <SearchHighlight text={user.fullName} searchQuery={searchQuery} />
                      ) : '-'}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {formatRoleLabel(user.role)}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      {getVerificationBadge(user.verificationStatus)}
                      {!user.emailVerified && (
                        <Badge variant="outline" className="w-fit border-yellow-400 text-yellow-400">
                          <Clock className="h-3 w-3 mr-1" />
                          Email Unverified
                        </Badge>
                      )}
                      {user.isSuspended && (
                        <Badge variant="destructive" className="w-fit">
                          <Ban className="h-3 w-3 mr-1" />
                          Suspended
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {formatRelativeTime(user.lastActivityAt)}
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label={`Actions for ${user.email}`}>
                          <MoreVertical className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user.verificationStatus.toLowerCase() === 'pending_verification' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => onUserAction(user.id, { type: 'verify', approved: true })}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve Verification
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUserAction(user.id, { type: 'verify', approved: false })}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject Verification
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => onUserAction(user.id, { type: 'changeRole', newRole: user.role })}
                        >
                          <UserCog className="h-4 w-4 mr-2" />
                          Change Role
                        </DropdownMenuItem>
                        {!user.isSuspended ? (
                          <DropdownMenuItem
                            onClick={() => onUserAction(user.id, { type: 'suspend', reason: '' })}
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Suspend User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => onUserAction(user.id, { type: 'reactivate' })}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reactivate User
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onUserAction(user.id, { type: 'viewActivity' })}
                        >
                          <Activity className="h-4 w-4 mr-2" />
                          View Activity Log
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <nav aria-label="User table pagination" className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex} to {endIndex} of {totalCount} users
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label="Go to previous page"
          >
            Previous
          </Button>
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }

              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className={page === pageNum ? "bg-yellow-400 hover:bg-yellow-500 text-black" : ""}
                  aria-label={`Go to page ${pageNum}`}
                  aria-current={page === pageNum ? "page" : undefined}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          <div className="sm:hidden text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            aria-label="Go to next page"
          >
            Next
          </Button>
        </div>
      </nav>
    </div>
  )
}
