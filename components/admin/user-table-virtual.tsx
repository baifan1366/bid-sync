"use client"

import { useRef } from "react"
import { FixedSizeList as List } from "react-window"
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
import type { UserAction } from "./user-table"

interface UserTableVirtualProps {
  users: User[]
  searchQuery?: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onUserAction: (userId: string, action: UserAction) => void
  onSort: (column: string) => void
  height?: number
}

export function UserTableVirtual({
  users,
  searchQuery = '',
  sortBy,
  sortOrder,
  onUserAction,
  onSort,
  height = 600
}: UserTableVirtualProps) {
  const listRef = useRef<List>(null)

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
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortBy === column ? 'text-yellow-400' : ''}`} />
    </button>
  )

  // Row renderer for virtual list
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const user = users[index]
    
    return (
      <div 
        style={style}
        className="border-b border-yellow-400/10 hover:bg-yellow-400/5 transition-colors flex items-center"
      >
        <div className="grid grid-cols-7 gap-4 w-full px-4">
          <div className="font-medium">
            <SearchHighlight text={user.email} searchQuery={searchQuery} />
          </div>
          <div>
            {user.fullName ? (
              <SearchHighlight text={user.fullName} searchQuery={searchQuery} />
            ) : '-'}
          </div>
          <div>
            <Badge className={getRoleBadgeColor(user.role)}>
              {formatRoleLabel(user.role)}
            </Badge>
          </div>
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
          <div className="text-sm text-muted-foreground">
            {formatDate(user.createdAt)}
          </div>
          <div className="text-sm text-muted-foreground">
            {formatRelativeTime(user.lastActivityAt)}
          </div>
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {user.verificationStatus === 'pending_verification' && (
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
          </div>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No users found matching your filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table Header */}
      <div className="border border-yellow-400/20 rounded-lg overflow-hidden">
        <div className="bg-yellow-400/5 border-b border-yellow-400/20 px-4 py-4">
          <div className="grid grid-cols-7 gap-4 font-semibold">
            <div>
              <SortButton column="email" label="Email" />
            </div>
            <div>
              <SortButton column="full_name" label="Name" />
            </div>
            <div>
              <SortButton column="role" label="Role" />
            </div>
            <div>Status</div>
            <div>
              <SortButton column="created_at" label="Registered" />
            </div>
            <div>
              <SortButton column="last_activity_at" label="Last Activity" />
            </div>
            <div className="text-right">Actions</div>
          </div>
        </div>

        {/* Virtual List */}
        <List
          ref={listRef}
          height={height}
          itemCount={users.length}
          itemSize={80}
          width="100%"
        >
          {Row}
        </List>
      </div>

      {/* Info */}
      <div className="text-sm text-muted-foreground">
        Showing {users.length} users (virtual scrolling enabled)
      </div>
    </div>
  )
}
