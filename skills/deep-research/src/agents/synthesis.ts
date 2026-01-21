/**
 * Synthesis Agent v2.0
 * Creates coherent report with reasoning: What / So What / Now What
 */

import * as crypto from 'crypto';
import { ResearchJob, Finding, Source } from '../types';

export interface StructuredFinding {
  id: string;
  title: string;
  what: string;
  soWhat: string;
  nowWhat: string;
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  category: string;
}

export interface DevilsAdvocateOutput {
  challenges: Array<{ conclusion: string; challenge: string; risk: string; alternativeView: string; severity: string }>;
  blindSpots: Array<{ area: string; why: string; recommendation: string }>;
  assumptionsQuestioned: Array<{ assumption: string; counter: string; evidence: string }>;
  risks: Array<{ risk: string; probability: string; impact: string; mitigation: string }>;
  overallAssessment: string;
}

export interface ActionPlanOutput {
  recommendations: Array<{ priority: number; action: string; rationale: string; effort: string; impact: string; nextSteps: string[]; successMetric: string }>;
  keyDecisions: Array<{ decision: string; options: string[]; recommendation: string; reasoning: string; confidence: string }>;
  quickWins: Array<{ action: string; timeToComplete: string; benefit: string }>;
  summary: string;
  priorityMatrix: { highImpactLowEffort: string[]; highImpactHighEffort: string[]; lowImpactLowEffort: string[]; lowImpactHighEffort: string[] };
}

export interface ConsiliumOutput {
  verifiedConclusions: Array<{ conclusion: string; votes: Record<string, number>; consensus: string; averageConfidence: number }>;
  contestedPoints: Array<{ claim: string; votes: Record<string, number>; disagreement: string }>;
  modelAgreement: number;
  overallConfidence: string;
  summary: string;
}

/**
 * Convert raw finding to structured finding with reasoning
 */
function structureFinding(finding: Finding, sources: Source[], goal: string): StructuredFinding {
  const soWhat = deriveSoWhat(finding, goal);
  const nowWhat = deriveNowWhat(finding, goal);
  const confidence: 'high' | 'medium' | 'low' =
    finding.confidence >= 0.8 ? 'high' :
      finding.confidence >= 0.6 ? 'medium' : 'low';

  const sourceUrls = finding.sources.map(id => {
    const source = sources.find(s => s.id === id || s.url === id);
    return source ? source.url : id;
  });

  return {
    id: finding.id,
    title: extractTitle(finding.claim),
    what: finding.claim,
    soWhat,
    nowWhat,
    sources: sourceUrls,
    confidence,
    category: finding.category
  };
}

function extractTitle(claim: string): string {
  const firstSentence = claim.split('.')[0];
  if (firstSentence.length <= 60) return firstSentence;
  return claim.slice(0, 57) + '...';
}

function deriveSoWhat(finding: Finding, goal: string): string {
  const claim = finding.claim.toLowerCase();

  if (claim.includes('funding') || claim.includes('raised') || claim.includes('valuation')) {
    return 'Indicates investor confidence and resources. Signals market timing or competition.';
  }
  if (claim.includes('leader') || claim.includes('largest') || claim.includes('dominant')) {
    return 'Establishes market benchmark. Target to surpass or potential partner/acquirer.';
  }
  if (claim.includes('technology') || claim.includes('ai') || claim.includes('model')) {
    return 'Technical approach indicates defensibility. Evaluate for learning or differentiation.';
  }
  if (claim.includes('customer') || claim.includes('client') || claim.includes('user')) {
    return 'Validates market demand. Study acquisition strategy and use cases.';
  }
  if (claim.includes('founder') || claim.includes('team') || claim.includes('ex-')) {
    return 'Team background predicts execution. Ex-unicorn founders have proven track record.';
  }
  if (claim.includes('partner') || claim.includes('integration')) {
    return 'Partnerships expand market access and validate enterprise readiness.';
  }
  if (goal.toLowerCase().includes('competitive')) {
    return 'Relevant for competitive positioning. Consider market strategy implications.';
  }
  return 'Adds market context. Evaluate relevance to specific objectives.';
}

function deriveNowWhat(finding: Finding, goal: string): string {
  const claim = finding.claim.toLowerCase();

  if (claim.includes('funding') || claim.includes('raised')) {
    return 'Track company; add to competitive watchlist.';
  }
  if (claim.includes('leader') || claim.includes('largest')) {
    return 'Deep dive on approach; find differentiation opportunities.';
  }
  if (claim.includes('technology') || claim.includes('ai')) {
    return 'Evaluate architecture; assess build vs buy vs partner.';
  }
  if (claim.includes('customer') || claim.includes('client')) {
    return 'Find case studies; reach out to shared connections.';
  }
  if (claim.includes('founder') || claim.includes('team')) {
    return 'Research on LinkedIn; identify intro opportunities.';
  }
  return 'Incorporate into analysis; reassess with new data.';
}

function generateExecutiveSummary(
  job: ResearchJob,
  structuredFindings: StructuredFinding[],
  consilium?: ConsiliumOutput
): string {
  const highConfidence = structuredFindings.filter(f => f.confidence === 'high');
  const { topic } = job;

  let summary = `**Research Question**: ${topic}\n\n`;
  if (highConfidence.length > 0) {
    summary += `**Key Finding**: ${highConfidence[0].what}\n\n`;
  }
  summary += '**Verified Insights**:\n';
  for (const finding of highConfidence.slice(0, 5)) {
    summary += `- ${finding.title}\n`;
  }
  if (consilium) {
    summary += `\n**Confidence**: ${consilium.overallConfidence.toUpperCase()} (${consilium.modelAgreement}% agreement)`;
  }
  return summary;
}

export function generateReport(job: ResearchJob): string {
  const { topic, plan, sources, findings } = job;
  const goal = plan?.subtopics[0] || topic;
  const structuredFindings = findings.map(f => structureFinding(f, sources, goal));
  const execSummary = generateExecutiveSummary(job, structuredFindings);

  const report = `
# Deep Research Report: ${topic}

**Generated**: ${new Date().toISOString()}
**Depth**: ${job.depth}
**Sources**: ${sources.length}

---

## Executive Summary

${execSummary}

---

${plan ? `
## Research Scope

### Subtopics
${plan.subtopics.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Questions
${plan.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

---
` : ''}

## Key Findings (What / So What / Now What)

${structuredFindings.length > 0 ? structuredFindings.map(f => `
### ${f.confidence === 'high' ? '✅' : f.confidence === 'medium' ? '⚠️' : '❓'} ${f.title}

| | |
|---|---|
| **What** | ${f.what} |
| **So What** | ${f.soWhat} |
| **Now What** | ${f.nowWhat} |
| **Confidence** | ${f.confidence.toUpperCase()} |
`).join('\n---\n') : '_No findings yet._'}

---

## Sources

${sources.map((s, i) => `${i + 1}. [${s.title}](${s.url}) (${s.type})`).join('\n')}

---

*Generated by Elio Deep Research v2.0*
`.trim();

  return report;
}

export function generateFullReportV2(
  job: ResearchJob,
  devilsAdvocate: DevilsAdvocateOutput,
  actionPlan: ActionPlanOutput,
  consilium: ConsiliumOutput
): string {
  const { topic, plan, sources, findings } = job;
  const goal = plan?.subtopics[0] || topic;
  const structuredFindings = findings.map(f => structureFinding(f, sources, goal));
  const execSummary = generateExecutiveSummary(job, structuredFindings, consilium);

  return `
# Deep Research Report: ${topic}

**Generated**: ${new Date().toISOString()}
**Version**: 2.0
**Depth**: ${job.depth}
**Sources**: ${sources.length} | **Findings**: ${findings.length}
**Confidence**: ${consilium.overallConfidence.toUpperCase()} (${consilium.modelAgreement}% consensus)

---

## Executive Summary

${execSummary}

---

${plan ? `
## Research Scope

### Subtopics
${plan.subtopics.map((s, i) => `${i + 1}. ${s}`).join('\n')}

### Questions
${plan.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

---
` : ''}

## Key Findings

${structuredFindings.slice(0, 10).map(f => `
### ${f.confidence === 'high' ? '✅' : f.confidence === 'medium' ? '⚠️' : '❓'} ${f.title}

| | |
|---|---|
| **What** | ${f.what} |
| **So What** | ${f.soWhat} |
| **Now What** | ${f.nowWhat} |
| **Confidence** | ${f.confidence.toUpperCase()} |
`).join('\n---\n')}

---

## Action Plan

**Summary**: ${actionPlan.summary}

### Priority Matrix

| Impact | Low Effort | High Effort |
|--------|------------|-------------|
| **High** | ${actionPlan.priorityMatrix.highImpactLowEffort.slice(0,2).join(', ') || '-'} | ${actionPlan.priorityMatrix.highImpactHighEffort.slice(0,2).join(', ') || '-'} |
| **Low** | ${actionPlan.priorityMatrix.lowImpactLowEffort.slice(0,2).join(', ') || '-'} | ${actionPlan.priorityMatrix.lowImpactHighEffort.slice(0,2).join(', ') || '-'} |

### Recommendations

${actionPlan.recommendations.slice(0, 5).map(r => `
#### P${r.priority}: ${r.action}
- **Rationale**: ${r.rationale}
- **Effort/Impact**: ${r.effort}/${r.impact}
- **Next Steps**: ${r.nextSteps.join('; ')}
- **Success Metric**: ${r.successMetric}
`).join('\n')}

### Quick Wins

${actionPlan.quickWins.map(w => `- [ ] **${w.action}** (${w.timeToComplete}) - ${w.benefit}`).join('\n')}

---

## Devil's Advocate

**Assessment**: ${devilsAdvocate.overallAssessment}

### Challenges

${devilsAdvocate.challenges.map(c => `
- **${c.conclusion.slice(0,50)}...**
  - Challenge: ${c.challenge}
  - Risk: ${c.risk}
`).join('\n')}

### Blind Spots

${devilsAdvocate.blindSpots.map(b => `- **${b.area}**: ${b.why}`).join('\n')}

### Risks

| Risk | P | I | Mitigation |
|------|---|---|------------|
${devilsAdvocate.risks.map(r => `| ${r.risk.slice(0,40)} | ${r.probability} | ${r.impact} | ${r.mitigation.slice(0,30)} |`).join('\n')}

---

## Consilium

**Summary**: ${consilium.summary}

**Model Agreement**: ${consilium.modelAgreement}%

### Verified Conclusions

${consilium.verifiedConclusions.slice(0, 5).map(v => `- ${v.conclusion.slice(0,60)}... (${v.consensus}, avg: ${Math.round(v.averageConfidence)}%)`).join('\n')}

${consilium.contestedPoints.length > 0 ? `
### Contested Points

${consilium.contestedPoints.map(p => `- ${p.claim.slice(0,50)}... - ${p.disagreement}`).join('\n')}
` : ''}

---

## Sources (${sources.length})

${sources.slice(0, 15).map((s, i) => `${i + 1}. [${s.title}](${s.url}) (${s.type})`).join('\n')}

---

*Generated by Elio Deep Research v2.0*
`.trim();
}

export function extractFindings(content: string, sources: string[]): Finding[] {
  return [{
    id: crypto.randomUUID(),
    claim: 'Initial findings pending analysis',
    sources: sources,
    confidence: 0.5,
    category: 'Overview'
  }];
}
