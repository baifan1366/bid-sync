"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { JOIN_TEAM } from "@/lib/graphql/mutations"
import { VALIDATE_INVITATION } from "@/lib/graphql/queries"
import { useUser } from "@/hooks/use-user"
import {
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Hash,
  Users,
  ArrowRight,
} from "lucide-react"
import { cn, formatDate } from "@/lib/utils"

interface InvitationJoinPageProps {
  token?: string
}

interface ValidationResult {
  valid: boolean
  invitation?: {
    id: string
    projectId: string
    code: string
    token: string
    expiresAt: string
    isMultiUse: boolean
    usedAt?: string
  }
  error?: string
}

export function InvitationJoinPage({ token }: InvitationJoinPageProps) {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { toast } = useToast()
  const [codeInput, setCodeInput] = useState("")
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(
    null
  )
  const [isValidating, setIsValidating] = useState(false)
  const [hasValidated, setHasValidated] = useState(false)

  // Validate token on mount if provided
  useEffect(() => {
    if (token && !hasValidated) {
      validateInvitation(token)
    }
  }, [token, hasValidated])

  const validateInvitation = async (codeOrToken: string) => {
    setIsValidating(true)
    setHasValidated(true)

    try {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: VALIDATE_INVITATION,
          variables: { codeOrToken },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to validate invitation")
      }

      const validation = result.data.validateInvitation
      setValidationResult(validation)

      if (!validation.valid) {
        toast({
          title: "Invalid Invitation",
          description: validation.error || "This invitation is not valid.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to validate invitation",
        variant: "destructive",
      })
      setValidationResult({ valid: false, error: "Validation failed" })
    } finally {
      setIsValidating(false)
    }
  }

  const handleValidateCode = () => {
    if (codeInput.trim()) {
      validateInvitation(codeInput.trim())
    }
  }

  const joinMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!user?.id) {
        throw new Error("You must be logged in to join a team")
      }

      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: JOIN_TEAM,
          variables: {
            input: {
              invitationId,
              userId: user.id,
            },
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to join team")
      }

      return result.data.joinTeam
    },
    onSuccess: (data) => {
      toast({
        title: "Welcome to the Team!",
        description: "You have successfully joined the bidding team.",
      })
      // Redirect to the project workspace or dashboard
      router.push(`/workspace?project=${data.projectId}`)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleJoinTeam = () => {
    if (validationResult?.invitation?.id) {
      joinMutation.mutate(validationResult.invitation.id)
    }
  }

  if (userLoading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-12">
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-black dark:text-white mb-2">
              Login Required
            </h2>
            <p className="text-muted-foreground mb-6">
              You must be logged in to join a bidding team.
            </p>
            <Button
              onClick={() => router.push("/login")}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 p-4 rounded-full bg-yellow-400/20 w-fit">
            <UserPlus className="h-8 w-8 text-yellow-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-black dark:text-white">
            Join Bidding Team
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            Enter your invitation code or use the link to join the team
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Code Input Section */}
          {!token && !validationResult && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-black dark:text-white">
                  Invitation Code
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="code"
                      placeholder="Enter 8-digit code"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      maxLength={8}
                      className="pl-10 border-yellow-400/20 focus-visible:ring-yellow-400 font-mono"
                    />
                  </div>
                  <Button
                    onClick={handleValidateCode}
                    disabled={isValidating || codeInput.length !== 8}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black"
                  >
                    {isValidating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Validate"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the 8-digit code provided by your team lead
                </p>
              </div>
            </div>
          )}

          {/* Validating State */}
          {isValidating && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 text-yellow-400 mx-auto mb-4 animate-spin" />
              <p className="text-sm text-muted-foreground">
                Validating invitation...
              </p>
            </div>
          )}

          {/* Validation Result */}
          {!isValidating && validationResult && (
            <>
              {validationResult.valid && validationResult.invitation ? (
                <div className="space-y-6">
                  {/* Success Message */}
                  <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-yellow-400" />
                      <p className="font-semibold text-black dark:text-white">
                        Valid Invitation
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This invitation is valid and ready to use.
                    </p>
                  </div>

                  {/* Invitation Details */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm text-muted-foreground">Code</span>
                      </div>
                      <span className="font-mono font-semibold text-black dark:text-white">
                        {validationResult.invitation.code}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm text-muted-foreground">Expires</span>
                      </div>
                      <span className="text-sm font-medium text-black dark:text-white">
                        {formatDate(validationResult.invitation.expiresAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm text-muted-foreground">Type</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-yellow-400/30 text-yellow-400"
                      >
                        {validationResult.invitation.isMultiUse
                          ? "Multi-use"
                          : "Single-use"}
                      </Badge>
                    </div>
                  </div>

                  {/* Join Button */}
                  <Button
                    onClick={handleJoinTeam}
                    disabled={joinMutation.isPending}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                    size="lg"
                  >
                    {joinMutation.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Joining Team...
                      </>
                    ) : (
                      <>
                        Join Team
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                    Invalid Invitation
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {validationResult.error || "This invitation is not valid."}
                  </p>
                  {!token && (
                    <Button
                      onClick={() => {
                        setValidationResult(null)
                        setCodeInput("")
                        setHasValidated(false)
                      }}
                      variant="outline"
                      className="border-yellow-400/20 hover:bg-yellow-400/10"
                    >
                      Try Another Code
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
