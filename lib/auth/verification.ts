import { User } from '@supabase/supabase-js';

export type VerificationStatus = 'pending_verification' | 'verified' | 'rejected';

export function getVerificationStatus(user: User | null): VerificationStatus {
  if (!user) {
    return 'pending_verification';
  }
  
  return user.user_metadata?.verification_status || 'pending_verification';
}

export function isVerified(user: User | null): boolean {
  return getVerificationStatus(user) === 'verified';
}

export function canCreateProjects(user: User | null): boolean {
  if (!user) {
    return false;
  }
  
  const role = user.user_metadata?.role;
  const status = getVerificationStatus(user);
  
  return role === 'client' && status === 'verified';
}

export function isContentCoordinator(user: User | null): boolean {
  if (!user) {
    return false;
  }
  
  return user.user_metadata?.role === 'admin';
}
