'use client'

import { useState } from 'react'
import { ArchiveSearch } from './archive-search'
import { ArchiveViewer } from './archive-viewer'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

// Use any type for the archive to avoid type conflicts between components
type ProjectArchive = any

/**
 * Example page component demonstrating the archive viewing workflow
 * 
 * This component shows how to:
 * 1. Search for archives using ArchiveSearch
 * 2. Display selected archive details using ArchiveViewer
 * 3. Navigate between search and view modes
 * 
 * Usage:
 * ```tsx
 * import { ArchivePageExample } from '@/components/client/archive-page-example'
 * 
 * export default function ArchivesPage() {
 *   return <ArchivePageExample />
 * }
 * ```
 */
export function ArchivePageExample() {
  const [selectedArchive, setSelectedArchive] = useState<ProjectArchive | null>(null)

  const handleSelectArchive = (archive: ProjectArchive) => {
    setSelectedArchive(archive)
  }

  const handleBackToSearch = () => {
    setSelectedArchive(null)
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-[1800px]">
      {selectedArchive ? (
        <div className="space-y-4">
          {/* Back Button */}
          <Button
            variant="outline"
            onClick={handleBackToSearch}
            className="border-yellow-400/40 hover:bg-yellow-400/10 hover:border-yellow-400"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>

          {/* Archive Viewer */}
          <ArchiveViewer archive={selectedArchive} />
        </div>
      ) : (
        /* Archive Search */
        <ArchiveSearch onSelectArchive={handleSelectArchive} />
      )}
    </div>
  )
}
