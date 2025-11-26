import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ProposalExportService } from '@/lib/proposal-export-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      proposalId,
      includeVersionHistory = true,
      includeTeamStats = true,
      includeDocuments = true,
      sendEmail = false,
      emailRecipient,
    } = body

    if (!proposalId) {
      return NextResponse.json(
        { error: 'Proposal ID is required' },
        { status: 400 }
      )
    }

    if (sendEmail) {
      // Export and email
      if (!emailRecipient) {
        return NextResponse.json(
          { error: 'Email recipient is required' },
          { status: 400 }
        )
      }

      const result = await ProposalExportService.exportAndEmail({
        proposalId,
        userId: user.id,
        recipientEmail: emailRecipient,
        includeVersionHistory,
        includeTeamStats,
        includeDocuments,
      })

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to export and email proposal' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } else {
      // Export and download
      const result = await ProposalExportService.exportProposal({
        proposalId,
        userId: user.id,
        includeVersionHistory,
        includeTeamStats,
        includeDocuments,
      })

      if (!result.success || !result.pdfBuffer || !result.fileName) {
        return NextResponse.json(
          { error: result.error || 'Failed to export proposal' },
          { status: 500 }
        )
      }

      // Return PDF as download
      return new NextResponse(result.pdfBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${result.fileName}"`,
        },
      })
    }
  } catch (error) {
    console.error('Error in export route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
