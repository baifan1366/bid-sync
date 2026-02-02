'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createGraphQLClient, PENDING_CLIENT_VERIFICATIONS, VERIFY_CLIENT } from '@/lib/graphql/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  verificationStatus: string;
  createdAt: string;
}

export default function VerificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const client = createGraphQLClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pendingVerifications'],
    queryFn: async () => {
      const response = await client.request<{ pendingClientVerifications: User[] }>(
        PENDING_CLIENT_VERIFICATIONS
      );
      return response.pendingClientVerifications;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ userId, approved, reason }: { userId: string; approved: boolean; reason?: string }) => {
      return client.request(VERIFY_CLIENT, { userId, approved, reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pendingVerifications'] });
      toast({
        title: variables.approved ? 'Client Verified' : 'Client Rejected',
        description: variables.approved 
          ? 'The client has been verified and can now create projects.'
          : 'The client verification has been rejected.',
      });
      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update verification status',
        variant: 'destructive',
      });
    },
  });

  const handleApprove = (user: User) => {
    verifyMutation.mutate({ userId: user.id, approved: true });
  };

  const handleReject = (user: User) => {
    setSelectedUser(user);
    setShowRejectDialog(true);
  };

  const confirmReject = () => {
    if (selectedUser) {
      verifyMutation.mutate({
        userId: selectedUser.id,
        approved: false,
        reason: rejectReason,
      });
    }
  };

  if (isLoading) {
    return (
      <>
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-2">Client Verifications</h1>
          <p className="text-muted-foreground">Loading pending verifications...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-2">Client Verifications</h1>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading verifications. Please try again.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-yellow-400 rounded-lg">
            <svg className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
            Client Verifications
          </h1>
        </div>
        <p className="text-muted-foreground">
          Review and approve client registrations before they can create projects
        </p>
      </div>

      {!data || data.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              No pending client verifications at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{user.fullName || 'Unnamed User'}</CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {user.verificationStatus.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Registered: {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleReject(user)}
                      disabled={verifyMutation.isPending}
                      className="border-red-500/20 hover:bg-red-500/10 text-red-500"
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(user)}
                      disabled={verifyMutation.isPending}
                      className="bg-yellow-400 hover:bg-yellow-500 text-black"
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Client Verification</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting {selectedUser?.fullName || 'this client'}'s verification.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason('');
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectReason.trim() || verifyMutation.isPending}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
