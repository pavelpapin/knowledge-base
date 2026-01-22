/**
 * Report Validator
 * Quality gate for AI team reports before publishing
 *
 * Usage: validateReport(report, 'cto' | 'cpo' | 'ceo')
 */

export interface ValidationResult {
  valid: boolean;
  score: number; // 0-100
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

export type ReportType = 'cto' | 'cpo' | 'ceo';

interface ReportSection {
  name: string;
  required: boolean;
  minLength?: number;
  patterns?: RegExp[];
}

const REPORT_SCHEMAS: Record<ReportType, ReportSection[]> = {
  cto: [
    { name: 'System Health', required: true, minLength: 50 },
    { name: 'Architecture Review', required: true, minLength: 100 },
    { name: 'Security Scan', required: true, minLength: 30 },
    { name: 'Auto-Fixes Applied', required: false },
    { name: 'Backlog', required: true, minLength: 20 },
    { name: 'Risks', required: false },
  ],
  cpo: [
    { name: 'Quality Snapshot', required: true, minLength: 50 },
    { name: 'User Feedback', required: true, minLength: 30 },
    { name: 'Failure Analysis', required: true, minLength: 30 },
    { name: 'Improvements', required: true, minLength: 50 },
    { name: 'Eval Sets', required: false },
    { name: 'Metrics', required: true, minLength: 30 },
  ],
  ceo: [
    { name: 'Цель', required: true, minLength: 20 },
    { name: 'Ключевые метрики', required: true, minLength: 50, patterns: [/\|.*\|.*\|/] },
    { name: 'Решения', required: true, minLength: 50 },
    { name: 'Задачи', required: true, minLength: 30 },
    { name: 'Риски', required: false },
    { name: 'Не делаем', required: false },
  ],
};

// Red flags that indicate low-quality or incomplete reports
const RED_FLAGS = [
  { pattern: /TBD|TODO|FIXME/gi, message: 'Contains unresolved placeholders' },
  { pattern: /: 0\n|: 0$/gm, message: 'Contains zero values (no data collected)' },
  { pattern: /No .*conversations|No .*feedback|No .*data/gi, message: 'Missing user data' },
  { pattern: /N\/A/gi, message: 'Contains N/A values' },
  { pattern: /\[\s*\]/g, message: 'Contains empty arrays' },
  { pattern: /: -\n|: -$/gm, message: 'Contains missing values marked with dash' },
];

// Quality indicators that boost score
const QUALITY_INDICATORS = [
  { pattern: /\d+%/g, message: 'Contains percentage metrics', weight: 5 },
  { pattern: /P[0-3]/g, message: 'Contains priority tags', weight: 3 },
  { pattern: /🟢|🟡|🔴|✅|❌|⚠️/g, message: 'Contains status indicators', weight: 2 },
  { pattern: /\|.*\|.*\|.*\|/g, message: 'Contains tables', weight: 5 },
  { pattern: /```[\s\S]*?```/g, message: 'Contains code blocks', weight: 3 },
  { pattern: /https?:\/\/\S+/g, message: 'Contains links', weight: 2 },
];

export function validateReport(content: string, type: ReportType): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let score = 100;

  const schema = REPORT_SCHEMAS[type];
  if (!schema) {
    return {
      valid: false,
      score: 0,
      errors: [{ code: 'INVALID_TYPE', message: `Unknown report type: ${type}` }],
      warnings: [],
    };
  }

  // Check minimum content length
  if (content.length < 500) {
    errors.push({
      code: 'TOO_SHORT',
      message: `Report too short (${content.length} chars, minimum 500)`,
    });
    score -= 30;
  }

  // Check required sections
  for (const section of schema) {
    const sectionPattern = new RegExp(`##?\\s*[🎯📊📋⚡⚠️🚫🔍💡📈🏥✅]*\\s*${section.name}`, 'i');
    const hasSection = sectionPattern.test(content);

    if (section.required && !hasSection) {
      errors.push({
        code: 'MISSING_SECTION',
        message: `Missing required section: ${section.name}`,
        field: section.name,
      });
      score -= 15;
    } else if (hasSection && section.minLength) {
      // Find section content and check length
      const match = content.match(new RegExp(`${sectionPattern.source}[\\s\\S]*?(?=##|$)`, 'i'));
      if (match && match[0].length < section.minLength) {
        warnings.push({
          code: 'SECTION_TOO_SHORT',
          message: `Section "${section.name}" is too short`,
          suggestion: `Add more detail (current: ${match[0].length}, minimum: ${section.minLength})`,
        });
        score -= 5;
      }
    }

    // Check section-specific patterns
    if (hasSection && section.patterns) {
      for (const pattern of section.patterns) {
        if (!pattern.test(content)) {
          warnings.push({
            code: 'MISSING_FORMAT',
            message: `Section "${section.name}" missing expected format`,
            suggestion: 'Consider adding tables or structured data',
          });
          score -= 3;
        }
      }
    }
  }

  // Check for red flags
  for (const flag of RED_FLAGS) {
    const matches = content.match(flag.pattern);
    if (matches && matches.length > 0) {
      warnings.push({
        code: 'RED_FLAG',
        message: `${flag.message} (${matches.length} occurrences)`,
        suggestion: 'Ensure data is actually collected, not just placeholders',
      });
      score -= Math.min(matches.length * 5, 20);
    }
  }

  // Check for quality indicators (bonus points)
  for (const indicator of QUALITY_INDICATORS) {
    const matches = content.match(indicator.pattern);
    if (matches && matches.length > 0) {
      score += Math.min(matches.length * indicator.weight, indicator.weight * 3);
    }
  }

  // Normalize score
  score = Math.max(0, Math.min(100, score));

  // Determine validity
  const valid = errors.length === 0 && score >= 60;

  return { valid, score, errors, warnings };
}

// Utility function for CLI/script usage
export function formatValidationResult(result: ValidationResult, type: ReportType): string {
  const lines: string[] = [];

  lines.push(`## ${type.toUpperCase()} Report Validation`);
  lines.push('');
  lines.push(`**Status:** ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  lines.push(`**Score:** ${result.score}/100`);
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('### Errors');
    for (const error of result.errors) {
      lines.push(`- ❌ [${error.code}] ${error.message}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('### Warnings');
    for (const warning of result.warnings) {
      lines.push(`- ⚠️ [${warning.code}] ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`  → ${warning.suggestion}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Export for testing
export const _internal = {
  REPORT_SCHEMAS,
  RED_FLAGS,
  QUALITY_INDICATORS,
};
