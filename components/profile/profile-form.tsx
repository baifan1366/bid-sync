"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { UserProfileData, ProfileUpdateData } from "@/types/user"

interface ProfileFormProps {
    profile: UserProfileData
    onSuccess?: () => void
}

// Define validation schema
const profileSchema = z.object({
    full_name: z.string().min(2, "Full name must be at least 2 characters"),
    professional_title: z.string().optional(),
    company_name: z.string().optional(),
    business_name: z.string().optional(),
    company_registration: z.string().optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

export function ProfileForm({ profile, onSuccess }: ProfileFormProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isLoading, setIsLoading] = React.useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            full_name: profile.full_name,
            professional_title: profile.role === 'bidding_lead' || profile.role === 'bidding_member'
                ? profile.professional_title || ''
                : undefined,
            company_name: profile.role === 'bidding_lead' || profile.role === 'bidding_member'
                ? profile.company_name || ''
                : undefined,
            business_name: profile.role === 'client' ? profile.business_name || '' : undefined,
            company_registration: profile.role === 'client' ? profile.company_registration || '' : undefined,
        },
    })

    const onSubmit = async (data: ProfileFormData) => {
        setIsLoading(true)

        try {
            // Build update payload
            const updateData: ProfileUpdateData = {
                full_name: data.full_name,
            }

            // Add role-specific fields
            if (profile.role === 'client') {
                if (data.business_name) updateData.business_name = data.business_name
                if (data.company_registration) updateData.company_registration = data.company_registration
            } else if (profile.role === 'bidding_lead' || profile.role === 'bidding_member') {
                if (data.professional_title) updateData.professional_title = data.professional_title
                if (data.company_name) updateData.company_name = data.company_name
            }

            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to update profile')
            }

            toast({
                title: "Success",
                description: "Your profile has been updated successfully.",
            })

            // Call success callback if provided
            if (onSuccess) {
                onSuccess()
            } else {
                // Navigate back to profile page
                router.push('/profile')
                router.refresh()
            }
        } catch (error) {
            console.error('Error updating profile:', error)
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to update profile",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                    id="full_name"
                    {...register("full_name")}
                    disabled={isLoading}
                />
                {errors.full_name && (
                    <p className="text-sm text-destructive">{errors.full_name.message}</p>
                )}
            </div>

            {/* Client-specific fields */}
            {profile.role === 'client' && profile.client_type === 'business' && (
                <>
                    <div className="space-y-2">
                        <Label htmlFor="business_name">Business Name</Label>
                        <Input
                            id="business_name"
                            {...register("business_name")}
                            disabled={isLoading}
                        />
                        {errors.business_name && (
                            <p className="text-sm text-destructive">{errors.business_name.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="company_registration">Company Registration Number</Label>
                        <Input
                            id="company_registration"
                            {...register("company_registration")}
                            disabled={isLoading}
                        />
                        {errors.company_registration && (
                            <p className="text-sm text-destructive">{errors.company_registration.message}</p>
                        )}
                    </div>
                </>
            )}

            {/* Bidding team specific fields */}
            {(profile.role === 'bidding_lead' || profile.role === 'bidding_member') && (
                <>
                    <div className="space-y-2">
                        <Label htmlFor="professional_title">Professional Title</Label>
                        <Input
                            id="professional_title"
                            placeholder="e.g., Senior Engineer, Project Manager"
                            {...register("professional_title")}
                            disabled={isLoading}
                        />
                        {errors.professional_title && (
                            <p className="text-sm text-destructive">{errors.professional_title.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="company_name">Company Name</Label>
                        <Input
                            id="company_name"
                            {...register("company_name")}
                            disabled={isLoading}
                        />
                        {errors.company_name && (
                            <p className="text-sm text-destructive">{errors.company_name.message}</p>
                        )}
                    </div>
                </>
            )}

            {/* Form Actions */}
            <div className="flex gap-4">
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/profile')}
                    disabled={isLoading}
                >
                    Cancel
                </Button>
            </div>
        </form>
    )
}
