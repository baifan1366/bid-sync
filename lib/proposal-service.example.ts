/**
 * Example usage of ProposalService
 * 
 * This file demonstrates how to use the ProposalService to create proposals
 * with automatic workspace and section initialization.
 */

import { ProposalService } from './proposal-service';

/**
 * Example: Create a new proposal for a project
 */
async function exampleCreateProposal() {
  const projectId = 'project-uuid-here';
  const leadId = 'lead-user-uuid-here';

  // Create proposal with automatic workspace and section initialization
  const result = await ProposalService.createProposal(projectId, leadId);

  if (result.success) {
    console.log('Proposal created successfully!');
    console.log('Proposal ID:', result.proposal?.id);
    console.log('Workspace ID:', result.workspace?.id);
    console.log('Workspace Name:', result.workspace?.name);
    
    // The proposal is now ready with:
    // - Status: 'draft'
    // - Associated workspace for collaboration
    // - 5 default sections:
    //   1. Executive Summary
    //   2. Technical Approach
    //   3. Timeline & Deliverables
    //   4. Budget Breakdown
    //   5. Team Qualifications
  } else {
    console.error('Failed to create proposal:', result.error);
    console.error('Error code:', result.errorCode);
    
    // Handle specific error cases
    switch (result.errorCode) {
      case 'DUPLICATE_PROPOSAL':
        console.log('You already have a proposal for this project');
        break;
      case 'PROJECT_NOT_FOUND':
        console.log('The project does not exist');
        break;
      case 'WORKSPACE_CREATION_FAILED':
        console.log('Failed to create collaboration workspace');
        break;
      default:
        console.log('An unexpected error occurred');
    }
  }
}

/**
 * Example: Get proposal details
 */
async function exampleGetProposal() {
  const proposalId = 'proposal-uuid-here';

  const proposal = await ProposalService.getProposal(proposalId);

  if (proposal) {
    console.log('Proposal found:');
    console.log('- ID:', proposal.id);
    console.log('- Status:', proposal.status);
    console.log('- Project:', (proposal.projects as any)?.title);
    console.log('- Created:', proposal.created_at);
  } else {
    console.log('Proposal not found');
  }
}

/**
 * Example: Get workspace for a proposal
 */
async function exampleGetWorkspace() {
  const projectId = 'project-uuid-here';
  const leadId = 'lead-user-uuid-here';

  const workspace = await ProposalService.getWorkspaceByProject(projectId, leadId);

  if (workspace) {
    console.log('Workspace found:');
    console.log('- ID:', workspace.id);
    console.log('- Name:', workspace.name);
    console.log('- Description:', workspace.description);
  } else {
    console.log('Workspace not found');
  }
}

// Export examples for documentation
export {
  exampleCreateProposal,
  exampleGetProposal,
  exampleGetWorkspace,
};
