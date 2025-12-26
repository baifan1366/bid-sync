import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, type, content } = body

    // Parse content if it's a string, otherwise use as-is
    let parsedContent = content
    if (typeof content === 'string') {
      try {
        parsedContent = JSON.parse(content)
      } catch {
        // If parsing fails, use the string as-is wrapped in an object
        parsedContent = { raw: content }
      }
    }

    // contract_templates table uses 'content' as TEXT and 'category' instead of 'type'
    const { data, error } = await supabase
      .from('contract_templates')
      .insert({
        name,
        description,
        category: type || 'proposal',
        content: typeof parsedContent === 'string' ? parsedContent : JSON.stringify(parsedContent),
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error creating template:', error)
      throw error
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to create template' },
      { status: 500 }
    )
  }
}
