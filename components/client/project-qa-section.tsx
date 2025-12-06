'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { MessageCircle, Send, Loader2, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useUser } from '@/hooks/use-user'

const PROJECT_QUESTIONS_QUERY = `
  query ProjectQuestions($projectId: ID!) {
    projectQuestions(projectId: $projectId) {
      id
      projectId
      question
      createdAt
      askedBy {
        id
        email
        fullName
        role
      }
      answers {
        id
        answer
        createdAt
        answeredBy {
          id
          email
          fullName
          role
        }
      }
    }
  }
`

const ASK_QUESTION_MUTATION = `
  mutation AskQuestion($projectId: ID!, $question: String!) {
    askQuestion(projectId: $projectId, question: $question) {
      id
      question
      createdAt
    }
  }
`

const ANSWER_QUESTION_MUTATION = `
  mutation AnswerQuestion($questionId: ID!, $answer: String!) {
    answerQuestion(questionId: $questionId, answer: $answer) {
      id
      answer
      createdAt
    }
  }
`

interface ProjectQASectionProps {
  projectId: string
}

export function ProjectQASection({ projectId }: ProjectQASectionProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const [newQuestion, setNewQuestion] = useState('')
  const [answerText, setAnswerText] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['projectQuestions', projectId],
    queryFn: async () => {
      const client = createGraphQLClient()
      return await client.request<any>(PROJECT_QUESTIONS_QUERY, { projectId })
    }
  })

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const client = createGraphQLClient()
      return await client.request(ASK_QUESTION_MUTATION, { projectId, question })
    },
    onSuccess: () => {
      toast({
        title: 'Question posted',
        description: 'Your question has been posted successfully.',
      })
      setNewQuestion('')
      queryClient.invalidateQueries({ queryKey: ['projectQuestions', projectId] })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to post question',
        description: error.message,
        variant: 'destructive',
      })
    }
  })

  const answerMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
      const client = createGraphQLClient()
      return await client.request(ANSWER_QUESTION_MUTATION, { questionId, answer })
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Answer posted',
        description: 'Your answer has been posted successfully.',
      })
      setAnswerText(prev => ({ ...prev, [variables.questionId]: '' }))
      queryClient.invalidateQueries({ queryKey: ['projectQuestions', projectId] })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to post answer',
        description: error.message,
        variant: 'destructive',
      })
    }
  })

  const handleAskQuestion = () => {
    if (!newQuestion.trim()) {
      toast({
        title: 'Question required',
        description: 'Please enter a question',
        variant: 'destructive',
      })
      return
    }
    askMutation.mutate(newQuestion)
  }

  const handleAnswer = (questionId: string) => {
    const answer = answerText[questionId]?.trim()
    if (!answer) {
      toast({
        title: 'Answer required',
        description: 'Please enter an answer',
        variant: 'destructive',
      })
      return
    }
    answerMutation.mutate({ questionId, answer })
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  const getRoleBadgeColor = (role: string) => {
    if (role === 'CLIENT') return 'bg-blue-500 text-white'
    if (role === 'BIDDING_LEAD') return 'bg-yellow-400 text-black'
    return 'bg-gray-500 text-white'
  }

  if (isLoading) {
    return (
      <Card className="border-yellow-400/20">
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const questions = data?.projectQuestions || []

  return (
    <Card className="border-yellow-400/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-yellow-400" />
          <CardTitle>Questions & Answers</CardTitle>
          <Badge variant="outline" className="ml-auto border-yellow-400/40">
            {questions.length} {questions.length === 1 ? 'question' : 'questions'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ask Question Form */}
        {user?.user_metadata?.role !== 'CLIENT' && (
          <div className="space-y-2">
            <Textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Ask a question about this project..."
              className="border-yellow-400/20 focus-visible:ring-yellow-400"
              rows={3}
            />
            <Button
              onClick={handleAskQuestion}
              disabled={askMutation.isPending || !newQuestion.trim()}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {askMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Post Question
            </Button>
          </div>
        )}

        {/* Questions List */}
        {questions.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No questions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Be the first to ask a question about this project
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((q: any) => (
              <div key={q.id} className="border border-yellow-400/20 rounded-lg p-4 space-y-4">
                {/* Question */}
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-yellow-400 text-black">
                      {getInitials(q.askedBy.fullName, q.askedBy.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {q.askedBy.fullName || q.askedBy.email}
                      </span>
                      <Badge className={getRoleBadgeColor(q.askedBy.role)}>
                        {q.askedBy.role.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm">{q.question}</p>
                  </div>
                </div>

                {/* Answers */}
                {q.answers.length > 0 && (
                  <div className="ml-13 space-y-3 border-l-2 border-yellow-400/20 pl-4">
                    {q.answers.map((a: any) => (
                      <div key={a.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-green-500 text-white text-xs">
                            {getInitials(a.answeredBy.fullName, a.answeredBy.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {a.answeredBy.fullName || a.answeredBy.email}
                            </span>
                            <Badge className={getRoleBadgeColor(a.answeredBy.role)} variant="outline">
                              {a.answeredBy.role.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{a.answer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Answer Form (for client only) */}
                {user?.user_metadata?.role === 'CLIENT' && (
                  <div className="ml-13 space-y-2">
                    <Textarea
                      value={answerText[q.id] || ''}
                      onChange={(e) => setAnswerText(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Write your answer..."
                      className="border-yellow-400/20 focus-visible:ring-yellow-400"
                      rows={2}
                    />
                    <Button
                      onClick={() => handleAnswer(q.id)}
                      disabled={answerMutation.isPending || !answerText[q.id]?.trim()}
                      size="sm"
                      className="bg-yellow-400 hover:bg-yellow-500 text-black"
                    >
                      {answerMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3 mr-2" />
                      )}
                      Post Answer
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
