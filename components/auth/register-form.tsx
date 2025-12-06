"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import * as z from "zod"
import { Loader2, ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { RoleSelector } from "@/components/auth/role-selector"
import { ClientTypeSelector } from "@/components/auth/client-type-selector"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/lib/roles/constants"
import type { ClientType } from "@/lib/roles/constants"
import type { RegistrationData } from "@/types/registration"

const emailSchema = z.object({
    email: z.string().email("Please enter a valid email address."),
})

const otpSchema = z.object({
    otp: z.string().min(8, "Your one-time password must be 8 characters."),
})

type Step = 'email' | 'otp' | 'role' | 'profile'

interface RegisterFormProps extends React.HTMLAttributes<HTMLDivElement> {
    invitationCode?: string
}

export function RegisterForm({ className, invitationCode, ...props }: RegisterFormProps) {
    const router = useRouter()
    const [step, setStep] = React.useState<Step>('email')
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [email, setEmail] = React.useState("")
    const [selectedRole, setSelectedRole] = React.useState<UserRole | null>(null)
    const [clientType, setClientType] = React.useState<ClientType | null>(null)
    const [emailCheckLoading, setEmailCheckLoading] = React.useState<boolean>(false)
    const [emailError, setEmailError] = React.useState<string | null>(null)

    const emailForm = useForm<z.infer<typeof emailSchema>>({
        resolver: zodResolver(emailSchema),
        defaultValues: { email: "" },
    })

    // Check if email already exists when user finishes typing
    const checkEmailExists = React.useCallback(async (emailValue: string) => {
        if (!emailValue || !emailValue.includes('@')) {
            setEmailError(null)
            return
        }

        setEmailCheckLoading(true)
        setEmailError(null)

        try {
            const response = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailValue }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to check email')
            }

            if (data.exists) {
                setEmailError('This email is already registered. Please sign in instead.')
            }
        } catch (error) {
            console.error('Error checking email:', error)
        } finally {
            setEmailCheckLoading(false)
        }
    }, [])

    // Debounce email check
    React.useEffect(() => {
        const emailValue = emailForm.watch('email')
        const timer = setTimeout(() => {
            if (emailValue) {
                checkEmailExists(emailValue)
            }
        }, 800)

        return () => clearTimeout(timer)
    }, [emailForm.watch('email'), checkEmailExists])

    const otpForm = useForm<z.infer<typeof otpSchema>>({
        resolver: zodResolver(otpSchema),
        defaultValues: { otp: "" },
    })

    const profileForm = useForm({
        defaultValues: {
            full_name: "",
            business_name: "",
            company_registration: "",
            professional_title: "",
            company_name: "",
        },
    })

    async function onEmailSubmit(values: z.infer<typeof emailSchema>) {
        // Check if email already exists before sending OTP
        if (emailError) {
            return
        }

        setIsLoading(true)
        setError(null)
        setEmailError(null) // Clear email error when submitting

        try {
            // Double-check email doesn't exist
            const checkResponse = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: values.email }),
            })

            const checkData = await checkResponse.json()

            if (checkData.exists) {
                setEmailError('This email is already registered. Please sign in instead.')
                setIsLoading(false)
                return
            }

            const supabase = createClient()
            const { error } = await supabase.auth.signInWithOtp({
                email: values.email,
                options: { shouldCreateUser: true }
            })

            if (error) {
                setIsLoading(false)
                setError(error.message)
                return
            }

            setEmail(values.email)
            setStep('otp')
            setIsLoading(false)
        } catch (error) {
            setIsLoading(false)
            setError('Failed to send OTP. Please try again.')
        }
    }

    async function onOTPSubmit(values: z.infer<typeof otpSchema>) {
        setIsLoading(true)
        setError(null)

        const supabase = createClient()
        const { error } = await supabase.auth.verifyOtp({
            email,
            token: values.otp,
            type: 'email',
        })

        if (error) {
            setIsLoading(false)
            setError(error.message)
            return
        }

        if (invitationCode) {
            setSelectedRole('bidding_member')
            setStep('profile')
        } else {
            setStep('role')
        }
        setIsLoading(false)
    }

    async function onRoleSelect(role: UserRole) {
        setSelectedRole(role)
        setStep('profile')
    }

    async function onProfileSubmit(values: any) {
        setIsLoading(true)
        setError(null)

        if (!selectedRole) {
            setError("Please select a role")
            setIsLoading(false)
            return
        }

        try {
            let registrationData: RegistrationData

            if (selectedRole === 'client') {
                if (!clientType) {
                    setError("Please select a client type")
                    setIsLoading(false)
                    return
                }

                registrationData = {
                    role: 'client',
                    client_type: clientType,
                    full_name: values.full_name,
                    business_name: values.business_name,
                    company_registration: values.company_registration,
                }
            } else if (selectedRole === 'bidding_lead' || selectedRole === 'bidding_member') {
                registrationData = {
                    role: selectedRole,
                    full_name: values.full_name,
                    professional_title: values.professional_title,
                    company_name: values.company_name,
                }
            } else {
                setError("Invalid role selected")
                setIsLoading(false)
                return
            }

            const response = await fetch('/api/auth/complete-registration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to complete registration')
            }

            // If joining via invitation, join the team
            if (invitationCode) {
                const joinResponse = await fetch('/api/team/join', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code_or_token: invitationCode }),
                })

                if (!joinResponse.ok) {
                    console.error('Failed to join team')
                }
            }

            // Redirect based on role
            if (selectedRole === 'client') {
                router.push("/projects")
            } else if (selectedRole === 'bidding_lead') {
                router.push("/lead-dashboard")
            } else if (selectedRole === 'bidding_member') {
                router.push("/")
            } else {
                router.push("/")
            }

            router.refresh()
        } catch (error) {
            setIsLoading(false)
            setError(error instanceof Error ? error.message : 'Unknown error')
        }
    }

    return (
        <div className={cn("grid gap-6", className)} {...props}>
            {step === 'email' && (
                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)}>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                placeholder="name@example.com"
                                type="email"
                                autoCapitalize="none"
                                autoComplete="email"
                                autoCorrect="off"
                                disabled={isLoading}
                                {...emailForm.register("email")}
                            />
                            {emailForm.formState.errors.email && (
                                <p className="text-sm text-red-500">
                                    {emailForm.formState.errors.email.message}
                                </p>
                            )}
                            {emailCheckLoading && (
                                <p className="text-sm text-muted-foreground">
                                    Checking email...
                                </p>
                            )}
                            {emailError && (
                                <p className="text-sm text-red-500">
                                    {emailError}
                                </p>
                            )}
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <Button 
                            disabled={isLoading || emailCheckLoading || !!emailError}
                            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                        >
                            {isLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Continue with Email
                        </Button>
                    </div>
                </form>
            )}

            {step === 'otp' && (
                <form onSubmit={otpForm.handleSubmit(onOTPSubmit)}>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="otp">One-Time Password</Label>
                            <div className="flex justify-center">
                                <Controller
                                    control={otpForm.control}
                                    name="otp"
                                    render={({ field }) => (
                                        <InputOTP maxLength={8} {...field}>
                                            <InputOTPGroup>
                                                <InputOTPSlot index={0} />
                                                <InputOTPSlot index={1} />
                                                <InputOTPSlot index={2} />
                                                <InputOTPSlot index={3} />
                                                <InputOTPSlot index={4} />
                                                <InputOTPSlot index={5} />
                                                <InputOTPSlot index={6} />
                                                <InputOTPSlot index={7} />
                                            </InputOTPGroup>
                                        </InputOTP>
                                    )}
                                />
                            </div>
                            {otpForm.formState.errors.otp && (
                                <p className="text-sm text-red-500 text-center">
                                    {otpForm.formState.errors.otp.message}
                                </p>
                            )}
                        </div>
                        <div className="text-center text-sm text-muted-foreground">
                            Sent to {email}
                        </div>
                        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                        <Button 
                            disabled={isLoading}
                            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                        >
                            {isLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Verify OTP
                        </Button>
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={() => setStep('email')}
                            disabled={isLoading}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Email
                        </Button>
                    </div>
                </form>
            )}

            {step === 'role' && (
                <div className="grid gap-4">
                    <div className="text-center">
                        <h3 className="text-lg font-semibold">Select Your Role</h3>
                        <p className="text-sm text-muted-foreground">
                            Choose how you'll be using BidSync
                        </p>
                    </div>
                    <RoleSelector
                        selectedRole={selectedRole}
                        onSelectRole={onRoleSelect}
                        disabled={isLoading}
                    />
                </div>
            )}

            {step === 'profile' && selectedRole && (
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                    <div className="grid gap-4">
                        <div className="text-center">
                            <h3 className="text-lg font-semibold">Complete Your Profile</h3>
                            <p className="text-sm text-muted-foreground">
                                Tell us a bit about yourself
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="full_name">
                                Full Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="full_name"
                                placeholder="John Doe"
                                disabled={isLoading}
                                {...profileForm.register("full_name")}
                                required
                            />
                        </div>

                        {selectedRole === 'client' && (
                            <ClientTypeSelector
                                clientType={clientType}
                                onClientTypeChange={setClientType}
                                businessName={profileForm.watch("business_name")}
                                onBusinessNameChange={(value: string) => profileForm.setValue("business_name", value)}
                                companyRegistration={profileForm.watch("company_registration")}
                                onCompanyRegistrationChange={(value: string) => profileForm.setValue("company_registration", value)}
                                disabled={isLoading}
                            />
                        )}

                        {(selectedRole === 'bidding_lead' || selectedRole === 'bidding_member') && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="professional_title">Professional Title</Label>
                                    <Input
                                        id="professional_title"
                                        placeholder="Senior Engineer"
                                        disabled={isLoading}
                                        {...profileForm.register("professional_title")}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="company_name">Company / Organization</Label>
                                    <Input
                                        id="company_name"
                                        placeholder="Tech Corp"
                                        disabled={isLoading}
                                        {...profileForm.register("company_name")}
                                    />
                                </div>
                            </>
                        )}

                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <Button 
                            disabled={isLoading} 
                            type="submit"
                            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                        >
                            {isLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Complete Registration
                        </Button>
                        {!invitationCode && (
                            <Button
                                variant="ghost"
                                type="button"
                                onClick={() => setStep('role')}
                                disabled={isLoading}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Role Selection
                            </Button>
                        )}
                    </div>
                </form>
            )}
        </div>
    )
}
