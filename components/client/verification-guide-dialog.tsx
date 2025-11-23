"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertCircle, CheckCircle, Clock, Mail } from "lucide-react"

interface VerificationGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  verificationStatus?: string
}

export function VerificationGuideDialog({ 
  open, 
  onOpenChange,
  verificationStatus = 'pending_verification'
}: VerificationGuideDialogProps) {
  
  const getStatusContent = () => {
    switch (verificationStatus) {
      case 'verified':
        return {
          icon: CheckCircle,
          iconColor: "text-green-500",
          title: "Account Verified",
          description: "Your account has been verified. You can now create projects.",
        }
      case 'rejected':
        return {
          icon: AlertCircle,
          iconColor: "text-red-500",
          title: "Verification Rejected",
          description: "Your account verification was not approved. Please contact our support team for more information and guidance on next steps.",
          steps: [
            "Review the rejection reason in your email notification",
            "Contact support at edusocial0704@gmail.com",
            "Provide any additional documentation if requested",
            "Wait for the support team to review your case"
          ]
        }
      default:
        return {
          icon: Clock,
          iconColor: "text-yellow-400",
          title: "Account Verification Required",
          description: "Your account must be verified by a Content Coordinator before you can create projects. This helps us maintain quality and security on our platform.",
          steps: [
            "Your registration has been submitted for review",
            "A Content Coordinator will review your account details",
            "You will receive an email notification once verified",
            "Verification typically takes 1-2 business days"
          ]
        }
    }
  }

  const content = getStatusContent()
  const Icon = content.icon

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-full bg-yellow-400/10`}>
              <Icon className={`h-6 w-6 ${content.iconColor}`} />
            </div>
            <AlertDialogTitle className="text-xl">
              {content.title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-4">
            <p className="text-base">
              {content.description}
            </p>
            
            {content.steps && (
              <div className="space-y-3 pt-2">
                <p className="font-medium text-black dark:text-white">
                  What happens next:
                </p>
                <ol className="space-y-2">
                  {content.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-black text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {verificationStatus === 'pending_verification' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20 mt-4">
                <Mail className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-sm">
                  <span className="font-medium text-black dark:text-white">Need help?</span>
                  {" "}Contact us at{" "}
                  <a 
                    href="mailto:edusocial0704@gmail.com" 
                    className="text-yellow-400 hover:underline"
                  >
                    edusocial0704@gmail.com
                  </a>
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={() => onOpenChange(false)}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            I Understand
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
