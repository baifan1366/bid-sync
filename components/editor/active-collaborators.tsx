/**
 * Active Collaborators Component
 * 
 * Displays active collaborators with:
 * - Avatar list with user colors
 * - User names on hover
 * - Current user indicator
 * - Expandable list for many users
 * - Idle/away status indicators
 * - Section-specific presence
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Circle, Clock, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PresenceStatus = 'active' | 'idle' | 'away'

interface ActiveUser {
  id: string
  name: string
  color: string
  status?: PresenceStatus
  currentSection?: string
  cursorPosition?: { from: number; to: number }
}

interface ActiveCollaboratorsProps {
  users: ActiveUser[]
  currentUserId: string
  maxVisible?: number
  className?: string
  showSectionInfo?: boolean
}

/**
 * Active Collaborators Component
 * 
 * Shows avatars of currently active users with their assigned colors.
 * Displays user names on hover and indicates the current user.
 * Shows presence status (active/idle/away) with color-coded indicators.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export function ActiveCollaborators({
  users,
  currentUserId,
  maxVisible = 5,
  className,
  showSectionInfo = false,
}: ActiveCollaboratorsProps) {
  const [showAll, setShowAll] = useState(false)

  if (users.length === 0) {
    return null
  }

  const visibleUsers = showAll ? users : users.slice(0, maxVisible)
  const remainingCount = users.length - maxVisible

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* User count badge */}
      <Badge variant="secondary" className="bg-yellow-400/20 text-yellow-400">
        <Users className="h-3 w-3 mr-1" />
        {users.length}
      </Badge>

      {/* Avatar list */}
      <div className="flex items-center -space-x-2">
        {visibleUsers.map((user) => {
          const isCurrentUser = user.id === currentUserId
          const initials = getInitials(user.name)
          const status = user.status || 'active'
          const statusInfo = getStatusInfo(status)

          return (
            <div
              key={user.id}
              className="relative group"
              title={isCurrentUser ? `${user.name} (You)` : user.name}
            >
              <Avatar
                className={cn(
                  'h-8 w-8 border-2 border-white dark:border-black',
                  'transition-transform hover:scale-110 hover:z-10',
                  isCurrentUser && 'ring-2 ring-yellow-400 ring-offset-2',
                  status === 'idle' && 'opacity-75',
                  status === 'away' && 'opacity-50'
                )}
                style={{ borderColor: user.color }}
              >
                <AvatarFallback
                  className="text-xs font-semibold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                <div className="flex items-center gap-1.5">
                  <Circle className={cn('h-2 w-2 fill-current', statusInfo.color)} />
                  <span>
                    {user.name}
                    {isCurrentUser && ' (You)'}
                  </span>
                </div>
                {showSectionInfo && user.currentSection && (
                  <div className="text-gray-300 mt-0.5">
                    Editing: {user.currentSection}
                  </div>
                )}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black"></div>
              </div>

              {/* Status indicator with color coding */}
              <div
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-black',
                  statusInfo.bgColor
                )}
                title={statusInfo.label}
              >
                {status === 'idle' && (
                  <Clock className="h-1.5 w-1.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
                {status === 'away' && (
                  <Moon className="h-1.5 w-1.5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>
          )
        })}

        {/* Show more button */}
        {remainingCount > 0 && !showAll && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-yellow-400/20 hover:bg-yellow-400/30 text-xs font-semibold"
            onClick={() => setShowAll(true)}
            title={`${remainingCount} more`}
          >
            +{remainingCount}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Compact Active Collaborators List
 * 
 * Shows a detailed list of active collaborators with their status.
 * Displays presence status (active/idle/away) and section information.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export function ActiveCollaboratorsList({
  users,
  currentUserId,
  className,
  showSectionInfo = false,
}: Omit<ActiveCollaboratorsProps, 'maxVisible'>) {
  if (users.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground text-center py-4', className)}>
        No active collaborators
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {users.map((user) => {
        const isCurrentUser = user.id === currentUserId
        const initials = getInitials(user.name)
        const status = user.status || 'active'
        const statusInfo = getStatusInfo(status)

        return (
          <div
            key={user.id}
            className={cn(
              'flex items-center gap-3 p-2 rounded-md hover:bg-yellow-400/5 transition-colors',
              status === 'idle' && 'opacity-75',
              status === 'away' && 'opacity-50'
            )}
          >
            {/* Avatar */}
            <div className="relative">
              <Avatar
                className={cn(
                  'h-8 w-8 border-2',
                  isCurrentUser && 'ring-2 ring-yellow-400 ring-offset-2'
                )}
                style={{ borderColor: user.color }}
              >
                <AvatarFallback
                  className="text-xs font-semibold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Status indicator */}
              <div
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-black',
                  statusInfo.bgColor
                )}
              />
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">
                  {user.name}
                  {isCurrentUser && (
                    <span className="text-muted-foreground ml-1">(You)</span>
                  )}
                </p>
              </div>
              {showSectionInfo && user.currentSection && (
                <p className="text-xs text-muted-foreground truncate">
                  Editing: {user.currentSection}
                </p>
              )}
            </div>

            {/* Status label */}
            <div className={cn('flex items-center gap-1 text-xs', statusInfo.color)}>
              <Circle className="h-2 w-2 fill-current" />
              {statusInfo.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Cursor Indicator Component
 * 
 * Shows a cursor position indicator for a collaborator.
 * This would be rendered at the cursor position in the editor.
 * Displays user color and name with presence status.
 * 
 * Requirements: 2.3, 2.5
 */
export function CollaboratorCursor({
  user,
  position,
  className,
}: {
  user: ActiveUser
  position: { top: number; left: number }
  className?: string
}) {
  const initials = getInitials(user.name)
  const status = user.status || 'active'
  const statusInfo = getStatusInfo(status)

  return (
    <div
      className={cn(
        'absolute pointer-events-none z-50',
        status === 'idle' && 'opacity-60',
        status === 'away' && 'opacity-30',
        className
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Cursor line */}
      <div
        className={cn(
          'w-0.5 h-5',
          status === 'active' && 'animate-pulse'
        )}
        style={{ backgroundColor: user.color }}
      />

      {/* User label with status indicator */}
      <div
        className="absolute top-0 left-1 px-1.5 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg flex items-center gap-1"
        style={{ backgroundColor: user.color }}
      >
        {status !== 'active' && (
          <Circle className={cn('h-1.5 w-1.5 fill-current', statusInfo.color)} />
        )}
        {user.name}
      </div>
    </div>
  )
}

/**
 * Typing Indicator Component
 * 
 * Shows when a user is actively typing.
 */
export function TypingIndicator({
  users,
  className,
}: {
  users: ActiveUser[]
  className?: string
}) {
  if (users.length === 0) {
    return null
  }

  const names = users.map((u) => u.name).join(', ')
  const text =
    users.length === 1
      ? `${names} is typing...`
      : users.length === 2
      ? `${names} are typing...`
      : `${users.length} people are typing...`

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{text}</span>
    </div>
  )
}

// Helper function to get user initials
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// Helper function to get status information
// Requirements: 2.4 - Visual distinction for active/idle/away users
function getStatusInfo(status: PresenceStatus): {
  label: string
  color: string
  bgColor: string
} {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        color: 'text-green-500',
        bgColor: 'bg-green-500',
      }
    case 'idle':
      return {
        label: 'Idle',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-400',
      }
    case 'away':
      return {
        label: 'Away',
        color: 'text-gray-400',
        bgColor: 'bg-gray-400',
      }
    default:
      return {
        label: 'Active',
        color: 'text-green-500',
        bgColor: 'bg-green-500',
      }
  }
}
