import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  iconColor?: string
  className?: string
}

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  iconColor = "text-primary",
  className 
}: StatCardProps) {
  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between space-x-3 sm:space-x-4">
          <div className="flex-1 space-y-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              {label}
            </p>
            <p className="text-xl sm:text-2xl font-bold truncate">
              {value}
            </p>
          </div>
          <div className={cn(
            "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/10 shrink-0",
            iconColor
          )}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
