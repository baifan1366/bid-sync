"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, FileText } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { createGraphQLClient, ADMIN_ALL_TEMPLATES } from '@/lib/graphql/client'

interface Template {
  id: string
  name: string
  description: string
  type: string
  content: string
  createdAt: string
  updatedAt: string
}

async function fetchTemplates(): Promise<Template[]> {
  const client = createGraphQLClient()
  const data = await client.request<{ adminAllTemplates: Template[] }>(ADMIN_ALL_TEMPLATES)
  return data.adminAllTemplates
}

export function TemplateManagement() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'PROPOSAL' as string,
    content: '',
  })

  const { data: templates, isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: fetchTemplates,
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to create template')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] })
      toast({ title: 'Template created successfully' })
      setIsCreateDialogOpen(false)
      resetForm()
    },
    onError: () => {
      toast({ title: 'Failed to create template', variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await fetch(`/api/admin/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to update template')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] })
      toast({ title: 'Template updated successfully' })
      setEditingTemplate(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/templates/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete template')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-templates'] })
      toast({ title: 'Template deleted successfully' })
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'PROPOSAL',
      content: '',
    })
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
      type: template.type,
      content: template.content,
    })
  }

  const handleSubmit = () => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-black dark:text-white">Templates</h2>
          <p className="text-muted-foreground">Manage proposal and checklist templates</p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            Loading templates...
          </div>
        ) : templates && templates.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            No templates found. Create your first template to get started.
          </div>
        ) : (
          templates?.map((template) => (
            <Card key={template.id} className="border-yellow-400/20">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-yellow-400" />
                      {template.name}
                    </CardTitle>
                    <CardDescription>{template.description || 'No description'}</CardDescription>
                  </div>
                  <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                    {template.type}
                  </Badge>
                </div>
              </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(template)}
                  className="border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteMutation.mutate(template.id)}
                  className="border-red-500/20 hover:bg-red-500/10 text-red-500"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
          ))
        )}
      </div>

      <Dialog
        open={isCreateDialogOpen || !!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false)
            setEditingTemplate(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update template details' : 'Create a new template'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter template name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content (JSON)</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder='{"fields": []}'
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false)
                setEditingTemplate(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
