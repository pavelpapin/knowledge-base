/**
 * Devil's Advocate Agent v2.0
 * Challenges conclusions, finds blind spots, questions assumptions
 */

import { ResearchJob, Finding } from '../types';

export interface Challenge {
  conclusion: string;
  challenge: string;
  risk: string;
  alternativeView: string;
  severity: 'high' | 'medium' | 'low';
}

export interface BlindSpot {
  area: string;
  why: string;
  recommendation: string;
}

export interface QuestionedAssumption {
  assumption: string;
  counter: string;
  evidence: string;
}

export interface Risk {
  risk: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface DevilsAdvocateOutput {
  challenges: Challenge[];
  blindSpots: BlindSpot[];
  assumptionsQuestioned: QuestionedAssumption[];
  risks: Risk[];
  overallAssessment: string;
}

/**
 * Extract key conclusions from findings
 */
function extractConclusions(findings: Finding[]): string[] {
  return findings
    .filter(f => f.confidence >= 0.7)
    .map(f => f.claim);
}

/**
 * Generate challenges for each conclusion
 */
function generateChallenges(conclusions: string[], topic: string): Challenge[] {
  const challenges: Challenge[] = [];

  for (const conclusion of conclusions) {
    // Check for funding-based claims
    if (conclusion.toLowerCase().includes('leader') || conclusion.toLowerCase().includes('dominant')) {
      challenges.push({
        conclusion,
        challenge: 'Leadership claim based on funding/PR, not verified revenue or market share data',
        risk: 'Overestimating market position',
        alternativeView: 'Multiple players may have similar traction; first-mover advantage uncertain',
        severity: 'medium'
      });
    }

    // Check for technology claims
    if (conclusion.toLowerCase().includes('technology') || conclusion.toLowerCase().includes('ai')) {
      challenges.push({
        conclusion,
        challenge: 'Technology advantage may be temporary; competitors can replicate',
        risk: 'Technology moat may be weaker than assumed',
        alternativeView: 'Foundation model providers (OpenAI, Anthropic) can add vertical features',
        severity: 'medium'
      });
    }

    // Check for growth claims
    if (conclusion.toLowerCase().includes('growth') || conclusion.toLowerCase().includes('arr')) {
      challenges.push({
        conclusion,
        challenge: 'Growth metrics often self-reported without verification',
        risk: 'Actual retention and unit economics unknown',
        alternativeView: 'High growth with negative unit economics is unsustainable',
        severity: 'high'
      });
    }
  }

  return challenges;
}

/**
 * Identify blind spots in research
 */
function identifyBlindSpots(job: ResearchJob): BlindSpot[] {
  const blindSpots: BlindSpot[] = [];
  const { sources, findings } = job;

  // Geographic blind spots
  const hasAsianSources = sources.some(s =>
    s.url.includes('.cn') || s.url.includes('.jp') || s.url.includes('.kr')
  );
  if (!hasAsianSources) {
    blindSpots.push({
      area: 'Asian market players',
      why: 'No sources from China, Japan, Korea analyzed',
      recommendation: 'Search for Chinese/Asian vertical AI startups (ByteDance, Alibaba spinoffs)'
    });
  }

  // Regulatory blind spot
  const hasRegulatoryFindings = findings.some(f =>
    f.category.toLowerCase().includes('regulatory') || f.claim.toLowerCase().includes('regulation')
  );
  if (!hasRegulatoryFindings) {
    blindSpots.push({
      area: 'Regulatory environment',
      why: 'No analysis of AI regulations (EU AI Act, US state laws)',
      recommendation: 'Research compliance requirements for AI in target verticals'
    });
  }

  // Customer voice blind spot
  const hasCustomerData = findings.some(f =>
    f.claim.toLowerCase().includes('customer') && f.claim.toLowerCase().includes('interview')
  );
  if (!hasCustomerData) {
    blindSpots.push({
      area: 'Customer perspective',
      why: 'All data from company/investor sources, not actual users',
      recommendation: 'Find customer reviews on G2, Capterra; look for case study interviews'
    });
  }

  // Failure analysis blind spot
  const hasFailures = findings.some(f =>
    f.claim.toLowerCase().includes('fail') || f.claim.toLowerCase().includes('shut down')
  );
  if (!hasFailures) {
    blindSpots.push({
      area: 'Failed competitors',
      why: 'No analysis of vertical AI startups that failed',
      recommendation: 'Research why previous vertical AI attempts failed (survivorship bias)'
    });
  }

  return blindSpots;
}

/**
 * Question common assumptions
 */
function questionAssumptions(topic: string, findings: Finding[]): QuestionedAssumption[] {
  const assumptions: QuestionedAssumption[] = [];

  // Common vertical AI assumptions
  assumptions.push({
    assumption: 'Vertical AI is more defensible than horizontal AI',
    counter: 'Horizontal players (ChatGPT, Claude) can add vertical features faster than vertical players can improve core AI',
    evidence: 'Microsoft Copilot added legal templates; OpenAI launched enterprise customization'
  });

  assumptions.push({
    assumption: 'Domain expertise creates lasting moat',
    counter: 'Domain expertise can be acquired through partnerships or acquisitions',
    evidence: 'OpenAI partnered with BigLaw firms; Google acquired specialized AI companies'
  });

  assumptions.push({
    assumption: 'Enterprise customers prefer specialized solutions',
    counter: 'Enterprises may prefer unified platforms to reduce vendor complexity',
    evidence: 'Salesforce, Microsoft bundling AI across all products'
  });

  // Check findings for assumed conclusions
  const highConfidence = findings.filter(f => f.confidence > 0.8);
  for (const finding of highConfidence) {
    if (finding.sources.length < 3) {
      assumptions.push({
        assumption: finding.claim,
        counter: 'High confidence based on limited sources (<3)',
        evidence: `Only ${finding.sources.length} source(s) support this claim`
      });
    }
  }

  return assumptions;
}

/**
 * Identify risks
 */
function identifyRisks(topic: string, findings: Finding[]): Risk[] {
  const risks: Risk[] = [];

  // Market timing risk
  risks.push({
    risk: 'Market timing - enterprises may not be ready for AI transformation',
    probability: 'medium',
    impact: 'high',
    mitigation: 'Focus on customers with proven AI budget; avoid early-stage enterprises'
  });

  // Technology commoditization risk
  risks.push({
    risk: 'AI capabilities commoditize faster than expected',
    probability: 'high',
    impact: 'high',
    mitigation: 'Build moat through data, integrations, and customer relationships, not just AI'
  });

  // Funding winter risk
  risks.push({
    risk: 'AI funding bubble burst affects vertical AI valuations',
    probability: 'medium',
    impact: 'medium',
    mitigation: 'Focus on unit economics and profitability path, not just growth'
  });

  // Regulatory risk
  risks.push({
    risk: 'AI regulation increases compliance costs for vertical AI',
    probability: 'high',
    impact: 'medium',
    mitigation: 'Build compliance into product early; monitor EU AI Act requirements'
  });

  return risks;
}

/**
 * Main Devil's Advocate function
 */
export function runDevilsAdvocate(job: ResearchJob): DevilsAdvocateOutput {
  const { topic, findings } = job;

  const conclusions = extractConclusions(findings);
  const challenges = generateChallenges(conclusions, topic);
  const blindSpots = identifyBlindSpots(job);
  const assumptionsQuestioned = questionAssumptions(topic, findings);
  const risks = identifyRisks(topic, findings);

  const overallAssessment = generateOverallAssessment(challenges, blindSpots, risks);

  return {
    challenges,
    blindSpots,
    assumptionsQuestioned,
    risks,
    overallAssessment
  };
}

/**
 * Generate overall assessment
 */
function generateOverallAssessment(
  challenges: Challenge[],
  blindSpots: BlindSpot[],
  risks: Risk[]
): string {
  const highSeverityChallenges = challenges.filter(c => c.severity === 'high').length;
  const highImpactRisks = risks.filter(r => r.impact === 'high').length;

  if (highSeverityChallenges >= 3 || highImpactRisks >= 3) {
    return 'CAUTION: Research has significant gaps and unverified assumptions. Recommend additional validation before acting on conclusions.';
  }

  if (blindSpots.length >= 3) {
    return 'MODERATE CONCERN: Several blind spots identified. Consider expanding research scope before finalizing recommendations.';
  }

  return 'ACCEPTABLE: Research covers main areas with reasonable confidence. Address identified blind spots for comprehensive analysis.';
}

/**
 * Format Devil's Advocate output as markdown
 */
export function formatDevilsAdvocateMarkdown(output: DevilsAdvocateOutput): string {
  const lines: string[] = [
    '## Devil\'s Advocate Analysis',
    '',
    `**Overall Assessment**: ${output.overallAssessment}`,
    '',
    '### Challenges to Conclusions',
    ''
  ];

  for (const challenge of output.challenges) {
    lines.push(`#### ${challenge.conclusion.slice(0, 50)}...`);
    lines.push(`- **Challenge**: ${challenge.challenge}`);
    lines.push(`- **Risk**: ${challenge.risk}`);
    lines.push(`- **Alternative View**: ${challenge.alternativeView}`);
    lines.push(`- **Severity**: ${challenge.severity}`);
    lines.push('');
  }

  lines.push('### Blind Spots');
  lines.push('');
  for (const spot of output.blindSpots) {
    lines.push(`- **${spot.area}**: ${spot.why}`);
    lines.push(`  - *Recommendation*: ${spot.recommendation}`);
  }

  lines.push('');
  lines.push('### Questioned Assumptions');
  lines.push('');
  for (const assumption of output.assumptionsQuestioned) {
    lines.push(`#### "${assumption.assumption}"`);
    lines.push(`- **Counter**: ${assumption.counter}`);
    lines.push(`- **Evidence**: ${assumption.evidence}`);
    lines.push('');
  }

  lines.push('### Risks');
  lines.push('');
  lines.push('| Risk | Probability | Impact | Mitigation |');
  lines.push('|------|-------------|--------|------------|');
  for (const risk of output.risks) {
    lines.push(`| ${risk.risk} | ${risk.probability} | ${risk.impact} | ${risk.mitigation} |`);
  }

  return lines.join('\n');
}
