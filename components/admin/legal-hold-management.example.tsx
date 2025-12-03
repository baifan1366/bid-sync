/**
 * Legal Hold Management Component - Example Usage
 * 
 * This file demonstrates how to use the LegalHoldManagement component
 * in different scenarios within the admin dashboard.
 */

import { LegalHoldManagement } from './legal-hold-management'
import { Shield } from 'lucide-react'

// ============================================================================
// Example 1: Basic Usage in Admin Page
// ============================================================================

export function BasicLegalHoldPage() {
  return (
    <div className="container mx-auto p-6">
      <LegalHoldManagement />
    </div>
  )
}

// ============================================================================
// Example 2: With Page Header and Description
// ============================================================================

export function LegalHoldPageWithHeader() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <Shield className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Legal Hold Management
          </h1>
        </div>
        <p className="text-muted-foreground">
          Manage legal holds on archived projects to prevent deletion during retention policy enforcement
        </p>
      </div>
      
      {/* Component */}
      <LegalHoldManagement />
    </div>
  )
}

// ============================================================================
// Example 3: Integrated in Admin Dashboard Tab
// ============================================================================

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArchiveViewer } from '@/components/client/archive-viewer'

export function AdminArchiveManagementTabs() {
  return (
    <div className="container mx-auto p-6">
      <Tabs defaultValue="legal-holds" className="space-y-6">
        <TabsList>
          <TabsTrigger value="legal-holds">Legal Holds</TabsTrigger>
          <TabsTrigger value="archives">All Archives</TabsTrigger>
          <TabsTrigger value="retention">Retention Policy</TabsTrigger>
        </TabsList>
        
        <TabsContent value="legal-holds">
          <LegalHoldManagement />
        </TabsContent>
        
        <TabsContent value="archives">
          {/* Archive viewer component */}
          <div className="text-center py-12 text-muted-foreground">
            Archive viewer would go here
          </div>
        </TabsContent>
        
        <TabsContent value="retention">
          {/* Retention policy settings */}
          <div className="text-center py-12 text-muted-foreground">
            Retention policy settings would go here
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================================
// Example 4: With Custom Wrapper and Additional Context
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export function LegalHoldPageWithContext() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <Shield className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Legal Hold Management
          </h1>
        </div>
        <p className="text-muted-foreground">
          Manage legal holds on archived projects to prevent deletion during retention policy enforcement
        </p>
      </div>

      {/* Important Notice */}
      <Alert className="border-yellow-400/20">
        <AlertCircle className="h-4 w-4 text-yellow-400" />
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          Archives under legal hold will not be deleted regardless of retention period. 
          Always document the reason for legal hold and remove it when no longer needed.
        </AlertDescription>
      </Alert>

      {/* Guidelines Card */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Legal Hold Guidelines</CardTitle>
          <CardDescription>
            Best practices for managing legal holds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-medium mb-1">When to Apply Legal Hold</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Pending or active litigation involving the project</li>
              <li>Regulatory investigation or audit</li>
              <li>Internal investigation requiring data preservation</li>
              <li>Contractual obligation to retain records</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-1">Documentation Requirements</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Provide specific case numbers or investigation IDs</li>
              <li>Include the legal or compliance team contact</li>
              <li>Document the expected duration if known</li>
              <li>Reference relevant legal or regulatory requirements</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-1">When to Remove Legal Hold</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Litigation has been resolved or dismissed</li>
              <li>Investigation has concluded</li>
              <li>Legal counsel has approved removal</li>
              <li>Retention requirements have been satisfied</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Main Component */}
      <LegalHoldManagement />
    </div>
  )
}

// ============================================================================
// Example 5: Standalone Component for Testing
// ============================================================================

export function LegalHoldManagementDemo() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1800px] mx-auto">
        <LegalHoldManagement />
      </div>
    </div>
  )
}

// ============================================================================
// Usage Notes
// ============================================================================

/**
 * ROUTING SETUP
 * 
 * To add the legal hold management page to your admin dashboard:
 * 
 * 1. Create the page file:
 *    app/(app)/(admin)/legal-holds/page.tsx
 * 
 * 2. Add the route to your navigation:
 *    {
 *      title: "Legal Holds",
 *      href: "/legal-holds",
 *      icon: Shield,
 *      adminOnly: true
 *    }
 * 
 * 3. Ensure admin authentication:
 *    import { requireAdmin } from '@/lib/auth/admin-guards'
 *    await requireAdmin()
 */

/**
 * PERMISSIONS
 * 
 * - Only administrators can access this component
 * - Legal hold operations are logged for audit purposes
 * - All actions require admin role verification
 */

/**
 * GRAPHQL SETUP
 * 
 * Ensure these mutations are available:
 * - applyLegalHold(archiveId: ID!, reason: String!): ProjectArchive!
 * - removeLegalHold(archiveId: ID!): ProjectArchive!
 * 
 * And this query:
 * - searchArchives(query: String!, limit: Int, offset: Int): [ProjectArchive!]!
 */

/**
 * TESTING
 * 
 * To test the component:
 * 
 * 1. Ensure you have archived projects in the database
 * 2. Log in as an administrator
 * 3. Navigate to /legal-holds
 * 4. Try applying and removing legal holds
 * 5. Verify the retention policy respects legal holds
 */
