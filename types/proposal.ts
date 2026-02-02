// Proposal-related types
export type ProposalStatus = 'draft' | 'submitted' | 'pending_approval' | 'reviewing' | 'approved' | 'rejected'

export interface Proposal {
  id: string
  project_id: string
  lead_id: string
  status: ProposalStatus
  content?: any // JSON content
  submitted_at?: string
  created_at: string
  updated_at: string
}

export interface CreateProposalData {
  project_id: string
  content?: any
}

export interface UpdateProposalData {
  content?: any
  status?: ProposalStatus
}

export interface ProposalVersion {
  id: string
  proposal_id: string
  version_number: number
  content: any
  created_by: string
  created_at: string
}

// API Response types
export interface GetProposalsResponse {
  success: boolean
  proposals?: Proposal[]
  error?: string
}

export interface GetProposalResponse {
  success: boolean
  proposal?: Proposal
  error?: string
}

export interface CreateProposalResponse {
  success: boolean
  proposal?: Proposal
  error?: string
}

export interface UpdateProposalResponse {
  success: boolean
  proposal?: Proposal
  error?: string
}
