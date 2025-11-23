"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AdminList } from "./admin-list"
import { AddAdminDialog } from "./add-admin-dialog"
import { createGraphQLClient } from "@/lib/graphql/client"
import { UserPlus, Users, Search, X } from "lucide-react"
import type { Admin, AdminInvitation } from "@/lib/graphql/types"

interface AdminManagementSectionProps {
  currentAdminId: string
}

const ALL_ADMINS_QUERY = `
  query AllAdmins {
    allAdmins {
      id
      email
      fullName
      createdAt
      lastLoginAt
      invitedBy
    }
  }
`

const INVITE_ADMIN_MUTATION = `
  mutation InviteAdmin($email: String!) {
    inviteAdmin(email: $email) {
      id
      email
      token
      expires_at
      created_at
    }
  }
`

const REMOVE_ADMIN_MUTATION = `
  mutation RemoveAdminPrivileges($userId: ID!) {
    removeAdminPrivileges(userId: $userId) {
      id
      email
      role
    }
  }
`

export function AdminManagementSection({ currentAdminId }: AdminManagementSectionProps) {
  const queryClient = useQueryClient()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      // Ctrl/Cmd + N to open add admin dialog
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        setAddDialogOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Fetch all admins with caching strategy
  const { data, isLoading, error } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const client = createGraphQLClient()
      const result = await client.request<{ allAdmins: Admin[] }>(ALL_ADMINS_QUERY)
      return result.allAdmins
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus for admin data
  })

  // Invite admin mutation
  const inviteAdminMutation = useMutation({
    mutationFn: async (email: string) => {
      const client = createGraphQLClient()
      const result = await client.request<{ inviteAdmin: AdminInvitation }>(
        INVITE_ADMIN_MUTATION,
        { email }
      )
      return result.inviteAdmin
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] })
    },
  })

  // Remove admin mutation
  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const client = createGraphQLClient()
      const result = await client.request(REMOVE_ADMIN_MUTATION, { userId })
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] })
    },
  })

  const handleInviteAdmin = async (email: string) => {
    await inviteAdminMutation.mutateAsync(email)
  }

  const handleRemoveAdmin = async (adminId: string) => {
    await removeAdminMutation.mutateAsync(adminId)
  }

  const admins = data || []
  const adminCount = admins.length

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <section aria-label="Administrator statistics">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-yellow-400/20">
            <CardHeader className="pb-3">
              <CardDescription>Total Administrators</CardDescription>
              <CardTitle className="text-3xl" aria-label={`${adminCount} total administrators`}>{adminCount}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-yellow-400/20">
            <CardHeader className="pb-3">
              <CardDescription>Active Today</CardDescription>
              <CardTitle className="text-3xl" aria-label={`${admins.filter((admin: Admin) => {
                if (!admin.lastLoginAt) return false
                const lastLogin = new Date(admin.lastLoginAt)
                const today = new Date()
                return lastLogin.toDateString() === today.toDateString()
              }).length} administrators active today`}>
                {admins.filter((admin: Admin) => {
                  if (!admin.lastLoginAt) return false
                  const lastLogin = new Date(admin.lastLoginAt)
                  const today = new Date()
                  return lastLogin.toDateString() === today.toDateString()
                }).length}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-yellow-400/20">
            <CardHeader className="pb-3">
              <CardDescription>Pending Invitations</CardDescription>
              <CardTitle className="text-3xl" aria-label="0 pending invitations">0</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Actions Bar */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Administrator Management
              </CardTitle>
              <CardDescription>
                Manage administrator accounts and privileges
              </CardDescription>
            </div>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
              aria-label="Add new administrator (Ctrl+N)"
            >
              <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
              Add Administrator
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={searchInputRef}
              placeholder="Search administrators by email or name... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
              aria-label="Search administrators"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12" role="status" aria-live="polite">
              <p className="text-muted-foreground">Loading administrators...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12" role="alert" aria-live="assertive">
              <p className="text-red-500">Error loading administrators: {error.message}</p>
            </div>
          )}

          {/* Admin List */}
          {!isLoading && !error && (
            <AdminList
              admins={admins}
              currentAdminId={currentAdminId}
              onRemoveAdmin={handleRemoveAdmin}
              searchQuery={searchQuery}
            />
          )}
        </CardContent>
      </Card>

      {/* Add Admin Dialog */}
      <AddAdminDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onInvite={handleInviteAdmin}
      />
    </div>
  )
}
