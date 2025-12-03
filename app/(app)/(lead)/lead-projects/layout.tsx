import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Project Marketplace | BidSync",
  description: "Discover and bid on open projects. Browse available opportunities and create proposals for projects that match your expertise.",
  keywords: ["projects", "marketplace", "bidding", "proposals", "opportunities"],
}

export default function LeadProjectsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
