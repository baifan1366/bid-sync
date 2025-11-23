"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface AddAdminDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvite: (email: string) => Promise<void>
}

export function AddAdminDialog({ open, onOpenChange, onInvite }: AddAdminDialogProps) {
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  // Focus email input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        emailInputRef.current?.focus()
      }, 0)
    }
  }, [open])

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)

    try {
      await onInvite(email)
      
      toast({
        title: "Invitation sent",
        description: `Admin invitation has been sent to ${email}`,
      })
      
      // Close dialog and reset form
      onOpenChange(false)
      setEmail("")
    } catch (error: any) {
      const errorMessage = error.message || "Failed to send invitation"
      setError(errorMessage)
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Invite New Administrator</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new administrator to the platform.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                ref={emailInputRef}
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                required
                className={error ? "border-red-500" : ""}
                aria-invalid={!!error}
                aria-describedby={error ? "email-error" : undefined}
              />
              {error && (
                <p id="email-error" className="text-sm text-red-500" role="alert">{error}</p>
              )}
            </div>
            
            <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-4">
              <h4 className="text-sm font-medium mb-2">Invitation Preview</h4>
              <p className="text-sm text-muted-foreground">
                The recipient will receive an email with a secure link to complete their admin registration. 
                The invitation will expire in 7 days.
              </p>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                setEmail("")
                setError(null)
              }}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !email}
              className="bg-yellow-400 hover:bg-yellow-500 text-black w-full sm:w-auto"
            >
              {isSubmitting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
