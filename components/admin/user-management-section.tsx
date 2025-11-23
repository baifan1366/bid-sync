"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserFilters, type UserFilters as UserFiltersType } from "./user-filters"
import { UserTable, type UserAction } from "./user-table"
import { VerificationDialog } from "./verification-dialog"
import { RoleChangeDialog } from "./role-change-dialog"
import { SuspendUserDialog } from "./suspend-user-dialog"
import { UserActivityLog } from "./user-activity-log"
import { createGraphQLClient } from "@/lib/graphql/client"
import { Users, CheckCircle, Clock, XCircle, Ban } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type { User, UserListResult } from "@/lib/graphql/types"

interface UserManagementSectionProps {
  currentAdminId: string
}

const ALL_USERS_QUERY = `
  query AllUsers(
    $page: Int
    $pageSize: Int
    $role: UserRole
    $verificationStatus: VerificationStatus
    $searchQuery: String
    $dateFrom: String
    $dateTo: String
    $sortBy: String
    $sortOrder: String
  ) {
    allUsers(
      page: $page
      pageSize: $pageSize
      role: $role
      verificationStatus: $verificationStatus
      searchQuery: $searchQuery
      dateFrom: $dateFrom
      dateTo: $dateTo
      sortBy: $sortBy
      sortOrder: $sortOrder
    ) {
      users {
        id
        email
        emailVerified
        role
        verificationStatus
        verificationReason
        fullName
        isSuspended
        suspendedReason
        suspendedAt
        lastActivityAt
        createdAt
        updatedAt
      }
      totalCount
      page
      pageSize
    }
  }
`

const VERIFY_CLIENT_MUTATION = `
  mutation VerifyClient($userId: ID!, $approved: Boolean!, $reason: String) {
    verifyClient(userId: $userId, approved: $approved, reason: $reason) {
      id
      verificationStatus
      verificationReason
    }
  }
`

const CHANGE_USER_ROLE_MUTATION = `
  mutation ChangeUserRole($userId: ID!, $newRole: UserRole!) {
    changeUserRole(userId: $userId, newRole: $newRole) {
      id
      role
    }
  }
`

const SUSPEND_USER_MUTATION = `
  mutation SuspendUser($userId: ID!, $reason: String!) {
    suspendUser(userId: $userId, reason: $reason) {
      id
      isSuspended
      suspendedReason
      suspendedAt
    }
  }
`

const REACTIVATE_USER_MUTATION = `
  mutation ReactivateUser($userId: ID!) {
    reactivateUser(userId: $userId) {
      id
      isSuspended
    }
  }
`

const USER_STATISTICS_QUERY = `
  query UserStatistics {
    userStatistics {
      totalUsers
      totalClients
      totalLeads
      totalMembers
      totalAdmins
      pendingVerifications
      verifiedUsers
      suspendedUsers
    }
  }
`

export function UserManagementSection({ currentAdminId }: UserManagementSectionProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // State for filters and pagination
  const [filters, setFilters] = useState<UserFiltersType>({
    role: 'all',
    verificationStatus: 'all',
    searchQuery: '',
    dateFrom: null,
    dateTo: null
  })
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // State for dialogs
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false)
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [activityLogUserId, setActivityLogUserId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Fetch users with caching strategy
  const { data, isLoading, error } = useQuery({
    queryKey: ['allUsers', page, pageSize, filters, sortBy, sortOrder],
    queryFn: async () => {
      const client = createGraphQLClient()
      const result = await client.request<{ allUsers: UserListResult }>(
        ALL_USERS_QUERY,
        {
          page,
          pageSize,
          role: filters.role !== 'all' ? filters.role.toUpperCase() : undefined,
          verificationStatus: filters.verificationStatus !== 'all' 
            ? filters.verificationStatus.toUpperCase() 
            : undefined,
          searchQuery: filters.searchQuery || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          sortBy,
          sortOrder
        }
      )
      return result.allUsers
    },
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch on window focus for user data
  })

  // Fetch user statistics separately with longer cache time
  const { data: statsData } = useQuery({
    queryKey: ['userStatistics'],
    queryFn: async () => {
      const client = createGraphQLClient()
      const result = await client.request<{ userStatistics: {
        totalUsers: number
        totalClients: number
        totalLeads: number
        totalMembers: number
        totalAdmins: number
        pendingVerifications: number
        verifiedUsers: number
        suspendedUsers: number
      } }>(USER_STATISTICS_QUERY)
      return result.userStatistics
    },
    staleTime: 5 * 60 * 1000, // Statistics can be stale for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch statistics on window focus
  })

  // Mutations with cache invalidation
  const verifyClientMutation = useMutation({
    mutationFn: async ({ userId, approved, reason }: { userId: string; approved: boolean; reason?: string }) => {
      const client = createGraphQLClient()
      return await client.request(VERIFY_CLIENT_MUTATION, { userId, approved, reason })
    },
    onSuccess: () => {
      // Invalidate both user list and statistics
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
      queryClient.invalidateQueries({ queryKey: ['userStatistics'] })
      toast({
        title: "Verification updated",
        description: "User verification status has been updated successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: User['role'] }) => {
      const client = createGraphQLClient()
      return await client.request(CHANGE_USER_ROLE_MUTATION, { 
        userId, 
        newRole: newRole.toUpperCase() 
      })
    },
    onSuccess: () => {
      // Invalidate both user list and statistics
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
      queryClient.invalidateQueries({ queryKey: ['userStatistics'] })
      toast({
        title: "Role changed",
        description: "User role has been updated successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const suspendUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const client = createGraphQLClient()
      return await client.request(SUSPEND_USER_MUTATION, { userId, reason })
    },
    onSuccess: () => {
      // Invalidate both user list and statistics
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
      queryClient.invalidateQueries({ queryKey: ['userStatistics'] })
      toast({
        title: "User suspended",
        description: "User account has been suspended successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const reactivateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const client = createGraphQLClient()
      return await client.request(REACTIVATE_USER_MUTATION, { userId })
    },
    onSuccess: () => {
      // Invalidate both user list and statistics
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
      queryClient.invalidateQueries({ queryKey: ['userStatistics'] })
      toast({
        title: "User reactivated",
        description: "User account has been reactivated successfully.",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  // Handlers
  const handleUserAction = (userId: string, action: UserAction) => {
    const user = data?.users.find(u => u.id === userId)
    if (!user) return

    setSelectedUser(user)

    switch (action.type) {
      case 'verify':
        setVerificationDialogOpen(true)
        break
      case 'changeRole':
        setRoleChangeDialogOpen(true)
        break
      case 'suspend':
        setSuspendDialogOpen(true)
        break
      case 'reactivate':
        reactivateUserMutation.mutate(userId)
        break
      case 'viewActivity':
        setActivityLogUserId(userId)
        break
    }
  }

  const handleVerificationDecision = async (approved: boolean, reason?: string) => {
    if (!selectedUser) return
    await verifyClientMutation.mutateAsync({
      userId: selectedUser.id,
      approved,
      reason
    })
  }

  const handleRoleChange = async (newRole: User['role']) => {
    if (!selectedUser) return
    await changeRoleMutation.mutateAsync({
      userId: selectedUser.id,
      newRole
    })
  }

  const handleSuspend = async (reason: string) => {
    if (!selectedUser) return
    await suspendUserMutation.mutateAsync({
      userId: selectedUser.id,
      reason
    })
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const handleFiltersChange = (newFilters: UserFiltersType) => {
    setFilters(newFilters)
    setPage(1) // Reset to first page when filters change
  }

  const users = data?.users || []
  const totalCount = data?.totalCount || 0

  // Use cached statistics if available, otherwise calculate from current page
  const stats = statsData ? {
    total: statsData.totalUsers,
    verified: statsData.verifiedUsers,
    pending: statsData.pendingVerifications,
    suspended: statsData.suspendedUsers
  } : {
    total: totalCount,
    verified: users.filter(u => u.verificationStatus === 'verified').length,
    pending: users.filter(u => u.verificationStatus === 'pending_verification').length,
    suspended: users.filter(u => u.isSuspended).length
  }

  // If viewing activity log, show that instead
  if (activityLogUserId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">User Activity Log</h2>
          <button
            onClick={() => setActivityLogUserId(null)}
            className="text-yellow-400 hover:text-yellow-500"
          >
            ← Back to User Management
          </button>
        </div>
        <UserActivityLog userId={activityLogUserId} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <section aria-label="User statistics">
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-yellow-400/20">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden="true" />
                Total Users
              </CardDescription>
              <CardTitle className="text-3xl" aria-label={`${stats.total} total users`}>{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-yellow-400/20">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                Verified
              </CardDescription>
              <CardTitle className="text-3xl" aria-label={`${stats.verified} verified users`}>{stats.verified}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card 
            className="border-yellow-400/20 cursor-pointer hover:border-yellow-400/40 transition-colors"
            onClick={() => {
              setFilters({ ...filters, verificationStatus: 'pending_verification' })
              setPage(1)
            }}
          >
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-400" aria-hidden="true" />
                Pending Verification
              </CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2" aria-label={`${stats.pending} users pending verification`}>
                {stats.pending}
                {stats.pending > 0 && (
                  <span className="text-sm font-normal text-yellow-400">Click to review</span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-yellow-400/20">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-500" aria-hidden="true" />
                Suspended
              </CardDescription>
              <CardTitle className="text-3xl" aria-label={`${stats.suspended} suspended users`}>{stats.suspended}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Filters and Table */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            View and manage all platform users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <UserFilters filters={filters} onFiltersChange={handleFiltersChange} searchInputRef={searchInputRef} />

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12" role="status" aria-live="polite">
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12" role="alert" aria-live="assertive">
              <p className="text-red-500">Error loading users: {error.message}</p>
            </div>
          )}

          {/* User Table */}
          {!isLoading && !error && (
            <UserTable
              users={users}
              totalCount={totalCount}
              page={page}
              pageSize={pageSize}
              sortBy={sortBy}
              sortOrder={sortOrder}
              searchQuery={filters.searchQuery}
              onPageChange={setPage}
              onUserAction={handleUserAction}
              onSort={handleSort}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <VerificationDialog
        user={selectedUser}
        open={verificationDialogOpen}
        onOpenChange={setVerificationDialogOpen}
        onDecision={handleVerificationDecision}
      />

      <RoleChangeDialog
        user={selectedUser}
        open={roleChangeDialogOpen}
        onOpenChange={setRoleChangeDialogOpen}
        onConfirm={handleRoleChange}
      />

      <SuspendUserDialog
        user={selectedUser}
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
        onConfirm={handleSuspend}
      />
    </div>
  )
}
