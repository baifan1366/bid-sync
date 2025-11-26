"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import type { BidPerformance } from "@/lib/analytics-service"

interface WinRateChartProps {
  performance: BidPerformance
}

export function WinRateChart({ performance }: WinRateChartProps) {
  const data = [
    { name: "Accepted", value: performance.accepted, color: "#10b981" },
    { name: "Rejected", value: performance.rejected, color: "#ef4444" },
    { name: "In Progress", value: performance.submitted - performance.accepted - performance.rejected, color: "#3b82f6" },
  ].filter(item => item.value > 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-black border border-yellow-400/20 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-black dark:text-white">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} proposals ({((payload[0].value / performance.submitted) * 100).toFixed(1)}%)
          </p>
        </div>
      )
    }
    return null
  }

  if (performance.submitted === 0) {
    return (
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardHeader>
          <CardTitle className="text-black dark:text-white">Win Rate</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No submitted proposals yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-yellow-400/20 bg-white dark:bg-black">
      <CardHeader>
        <CardTitle className="text-black dark:text-white">Win Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 pt-4 border-t border-yellow-400/20">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {performance.accepted}
              </p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {performance.rejected}
              </p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {performance.submitted - performance.accepted - performance.rejected}
              </p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
