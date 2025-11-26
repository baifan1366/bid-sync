"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface ProposalStatusBreakdownProps {
  statusBreakdown: {
    draft: number
    submitted: number
    reviewing: number
    approved: number
    rejected: number
  }
}

export function ProposalStatusBreakdown({ statusBreakdown }: ProposalStatusBreakdownProps) {
  const data = [
    { status: "Draft", count: statusBreakdown.draft, fill: "#9ca3af" },
    { status: "Submitted", count: statusBreakdown.submitted, fill: "#3b82f6" },
    { status: "Reviewing", count: statusBreakdown.reviewing, fill: "#f59e0b" },
    { status: "Approved", count: statusBreakdown.approved, fill: "#10b981" },
    { status: "Rejected", count: statusBreakdown.rejected, fill: "#ef4444" },
  ]

  const total = Object.values(statusBreakdown).reduce((sum, val) => sum + val, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percentage = total > 0 ? ((payload[0].value / total) * 100).toFixed(1) : 0
      return (
        <div className="bg-white dark:bg-black border border-yellow-400/20 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-black dark:text-white">{payload[0].payload.status}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} proposals ({percentage}%)
          </p>
        </div>
      )
    }
    return null
  }

  if (total === 0) {
    return (
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardHeader>
          <CardTitle className="text-black dark:text-white">
            Proposal Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No proposals yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-yellow-400/20 bg-white dark:bg-black">
      <CardHeader>
        <CardTitle className="text-black dark:text-white">
          Proposal Status Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#fbbf24" opacity={0.1} />
            <XAxis
              dataKey="status"
              tick={{ fill: "currentColor" }}
              className="text-xs text-muted-foreground"
            />
            <YAxis
              tick={{ fill: "currentColor" }}
              className="text-xs text-muted-foreground"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Bar key={`bar-${index}`} dataKey="count" fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 pt-4 border-t border-yellow-400/20">
          <div className="grid grid-cols-5 gap-2 text-center">
            {data.map((item) => (
              <div key={item.status}>
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-1"
                  style={{ backgroundColor: item.fill }}
                />
                <p className="text-xs font-medium text-black dark:text-white">
                  {item.count}
                </p>
                <p className="text-xs text-muted-foreground">{item.status}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
