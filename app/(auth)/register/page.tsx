import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { RegisterForm } from "@/components/auth/register-form"

export const metadata: Metadata = {
    title: "Create Account - BidSync",
    description: "Create your BidSync account",
}

export default function RegisterPage() {
    return (
        <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
            <Link
                href="/login"
                className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "absolute right-4 top-4 md:right-8 md:top-8 hover:bg-yellow-400/10 hover:text-yellow-400"
                )}
            >
                Login
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
                            &ldquo;BidSync has transformed how we manage project proposals,
                            making collaboration seamless and efficient.&rdquo;
                        </p>
                        <footer className="text-sm text-yellow-400">— Alex Chen, Project Lead</footer>
                    </blockquote>
                </div>
            </div>
            <div className="lg:p-8">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px]">
                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-white">
                            Create an account
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Enter your email to get started with BidSync
                        </p>
                    </div>
                    <RegisterForm />
                    <p className="px-8 text-center text-sm text-muted-foreground">
                        By creating an account, you agree to our{" "}
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
