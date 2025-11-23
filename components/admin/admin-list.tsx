"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RemoveAdminDialog } from "./remove-admin-dialog"
import { UserMinus, Mail, Calendar, Clock } from "lucide-react"
import type { Admin } from "@/lib/graphql/types"

interface AdminListProps {
  admins: Admin[]
  currentAdminId: string
  onRemoveAdmin: (adminId: string) => Promise<void>
  searchQuery?: string
}

export function AdminList({ admins, currentAdminId, onRemoveAdmin, searchQuery = "" }: AdminListProps) {
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)

  // Filter admins based on search query
  const filteredAdmins = admins.filter(admin => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      admin.email.toLowerCase().includes(query) ||
      admin.fullName?.toLowerCase().includes(query)
    )
  })

  const handleRemoveClick = (admin: Admin) => {
    setSelectedAdmin(admin)
    setRemoveDialogOpen(true)
  }

  const handleRemoveConfirm = async () => {
    if (!selectedAdmin) return
    await onRemoveAdmin(selectedAdmin.id)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return "Today"
    if (diffInDays === 1) return "Yesterday"
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`
    return `${Math.floor(diffInDays / 365)} years ago`
  }

  if (filteredAdmins.length === 0) {
    return (
      <div className="text-center py-12" role="status">
        <p className="text-muted-foreground">
          {searchQuery ? "No administrators found matching your search." : "No administrators found."}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Administrator list">
        {filteredAdmins.map((admin) => {
          const isSelf = admin.id === currentAdminId
          const isLastAdmin = admins.length === 1

          return (
            <Card 
              key={admin.id} 
              className="border-yellow-400/20 hover:border-yellow-400/40 transition-colors"
              role="listitem"
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">
                        {admin.fullName || "Admin User"}
                      </h3>
                      {isSelf && (
                        <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{admin.email}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Joined:</span>
                    <span>{formatDate(admin.createdAt)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Last login:</span>
                    <span>{formatRelativeTime(admin.lastLoginAt)}</span>
                  </div>

                  {admin.invitedBy && (
                    <div className="text-sm text-muted-foreground">
                      Invited by: {admin.invitedBy}
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full min-h-[44px]"
                  onClick={() => handleRemoveClick(admin)}
                  disabled={isSelf || isLastAdmin}
                  aria-label={`Remove admin privileges from ${admin.email}`}
                >
                  <UserMinus className="h-4 w-4 mr-2" aria-hidden="true" />
                  Remove Admin
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedAdmin && (
        <RemoveAdminDialog
          admin={selectedAdmin}
          open={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
          onConfirm={handleRemoveConfirm}
          isLastAdmin={admins.length === 1}
          isSelf={selectedAdmin.id === currentAdminId}
        />
      )}
    </>
  )
}
