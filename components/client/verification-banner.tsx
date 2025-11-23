"use client"

import { AlertCircle, Clock, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VerificationBannerProps {
  verificationStatus?: string
  onLearnMore: () => void
}

export function VerificationBanner({ verificationStatus, onLearnMore }: VerificationBannerProps) {
  // Don't show banner if verified
  if (verificationStatus === 'verified') {
    return null
  }

  const getStatusConfig = () => {
    switch (verificationStatus) {
      case 'rejected':
        return {
          icon: AlertCircle,
          bgColor: "bg-red-50 dark:bg-red-950/20",
          borderColor: "border-red-200 dark:border-red-900/50",
          iconColor: "text-red-600 dark:text-red-400",
          textColor: "text-red-900 dark:text-red-100",
          title: "Verification Rejected",
          message: "Your account verification was not approved. Please contact support for assistance.",
        }
      default:
        return {
          icon: Clock,
          bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
          borderColor: "border-yellow-400/30",
          iconColor: "text-yellow-600 dark:text-yellow-400",
          textColor: "text-yellow-900 dark:text-yellow-100",
          title: "Account Verification Required",
          message: "Your account must be verified by a Content Coordinator before you can create projects.",
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div className={`${config.bgColor} border ${config.borderColor} rounded-lg p-4 sm:p-5`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`shrink-0 ${config.iconColor} mt-0.5`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm sm:text-base ${config.textColor}`}>
            {config.title}
          </h3>
          <p className={`mt-1 text-xs sm:text-sm ${config.textColor} opacity-90`}>
            {config.message}
          </p>
        </div>
        <Button
          onClick={onLearnMore}
          variant="outline"
          size="sm"
          className="shrink-0 border-yellow-400/40 hover:bg-yellow-400/10 text-xs sm:text-sm"
        >
          <Info className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
          Learn More
        </Button>
      </div>
    </div>
  )
}
