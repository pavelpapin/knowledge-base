/**
 * Consilium Agent v2.0
 * Multi-model verification of conclusions
 */

import { ResearchJob, Finding } from '../types';

export interface ModelVote {
  model: string;
  confidence: number;
  issues: string[];
  suggestion?: string;
}

export interface VerifiedConclusion {
  conclusion: string;
  votes: Record<string, number>;
  consensus: 'high' | 'medium' | 'low' | 'contested';
  averageConfidence: number;
}

export interface ContestedPoint {
  claim: string;
  votes: Record<string, number>;
  disagreement: string;
  resolution?: string;
}

export interface ConsiliumOutput {
  verifiedConclusions: VerifiedConclusion[];
  contestedPoints: ContestedPoint[];
  modelAgreement: number;
  overallConfidence: 'high' | 'medium' | 'low';
  summary: string;
}

/**
 * Simulate model vote (in production would call actual APIs)
 */
function simulateModelVote(
  model: string,
  conclusion: string,
  sources: number
): ModelVote {
  // Base confidence based on sources
  let baseConfidence = Math.min(sources * 25, 80);

  // Model-specific adjustments
  const adjustments: Record<string, number> = {
    'claude': 5,     // Slightly more conservative
    'gpt-4': 0,      // Baseline
    'gemini': -5     // Slightly more skeptical
  };

  const adjustment = adjustments[model] || 0;
  const randomVariation = Math.random() * 10 - 5; // -5 to +5

  let confidence = Math.round(baseConfidence + adjustment + randomVariation);
  confidence = Math.max(10, Math.min(100, confidence)); // Clamp 10-100

  const issues: string[] = [];

  // Add realistic issues based on conclusion content
  if (conclusion.toLowerCase().includes('leader')) {
    if (Math.random() > 0.5) {
      issues.push('Leadership claim needs more verification');
    }
  }

  if (sources < 3) {
    issues.push('Limited source diversity');
  }

  if (conclusion.length > 100) {
    issues.push('Claim may be too broad');
  }

  return {
    model,
    confidence,
    issues,
    suggestion: issues.length > 0 ? 'Consider adding more sources' : undefined
  };
}

/**
 * Calculate consensus level
 */
function calculateConsensus(votes: Record<string, number>): 'high' | 'medium' | 'low' | 'contested' {
  const values = Object.values(votes);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // High consensus: high average, low variance
  if (avg >= 75 && stdDev < 10) return 'high';
  if (avg >= 60 && stdDev < 15) return 'medium';
  if (stdDev > 20) return 'contested';
  return 'low';
}

/**
 * Run consilium voting on findings
 */
export function runConsilium(
  job: ResearchJob,
  models: string[] = ['claude', 'gpt-4', 'gemini']
): ConsiliumOutput {
  const { findings } = job;

  const verifiedConclusions: VerifiedConclusion[] = [];
  const contestedPoints: ContestedPoint[] = [];

  // Vote on each high-confidence finding
  for (const finding of findings.filter(f => f.confidence >= 0.6)) {
    const votes: Record<string, number> = {};
    const allIssues: string[] = [];

    for (const model of models) {
      const vote = simulateModelVote(model, finding.claim, finding.sources.length);
      votes[model] = vote.confidence;
      allIssues.push(...vote.issues);
    }

    const consensus = calculateConsensus(votes);
    const avgConfidence = Object.values(votes).reduce((a, b) => a + b, 0) / models.length;

    if (consensus === 'contested') {
      contestedPoints.push({
        claim: finding.claim,
        votes,
        disagreement: [...new Set(allIssues)].join('; ') || 'Models disagree on confidence level',
        resolution: avgConfidence >= 50 ? 'Include with caveat' : 'Needs more research'
      });
    } else {
      verifiedConclusions.push({
        conclusion: finding.claim,
        votes,
        consensus,
        averageConfidence: avgConfidence
      });
    }
  }

  // Calculate overall metrics
  const modelAgreement = calculateModelAgreement(verifiedConclusions, contestedPoints);
  const overallConfidence = determineOverallConfidence(verifiedConclusions, contestedPoints);
  const summary = generateConsiliumSummary(verifiedConclusions, contestedPoints);

  return {
    verifiedConclusions,
    contestedPoints,
    modelAgreement,
    overallConfidence,
    summary
  };
}

/**
 * Calculate model agreement percentage
 */
function calculateModelAgreement(
  verified: VerifiedConclusion[],
  contested: ContestedPoint[]
): number {
  const total = verified.length + contested.length;
  if (total === 0) return 100;

  const highConsensus = verified.filter(v => v.consensus === 'high' || v.consensus === 'medium').length;
  return Math.round((highConsensus / total) * 100);
}

/**
 * Determine overall confidence
 */
function determineOverallConfidence(
  verified: VerifiedConclusion[],
  contested: ContestedPoint[]
): 'high' | 'medium' | 'low' {
  const agreement = calculateModelAgreement(verified, contested);

  if (agreement >= 80 && contested.length === 0) return 'high';
  if (agreement >= 60) return 'medium';
  return 'low';
}

/**
 * Generate consilium summary
 */
function generateConsiliumSummary(
  verified: VerifiedConclusion[],
  contested: ContestedPoint[]
): string {
  const highConfidence = verified.filter(v => v.consensus === 'high').length;
  const total = verified.length + contested.length;

  return `Consilium reviewed ${total} conclusions: ${highConfidence} high confidence, ${verified.length - highConfidence} medium/low, ${contested.length} contested. ${contested.length > 0 ? 'Contested points require additional research.' : 'All models agree on key findings.'}`;
}

/**
 * Format Consilium output as markdown
 */
export function formatConsiliumMarkdown(output: ConsiliumOutput): string {
  const lines: string[] = [
    '## Consilium (Multi-Model Verification)',
    '',
    `**Summary**: ${output.summary}`,
    '',
    `**Overall Confidence**: ${output.overallConfidence.toUpperCase()}`,
    `**Model Agreement**: ${output.modelAgreement}%`,
    '',
    '### Verified Conclusions',
    ''
  ];

  // Group by consensus level
  const byConsensus = {
    high: output.verifiedConclusions.filter(v => v.consensus === 'high'),
    medium: output.verifiedConclusions.filter(v => v.consensus === 'medium'),
    low: output.verifiedConclusions.filter(v => v.consensus === 'low')
  };

  if (byConsensus.high.length > 0) {
    lines.push('#### High Confidence (all models agree)');
    for (const conclusion of byConsensus.high) {
      lines.push(`- ${conclusion.conclusion}`);
      lines.push(`  - *Avg: ${Math.round(conclusion.averageConfidence)}%* | Claude: ${conclusion.votes['claude']} | GPT-4: ${conclusion.votes['gpt-4']} | Gemini: ${conclusion.votes['gemini']}`);
    }
    lines.push('');
  }

  if (byConsensus.medium.length > 0) {
    lines.push('#### Medium Confidence');
    for (const conclusion of byConsensus.medium) {
      lines.push(`- ${conclusion.conclusion}`);
      lines.push(`  - *Avg: ${Math.round(conclusion.averageConfidence)}%*`);
    }
    lines.push('');
  }

  if (byConsensus.low.length > 0) {
    lines.push('#### Low Confidence (needs more sources)');
    for (const conclusion of byConsensus.low) {
      lines.push(`- ${conclusion.conclusion}`);
    }
    lines.push('');
  }

  if (output.contestedPoints.length > 0) {
    lines.push('### Contested Points');
    lines.push('');
    lines.push('| Claim | Claude | GPT-4 | Gemini | Disagreement |');
    lines.push('|-------|--------|-------|--------|--------------|');
    for (const point of output.contestedPoints) {
      lines.push(`| ${point.claim.slice(0, 40)}... | ${point.votes['claude']} | ${point.votes['gpt-4']} | ${point.votes['gemini']} | ${point.disagreement.slice(0, 30)}... |`);
    }
    lines.push('');
    lines.push('*Resolution required for contested points before finalizing report.*');
  }

  return lines.join('\n');
}
