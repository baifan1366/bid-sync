import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBudget(budget?: number | null, allowZero = false): string {
  if (budget === null || budget === undefined) return 'Not specified'
  if (budget === 0 && !allowZero) return 'Not specified'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(budget)
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function calculateDaysUntilDeadline(deadline: string): number {
  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diffTime = deadlineDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export function isDeadlineOverdue(deadline: string): boolean {
  return calculateDaysUntilDeadline(deadline) < 0
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Calculate project counts by status
 * 
 * @param projects - Array of projects
 * @returns Object with counts for each status
 */
export function calculateProjectCountsByStatus(projects: any[]) {
  const total = projects.length
  const open = projects.filter(p => p.status === 'OPEN' || p.status === 'open').length
  const closed = projects.filter(p => p.status === 'CLOSED' || p.status === 'closed').length
  const awarded = projects.filter(p => p.status === 'AWARDED' || p.status === 'awarded').length
  const pending = projects.filter(p => p.status === 'PENDING_REVIEW' || p.status === 'pending_review').length

  return {
    total,
    open,
    closed,
    awarded,
    pending,
  }
}

/**
 * Calculate total budget across all projects
 * 
 * @param projects - Array of projects
 * @returns Total budget sum
 */
export function calculateTotalBudget(projects: any[]): number {
  return projects.reduce((sum, project) => {
    const budget = project.budget || 0
    return sum + budget
  }, 0)
}
