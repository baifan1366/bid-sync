'use client';

import { useQuery } from '@tanstack/react-query';
import { createGraphQLClient, ME_QUERY } from '@/lib/graphql/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface MeData {
  me: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    verificationStatus: string;
  };
}

export function VerificationStatus() {
  const client = createGraphQLClient();

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      return client.request<MeData>(ME_QUERY);
    },
  });

  if (isLoading) {
    return null;
  }

  const status = data?.me?.verificationStatus;

  if (status === 'VERIFIED') {
    return null; // Don't show anything if verified
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'PENDING_VERIFICATION':
        return {
          icon: Clock,
          variant: 'secondary' as const,
          title: 'Verification Pending',
          description: 'Your account is pending verification by our Content Coordinator team. You will be notified once your account is approved.',
          color: 'text-yellow-600',
        };
      case 'REJECTED':
        return {
          icon: AlertCircle,
          variant: 'destructive' as const,
          title: 'Verification Rejected',
          description: 'Your account verification was not approved. Please contact support for more information.',
          color: 'text-destructive',
        };
      default:
        return {
          icon: Clock,
          variant: 'secondary' as const,
          title: 'Verification Required',
          description: 'Your account requires verification before you can create projects.',
          color: 'text-muted-foreground',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <CardTitle className="text-lg">{config.title}</CardTitle>
          </div>
          <Badge variant={config.variant}>
            {status?.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>{config.description}</CardDescription>
      </CardContent>
    </Card>
  );
}
