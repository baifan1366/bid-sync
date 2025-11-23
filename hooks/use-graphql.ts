import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { RequestDocument } from 'graphql-request'

interface GraphQLQueryOptions {
  staleTime?: number
  cacheTime?: number
  refetchOnWindowFocus?: boolean
  refetchOnMount?: boolean
  enabled?: boolean
}

export function useGraphQLQuery<T>(
  key: string[], 
  query: RequestDocument, 
  variables?: any,
  options?: GraphQLQueryOptions
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const client = createGraphQLClient()
      return client.request<T>(query, variables)
    },
    // Stale-while-revalidate strategy
    staleTime: options?.staleTime ?? 2 * 60 * 1000, // 2 minutes default
    gcTime: options?.cacheTime ?? 10 * 60 * 1000, // 10 minutes default (formerly cacheTime)
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    refetchOnMount: options?.refetchOnMount ?? true,
    enabled: options?.enabled ?? true, // Only run query if enabled
  })
}

export function useGraphQLMutation<T, V>(mutation: RequestDocument, invalidationKeys: string[][] = []) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variables: V) => {
      const client = createGraphQLClient()
      return client.request<T>(mutation, variables as any)
    },
    onSuccess: () => {
      invalidationKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key })
      })
    },
  })
}
