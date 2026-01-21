/**
 * Action Plan Agent v2.0
 * Converts findings into concrete, actionable recommendations
 */

import { ResearchJob, Finding } from '../types';
import { DevilsAdvocateOutput } from './devils-advocate';

export interface Recommendation {
  priority: number;
  action: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  nextSteps: string[];
  successMetric: string;
  owner?: string;
  deadline?: string;
}

export interface KeyDecision {
  decision: string;
  options: string[];
  recommendation: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface QuickWin {
  action: string;
  timeToComplete: string;
  benefit: string;
}

export interface ActionPlanOutput {
  recommendations: Recommendation[];
  keyDecisions: KeyDecision[];
  quickWins: QuickWin[];
  summary: string;
  priorityMatrix: {
    highImpactLowEffort: string[];
    highImpactHighEffort: string[];
    lowImpactLowEffort: string[];
    lowImpactHighEffort: string[];
  };
}

/**
 * Generate recommendations from findings
 */
function generateRecommendations(
  job: ResearchJob,
  devilsAdvocate: DevilsAdvocateOutput
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { findings } = job;

  // Priority 1: Address high-severity challenges
  for (const challenge of devilsAdvocate.challenges.filter(c => c.severity === 'high')) {
    recommendations.push({
      priority: 1,
      action: `Validate: "${challenge.conclusion.slice(0, 50)}..."`,
      rationale: challenge.challenge,
      effort: 'medium',
      impact: 'high',
      nextSteps: [
        'Search for independent verification sources',
        'Look for customer/employee reviews',
        'Cross-reference with competitor claims'
      ],
      successMetric: 'Get 2+ independent sources confirming or refuting claim'
    });
  }

  // Priority 2: Fill blind spots
  for (const blindSpot of devilsAdvocate.blindSpots) {
    recommendations.push({
      priority: 2,
      action: `Research: ${blindSpot.area}`,
      rationale: blindSpot.why,
      effort: 'medium',
      impact: 'medium',
      nextSteps: [blindSpot.recommendation],
      successMetric: `Comprehensive view of ${blindSpot.area}`
    });
  }

  // Priority 3: Act on high-confidence findings
  const highConfidenceFindings = findings.filter(f => f.confidence >= 0.8);
  for (const finding of highConfidenceFindings.slice(0, 3)) {
    recommendations.push({
      priority: 3,
      action: deriveActionFromFinding(finding),
      rationale: `High-confidence finding: ${finding.claim.slice(0, 60)}`,
      effort: 'low',
      impact: 'high',
      nextSteps: generateNextSteps(finding),
      successMetric: generateSuccessMetric(finding)
    });
  }

  // Priority 4: Monitor risks
  for (const risk of devilsAdvocate.risks.filter(r => r.impact === 'high')) {
    recommendations.push({
      priority: 4,
      action: `Monitor risk: ${risk.risk.slice(0, 50)}`,
      rationale: `Probability: ${risk.probability}, Impact: ${risk.impact}`,
      effort: 'low',
      impact: 'medium',
      nextSteps: [risk.mitigation, 'Set up alerts for relevant news'],
      successMetric: 'Early warning system in place'
    });
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}

/**
 * Derive action from finding
 */
function deriveActionFromFinding(finding: Finding): string {
  const claim = finding.claim.toLowerCase();

  if (claim.includes('funding') || claim.includes('raised')) {
    return 'Track company for partnership/competitive intelligence';
  }
  if (claim.includes('customer') || claim.includes('client')) {
    return 'Analyze customer acquisition strategy';
  }
  if (claim.includes('technology') || claim.includes('ai')) {
    return 'Evaluate technology approach for learning';
  }
  if (claim.includes('team') || claim.includes('founder')) {
    return 'Research team background for pattern matching';
  }

  return `Deep dive on: ${finding.category}`;
}

/**
 * Generate next steps for a finding
 */
function generateNextSteps(finding: Finding): string[] {
  const steps: string[] = [];
  const claim = finding.claim.toLowerCase();

  if (claim.includes('funding')) {
    steps.push('Check Crunchbase for full funding history');
    steps.push('Find investor thesis/blog posts');
    steps.push('Track future funding announcements');
  } else if (claim.includes('customer')) {
    steps.push('Find customer case studies');
    steps.push('Search G2/Capterra reviews');
    steps.push('Look for LinkedIn connections at customer companies');
  } else {
    steps.push('Set up Google Alerts for company name');
    steps.push('Follow company on LinkedIn/Twitter');
    steps.push('Subscribe to company newsletter');
  }

  return steps;
}

/**
 * Generate success metric for a finding
 */
function generateSuccessMetric(finding: Finding): string {
  const claim = finding.claim.toLowerCase();

  if (claim.includes('funding')) {
    return 'Complete funding history documented with investor names';
  }
  if (claim.includes('customer')) {
    return '5+ customer references identified with contact info';
  }
  if (claim.includes('technology')) {
    return 'Technical architecture understood and documented';
  }

  return 'Actionable insights captured in notes';
}

/**
 * Identify key decisions
 */
function identifyKeyDecisions(job: ResearchJob): KeyDecision[] {
  const decisions: KeyDecision[] = [];
  const { topic, findings } = job;

  // Common decisions for competitive analysis
  if (topic.toLowerCase().includes('competitive') || topic.toLowerCase().includes('market')) {
    decisions.push({
      decision: 'Which segment to focus on?',
      options: extractSegments(findings),
      recommendation: identifyBestSegment(findings),
      reasoning: 'Based on funding trends, market size, and competitive intensity',
      confidence: 'medium'
    });

    decisions.push({
      decision: 'Build vs Buy vs Partner?',
      options: ['Build in-house AI', 'License from vendor', 'Partner with startup'],
      recommendation: 'Partner with emerging player for speed; build for differentiation',
      reasoning: 'Time-to-market critical in fast-moving AI space',
      confidence: 'medium'
    });
  }

  // Decision about depth of analysis
  decisions.push({
    decision: 'Next research priority?',
    options: ['Deep dive on #1 player', 'Broader market scan', 'Customer interviews', 'Technical evaluation'],
    recommendation: 'Customer interviews to validate findings',
    reasoning: 'Current research based on public sources; need ground truth',
    confidence: 'high'
  });

  return decisions;
}

/**
 * Extract segments from findings
 */
function extractSegments(findings: Finding[]): string[] {
  const segments = new Set<string>();

  for (const finding of findings) {
    if (finding.category) {
      segments.add(finding.category);
    }
  }

  return Array.from(segments).slice(0, 4);
}

/**
 * Identify best segment based on findings
 */
function identifyBestSegment(findings: Finding[]): string {
  const categoryScores: Record<string, number> = {};

  for (const finding of findings) {
    if (finding.category) {
      categoryScores[finding.category] = (categoryScores[finding.category] || 0) + finding.confidence;
    }
  }

  const sorted = Object.entries(categoryScores).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'Insufficient data for recommendation';
}

/**
 * Generate quick wins
 */
function generateQuickWins(job: ResearchJob): QuickWin[] {
  const quickWins: QuickWin[] = [];
  const { findings } = job;

  // Standard quick wins
  quickWins.push({
    action: 'Set up Google Alerts for top 5 companies',
    timeToComplete: '10 minutes',
    benefit: 'Automatic updates on news and developments'
  });

  quickWins.push({
    action: 'Follow key companies on LinkedIn',
    timeToComplete: '5 minutes',
    benefit: 'See job postings and company updates'
  });

  quickWins.push({
    action: 'Subscribe to company newsletters',
    timeToComplete: '15 minutes',
    benefit: 'First-hand product announcements and thought leadership'
  });

  quickWins.push({
    action: 'Create watchlist in Crunchbase/PitchBook',
    timeToComplete: '10 minutes',
    benefit: 'Track funding rounds and M&A activity'
  });

  // Topic-specific quick wins
  if (findings.some(f => f.claim.toLowerCase().includes('investor'))) {
    quickWins.push({
      action: 'Subscribe to key investor newsletters (Sequoia, a16z)',
      timeToComplete: '5 minutes',
      benefit: 'Early signal on investment thesis and portfolio updates'
    });
  }

  return quickWins;
}

/**
 * Build priority matrix
 */
function buildPriorityMatrix(recommendations: Recommendation[]): ActionPlanOutput['priorityMatrix'] {
  return {
    highImpactLowEffort: recommendations
      .filter(r => r.impact === 'high' && r.effort === 'low')
      .map(r => r.action),
    highImpactHighEffort: recommendations
      .filter(r => r.impact === 'high' && r.effort === 'high')
      .map(r => r.action),
    lowImpactLowEffort: recommendations
      .filter(r => r.impact === 'low' && r.effort === 'low')
      .map(r => r.action),
    lowImpactHighEffort: recommendations
      .filter(r => r.impact === 'low' && r.effort === 'high')
      .map(r => r.action)
  };
}

/**
 * Main Action Plan function
 */
export function generateActionPlan(
  job: ResearchJob,
  devilsAdvocate: DevilsAdvocateOutput
): ActionPlanOutput {
  const recommendations = generateRecommendations(job, devilsAdvocate);
  const keyDecisions = identifyKeyDecisions(job);
  const quickWins = generateQuickWins(job);
  const priorityMatrix = buildPriorityMatrix(recommendations);

  const summary = generateSummary(recommendations, keyDecisions);

  return {
    recommendations,
    keyDecisions,
    quickWins,
    summary,
    priorityMatrix
  };
}

/**
 * Generate summary
 */
function generateSummary(recommendations: Recommendation[], keyDecisions: KeyDecision[]): string {
  const topActions = recommendations.slice(0, 3).map(r => r.action).join('; ');
  return `Top priorities: ${topActions}. ${keyDecisions.length} key decision(s) to make.`;
}

/**
 * Format Action Plan as markdown
 */
export function formatActionPlanMarkdown(output: ActionPlanOutput): string {
  const lines: string[] = [
    '## Action Plan',
    '',
    `**Summary**: ${output.summary}`,
    '',
    '### Priority Matrix',
    '',
    '| Impact | Low Effort | High Effort |',
    '|--------|------------|-------------|',
    `| **High** | ${output.priorityMatrix.highImpactLowEffort.slice(0, 2).join(', ') || '-'} | ${output.priorityMatrix.highImpactHighEffort.slice(0, 2).join(', ') || '-'} |`,
    `| **Low** | ${output.priorityMatrix.lowImpactLowEffort.slice(0, 2).join(', ') || '-'} | ${output.priorityMatrix.lowImpactHighEffort.slice(0, 2).join(', ') || '-'} |`,
    '',
    '### Recommendations',
    ''
  ];

  for (const rec of output.recommendations.slice(0, 7)) {
    lines.push(`#### P${rec.priority}: ${rec.action}`);
    lines.push(`- **Rationale**: ${rec.rationale}`);
    lines.push(`- **Effort/Impact**: ${rec.effort}/${rec.impact}`);
    lines.push(`- **Next Steps**:`);
    for (const step of rec.nextSteps) {
      lines.push(`  - ${step}`);
    }
    lines.push(`- **Success Metric**: ${rec.successMetric}`);
    lines.push('');
  }

  lines.push('### Key Decisions');
  lines.push('');
  for (const decision of output.keyDecisions) {
    lines.push(`#### ${decision.decision}`);
    lines.push(`- **Options**: ${decision.options.join(' | ')}`);
    lines.push(`- **Recommendation**: ${decision.recommendation}`);
    lines.push(`- **Reasoning**: ${decision.reasoning}`);
    lines.push(`- **Confidence**: ${decision.confidence}`);
    lines.push('');
  }

  lines.push('### Quick Wins (Do Today)');
  lines.push('');
  for (const win of output.quickWins) {
    lines.push(`- [ ] **${win.action}** (${win.timeToComplete}) - ${win.benefit}`);
  }

  return lines.join('\n');
}
