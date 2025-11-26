"use client"

import { useState, useEffect } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface ProjectSearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  placeholder?: string
}

export function ProjectSearchBar({
  value,
  onChange,
  onSearch,
  placeholder = "Search projects by title, description, or requirements...",
}: ProjectSearchBarProps) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (newValue: string) => {
    setLocalValue(newValue)
    // Debounced search - update parent after typing stops
    const timeoutId = setTimeout(() => {
      onChange(newValue)
    }, 300)

    return () => clearTimeout(timeoutId)
  }

  const handleClear = () => {
    setLocalValue("")
    onChange("")
    // Auto-refresh results immediately
    onSearch()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch()
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10 h-11 border-yellow-400/20 focus-visible:ring-yellow-400"
        />
        {localValue && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-yellow-400/10"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Button
        onClick={onSearch}
        className="h-11 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-6"
      >
        Search
      </Button>
    </div>
  )
}
