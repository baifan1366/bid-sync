"use client"

import * as React from "react"
import { Copy, Link as LinkIcon, Hash, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { formatInvitationCode } from "@/lib/auth/registration"
import type { TeamInvitation, CreateInvitationResponse } from "@/types/registration"

interface InvitationManagerProps {
    projectId: string
}

export function InvitationManager({ projectId }: InvitationManagerProps) {
    const { toast } = useToast()
    const [invitations, setInvitations] = React.useState<TeamInvitation[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [isCreating, setIsCreating] = React.useState(false)

    React.useEffect(() => {
        loadInvitations()
    }, [projectId])

    async function loadInvitations() {
        try {
            setIsLoading(true)
            const response = await fetch(`/api/team/invite?project_id=${projectId}`)
            if (response.ok) {
                const data = await response.json()
                setInvitations(data.invitations || [])
            }
        } catch (error) {
            console.error('Failed to load invitations:', error)
        } finally {
            setIsLoading(false)
        }
    }

    async function createInvitation(type: 'link' | 'code') {
        try {
            setIsCreating(true)
            const response = await fetch('/api/team/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    type,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to create invitation')
            }

            const data: CreateInvitationResponse = await response.json()

            // Copy to clipboard
            const textToCopy = type === 'link'
                ? data.share_url!
                : data.display_code!

            await navigator.clipboard.writeText(textToCopy)

            toast({
                title: "Invitation created!",
                description: `${type === 'link' ? 'Link' : 'Code'} copied to clipboard`,
            })

            loadInvitations()
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create invitation",
                variant: "destructive",
            })
        } finally {
            setIsCreating(false)
        }
    }

    async function deleteInvitation(id: string) {
        try {
            const response = await fetch(`/api/team/invite/${id}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                throw new Error('Failed to delete invitation')
            }

            toast({
                title: "Invitation revoked",
                description: "The invitation has been deleted",
            })

            loadInvitations()
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete invitation",
                variant: "destructive",
            })
        }
    }

    async function copyToClipboard(invitation: TeamInvitation, type: 'link' | 'code') {
        const text = type === 'link'
            ? `${window.location.origin}/join/${invitation.token}`
            : formatInvitationCode(invitation.code)

        await navigator.clipboard.writeText(text)

        toast({
            title: "Copied!",
            description: `Invitation ${type} copied to clipboard`,
        })
    }

    function getInvitationStatus(invitation: TeamInvitation): 'active' | 'expired' | 'used' {
        const now = new Date()
        const expiresAt = new Date(invitation.expires_at)

        if (now > expiresAt) return 'expired'
        if (invitation.used_by && !invitation.is_multi_use) return 'used'
        return 'active'
    }

    const activeInvitations = invitations.filter(inv => getInvitationStatus(inv) === 'active')
    const inactiveInvitations = invitations.filter(inv => getInvitationStatus(inv) !== 'active')

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Team Invitations</CardTitle>
                    <CardDescription>
                        Invite team members to collaborate on this project
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button
                            onClick={() => createInvitation('link')}
                            disabled={isCreating}
                            className="flex-1"
                        >
                            {isCreating ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <LinkIcon className="mr-2 h-4 w-4" />
                            )}
                            Generate Link
                        </Button>
                        <Button
                            onClick={() => createInvitation('code')}
                            disabled={isCreating}
                            variant="outline"
                            className="flex-1"
                        >
                            {isCreating ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Hash className="mr-2 h-4 w-4" />
                            )}
                            Generate Code
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : (
                <>
                    {activeInvitations.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold">Active Invitations</h3>
                            <div className="space-y-2">
                                {activeInvitations.map((invitation) => (
                                    <Card key={invitation.id}>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                                                            {formatInvitationCode(invitation.code)}
                                                        </code>
                                                        {invitation.is_multi_use && (
                                                            <Badge variant="secondary">Multi-use</Badge>
                                                        )}
                                                        {invitation.used_by && (
                                                            <Badge variant="outline">Used</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Expires: {new Date(invitation.expires_at).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => copyToClipboard(invitation, 'link')}
                                                    >
                                                        <LinkIcon className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => copyToClipboard(invitation, 'code')}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => deleteInvitation(invitation.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {inactiveInvitations.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-muted-foreground">
                                Expired / Used Invitations
                            </h3>
                            <div className="space-y-2">
                                {inactiveInvitations.map((invitation) => (
                                    <Card key={invitation.id} className="opacity-60">
                                        <CardContent className="pt-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                                                            {formatInvitationCode(invitation.code)}
                                                        </code>
                                                        <Badge variant="secondary">
                                                            {getInvitationStatus(invitation)}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {invitation.used_at
                                                            ? `Used: ${new Date(invitation.used_at).toLocaleString()}`
                                                            : `Expired: ${new Date(invitation.expires_at).toLocaleString()}`}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => deleteInvitation(invitation.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {invitations.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-8">
                            No invitations yet. Create one to invite team members.
                        </p>
                    )}
                </>
            )}
        </div>
    )
}
