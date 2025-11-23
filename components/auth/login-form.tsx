"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, Controller } from "react-hook-form"
import * as z from "zod"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { createClient } from "@/lib/supabase/client"

const formSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
})

const otpSchema = z.object({
    otp: z.string().min(8, {
        message: "Your one-time password must be 8 characters.",
    }),
})

interface LoginFormProps extends React.HTMLAttributes<HTMLDivElement> { }

export function LoginForm({ className, ...props }: LoginFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = React.useState<boolean>(false)
    const [error, setError] = React.useState<string | null>(null)
    const [showOTP, setShowOTP] = React.useState<boolean>(false)
    const [email, setEmail] = React.useState<string>("")
    const [emailCheckLoading, setEmailCheckLoading] = React.useState<boolean>(false)
    const [emailError, setEmailError] = React.useState<string | null>(null)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
    })

    // Check if email exists when user finishes typing
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

            if (!data.exists) {
                setEmailError('This email is not registered. Please sign up first.')
            }
        } catch (error) {
            console.error('Error checking email:', error)
        } finally {
            setEmailCheckLoading(false)
        }
    }, [])

    // Debounce email check
    React.useEffect(() => {
        const emailValue = form.watch('email')
        const timer = setTimeout(() => {
            if (emailValue) {
                checkEmailExists(emailValue)
            }
        }, 800)

        return () => clearTimeout(timer)
    }, [form.watch('email'), checkEmailExists])

    const otpForm = useForm<z.infer<typeof otpSchema>>({
        resolver: zodResolver(otpSchema),
        defaultValues: {
            otp: "",
        },
    })

    async function onEmailSubmit(values: z.infer<typeof formSchema>) {
        // Check if email exists before sending OTP
        if (emailError) {
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            // Double-check email exists
            const checkResponse = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: values.email }),
            })

            const checkData = await checkResponse.json()

            if (!checkData.exists) {
                setError('This email is not registered. Please sign up first.')
                setIsLoading(false)
                return
            }

            const supabase = createClient()
            const { error } = await supabase.auth.signInWithOtp({
                email: values.email,
                options: {
                    shouldCreateUser: false, // Don't create user on sign in
                }
            })

            if (error) {
                setIsLoading(false)
                setError(error.message)
                return
            }

            setEmail(values.email)
            setShowOTP(true)
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

        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
            setIsLoading(false)
            setError(userError?.message || "Error fetching user profile")
            return
        }

        const role = user.user_metadata?.role

        if (role === 'admin') {
            router.push("/admin-dashboard")
        } else if (role === 'client') {
            router.push("/projects")
        } else if (role === 'bidding_lead') {
            router.push("/lead-dashboard")
        } else if (role === 'bidding_member') {
            router.push("/")
        } else {
            // Default fallback
            router.push("/")
        }

        router.refresh()
    }

    return (
        <div className={cn("grid gap-6", className)} {...props}>
            {!showOTP ? (
                <form onSubmit={form.handleSubmit(onEmailSubmit)}>
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
                                {...form.register("email")}
                            />
                            {form.formState.errors.email && (
                                <p className="text-sm text-red-500">
                                    {form.formState.errors.email.message}
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
                            Sign In with Email
                        </Button>
                    </div>
                </form>
            ) : (
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
                        <div className="flex flex-col gap-2">
                            <Button
                                variant="link"
                                type="button"
                                disabled={isLoading}
                                className="px-0 font-normal text-yellow-400 hover:text-yellow-500"
                                onClick={() => onEmailSubmit({ email })}
                            >
                                Resend OTP
                            </Button>
                            <Button
                                variant="ghost"
                                type="button"
                                disabled={isLoading}
                                onClick={() => {
                                    setShowOTP(false)
                                    setError(null)
                                    otpForm.reset()
                                }}
                            >
                                Back to Email
                            </Button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    )
}
