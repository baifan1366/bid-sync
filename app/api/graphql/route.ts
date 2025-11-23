import { createYoga } from 'graphql-yoga';
import { createSchema } from 'graphql-yoga';
import { typeDefs } from '@/lib/graphql/schema';
import { resolvers } from '@/lib/graphql/resolvers';
import { NextRequest } from 'next/server';

const { handleRequest } = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response },
});

export async function GET(request: NextRequest) {
  return handleRequest(request, {});
}

export async function POST(request: NextRequest) {
  return handleRequest(request, {});
}
