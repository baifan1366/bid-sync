/**
 * Performance Optimizer Service
 * 
 * Handles performance optimization for concurrent users including:
 * - Connection pooling for WebSocket connections
 * - Rate limiting for lock operations
 * - GraphQL subscription batching
 * - Graceful degradation under high load
 * - Performance metrics logging
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { errorLogger } from './error-logger'

// ============================================================
// TYPES
// ============================================================

export interface PerformanceMetrics {
  timestamp: Date
  operation: string
  duration: number
  success: boolean
  userId?: string
  documentId?: string
  metadata?: Record<string, any>
}

export interface ConnectionPoolConfig {
  maxConnections: number
  minConnections: number
  idleTimeout: number // milliseconds
  connectionTimeout: number // milliseconds
}

export interface RateLimitConfig {
  maxRequestsPerSecond: number
  maxRequestsPerMinute: number
  burstSize: number
}

export interface LoadMetrics {
  activeConnections: number
  requestsPerSecond: number
  averageLatency: number
  errorRate: number
}

export interface DegradationConfig {
  highLoadThreshold: number // percentage (0-100)
  criticalLoadThreshold: number // percentage (0-100)
  syncIntervalIncrease: number // multiplier
  maxSyncInterval: number // milliseconds
}

// ============================================================
// RATE LIMITER
// ============================================================

class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  /**
   * Check if a request is allowed for a user
   * Requirements: 10.2 - Rate limiting for lock operations
   */
  async checkLimit(userId: string, operation: string): Promise<boolean> {
    const key = `${userId}:${operation}`
    const now = Date.now()
    
    // Get or create request history for this user+operation
    let requestTimes = this.requests.get(key) || []
    
    // Remove requests older than 1 minute
    requestTimes = requestTimes.filter(time => now - time < 60000)
    
    // Check per-second limit (last second)
    const lastSecondRequests = requestTimes.filter(time => now - time < 1000)
    if (lastSecondRequests.length >= this.config.maxRequestsPerSecond) {
      errorLogger.warn('Rate limit exceeded (per second)', {
        userId,
        operation,
        requestsInLastSecond: lastSecondRequests.length,
        limit: this.config.maxRequestsPerSecond
      })
      return false
    }
    
    // Check per-minute limit
    if (requestTimes.length >= this.config.maxRequestsPerMinute) {
      errorLogger.warn('Rate limit exceeded (per minute)', {
        userId,
        operation,
        requestsInLastMinute: requestTimes.length,
        limit: this.config.maxRequestsPerMinute
      })
      return false
    }
    
    // Check burst size (requests in last 100ms)
    const burstRequests = requestTimes.filter(time => now - time < 100)
    if (burstRequests.length >= this.config.burstSize) {
      errorLogger.warn('Rate limit exceeded (burst)', {
        userId,
        operation,
        burstRequests: burstRequests.length,
        limit: this.config.burstSize
      })
      return false
    }
    
    // Add this request
    requestTimes.push(now)
    this.requests.set(key, requestTimes)
    
    return true
  }

  /**
   * Clear rate limit history for a user
   */
  clearUser(userId: string): void {
    const keysToDelete: string[] = []
    for (const key of this.requests.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.requests.delete(key))
  }

  /**
   * Clean up old entries periodically
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, times] of this.requests.entries()) {
      const recentTimes = times.filter(time => now - time < 60000)
      if (recentTimes.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, recentTimes)
      }
    }
  }
}

// ============================================================
// CONNECTION POOL MANAGER
// ============================================================

class ConnectionPoolManager {
  private activeConnections: Set<string> = new Set()
  private idleConnections: Map<string, number> = new Map()
  private config: ConnectionPoolConfig
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config: ConnectionPoolConfig) {
    this.config = config
    this.startCleanup()
  }

  /**
   * Request a connection from the pool
   * Requirements: 10.1 - Connection pooling for WebSocket connections
   */
  async acquireConnection(connectionId: string): Promise<boolean> {
    // Check if we're at max capacity
    if (this.activeConnections.size >= this.config.maxConnections) {
      errorLogger.warn('Connection pool at capacity', {
        activeConnections: this.activeConnections.size,
        maxConnections: this.config.maxConnections
      })
      return false
    }

    // Remove from idle if it was there
    this.idleConnections.delete(connectionId)
    
    // Add to active
    this.activeConnections.add(connectionId)
    
    return true
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connectionId: string): void {
    this.activeConnections.delete(connectionId)
    
    // Add to idle pool if we're above minimum
    if (this.activeConnections.size >= this.config.minConnections) {
      this.idleConnections.set(connectionId, Date.now())
    }
  }

  /**
   * Remove a connection from the pool
   */
  removeConnection(connectionId: string): void {
    this.activeConnections.delete(connectionId)
    this.idleConnections.delete(connectionId)
  }

  /**
   * Get current pool statistics
   */
  getStats(): { active: number; idle: number; total: number } {
    return {
      active: this.activeConnections.size,
      idle: this.idleConnections.size,
      total: this.activeConnections.size + this.idleConnections.size
    }
  }

  /**
   * Start cleanup interval for idle connections
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      const toRemove: string[] = []
      
      for (const [connectionId, idleTime] of this.idleConnections.entries()) {
        if (now - idleTime > this.config.idleTimeout) {
          toRemove.push(connectionId)
        }
      }
      
      toRemove.forEach(id => this.idleConnections.delete(id))
      
      if (toRemove.length > 0) {
        errorLogger.info('Cleaned up idle connections', {
          removed: toRemove.length,
          remaining: this.idleConnections.size
        })
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Stop cleanup and release resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.activeConnections.clear()
    this.idleConnections.clear()
  }
}

// ============================================================
// SUBSCRIPTION BATCHER
// ============================================================

class SubscriptionBatcher {
  private pendingSubscriptions: Map<string, Set<string>> = new Map()
  private batchTimeout: NodeJS.Timeout | null = null
  private readonly batchDelay = 50 // milliseconds

  /**
   * Add a subscription to the batch
   * Requirements: 10.3 - Optimize GraphQL subscriptions with batching
   */
  addSubscription(documentId: string, subscriptionType: string): void {
    const key = `${documentId}:${subscriptionType}`
    
    if (!this.pendingSubscriptions.has(key)) {
      this.pendingSubscriptions.set(key, new Set())
    }
    
    this.pendingSubscriptions.get(key)!.add(subscriptionType)
    
    // Schedule batch processing
    this.scheduleBatch()
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    if (this.batchTimeout) {
      return // Already scheduled
    }
    
    this.batchTimeout = setTimeout(() => {
      this.processBatch()
      this.batchTimeout = null
    }, this.batchDelay)
  }

  /**
   * Process batched subscriptions
   */
  private processBatch(): void {
    if (this.pendingSubscriptions.size === 0) {
      return
    }
    
    errorLogger.debug('Processing subscription batch', {
      batchSize: this.pendingSubscriptions.size
    })
    
    // Process all pending subscriptions
    // In a real implementation, this would send batched subscription requests
    // to the GraphQL server
    
    this.pendingSubscriptions.clear()
  }

  /**
   * Get pending batch size
   */
  getPendingCount(): number {
    return this.pendingSubscriptions.size
  }
}

// ============================================================
// LOAD MONITOR
// ============================================================

class LoadMonitor {
  private metrics: PerformanceMetrics[] = []
  private readonly maxMetricsHistory = 1000
  private readonly metricsWindow = 60000 // 1 minute

  /**
   * Record a performance metric
   * Requirements: 10.5 - Log performance metrics
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric)
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory)
    }
    
    // Log slow operations
    if (metric.duration > 1000) {
      errorLogger.warn('Slow operation detected', {
        operation: metric.operation,
        duration: metric.duration,
        userId: metric.userId,
        documentId: metric.documentId
      })
    }
  }

  /**
   * Get current load metrics
   */
  getLoadMetrics(): LoadMetrics {
    const now = Date.now()
    const recentMetrics = this.metrics.filter(
      m => now - m.timestamp.getTime() < this.metricsWindow
    )
    
    if (recentMetrics.length === 0) {
      return {
        activeConnections: 0,
        requestsPerSecond: 0,
        averageLatency: 0,
        errorRate: 0
      }
    }
    
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0)
    const errorCount = recentMetrics.filter(m => !m.success).length
    
    return {
      activeConnections: recentMetrics.length,
      requestsPerSecond: recentMetrics.length / (this.metricsWindow / 1000),
      averageLatency: totalDuration / recentMetrics.length,
      errorRate: errorCount / recentMetrics.length
    }
  }

  /**
   * Get metrics for a specific operation
   */
  getOperationMetrics(operation: string): {
    count: number
    averageDuration: number
    successRate: number
  } {
    const now = Date.now()
    const operationMetrics = this.metrics.filter(
      m => m.operation === operation && now - m.timestamp.getTime() < this.metricsWindow
    )
    
    if (operationMetrics.length === 0) {
      return { count: 0, averageDuration: 0, successRate: 1 }
    }
    
    const totalDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0)
    const successCount = operationMetrics.filter(m => m.success).length
    
    return {
      count: operationMetrics.length,
      averageDuration: totalDuration / operationMetrics.length,
      successRate: successCount / operationMetrics.length
    }
  }

  /**
   * Clear old metrics
   */
  cleanup(): void {
    const now = Date.now()
    this.metrics = this.metrics.filter(
      m => now - m.timestamp.getTime() < this.metricsWindow
    )
  }
}

// ============================================================
// PERFORMANCE OPTIMIZER (MAIN CLASS)
// ============================================================

export class PerformanceOptimizer {
  private rateLimiter: RateLimiter
  private connectionPool: ConnectionPoolManager
  private subscriptionBatcher: SubscriptionBatcher
  private loadMonitor: LoadMonitor
  private degradationConfig: DegradationConfig
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(
    rateLimitConfig?: Partial<RateLimitConfig>,
    connectionPoolConfig?: Partial<ConnectionPoolConfig>,
    degradationConfig?: Partial<DegradationConfig>
  ) {
    // Initialize rate limiter
    // Requirement 10.2: max 10 requests per second per user
    this.rateLimiter = new RateLimiter({
      maxRequestsPerSecond: 10,
      maxRequestsPerMinute: 300,
      burstSize: 5,
      ...rateLimitConfig
    })

    // Initialize connection pool
    // Requirement 10.1: Support at least 20 concurrent users
    this.connectionPool = new ConnectionPoolManager({
      maxConnections: 50,
      minConnections: 5,
      idleTimeout: 300000, // 5 minutes
      connectionTimeout: 30000, // 30 seconds
      ...connectionPoolConfig
    })

    // Initialize subscription batcher
    this.subscriptionBatcher = new SubscriptionBatcher()

    // Initialize load monitor
    this.loadMonitor = new LoadMonitor()

    // Initialize degradation config
    // Requirement 10.4: Graceful degradation under high load
    this.degradationConfig = {
      highLoadThreshold: 70,
      criticalLoadThreshold: 90,
      syncIntervalIncrease: 2,
      maxSyncInterval: 5000,
      ...degradationConfig
    }

    // Start periodic cleanup
    this.startCleanup()
  }

  /**
   * Check if a lock operation is allowed (rate limiting)
   * Requirements: 10.2
   */
  async checkLockRateLimit(userId: string): Promise<boolean> {
    return this.rateLimiter.checkLimit(userId, 'lock')
  }

  /**
   * Acquire a WebSocket connection from the pool
   * Requirements: 10.1
   */
  async acquireConnection(connectionId: string): Promise<boolean> {
    const allowed = await this.connectionPool.acquireConnection(connectionId)
    
    if (!allowed) {
      this.recordMetric({
        timestamp: new Date(),
        operation: 'connection_acquire',
        duration: 0,
        success: false,
        metadata: { reason: 'pool_full' }
      })
    }
    
    return allowed
  }

  /**
   * Release a WebSocket connection back to the pool
   */
  releaseConnection(connectionId: string): void {
    this.connectionPool.releaseConnection(connectionId)
  }

  /**
   * Batch a GraphQL subscription
   * Requirements: 10.3
   */
  batchSubscription(documentId: string, subscriptionType: string): void {
    this.subscriptionBatcher.addSubscription(documentId, subscriptionType)
  }

  /**
   * Record a performance metric
   * Requirements: 10.5
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.loadMonitor.recordMetric(metric)
    
    // Log to error logger for persistence
    if (metric.duration > 100 || !metric.success) {
      errorLogger.info('Performance metric', {
        operation: metric.operation,
        duration: metric.duration,
        success: metric.success,
        userId: metric.userId,
        documentId: metric.documentId,
        ...metric.metadata
      })
    }
  }

  /**
   * Get recommended sync interval based on current load
   * Requirements: 10.4 - Graceful degradation
   */
  getRecommendedSyncInterval(baseSyncInterval: number = 1000): number {
    const loadMetrics = this.loadMonitor.getLoadMetrics()
    const loadPercentage = (loadMetrics.requestsPerSecond / 100) * 100
    
    if (loadPercentage >= this.degradationConfig.criticalLoadThreshold) {
      // Critical load: increase sync interval significantly
      const newInterval = Math.min(
        baseSyncInterval * this.degradationConfig.syncIntervalIncrease * 2,
        this.degradationConfig.maxSyncInterval
      )
      
      errorLogger.warn('Critical load detected, increasing sync interval', {
        loadPercentage,
        oldInterval: baseSyncInterval,
        newInterval
      })
      
      return newInterval
    } else if (loadPercentage >= this.degradationConfig.highLoadThreshold) {
      // High load: increase sync interval moderately
      const newInterval = Math.min(
        baseSyncInterval * this.degradationConfig.syncIntervalIncrease,
        this.degradationConfig.maxSyncInterval
      )
      
      errorLogger.info('High load detected, increasing sync interval', {
        loadPercentage,
        oldInterval: baseSyncInterval,
        newInterval
      })
      
      return newInterval
    }
    
    // Normal load: use base interval
    return baseSyncInterval
  }

  /**
   * Get current system statistics
   */
  getStats(): {
    connections: { active: number; idle: number; total: number }
    load: LoadMetrics
    pendingSubscriptions: number
  } {
    return {
      connections: this.connectionPool.getStats(),
      load: this.loadMonitor.getLoadMetrics(),
      pendingSubscriptions: this.subscriptionBatcher.getPendingCount()
    }
  }

  /**
   * Get metrics for a specific operation
   * Requirements: 10.5
   */
  getOperationMetrics(operation: string): {
    count: number
    averageDuration: number
    successRate: number
  } {
    return this.loadMonitor.getOperationMetrics(operation)
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.rateLimiter.cleanup()
      this.loadMonitor.cleanup()
    }, 60000) // Every minute
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.connectionPool.destroy()
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let optimizerInstance: PerformanceOptimizer | null = null

/**
 * Get the singleton instance of the performance optimizer
 */
export function getPerformanceOptimizer(): PerformanceOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new PerformanceOptimizer()
  }
  return optimizerInstance
}

/**
 * Create a new performance optimizer instance (for testing)
 */
export function createPerformanceOptimizer(
  rateLimitConfig?: Partial<RateLimitConfig>,
  connectionPoolConfig?: Partial<ConnectionPoolConfig>,
  degradationConfig?: Partial<DegradationConfig>
): PerformanceOptimizer {
  return new PerformanceOptimizer(
    rateLimitConfig,
    connectionPoolConfig,
    degradationConfig
  )
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Measure the duration of an async operation
 */
export async function measureOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: { userId?: string; documentId?: string }
): Promise<T> {
  const optimizer = getPerformanceOptimizer()
  const startTime = Date.now()
  let success = true
  let error: Error | undefined
  
  try {
    const result = await fn()
    return result
  } catch (err) {
    success = false
    error = err as Error
    throw err
  } finally {
    const duration = Date.now() - startTime
    
    optimizer.recordMetric({
      timestamp: new Date(),
      operation,
      duration,
      success,
      userId: context?.userId,
      documentId: context?.documentId,
      metadata: error ? { error: error.message } : undefined
    })
  }
}
