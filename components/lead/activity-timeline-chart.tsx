"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { ActivityTimeline } from "@/lib/analytics-service"
import { format, parseISO } from "date-fns"

interface ActivityTimelineChartProps {
  timeline: ActivityTimeline
}

export function ActivityTimelineChart({ timeline }: ActivityTimelineChartProps) {
  // Merge all activity data by date
  const dateMap = new Map<string, { date: string; proposals: number; submissions: number; acceptances: number }>()

  timeline.proposalActivity.forEach((point) => {
    if (!dateMap.has(point.date)) {
      dateMap.set(point.date, { date: point.date, proposals: 0, submissions: 0, acceptances: 0 })
    }
    dateMap.get(point.date)!.proposals = point.count
  })

  timeline.submissionActivity.forEach((point) => {
    if (!dateMap.has(point.date)) {
      dateMap.set(point.date, { date: point.date, proposals: 0, submissions: 0, acceptances: 0 })
    }
    dateMap.get(point.date)!.submissions = point.count
  })

  timeline.acceptanceActivity.forEach((point) => {
    if (!dateMap.has(point.date)) {
      dateMap.set(point.date, { date: point.date, proposals: 0, submissions: 0, acceptances: 0 })
    }
    dateMap.get(point.date)!.acceptances = point.count
  })

  const data = Array.from(dateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      formattedDate: format(parseISO(item.date), "MMM dd"),
    }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-black border border-yellow-400/20 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-black dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const hasData = data.some(d => d.proposals > 0 || d.submissions > 0 || d.acceptances > 0)

  if (!hasData) {
    return (
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardHeader>
          <CardTitle className="text-black dark:text-white">
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No activity in this time period</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-yellow-400/20 bg-white dark:bg-black">
      <CardHeader>
        <CardTitle className="text-black dark:text-white">
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#fbbf24" opacity={0.1} />
            <XAxis
              dataKey="formattedDate"
              tick={{ fill: "currentColor" }}
              className="text-xs text-muted-foreground"
            />
            <YAxis
              tick={{ fill: "currentColor" }}
              className="text-xs text-muted-foreground"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="proposals"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Proposals Created"
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="submissions"
              stroke="#fbbf24"
              strokeWidth={2}
              name="Proposals Submitted"
              dot={{ fill: "#fbbf24", r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="acceptances"
              stroke="#10b981"
              strokeWidth={2}
              name="Proposals Accepted"
              dot={{ fill: "#10b981", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 pt-4 border-t border-yellow-400/20">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <p className="text-lg font-bold text-black dark:text-white">
                {timeline.proposalActivity.reduce((sum, p) => sum + p.count, 0)}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <p className="text-xs text-muted-foreground">Submitted</p>
              </div>
              <p className="text-lg font-bold text-black dark:text-white">
                {timeline.submissionActivity.reduce((sum, p) => sum + p.count, 0)}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-green-600" />
                <p className="text-xs text-muted-foreground">Accepted</p>
              </div>
              <p className="text-lg font-bold text-black dark:text-white">
                {timeline.acceptanceActivity.reduce((sum, p) => sum + p.count, 0)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
