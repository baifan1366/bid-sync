/**
 * AI Assistance Service Usage Examples
 * 
 * Demonstrates how to use the AI Assistance Service for proposal content generation
 */

import { AIAssistanceService } from './ai-assistance-service';

/**
 * Example 1: Generate a draft section for a proposal
 * Requirement 10.2: AI draft generation from project requirements
 */
export async function exampleGenerateDraft() {
  console.log('=== Example: Generate Draft Section ===\n');

  const result = await AIAssistanceService.generateDraft({
    projectTitle: 'E-Commerce Platform Modernization',
    projectDescription: 'Modernize legacy e-commerce platform with microservices architecture, improve performance, and enhance user experience',
    sectionTitle: 'Technical Approach',
    budget: 250000,
    deadline: '2024-12-31',
    additionalContext: 'Client uses AWS infrastructure and prefers React for frontend',
  });

  if (result.success && result.data) {
    console.log('Generated Draft:');
    console.log(result.data.content);
    console.log('\nMetadata:');
    console.log(`- Model: ${result.data.metadata?.model}`);
    console.log(`- Tokens Used: ${result.data.metadata?.tokensUsed}`);
    console.log(`- Generated At: ${result.data.metadata?.generatedAt}`);
  } else {
    console.error('Error:', result.error);
  }
}

/**
 * Example 2: Rewrite text for professional tone
 * Requirement 10.3: AI rewrite for text improvement
 */
export async function exampleRewriteText() {
  console.log('\n=== Example: Rewrite Text ===\n');

  const originalText = `We're gonna build a really cool system that'll make everything faster. 
It's gonna be awesome and the client will love it. We've done this kinda thing before.`;

  const result = await AIAssistanceService.rewriteText({
    text: originalText,
    tone: 'professional',
    context: 'Proposal section describing technical capabilities',
  });

  if (result.success && result.data) {
    console.log('Original Text:');
    console.log(originalText);
    console.log('\nRewritten Text:');
    console.log(result.data.content);
  } else {
    console.error('Error:', result.error);
  }
}

/**
 * Example 3: Rewrite with different tones
 */
export async function exampleDifferentTones() {
  console.log('\n=== Example: Different Tones ===\n');

  const text = 'Our solution provides significant improvements to system performance and user satisfaction.';

  const tones: Array<'professional' | 'technical' | 'persuasive' | 'concise'> = [
    'professional',
    'technical',
    'persuasive',
    'concise',
  ];

  for (const tone of tones) {
    const result = await AIAssistanceService.rewriteText({ text, tone });
    
    if (result.success && result.data) {
      console.log(`\n${tone.toUpperCase()} Tone:`);
      console.log(result.data.content);
    }
  }
}

/**
 * Example 4: Generate executive summary
 * Requirement 10.4: AI summarization for executive summaries
 */
export async function exampleGenerateSummary() {
  console.log('\n=== Example: Generate Executive Summary ===\n');

  const proposalContent = `
    Our proposed solution leverages modern cloud-native architecture to deliver a scalable,
    high-performance e-commerce platform. We will implement microservices using Docker and
    Kubernetes, ensuring 99.9% uptime and sub-second response times.
    
    The frontend will be rebuilt using React and Next.js, providing an exceptional user
    experience with server-side rendering and progressive web app capabilities. Our team
    has successfully delivered similar projects for Fortune 500 companies.
    
    The project will be completed in three phases over 6 months, with continuous integration
    and deployment pipelines ensuring quality at every step. We estimate a 40% improvement
    in page load times and a 25% increase in conversion rates.
    
    Our pricing is competitive at $250,000, including 6 months of post-launch support and
    training for your technical team.
  `;

  const result = await AIAssistanceService.generateSummary({
    proposalContent,
    maxLength: 150,
    focusAreas: ['technical approach', 'business value', 'timeline'],
  });

  if (result.success && result.data) {
    console.log('Executive Summary:');
    console.log(result.data.content);
    
    if (result.data.suggestions) {
      console.log('\nSuggestions for Improvement:');
      result.data.suggestions.forEach((suggestion, index) => {
        console.log(`${index + 1}. ${suggestion}`);
      });
    }
  } else {
    console.error('Error:', result.error);
  }
}

/**
 * Example 5: Generate improvement suggestions
 */
export async function exampleGenerateSuggestions() {
  console.log('\n=== Example: Generate Improvement Suggestions ===\n');

  const content = `
    We will build the system using modern technologies. The system will be fast and reliable.
    Our team is experienced. We can deliver on time.
  `;

  const result = await AIAssistanceService.generateSuggestions(content);

  if (result.success && result.data) {
    console.log('Content to Review:');
    console.log(content);
    console.log('\nSuggestions for Improvement:');
    result.data.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });
  } else {
    console.error('Error:', result.error);
  }
}

/**
 * Example 6: Review workflow - Display before applying
 * Requirement 10.5: Review workflow (display before applying)
 */
export async function exampleReviewWorkflow() {
  console.log('\n=== Example: Review Workflow ===\n');

  // Step 1: Generate content
  const draftResult = await AIAssistanceService.generateDraft({
    projectTitle: 'Mobile App Development',
    projectDescription: 'Build a cross-platform mobile app for fitness tracking',
    sectionTitle: 'Project Timeline',
  });

  if (!draftResult.success || !draftResult.data) {
    console.error('Failed to generate draft:', draftResult.error);
    return;
  }

  // Step 2: Display for review
  console.log('Generated Content (for review):');
  console.log('─'.repeat(60));
  console.log(draftResult.data.content);
  console.log('─'.repeat(60));

  // Step 3: Simulate user review decision
  const userApproved = true; // In real app, this would come from user interaction

  if (userApproved) {
    console.log('\n✓ Content approved and applied to proposal');
    // In real implementation, save to database here
  } else {
    console.log('\n✗ Content rejected, not applied to proposal');
    // User can regenerate or edit manually
  }
}

/**
 * Example 7: Error handling
 */
export async function exampleErrorHandling() {
  console.log('\n=== Example: Error Handling ===\n');

  // Invalid input
  const result1 = await AIAssistanceService.generateDraft({
    projectTitle: '', // Empty title
    projectDescription: 'Test',
    sectionTitle: 'Test',
  });

  console.log('Invalid Input Result:');
  console.log(`Success: ${result1.success}`);
  console.log(`Error: ${result1.error}`);

  // Empty text for rewrite
  const result2 = await AIAssistanceService.rewriteText({
    text: '',
  });

  console.log('\nEmpty Text Result:');
  console.log(`Success: ${result2.success}`);
  console.log(`Error: ${result2.error}`);
}

/**
 * Example 8: Complete proposal section workflow
 */
export async function exampleCompleteWorkflow() {
  console.log('\n=== Example: Complete Workflow ===\n');

  // Step 1: Generate initial draft
  console.log('Step 1: Generating initial draft...');
  const draftResult = await AIAssistanceService.generateDraft({
    projectTitle: 'Cloud Migration Project',
    projectDescription: 'Migrate on-premise infrastructure to AWS cloud',
    sectionTitle: 'Risk Management',
    budget: 500000,
  });

  if (!draftResult.success || !draftResult.data) {
    console.error('Failed:', draftResult.error);
    return;
  }

  console.log('Initial draft generated ✓');

  // Step 2: Get improvement suggestions
  console.log('\nStep 2: Getting improvement suggestions...');
  const suggestionsResult = await AIAssistanceService.generateSuggestions(
    draftResult.data.content
  );

  if (suggestionsResult.success && suggestionsResult.data) {
    console.log('Suggestions:');
    suggestionsResult.data.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }

  // Step 3: Rewrite for persuasive tone
  console.log('\nStep 3: Rewriting for persuasive tone...');
  const rewriteResult = await AIAssistanceService.rewriteText({
    text: draftResult.data.content,
    tone: 'persuasive',
  });

  if (rewriteResult.success && rewriteResult.data) {
    console.log('Rewritten version ready ✓');
    console.log('\nFinal Content:');
    console.log(rewriteResult.data.content);
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await exampleGenerateDraft();
    await exampleRewriteText();
    await exampleDifferentTones();
    await exampleGenerateSummary();
    await exampleGenerateSuggestions();
    await exampleReviewWorkflow();
    await exampleErrorHandling();
    await exampleCompleteWorkflow();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Uncomment to run examples
// runAllExamples();
