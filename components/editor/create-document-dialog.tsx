"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useGraphQLMutation } from "@/hooks/use-graphql"
import { gql } from "graphql-request"
import { Loader2 } from "lucide-react"

const CREATE_DOCUMENT = gql`
  mutation CreateDocument($input: CreateDocumentInput!) {
    createDocument(input: $input) {
      id
      title
      description
    }
  }
`

interface CreateDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onSuccess?: () => void
}

export function CreateDocumentDialog({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}: CreateDocumentDialogProps) {
  const router = useRouter()
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const createDocumentMutation = useGraphQLMutation<any, any>(CREATE_DOCUMENT)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) return

    try {
      const result = await createDocumentMutation.mutateAsync({
        input: {
          workspaceId,
          title: title.trim(),
          description: description.trim() || null,
        },
      })

      setTitle("")
      setDescription("")
      onSuccess?.()

      // Navigate to the new document
      if (result?.createDocument?.id) {
        router.push(`/app/editor/${result.createDocument.id}`)
      }
    } catch (err) {
      console.error("Failed to create document:", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>
              Create a new collaborative document in this workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter document title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-yellow-400/20"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter document description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border-yellow-400/20 min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createDocumentMutation.isPending}
              className="border-yellow-400/20"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createDocumentMutation.isPending || !title.trim()}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {createDocumentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Document"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
