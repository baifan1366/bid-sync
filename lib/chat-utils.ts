import { ChatMessage } from './graphql/types'

/**
 * Format message timestamp for display
 * @param timestamp ISO timestamp string
 * @param format Format type: 'relative', 'time', 'full'
 * @returns Formatted timestamp string
 */
export function formatMessageTimestamp(
  timestamp: string,
  format: 'relative' | 'time' | 'full' = 'relative'
): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (format === 'relative') {
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (format === 'time') {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // format === 'full'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Group messages by date for display
 * @param messages Array of chat messages
 * @returns Object with date keys and message arrays
 */
export function groupMessagesByDate(messages: ChatMessage[]): Record<string, ChatMessage[]> {
  const grouped: Record<string, ChatMessage[]> = {}

  messages.forEach((message) => {
    const date = new Date(message.created_at)
    const dateKey = getDateKey(date)

    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }

    grouped[dateKey].push(message)
  })

  return grouped
}

/**
 * Get a human-readable date key for grouping
 * @param date Date object
 * @returns Date key string (e.g., "Today", "Yesterday", "Jan 15, 2024")
 */
function getDateKey(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/**
 * Detect unread messages for the current user
 * @param messages Array of chat messages
 * @param currentUserId Current user's ID
 * @returns Array of unread messages
 */
export function detectUnreadMessages(
  messages: ChatMessage[],
  currentUserId: string
): ChatMessage[] {
  return messages.filter(
    (message) => !message.read && message.sender_id !== currentUserId
  )
}

/**
 * Count unread messages for the current user
 * @param messages Array of chat messages
 * @param currentUserId Current user's ID
 * @returns Number of unread messages
 */
export function countUnreadMessages(
  messages: ChatMessage[],
  currentUserId: string
): number {
  return detectUnreadMessages(messages, currentUserId).length
}

/**
 * Generate a preview of the message content
 * @param content Full message content
 * @param maxLength Maximum length of preview (default: 50)
 * @returns Truncated message preview
 */
export function generateMessagePreview(content: string, maxLength: number = 50): string {
  if (!content) return ''

  // Remove extra whitespace and newlines
  const cleaned = content.trim().replace(/\s+/g, ' ')

  if (cleaned.length <= maxLength) {
    return cleaned
  }

  return cleaned.substring(0, maxLength).trim() + '...'
}

/**
 * Check if messages should be grouped together (same sender, within time threshold)
 * @param message1 First message
 * @param message2 Second message
 * @param thresholdMinutes Time threshold in minutes (default: 5)
 * @returns True if messages should be grouped
 */
export function shouldGroupMessages(
  message1: ChatMessage,
  message2: ChatMessage,
  thresholdMinutes: number = 5
): boolean {
  if (message1.sender_id !== message2.sender_id) {
    return false
  }

  const time1 = new Date(message1.created_at).getTime()
  const time2 = new Date(message2.created_at).getTime()
  const diffMs = Math.abs(time2 - time1)
  const diffMins = diffMs / (1000 * 60)

  return diffMins <= thresholdMinutes
}

/**
 * Sort messages chronologically (oldest first)
 * @param messages Array of chat messages
 * @returns Sorted array of messages
 */
export function sortMessagesChronologically(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}
