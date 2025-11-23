/**
 * Connection Status Indicator
 * 
 * Displays the current Realtime connection status with visual feedback.
 * Shows connected, connecting, or disconnected states with appropriate colors.
 * 
 * Requirements: 10.4
 */

'use client'

import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface ConnectionStatusIndicatorProps {
  status: 'connected' | 'connecting' | 'disconnected'
  onReconnect?: () => void
  className?: string
}

/**
 * Connection Status Indicator Component
 * 
 * Displays connection status with icon and text.
 * Provides reconnect button when disconnected.
 */
export function ConnectionStatusIndicator({
  status,
  onReconnect,
  className = '',
}: ConnectionStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Connected',
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600 text-white',
        }
      case 'connecting':
        return {
          icon: Loader2,
          text: 'Connecting...',
          variant: 'secondary' as const,
          className: 'bg-yellow-400 hover:bg-yellow-500 text-black',
          animate: true,
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          text: 'Disconnected',
          variant: 'destructive' as const,
          className: 'bg-red-500 hover:bg-red-600 text-white',
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge className={config.className}>
        <Icon
          className={`h-3 w-3 mr-1 ${config.animate ? 'animate-spin' : ''}`}
        />
        {config.text}
      </Badge>

      {status === 'disconnected' && onReconnect && (
        <Button
          size="sm"
          variant="outline"
          onClick={onReconnect}
          className="h-6 text-xs border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
        >
          Reconnect
        </Button>
      )}
    </div>
  )
}

/**
 * Compact Connection Status Indicator
 * 
 * Shows only an icon with tooltip for minimal UI footprint.
 */
export function CompactConnectionStatusIndicator({
  status,
  onReconnect,
  className = '',
}: ConnectionStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-500',
          title: 'Connected',
        }
      case 'connecting':
        return {
          icon: Loader2,
          color: 'text-yellow-400',
          title: 'Connecting...',
          animate: true,
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-500',
          title: 'Disconnected - Click to reconnect',
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  const handleClick = () => {
    if (status === 'disconnected' && onReconnect) {
      onReconnect()
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status !== 'disconnected'}
      title={config.title}
      className={`${config.color} ${
        status === 'disconnected' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
      } ${className}`}
    >
      <Icon
        className={`h-4 w-4 ${config.animate ? 'animate-spin' : ''}`}
      />
    </button>
  )
}
