#!/usr/bin/env npx tsx
/**
 * Consilium - Multi-Model Code Review
 *
 * Triggered by CTO when criteria are met.
 * Uses multiple AI models to review code and vote on issues.
 *
 * Run: npx tsx consilium.ts --reason="security" --files="file1.ts,file2.ts"
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ============ Configuration ============

const CONFIG = {
  outputDir: '/root/.claude/logs/consilium',
  claudeDir: '/root/.claude',
  maxFilesPerReview: 10,
  maxLinesPerFile: 500,
};

// ============ Types ============

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'architecture' | 'performance' | 'quality';
  file: string;
  line?: number;
  issue: string;
  suggestion: string;
}

interface ModelAnalysis {
  model: string;
  findings: Finding[];
  summary: string;
  timestamp: string;
}

interface ConsiliumResult {
  date: string;
  reason: string;
  focus_areas: string[];
  analyses: ModelAnalysis[];
  consensus: Array<{
    issue: string;
    agreed_by: string[];
    severity: string;
    confidence: 'high' | 'medium' | 'low';
    action: 'auto_fix' | 'propose' | 'escalate';
  }>;
  disagreements: Array<{
    issue: string;
    opinions: Record<string, string>;
    action: 'human_review';
  }>;
  actions_taken: {
    auto_fixed: number;
    proposed: number;
    escalated: number;
  };
}

// ============ Utilities ============

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function exec(cmd: string, fallback: string = ''): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch {
    return fallback;
  }
}

function readFileContent(filepath: string, maxLines: number = CONFIG.maxLinesPerFile): string {
  if (!fs.existsSync(filepath)) return '';
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
    }
    return content;
  } catch {
    return '';
  }
}

function sendTelegram(message: string): void {
  try {
    const configPath = '/root/.claude/secrets/telegram.json';
    if (!fs.existsSync(configPath)) return;

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const token = config.bot_token;
    const chatId = config.default_chat_id;

    if (!token || !chatId) return;

    execSync(
      `curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" ` +
      `-d "chat_id=${chatId}" ` +
      `-d "text=${encodeURIComponent(message)}" ` +
      `-d "parse_mode=HTML"`,
      { timeout: 10000, stdio: 'ignore' }
    );
  } catch { /* ignore */ }
}

// ============ Analysis ============

function analyzeWithClaude(files: string[], context: string): ModelAnalysis {
  // Claude analysis is done by the calling agent
  // This function prepares the prompt and expects results

  const findings: Finding[] = [];

  // Basic static analysis as fallback
  for (const file of files) {
    const content = readFileContent(path.join(CONFIG.claudeDir, file));
    if (!content) continue;

    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // Security checks
      if (line.includes('eval(') || line.includes('Function(')) {
        findings.push({
          severity: 'high',
          category: 'security',
          file,
          line: idx + 1,
          issue: 'Potential code injection via eval/Function',
          suggestion: 'Avoid eval() and new Function(). Use safer alternatives.'
        });
      }

      if (line.match(/`.*\$\{.*\}.*`/) && (line.includes('exec') || line.includes('spawn'))) {
        findings.push({
          severity: 'high',
          category: 'security',
          file,
          line: idx + 1,
          issue: 'Potential command injection in template string',
          suggestion: 'Sanitize user input before using in shell commands.'
        });
      }

      // Quality checks
      if (line.includes(': any') || line.includes(' any;') || line.includes(' any,')) {
        findings.push({
          severity: 'low',
          category: 'quality',
          file,
          line: idx + 1,
          issue: 'Use of `any` type',
          suggestion: 'Replace with proper type annotation.'
        });
      }

      // Console.log in production
      if (line.includes('console.log') && !file.includes('test') && !file.includes('spec')) {
        findings.push({
          severity: 'low',
          category: 'quality',
          file,
          line: idx + 1,
          issue: 'console.log in production code',
          suggestion: 'Use proper logging utility.'
        });
      }
    });

    // Check file length
    if (lines.length > 200) {
      findings.push({
        severity: 'medium',
        category: 'architecture',
        file,
        issue: `File has ${lines.length} lines (>200)`,
        suggestion: 'Consider splitting into smaller modules.'
      });
    }
  }

  return {
    model: 'claude-static',
    findings,
    summary: `Static analysis found ${findings.length} issues`,
    timestamp: new Date().toISOString()
  };
}

function getGitDiff(): string {
  return exec(`cd ${CONFIG.claudeDir} && git diff --stat HEAD~5 2>/dev/null | head -50`, '');
}

function getChangedFiles(): string[] {
  const result = exec(
    `cd ${CONFIG.claudeDir} && git diff --name-only HEAD~5 2>/dev/null | head -${CONFIG.maxFilesPerReview}`,
    ''
  );
  return result.split('\n').filter(f => f.trim() && f.endsWith('.ts'));
}

// ============ Voting ============

function aggregateFindings(analyses: ModelAnalysis[]): ConsiliumResult['consensus'] {
  const findingMap: Record<string, { finding: Finding; models: string[] }> = {};

  for (const analysis of analyses) {
    for (const finding of analysis.findings) {
      const key = `${finding.file}:${finding.line || 0}:${finding.category}`;

      if (findingMap[key]) {
        findingMap[key].models.push(analysis.model);
      } else {
        findingMap[key] = { finding, models: [analysis.model] };
      }
    }
  }

  return Object.values(findingMap).map(({ finding, models }) => {
    const confidence = models.length >= 2 ? 'high' : models.length === 1 ? 'medium' : 'low';
    const action =
      finding.severity === 'critical' || finding.severity === 'high' ? 'escalate' :
      confidence === 'high' && finding.severity === 'low' ? 'auto_fix' : 'propose';

    return {
      issue: finding.issue,
      agreed_by: models,
      severity: finding.severity,
      confidence,
      action: action as 'auto_fix' | 'propose' | 'escalate'
    };
  });
}

// ============ Main ============

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reason = args.find(a => a.startsWith('--reason='))?.split('=')[1] || 'manual';
  const filesArg = args.find(a => a.startsWith('--files='))?.split('=')[1] || '';

  const now = new Date();
  const date = now.toISOString().split('T')[0];

  console.log(`\n🏛️ Consilium - Multi-Model Review`);
  console.log('═'.repeat(50));
  console.log(`Date: ${date}`);
  console.log(`Reason: ${reason}`);

  ensureDir(CONFIG.outputDir);

  // Determine files to review
  let focusAreas: string[] = [];
  if (filesArg) {
    focusAreas = filesArg.split(',').map(f => f.trim());
  } else {
    focusAreas = getChangedFiles();
  }

  if (focusAreas.length === 0) {
    console.log('No files to review. Exiting.');
    return;
  }

  console.log(`\n📁 Files to review (${focusAreas.length}):`);
  focusAreas.forEach(f => console.log(`   - ${f}`));

  // Run analyses
  const analyses: ModelAnalysis[] = [];

  console.log('\n🔍 Running Claude static analysis...');
  const claudeAnalysis = analyzeWithClaude(focusAreas, reason);
  analyses.push(claudeAnalysis);
  console.log(`   Found ${claudeAnalysis.findings.length} issues`);

  // TODO: Add OpenAI via Perplexity
  // TODO: Add Groq

  // Aggregate findings
  console.log('\n🗳️ Aggregating findings...');
  const consensus = aggregateFindings(analyses);

  const highConfidence = consensus.filter(c => c.confidence === 'high');
  const toAutoFix = consensus.filter(c => c.action === 'auto_fix');
  const toPropose = consensus.filter(c => c.action === 'propose');
  const toEscalate = consensus.filter(c => c.action === 'escalate');

  console.log(`   High confidence: ${highConfidence.length}`);
  console.log(`   Auto-fix: ${toAutoFix.length}`);
  console.log(`   Propose: ${toPropose.length}`);
  console.log(`   Escalate: ${toEscalate.length}`);

  // Build result
  const result: ConsiliumResult = {
    date,
    reason,
    focus_areas: focusAreas,
    analyses,
    consensus,
    disagreements: [], // TODO: implement when we have multiple models
    actions_taken: {
      auto_fixed: 0, // TODO: implement auto-fix
      proposed: toPropose.length,
      escalated: toEscalate.length
    }
  };

  // Save result
  const outputPath = path.join(CONFIG.outputDir, `${date}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ Results saved to: ${outputPath}`);

  // Generate report
  const report = `# Consilium Report — ${date}

## 🎯 Trigger
- Reason: ${reason}
- Files reviewed: ${focusAreas.length}

## 🤖 Models Used
- Claude Static: ✅
- GPT-4: ❌ (not configured)
- Groq: ❌ (not configured)

## 🔍 Findings Summary

### By Severity
- Critical: ${consensus.filter(c => c.severity === 'critical').length}
- High: ${consensus.filter(c => c.severity === 'high').length}
- Medium: ${consensus.filter(c => c.severity === 'medium').length}
- Low: ${consensus.filter(c => c.severity === 'low').length}

### Consensus Items
${consensus.map((c, i) => `${i + 1}. [${c.severity.toUpperCase()}] ${c.issue} → ${c.action}`).join('\n')}

## ✅ Actions
- Auto-fixed: ${result.actions_taken.auto_fixed}
- Proposed to backlog: ${result.actions_taken.proposed}
- Escalated: ${result.actions_taken.escalated}

---
Generated: ${now.toISOString()}
`;

  const reportPath = path.join(CONFIG.outputDir, `${date}.md`);
  fs.writeFileSync(reportPath, report);

  // Notify
  const telegramMsg = `🏛️ <b>Consilium Complete</b>

Reason: ${reason}
Files: ${focusAreas.length}

Findings:
- Critical: ${consensus.filter(c => c.severity === 'critical').length}
- High: ${consensus.filter(c => c.severity === 'high').length}
- Medium: ${consensus.filter(c => c.severity === 'medium').length}
- Low: ${consensus.filter(c => c.severity === 'low').length}

Actions: ${toAutoFix.length} auto-fix, ${toPropose.length} proposed`;

  sendTelegram(telegramMsg);

  console.log('\n📋 Report:');
  console.log(report);
  console.log('═'.repeat(50));
}

main().catch(error => {
  console.error('❌ Consilium failed:', error);
  process.exit(1);
});
