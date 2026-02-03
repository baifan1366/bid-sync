# Quick Reference: Decision Page Actions

## 🚀 Quick Start

### Access the Page
```
URL: /client-projects/[projectId]/decision
Role: Client (project owner)
```

### Available Actions

| Action | Button Color | Status Required | Result |
|--------|-------------|-----------------|--------|
| **Mark Under Review** | Yellow outline | Submitted | Status → under_review |
| **Accept** | Green | Submitted/Under Review | Status → accepted, others → rejected |
| **Reject** | Red | Submitted/Under Review | Status → rejected (requires feedback) |

## 🎯 Button Locations

Buttons appear at the bottom of each proposal card in the decision page grid.

## 🔄 Status Flow

```
Submitted ──[Mark Under Review]──> Under Review
    │                                    │
    └────────[Accept/Reject]─────────────┘
                    │
            ┌───────┴───────┐
            ↓               ↓
        Accepted        Rejected
```

## 💡 Key Features

### Accept Proposal
- ✅ Opens confirmation dialog
- ✅ Shows proposal details (title, team, budget)
- ✅ Warns about auto-rejecting other proposals
- ✅ Updates project status to "awarded"
- ✅ Sends notifications to entire bidding team

### Reject Proposal
- ✅ Opens feedback dialog
- ✅ Requires rejection reason (mandatory)
- ✅ Sends feedback to bidding lead
- ✅ Other proposals remain unchanged

### Mark Under Review
- ✅ One-click action (no dialog)
- ✅ Updates status immediately
- ✅ Notifies bidding lead
- ✅ Shows in "Under Review" filter

## 🎨 Visual Design

```
┌─────────────────────────────────────┐
│  Proposal Card                      │
│  ─────────────────────────────────  │
│  Title: Web Development Proposal    │
│  Team: John's Team                  │
│  Budget: $50,000                    │
│  Status: [Submitted]                │
│  ─────────────────────────────────  │
│  [👁️ Mark Under Review]             │
│  [✓ Accept]  [✗ Reject]             │
└─────────────────────────────────────┘
```

## 🔐 Authorization

- ✅ Only project **client** can perform actions
- ✅ Bidding leads/members cannot access
- ✅ Enforced at both frontend and backend
- ✅ Returns 403 Forbidden for unauthorized users

## 📱 Responsive Design

### Desktop
- Buttons side-by-side
- Full card layout

### Mobile
- Buttons stack vertically
- Touch-friendly sizing

## ⚡ Real-time Updates

- ✅ Status changes broadcast to all connected clients
- ✅ Progress tracker updates automatically
- ✅ Toast notifications appear
- ✅ No page refresh needed

## 🔔 Notifications

| Action | Recipient | Priority | Email |
|--------|-----------|----------|-------|
| Accept | Lead + Team | HIGH | ✅ Yes |
| Reject | Lead only | HIGH | ✅ Yes |
| Under Review | Lead only | MEDIUM | ❌ No |

## 🐛 Troubleshooting

### Buttons not showing?
- Check proposal status (must be submitted/under_review)
- Verify you're logged in as project client
- Refresh the page

### Action fails?
- Check browser console for errors
- Verify network connection
- Ensure you have permission

### Page won't load?
- Check project ID is valid
- Verify you own the project
- Clear browser cache

## 📊 Status Filters

Use the filter dropdown to view:
- **All Proposals** - Show everything
- **Submitted** - Ready for review
- **Under Review** - Currently reviewing
- **Accepted** - Winning proposal
- **Rejected** - Declined proposals

## 🎯 Best Practices

1. **Review First** - Click proposal card to view details before deciding
2. **Provide Feedback** - Always explain rejection reasons
3. **Compare** - Use comparison mode to evaluate multiple proposals
4. **Communicate** - Use chat to ask questions before deciding
5. **Score** - Use scoring system for objective evaluation

## ⌨️ Keyboard Shortcuts

- `Tab` - Navigate between buttons
- `Enter` - Activate focused button
- `Esc` - Close dialog

## 🔗 Related Pages

- **Proposal Detail:** Click card to view full proposal
- **Comparison View:** Select 2-4 proposals to compare
- **Scoring:** Score proposals before deciding
- **Chat:** Communicate with bidding teams

## 📞 Need Help?

1. Check `DECISION-PAGE-TESTING-GUIDE.md` for detailed testing
2. Review `CLIENT-DECISION-ACTIONS-IMPLEMENTATION.md` for technical details
3. See `DECISION-PAGE-IMPLEMENTATION-SUMMARY.md` for overview

---

**Quick Tip:** Use "Mark Under Review" to signal you're actively evaluating a proposal!
