"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserProfileData } from "@/types/user"
import { Mail, User, Briefcase, Building2, FileText } from "lucide-react"

interface ProfileDisplayProps {
    profile: UserProfileData
}

const getRoleBadgeVariant = (role: string) => {
    switch (role) {
        case 'admin':
            return 'destructive'
        case 'client':
            return 'default'
        case 'bidding_lead':
            return 'secondary'
        case 'bidding_member':
            return 'outline'
        default:
            return 'default'
    }
}

const getRoleLabel = (role: string) => {
    switch (role) {
        case 'admin':
            return 'Admin'
        case 'client':
            return 'Client'
        case 'bidding_lead':
            return 'Bidding Lead'
        case 'bidding_member':
            return 'Bidding Member'
        default:
            return role
    }
}

export function ProfileDisplay({ profile }: ProfileDisplayProps) {
    const initials = profile.full_name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || profile.email.substring(0, 2).toUpperCase()

    return (
        <div className="space-y-6">
            {/* Profile Header Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <CardTitle className="text-2xl">{profile.full_name}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                                <Mail className="h-4 w-4" />
                                {profile.email}
                            </CardDescription>
                            <div className="mt-2">
                                <Badge variant={getRoleBadgeVariant(profile.role)}>
                                    {getRoleLabel(profile.role)}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Profile Details Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Your account details and role-specific information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4">
                        {/* Full Name */}
                        <div className="flex items-start gap-3">
                            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">Full Name</p>
                                <p className="text-sm text-muted-foreground">{profile.full_name}</p>
                            </div>
                        </div>

                        {/* Email */}
                        <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">Email Address</p>
                                <p className="text-sm text-muted-foreground">{profile.email}</p>
                            </div>
                        </div>

                        {/* Client-specific fields */}
                        {profile.role === 'client' && (
                            <>
                                <div className="flex items-start gap-3">
                                    <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium">Client Type</p>
                                        <p className="text-sm text-muted-foreground capitalize">
                                            {profile.client_type}
                                        </p>
                                    </div>
                                </div>
                                {profile.client_type === 'business' && profile.business_name && (
                                    <>
                                        <div className="flex items-start gap-3">
                                            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium">Business Name</p>
                                                <p className="text-sm text-muted-foreground">{profile.business_name}</p>
                                            </div>
                                        </div>
                                        {profile.company_registration && (
                                            <div className="flex items-start gap-3">
                                                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium">Company Registration</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {profile.company_registration}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* Bidding team specific fields */}
                        {(profile.role === 'bidding_lead' || profile.role === 'bidding_member') && (
                            <>
                                {profile.professional_title && (
                                    <div className="flex items-start gap-3">
                                        <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium">Professional Title</p>
                                            <p className="text-sm text-muted-foreground">{profile.professional_title}</p>
                                        </div>
                                    </div>
                                )}
                                {profile.company_name && (
                                    <div className="flex items-start gap-3">
                                        <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium">Company Name</p>
                                            <p className="text-sm text-muted-foreground">{profile.company_name}</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
