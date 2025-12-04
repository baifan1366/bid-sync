/**
 * NotificationBell Component
 * 
 * Displays a notification bell icon with unread badge in the header.
 * Clicking the bell opens the notification dropdown.
 * 
 * Requirements:
 * - 1.2: Display unread notification count in header
 * - 1.5: Display visual indicator (badge) on notification bell
 */

'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  unreadCount: number
  onClick: () => void
  isOpen: boolean
  className?: string
}

export function NotificationBell({
  unreadCount,
  onClick,
  isOpen,
  className,
}: NotificationBellProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn(
        'relative hover:bg-yellow-400/10',
        isOpen && 'bg-yellow-400/10',
        className
      )}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell className={cn(
        'h-5 w-5',
        unreadCount > 0 ? 'text-yellow-400' : 'text-muted-foreground'
      )} />
      
      {/* Requirement 1.5: Visual indicator (badge) for unread notifications */}
      {unreadCount > 0 && (
        <Badge
          className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-yellow-400 text-black hover:bg-yellow-500 border-0"
          aria-label={`${unreadCount} unread notifications`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  )
}
