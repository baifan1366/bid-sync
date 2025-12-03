/**
 * Script to verify performance analytics setup
 * Run with: npx tsx scripts/check-performance-setup.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkSetup() {
  console.log('🔍 Checking Performance Analytics Setup...\n')

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Check 1: Database function exists
  console.log('1️⃣ Checking database function...')
  const { data: functionExists, error: funcError } = await supabase
    .from('information_schema.routines')
    .select('routine_name')
    .eq('routine_schema', 'public')
    .eq('routine_name', 'get_bid_performance')
    .single()

  if (funcError || !functionExists) {
    console.log('❌ Function get_bid_performance NOT FOUND')
    console.log('   Run: db/migrations/add_get_bid_performance_function.sql\n')
  } else {
    console.log('✅ Function get_bid_performance exists\n')
  }

  // Check 2: Test function with a sample lead ID
  console.log('2️⃣ Testing function execution...')
  
  // Get a sample lead
  const { data: leads } = await supabase
    .from('proposals')
    .select('lead_id')
    .limit(1)
    .single()

  if (leads) {
    const { data: perfData, error: perfError } = await supabase
      .rpc('get_bid_performance', { p_lead_id: leads.lead_id })

    if (perfError) {
      console.log('❌ Function execution failed:', perfError.message)
    } else {
      console.log('✅ Function executed successfully')
      console.log('   Sample data:', JSON.stringify(perfData, null, 2), '\n')
    }
  } else {
    console.log('⚠️  No proposals found to test with\n')
  }

  // Check 3: Proposal performance table
  console.log('3️⃣ Checking proposal_performance table...')
  const { data: perfTable, error: tableError } = await supabase
    .from('proposal_performance')
    .select('*')
    .limit(1)

  if (tableError) {
    console.log('❌ Table proposal_performance error:', tableError.message)
  } else {
    console.log('✅ Table proposal_performance accessible')
    console.log(`   Records found: ${perfTable?.length || 0}\n`)
  }

  // Check 4: API routes
  console.log('4️⃣ Checking API routes...')
  
  const apiChecks = [
    { name: 'GraphQL', path: '/api/graphql' },
    { name: 'Statistics', path: '/api/analytics/statistics' },
    { name: 'Timeline', path: '/api/analytics/timeline' },
  ]

  for (const check of apiChecks) {
    try {
      const response = await fetch(`http://localhost:3000${check.path}`)
      if (response.status === 401 || response.status === 400) {
        console.log(`✅ ${check.name} route exists (${response.status})`)
      } else {
        console.log(`⚠️  ${check.name} route returned ${response.status}`)
      }
    } catch (error) {
      console.log(`❌ ${check.name} route not accessible`)
    }
  }

  console.log('\n✨ Setup check complete!')
}

checkSetup().catch(console.error)
