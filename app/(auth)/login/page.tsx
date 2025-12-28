import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
    title: "Sign In - BidSync",
    description: "Sign in to your BidSync account",
}

export default function AuthenticationPage() {
    return (
        <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
            <Link
                href="/register"
                className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "absolute right-4 top-4 md:right-8 md:top-8 hover:bg-yellow-400/10 hover:text-yellow-400"
                )}
            >
                Register
            </Link>
            <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
                <div className="absolute inset-0 bg-black bg-[url('/bg.png')] bg-cover bg-center bg-no-repeat" />
                <div className="relative z-20 flex items-center text-lg font-medium">
                    <div className="mr-2 h-12 w-12 roundedflex items-center justify-center relative">
                        <Image
                            src="/logo.png"
                            alt="BidSync Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <span className="text-white">BidSync</span>
                </div>
                <div className="relative z-20 mt-auto">
                    <blockquote className="space-y-2">
                        <p className="text-lg">
                            &ldquo;BidSync has transformed how we manage proposals and collaborate with our team. The platform is intuitive and powerful.&rdquo;
                        </p>
                        <footer className="text-sm text-yellow-400">— Project Manager</footer>
                    </blockquote>
                </div>
            </div>
            <div className="lg:p-8">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-white">
                            Sign in to your account
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Enter your email below to sign in. Don't have an account?{" "}
                            <Link href="/register" className="underline underline-offset-4 hover:text-yellow-400 text-yellow-400">
                                Register here
                            </Link>
                        </p>
                    </div>
                    <LoginForm />
                    <p className="px-8 text-center text-sm text-muted-foreground">
                        By clicking continue, you agree to our{" "}
                        <Link
                            href="/terms"
                            className="underline underline-offset-4 hover:text-yellow-400"
                        >
                            Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                            href="/privacy"
                            className="underline underline-offset-4 hover:text-yellow-400"
                        >
                            Privacy Policy
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </div>
    )
}
