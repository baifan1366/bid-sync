import { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ClientDecisionPage } from "./client-decision-page"

export const metadata: Metadata = {
  title: "Project Decision | BidSync",
  description: "Review proposals and make decisions on project awards",
  keywords: ["project management", "proposals", "bidding", "decision making"],
}

interface PageProps {
  params: Promise<{
    projectId: string
  }>
}

export default async function Page({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Verify user has access to this project (is the client)
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .single()

  if (error || !project) {
    redirect("/projects")
  }

  if (project.client_id !== user.id) {
    redirect("/unauthorized")
  }

  return <ClientDecisionPage projectId={projectId} />
}
