import { jsPDF } from 'jspdf';
import { createClient } from '@/lib/supabase/server';

interface ExportData {
  project: {
    id: string;
    title: string;
    description: string;
    client: {
      fullName: string;
      email: string;
    };
  };
  scoringTemplate: {
    name: string;
    description: string | null;
    criteria: Array<{
      name: string;
      description: string | null;
      weight: number;
      orderIndex: number;
    }>;
  };
  proposals: Array<{
    id: string;
    title: string | null;
    biddingTeamName: string | null;
    leadName: string;
    budgetEstimate: number | null;
    timelineEstimate: string | null;
    totalScore: number;
    rank: number;
    isFullyScored: boolean;
    scores: Array<{
      criterionName: string;
      rawScore: number;
      weightedScore: number;
      notes: string | null;
    }>;
  }>;
  unscoredProposals: Array<{
    id: string;
    title: string | null;
    leadName: string;
  }>;
  exportDate: string;
}

export class ScoringExportService {
  /**
   * Generate a PDF export of scoring data for a project
   */
  static async generateExport(projectId: string, userId: string): Promise<{ url: string; expiresAt: string }> {
    const supabase = await createClient();

    // Fetch all required data
    const exportData = await this.fetchExportData(supabase, projectId, userId);

    // Generate PDF
    const pdfBlob = this.createPDF(exportData);

    // Upload to Supabase Storage (temporary bucket)
    const fileName = `scoring-export-${projectId}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload export: ${uploadError.message}`);
    }

    // Generate signed URL with 24-hour expiration
    const { data: urlData, error: urlError } = await supabase.storage
      .from('exports')
      .createSignedUrl(fileName, 86400); // 24 hours

    if (urlError || !urlData) {
      throw new Error(`Failed to generate download URL: ${urlError?.message}`);
    }

    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

    return {
      url: urlData.signedUrl,
      expiresAt,
    };
  }

  /**
   * Fetch all data needed for the export
   */
  private static async fetchExportData(supabase: any, projectId: string, userId: string): Promise<ExportData> {
    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        description,
        client:users!projects_client_id_fkey(full_name, email)
      `)
      .eq('id', projectId)
      .eq('client_id', userId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found or access denied');
    }

    // Fetch scoring template
    const { data: template, error: templateError } = await supabase
      .from('scoring_templates')
      .select(`
        name,
        description,
        criteria:scoring_criteria(
          name,
          description,
          weight,
          order_index
        )
      `)
      .eq('project_id', projectId)
      .single();

    if (templateError || !template) {
      throw new Error('Scoring template not found');
    }

    // Fetch rankings with proposal details
    const { data: rankings, error: rankingsError } = await supabase
      .from('proposal_rankings')
      .select(`
        proposal_id,
        total_score,
        rank,
        is_fully_scored,
        proposal:proposals(
          id,
          title,
          bidding_team_name,
          budget_estimate,
          timeline_estimate,
          lead:users!proposals_lead_id_fkey(full_name)
        )
      `)
      .eq('project_id', projectId)
      .order('rank', { ascending: true });

    if (rankingsError) {
      throw new Error('Failed to fetch rankings');
    }

    // Fetch scores for each proposal
    const proposalsWithScores = await Promise.all(
      (rankings || []).map(async (ranking: any) => {
        const { data: scores } = await supabase
          .from('proposal_scores')
          .select(`
            raw_score,
            weighted_score,
            notes,
            criterion:scoring_criteria(name)
          `)
          .eq('proposal_id', ranking.proposal_id)
          .eq('is_final', true);

        return {
          id: ranking.proposal.id,
          title: ranking.proposal.title,
          biddingTeamName: ranking.proposal.bidding_team_name,
          leadName: ranking.proposal.lead.full_name,
          budgetEstimate: ranking.proposal.budget_estimate,
          timelineEstimate: ranking.proposal.timeline_estimate,
          totalScore: ranking.total_score,
          rank: ranking.rank,
          isFullyScored: ranking.is_fully_scored,
          scores: (scores || []).map((s: any) => ({
            criterionName: s.criterion.name,
            rawScore: s.raw_score,
            weightedScore: s.weighted_score,
            notes: s.notes,
          })),
        };
      })
    );

    // Fetch unscored proposals
    const { data: allProposals } = await supabase
      .from('proposals')
      .select(`
        id,
        title,
        lead:users!proposals_lead_id_fkey(full_name)
      `)
      .eq('project_id', projectId)
      .eq('status', 'submitted');

    const scoredProposalIds = new Set(proposalsWithScores.map(p => p.id));
    const unscoredProposals = (allProposals || [])
      .filter((p: any) => !scoredProposalIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        title: p.title,
        leadName: p.lead.full_name,
      }));

    return {
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        client: {
          fullName: project.client.full_name,
          email: project.client.email,
        },
      },
      scoringTemplate: {
        name: template.name,
        description: template.description,
        criteria: template.criteria.sort((a: any, b: any) => a.order_index - b.order_index),
      },
      proposals: proposalsWithScores,
      unscoredProposals,
      exportDate: new Date().toISOString(),
    };
  }

  /**
   * Create PDF document from export data
   */
  private static createPDF(data: ExportData): Blob {
    const doc = new jsPDF();
    let yPosition = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    // Helper function to add text with word wrap
    const addText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10) => {
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + lines.length * (fontSize * 0.5);
    };

    // Helper function to check if we need a new page
    const checkNewPage = (requiredSpace: number) => {
      if (yPosition + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPosition = 20;
      }
    };

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Proposal Scoring Report', margin, yPosition);
    yPosition += 15;

    // Project Information
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Project Information', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPosition = addText(`Project: ${data.project.title}`, margin, yPosition, contentWidth);
    yPosition = addText(`Description: ${data.project.description}`, margin, yPosition, contentWidth);
    yPosition = addText(`Client: ${data.project.client.fullName} (${data.project.client.email})`, margin, yPosition, contentWidth);
    yPosition = addText(`Export Date: ${new Date(data.exportDate).toLocaleString()}`, margin, yPosition, contentWidth);
    yPosition += 10;

    // Scoring Template
    checkNewPage(40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Scoring Template', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPosition = addText(`Template: ${data.scoringTemplate.name}`, margin, yPosition, contentWidth);
    if (data.scoringTemplate.description) {
      yPosition = addText(`Description: ${data.scoringTemplate.description}`, margin, yPosition, contentWidth);
    }
    yPosition += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Scoring Criteria:', margin, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    data.scoringTemplate.criteria.forEach((criterion) => {
      checkNewPage(15);
      yPosition = addText(`• ${criterion.name} (${criterion.weight}%)`, margin + 5, yPosition, contentWidth - 5);
      if (criterion.description) {
        yPosition = addText(`  ${criterion.description}`, margin + 10, yPosition, contentWidth - 10, 9);
      }
      yPosition += 3;
    });
    yPosition += 10;

    // Proposal Rankings
    checkNewPage(40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Proposal Rankings', margin, yPosition);
    yPosition += 10;

    data.proposals.forEach((proposal, index) => {
      checkNewPage(60);

      // Proposal header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Rank #${proposal.rank}: ${proposal.title || 'Untitled Proposal'}`, margin, yPosition);
      yPosition += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      yPosition = addText(`Lead: ${proposal.leadName}`, margin, yPosition, contentWidth);
      if (proposal.biddingTeamName) {
        yPosition = addText(`Team: ${proposal.biddingTeamName}`, margin, yPosition, contentWidth);
      }
      if (proposal.budgetEstimate) {
        yPosition = addText(`Budget: $${proposal.budgetEstimate.toLocaleString()}`, margin, yPosition, contentWidth);
      }
      if (proposal.timelineEstimate) {
        yPosition = addText(`Timeline: ${proposal.timelineEstimate}`, margin, yPosition, contentWidth);
      }

      doc.setFont('helvetica', 'bold');
      yPosition = addText(`Total Score: ${proposal.totalScore.toFixed(2)}`, margin, yPosition, contentWidth);
      yPosition = addText(`Status: ${proposal.isFullyScored ? 'Fully Scored' : 'Partially Scored'}`, margin, yPosition, contentWidth);
      yPosition += 5;

      // Scores table
      if (proposal.scores.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Criterion Scores:', margin, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'normal');
        proposal.scores.forEach((score) => {
          checkNewPage(20);
          yPosition = addText(
            `• ${score.criterionName}: ${score.rawScore.toFixed(1)}/10 (Weighted: ${score.weightedScore.toFixed(2)})`,
            margin + 5,
            yPosition,
            contentWidth - 5
          );
          if (score.notes) {
            yPosition = addText(`  Notes: ${score.notes}`, margin + 10, yPosition, contentWidth - 10, 9);
          }
          yPosition += 3;
        });
      }

      yPosition += 8;
    });

    // Unscored Proposals
    if (data.unscoredProposals.length > 0) {
      checkNewPage(40);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Unscored Proposals', margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      data.unscoredProposals.forEach((proposal) => {
        checkNewPage(10);
        yPosition = addText(`• ${proposal.title || 'Untitled'} (Lead: ${proposal.leadName})`, margin + 5, yPosition, contentWidth - 5);
        yPosition += 5;
      });
    }

    return doc.output('blob');
  }
}
