"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Archive, Filter, FolderOpen, Folders } from "lucide-react"

export type ArchiveFilterMode = "active" | "archived" | "all"

interface ProposalsArchiveToggleProps {
  mode: ArchiveFilterMode
  onModeChange: (mode: ArchiveFilterMode) => void
  activeCount?: number
  archivedCount?: number
}

export function ProposalsArchiveToggle({
  mode,
  onModeChange,
  activeCount = 0,
  archivedCount = 0,
}: ProposalsArchiveToggleProps) {
  const getModeLabel = () => {
    switch (mode) {
      case "active":
        return "Active Only"
      case "archived":
        return "Archived Only"
      case "all":
        return "All Proposals"
      default:
        return "Active Only"
    }
  }

  const getModeIcon = () => {
    switch (mode) {
      case "active":
        return <FolderOpen className="h-4 w-4" />
      case "archived":
        return <Archive className="h-4 w-4" />
      case "all":
        return <Folders className="h-4 w-4" />
      default:
        return <FolderOpen className="h-4 w-4" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="border-yellow-400/20 hover:bg-yellow-400/10"
        >
          {getModeIcon()}
          <span className="ml-2">{getModeLabel()}</span>
          <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-white dark:bg-black border-yellow-400/20"
      >
        <DropdownMenuLabel className="text-black dark:text-white">
          Filter Proposals
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-yellow-400/20" />
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => onModeChange(value as ArchiveFilterMode)}>
          <DropdownMenuRadioItem
            value="active"
            className="cursor-pointer focus:bg-yellow-400/10"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-yellow-400" />
                <span>Active Only</span>
              </div>
              {activeCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-yellow-400/30 text-yellow-400 ml-2"
                >
                  {activeCount}
                </Badge>
              )}
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="archived"
            className="cursor-pointer focus:bg-yellow-400/10"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-yellow-400" />
                <span>Archived Only</span>
              </div>
              {archivedCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-yellow-400/30 text-yellow-400 ml-2"
                >
                  {archivedCount}
                </Badge>
              )}
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="all"
            className="cursor-pointer focus:bg-yellow-400/10"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Folders className="h-4 w-4 text-yellow-400" />
                <span>All Proposals</span>
              </div>
              {(activeCount + archivedCount) > 0 && (
                <Badge
                  variant="outline"
                  className="border-yellow-400/30 text-yellow-400 ml-2"
                >
                  {activeCount + archivedCount}
                </Badge>
              )}
            </div>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
