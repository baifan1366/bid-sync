"use client"

import * as React from "react"
import { useRole } from "@/lib/auth/use-role"
import { UserRole } from "@/lib/roles/constants"

interface RoleGuardProps {
    children: React.ReactNode
    allowedRoles: UserRole[]
    fallback?: React.ReactNode
}

export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
    const { role, loading } = useRole()

    if (loading) {
        return null // Or a loading spinner
    }

    if (role && allowedRoles.includes(role)) {
        return <>{children}</>
    }

    return <>{fallback}</>
}
