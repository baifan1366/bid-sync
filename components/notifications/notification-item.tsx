/**
 * NotificationItem Component
 * 
 * Displays a single notification with read/delete actions.
 * 
 * Requirements:
 * - 1.3: Display notification in dropdown list
 * - 1.4: Mark notification as read and navigate to relevant page
 * - 13.4: Visually distinguish read from unread notifications
 * - 20.1: Delete notification
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Notification } from '@/lib/notification-types'
import { X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (notificationId: string) => Promise<void>
  onDelete: (notificationId: string) => Promise<void>
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: NotificationItemProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  // Generate navigation URL based on notification type and data
  const getNavigationUrl = (): string | null => {
    const { type, data } = notification

    switch (type) {
      case 'proposal_submitted':
      case 'proposal_scored':
      case 'proposal_score_updated':
      case 'proposal_accepted':
      case 'proposal_rejected':
        return data.proposalId ? `/proposals/${data.proposalId}` : null

      case 'project_created':
      case 'project_approved':
      case 'project_rejected':
      case 'project_awarded':
      case 'project_completed':
      case 'project_deadline_approaching':
        return data.projectId ? `/projects/${data.projectId}` : null

      case 'section_assigned':
      case 'section_reassigned':
      case 'section_completed':
      case 'section_deadline_approaching':
        return data.documentId ? `/editor/${data.documentId}` : null

      case 'ready_for_delivery':
      case 'completion_accepted':
      case 'revision_requested':
        return data.projectId ? `/projects/${data.projectId}/completion` : null

      case 'team_member_joined':
      case 'team_member_removed':
        return '/team'

      default:
        return null
    }
  }

  // Requirement 1.4: Mark as read and navigate to relevant page
  const handleClick = async () => {
    if (!notification.read) {
      await onMarkAsRead(notification.id)
    }

    const url = getNavigationUrl()
    if (url) {
      router.push(url)
    }
  }

  // Requirement 20.1: Delete notification
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the click handler
    setIsDeleting(true)
    
    try {
      await onDelete(notification.id)
    } catch (error) {
      console.error('Error deleting notification:', error)
      setIsDeleting(false)
    }
  }

  const timeAgo = formatDistanceToNow(notification.createdAt, { addSuffix: true })
  const hasNavigationUrl = getNavigationUrl() !== null

  return (
    <div
      className={cn(
        'group relative p-3 rounded-lg border transition-all duration-200',
        // Requirement 13.4: Visually distinguish read from unread
        notification.read
          ? 'border-gray-200 dark:border-gray-800 bg-background'
          : 'border-yellow-400/40 bg-yellow-400/5 hover:bg-yellow-400/10',
        hasNavigationUrl && 'cursor-pointer hover:shadow-md',
        isDeleting && 'opacity-50 pointer-events-none'
      )}
      onClick={hasNavigationUrl ? handleClick : undefined}
      role={hasNavigationUrl ? 'button' : undefined}
      tabIndex={hasNavigationUrl ? 0 : undefined}
      onKeyDown={
        hasNavigationUrl
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleClick()
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {/* Unread indicator dot */}
            {!notification.read && (
              <div className="mt-1.5 h-2 w-2 rounded-full bg-yellow-400 shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-tight">
                {notification.title}
              </p>
              
              {notification.body && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {notification.body}
                </p>
              )}
              
              <div className="flex items-center gap-2 mt-1.5">
                <p className="text-xs text-muted-foreground">
                  {timeAgo}
                </p>
                
                {notification.sentViaEmail && (
                  <span className="text-xs text-muted-foreground">
                    • Sent via email
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {hasNavigationUrl && (
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          
          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-opacity"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete notification"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
