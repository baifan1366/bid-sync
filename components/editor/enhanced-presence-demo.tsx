/**
 * Enhanced Presence Demo
 * 
 * Example component demonstrating the enhanced presence indicators
 * with idle/away status, section-specific presence, and visual distinctions.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ActiveCollaborators, 
  ActiveCollaboratorsList,
  CollaboratorCursor,
  TypingIndicator,
  type PresenceStatus 
} from './active-collaborators'

export function EnhancedPresenceDemo() {
  // Demo users with different presence statuses
  const [users] = useState([
    {
      id: '1',
      name: 'Alice Johnson',
      color: '#3B82F6',
      status: 'active' as PresenceStatus,
      currentSection: 'Executive Summary',
      cursorPosition: { from: 0, to: 0 },
    },
    {
      id: '2',
      name: 'Bob Smith',
      color: '#10B981',
      status: 'idle' as PresenceStatus,
      currentSection: 'Technical Approach',
      cursorPosition: { from: 100, to: 100 },
    },
    {
      id: '3',
      name: 'Carol Williams',
      color: '#F59E0B',
      status: 'away' as PresenceStatus,
      currentSection: undefined,
      cursorPosition: undefined,
    },
    {
      id: '4',
      name: 'David Brown',
      color: '#EF4444',
      status: 'active' as PresenceStatus,
      currentSection: 'Budget Breakdown',
      cursorPosition: { from: 200, to: 200 },
    },
  ])

  const currentUserId = '1'
  const typingUsers = users.filter(u => u.status === 'active' && u.id !== currentUserId)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Enhanced Presence Indicators</h1>
        <p className="text-muted-foreground">
          Demonstration of real-time collaboration presence with status indicators
        </p>
      </div>

      {/* Compact Avatar List */}
      <Card>
        <CardHeader>
          <CardTitle>Compact Presence View</CardTitle>
          <CardDescription>
            Shows active collaborators with status indicators (green=active, yellow=idle, gray=away)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveCollaborators
            users={users}
            currentUserId={currentUserId}
            maxVisible={5}
            showSectionInfo={true}
          />
        </CardContent>
      </Card>

      {/* Detailed List View */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Presence List</CardTitle>
          <CardDescription>
            Shows all collaborators with their current status and section information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveCollaboratorsList
            users={users}
            currentUserId={currentUserId}
            showSectionInfo={true}
          />
        </CardContent>
      </Card>

      {/* Status Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Presence Status Legend</CardTitle>
          <CardDescription>
            Understanding the different presence states
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <div>
              <p className="font-medium">Active</p>
              <p className="text-sm text-muted-foreground">
                User is currently editing and has been active in the last 2 minutes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div>
              <p className="font-medium">Idle</p>
              <p className="text-sm text-muted-foreground">
                User is connected but has been inactive for 2-5 minutes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-gray-400" />
            <div>
              <p className="font-medium">Away</p>
              <p className="text-sm text-muted-foreground">
                User has been inactive for more than 5 minutes (Requirement 2.4)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cursor Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Cursor Position Indicators</CardTitle>
          <CardDescription>
            Shows where other users are currently editing (Requirement 2.3, 2.5)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative h-40 bg-muted/20 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Simulated editor content area with cursor positions...
            </p>
            {users
              .filter(u => u.cursorPosition && u.id !== currentUserId)
              .map((user, index) => (
                <CollaboratorCursor
                  key={user.id}
                  user={user}
                  position={{ top: 60 + index * 30, left: 20 + index * 50 }}
                />
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Typing Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>Typing Indicator</CardTitle>
          <CardDescription>
            Shows when other users are actively typing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TypingIndicator users={typingUsers} />
        </CardContent>
      </Card>

      {/* Section-Specific Presence */}
      <Card>
        <CardHeader>
          <CardTitle>Section-Specific Presence</CardTitle>
          <CardDescription>
            Shows which users are editing which sections (Requirement 2.3)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {['Executive Summary', 'Technical Approach', 'Budget Breakdown'].map(section => {
            const sectionUsers = users.filter(u => u.currentSection === section)
            return (
              <div key={section} className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20">
                <div>
                  <p className="font-medium">{section}</p>
                  <p className="text-sm text-muted-foreground">
                    {sectionUsers.length === 0
                      ? 'No one editing'
                      : `${sectionUsers.length} user${sectionUsers.length > 1 ? 's' : ''} editing`}
                  </p>
                </div>
                {sectionUsers.length > 0 && (
                  <div className="flex -space-x-2">
                    {sectionUsers.map(user => (
                      <Badge
                        key={user.id}
                        variant="secondary"
                        className="border-2 border-white dark:border-black"
                        style={{ backgroundColor: user.color }}
                      >
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Implementation Notes */}
      <Card className="border-yellow-400/40">
        <CardHeader>
          <CardTitle>Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Requirement 2.1:</strong> Active users are displayed with presence indicators
          </p>
          <p>
            <strong>Requirement 2.2:</strong> All active users shown in presence list
          </p>
          <p>
            <strong>Requirement 2.3:</strong> Section-specific presence shows who's editing which section
          </p>
          <p>
            <strong>Requirement 2.4:</strong> 5-minute idle timeout automatically marks users as away
          </p>
          <p>
            <strong>Requirement 2.5:</strong> Cursor positions displayed with user colors
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
