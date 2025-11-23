"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, UserCog } from "lucide-react"
import type { User } from "@/lib/graphql/types"

interface RoleChangeDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (newRole: User['role']) => Promise<void>
}

export function RoleChangeDialog({
  user,
  open,
  onOpenChange,
  onConfirm
}: RoleChangeDialogProps) {
  const [newRole, setNewRole] = useState<User['role'] | ''>('')
  const [isChanging, setIsChanging] = useState(false)

  // Reset newRole when dialog opens with a new user
  useEffect(() => {
    if (open && user) {
      setNewRole('')
    }
  }, [open, user])

  if (!user) return null

  const handleConfirm = async () => {
    if (!newRole || newRole === user.role) return

    setIsChanging(true)
    try {
      await onConfirm(newRole)
      onOpenChange(false)
      setNewRole('')
    } finally {
      setIsChanging(false)
    }
  }

  const formatRoleLabel = (role: User['role']) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const getRoleDescription = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'Full system access, can manage users and verify clients'
      case 'client':
        return 'Can create and manage projects, requires verification'
      case 'bidding_lead':
        return 'Can create proposals and manage bidding teams'
      case 'bidding_member':
        return 'Can contribute to proposals under a lead'
      case 'content_coordinator':
        return 'Can coordinate content across projects'
      default:
        return ''
    }
  }

  const getRoleBadgeColor = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-400 text-black hover:bg-yellow-500'
      case 'client':
        return 'bg-blue-500 text-white hover:bg-blue-600'
      case 'bidding_lead':
        return 'bg-green-500 text-white hover:bg-green-600'
      case 'bidding_member':
        return 'bg-purple-500 text-white hover:bg-purple-600'
      case 'content_coordinator':
        return 'bg-orange-500 text-white hover:bg-orange-600'
      default:
        return 'bg-gray-500 text-white hover:bg-gray-600'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Change User Role
          </DialogTitle>
          <DialogDescription>
            Change the role for {user.email}. This will immediately update their permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Role */}
          <div className="border border-yellow-400/20 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Current Role</div>
            <Badge className={getRoleBadgeColor(user.role)}>
              {formatRoleLabel(user.role)}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {getRoleDescription(user.role)}
            </p>
          </div>

          {/* New Role Selection */}
          <div className="space-y-2">
            <label htmlFor="new-role" className="text-sm font-medium">New Role</label>
            <Select value={newRole} onValueChange={(value) => setNewRole(value as User['role'])}>
              <SelectTrigger id="new-role" aria-label="Select new role">
                <SelectValue placeholder="Select a new role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="bidding_lead">Bidding Lead</SelectItem>
                <SelectItem value="bidding_member">Bidding Member</SelectItem>
                <SelectItem value="content_coordinator">Content Coordinator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {newRole && newRole !== user.role && (
              <p className="text-sm text-muted-foreground" role="status">
                {getRoleDescription(newRole)}
              </p>
            )}
          </div>

          {/* Warning */}
          <div className="border border-yellow-400/20 bg-yellow-400/5 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Important</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Permissions will be updated immediately</li>
                  <li>• User will need to re-authenticate on their next action</li>
                  <li>• This action will be logged in the audit trail</li>
                  {newRole === 'client' && user.verificationStatus !== 'verified' && (
                    <li className="text-yellow-400">• User will need verification to create projects</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setNewRole('')
            }}
            disabled={isChanging}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isChanging || !newRole || newRole === user.role}
            className="bg-yellow-400 hover:bg-yellow-500 text-black w-full sm:w-auto"
          >
            {isChanging ? 'Changing...' : 'Change Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
