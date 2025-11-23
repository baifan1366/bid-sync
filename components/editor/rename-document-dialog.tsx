"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
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
import { Loader2 } from "lucide-react"
import { useGraphQLMutation } from "@/hooks/use-graphql"
import { gql } from "graphql-request"

const UPDATE_DOCUMENT = gql`
  mutation UpdateDocument($documentId: ID!, $input: UpdateDocumentInput!) {
    updateDocument(documentId: $documentId, input: $input) {
      success
      document {
        id
        title
        description
      }
      error
    }
  }
`

interface Document {
  id: string
  title: string
  description: string | null
}

interface RenameDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: Document
  onSuccess?: () => void
}

interface FormData {
  title: string
  description: string
}

export function RenameDocumentDialog({
  open,
  onOpenChange,
  document,
  onSuccess,
}: RenameDocumentDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    defaultValues: {
      title: document.title,
      description: document.description || "",
    },
  })

  const updateMutation = useGraphQLMutation<
    any,
    { documentId: string; input: { title?: string; description?: string } }
  >(UPDATE_DOCUMENT)

  React.useEffect(() => {
    if (open) {
      reset({
        title: document.title,
        description: document.description || "",
      })
    }
  }, [open, document, reset])

  const onSubmit = async (data: FormData) => {
    try {
      const result = await updateMutation.mutateAsync({
        documentId: document.id,
        input: {
          title: data.title,
          description: data.description || undefined,
        },
      })

      if (result.updateDocument.success) {
        onSuccess?.()
      } else {
        console.error("Failed to update document:", result.updateDocument.error)
      }
    } catch (error) {
      console.error("Failed to update document:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Rename Document</DialogTitle>
          <DialogDescription>
            Update the title and description of your document.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter document title"
              {...register("title", {
                required: "Title is required",
                minLength: {
                  value: 1,
                  message: "Title must be at least 1 character",
                },
              })}
              className="border-yellow-400/20"
            />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter document description"
              rows={3}
              {...register("description")}
              className="border-yellow-400/20"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
              className="border-yellow-400/20"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
