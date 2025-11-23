import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-black">
      <Card className="max-w-md w-full border-yellow-400/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-yellow-400/10 rounded-full">
              <ShieldAlert className="h-12 w-12 text-yellow-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            This page requires administrator privileges. If you believe you should have access,
            please contact your system administrator.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/dashboard" className="w-full">
              <Button className="w-full bg-yellow-400 hover:bg-yellow-500 text-black">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full border-yellow-400/20 hover:bg-yellow-400/10">
                Go to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
