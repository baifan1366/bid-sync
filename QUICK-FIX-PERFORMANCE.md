# Quick Fix: Performance Page Error

## 🚨 The Problem
Performance page (`/performance`) was timing out with connection errors.

## ⚡ Quick Fix (3 Steps)

### 1️⃣ Run This SQL in Supabase
Open Supabase SQL Editor → Copy/paste this:

```sql
CREATE OR REPLACE FUNCTION public.get_bid_performance(p_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'totalProposals', COUNT(*),
        'submitted', COUNT(*) FILTER (WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected')),
        'accepted', COUNT(*) FILTER (WHERE status = 'approved'),
        'rejected', COUNT(*) FILTER (WHERE status = 'rejected'),
        'winRate', CASE 
            WHEN COUNT(*) FILTER (WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected')) > 0 
            THEN ROUND(
                (COUNT(*) FILTER (WHERE status = 'approved')::NUMERIC / 
                COUNT(*) FILTER (WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected'))::NUMERIC) * 100, 
                2
            )
            ELSE 0
        END,
        'statusBreakdown', jsonb_build_object(
            'draft', COUNT(*) FILTER (WHERE status = 'draft'),
            'submitted', COUNT(*) FILTER (WHERE status = 'submitted'),
            'reviewing', COUNT(*) FILTER (WHERE status = 'reviewing'),
            'approved', COUNT(*) FILTER (WHERE status = 'approved'),
            'rejected', COUNT(*) FILTER (WHERE status = 'rejected')
        ),
        'averageTeamSize', COALESCE(ROUND(AVG(pp.team_size), 1), 0),
        'averageSectionsCount', COALESCE(ROUND(AVG(pp.sections_count), 1), 0),
        'averageTimeToSubmit', COALESCE(
            EXTRACT(EPOCH FROM AVG(pp.time_to_submit))::INT, 
            0
        )
    )
    INTO v_result
    FROM public.proposals p
    LEFT JOIN public.proposal_performance pp ON pp.proposal_id = p.id
    WHERE p.lead_id = p_lead_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_bid_performance(UUID) TO authenticated;
```

### 2️⃣ Restart Dev Server
```bash
# Stop the server (Ctrl+C)
npm run dev
```

### 3️⃣ Test
Navigate to `/performance` - should load in ~5 seconds!

## ✅ What Was Fixed
- ✅ Created missing API routes (`/api/analytics/statistics`, `/api/analytics/timeline`)
- ✅ Added database function `get_bid_performance`
- ✅ Added timeout protection (15s GraphQL, 10s API)
- ✅ Improved error messages
- ✅ Fixed unused imports

## 🧪 Verify It Works
```bash
npx tsx scripts/check-performance-setup.ts
```

## 📖 Full Documentation
See `PERFORMANCE-PAGE-FIX-SUMMARY.md` for complete details.

---
**That's it!** The performance page should now work. 🎉
