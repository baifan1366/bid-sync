import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { Project } from "@/types/project"
import { CategorySkeleton } from "./category-skeleton"

interface TrendingCategoriesProps {
  projects: Project[]
  isLoading: boolean
}

interface Category {
  name: string
  count: number
}

// Common words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'we', 'our', 'your', 'this', 'these',
  'those', 'i', 'you', 'they', 'them', 'their', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'can', 'just', 'should',
  'now', 'need', 'want', 'looking', 'seeking'
])

function extractKeywords(text: string): string[] {
  // Convert to lowercase and split into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && // Only words longer than 3 characters
      !STOP_WORDS.has(word) &&
      !/^\d+$/.test(word) // Exclude pure numbers
    )
  
  return words
}

function extractCategories(projects: Project[]): Category[] {
  const keywordCounts = new Map<string, number>()
  
  // Extract keywords from all projects
  projects.forEach(project => {
    const titleKeywords = extractKeywords(project.title)
    const descriptionKeywords = extractKeywords(project.description)
    const allKeywords = [...titleKeywords, ...descriptionKeywords]
    
    allKeywords.forEach(keyword => {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1)
    })
  })
  
  // Convert to array and sort by count
  const categories = Array.from(keywordCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5) // Top 5 categories
  
  return categories
}

export function TrendingCategories({ projects, isLoading }: TrendingCategoriesProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            Trending Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <CategorySkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }
  
  const categories = extractCategories(projects)
  
  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            Trending Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <p className="text-xs sm:text-sm text-muted-foreground">
            No categories found yet. Create more projects to see trending topics.
          </p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
          Trending Categories
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Badge 
              key={category.name}
              variant="secondary"
              className="text-xs sm:text-sm capitalize"
            >
              {category.name} ({category.count})
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
