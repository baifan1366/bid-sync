"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserRole } from "@/lib/roles/constants"

interface RoleSelectorProps {
    selectedRole?: UserRole | null
    onSelectRole: (role: UserRole) => void
    disabled?: boolean
}

interface RoleOption {
    role: UserRole
    title: string
    description: string
    icon: string
}

const roleOptions: RoleOption[] = [
    {
        role: 'client',
        title: 'Client',
        description: 'Post projects, review proposals, and select winning bids',
        icon: '👔',
    },
    {
        role: 'bidding_lead',
        title: 'Bidding Lead',
        description: 'Create teams, manage proposals, and submit bids',
        icon: '🎯',
    },
    {
        role: 'bidding_member',
        title: 'Bidding Member',
        description: 'Join teams and contribute to proposal creation',
        icon: '👥',
    },
]

export function RoleSelector({ selectedRole, onSelectRole, disabled = false }: RoleSelectorProps) {
    return (
        <div className="grid gap-4 sm:grid-cols-3">
            {roleOptions.map((option) => (
                <Card
                    key={option.role}
                    className={cn(
                        "cursor-pointer transition-all hover:border-primary",
                        selectedRole === option.role && "border-primary bg-primary/5",
                        disabled && "cursor-not-allowed opacity-60"
                    )}
                    onClick={() => !disabled && onSelectRole(option.role)}
                >
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="text-4xl">{option.icon}</div>
                            {selectedRole === option.role && (
                                <div className="rounded-full bg-primary p-1">
                                    <Check className="h-4 w-4 text-primary-foreground" />
                                </div>
                            )}
                        </div>
                        <CardTitle>{option.title}</CardTitle>
                        <CardDescription>{option.description}</CardDescription>
                    </CardHeader>
                </Card>
            ))}
        </div>
    )
}
