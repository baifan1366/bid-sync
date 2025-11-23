"use client"

interface SearchHighlightProps {
  text: string
  searchQuery: string
}

export function SearchHighlight({ text, searchQuery }: SearchHighlightProps) {
  if (!searchQuery || !text) {
    return <>{text}</>
  }

  // Split search query into terms
  const terms = searchQuery.trim().split(/\s+/).filter(term => term.length > 0)
  
  if (terms.length === 0) {
    return <>{text}</>
  }

  // Create a regex pattern that matches any of the search terms (case-insensitive)
  const pattern = new RegExp(`(${terms.map(term => 
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
  ).join('|')})`, 'gi')

  // Split the text by matches
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, index) => {
        // Check if this part matches any search term
        const isMatch = terms.some(term => 
          part.toLowerCase() === term.toLowerCase()
        )

        if (isMatch) {
          return (
            <mark
              key={index}
              className="bg-yellow-400 text-black px-0.5 rounded"
            >
              {part}
            </mark>
          )
        }

        return <span key={index}>{part}</span>
      })}
    </>
  )
}

// Helper function to check if text contains search query
export function containsSearchQuery(text: string | null, searchQuery: string): boolean {
  if (!text || !searchQuery) return false
  
  const terms = searchQuery.trim().toLowerCase().split(/\s+/)
  const lowerText = text.toLowerCase()
  
  return terms.some(term => lowerText.includes(term))
}
