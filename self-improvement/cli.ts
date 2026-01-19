/**
 * Self-Improvement CLI
 * Command-line interface for tracking corrections and patterns
 */

import * as store from './store.js';
import { CorrectionType, Correction, Pattern } from './types.js';

const command = process.argv[2];
const args = process.argv.slice(3);

function printCorrection(c: Correction): void {
  const typeIcon = c.type === 'factual' ? '🔴' :
                   c.type === 'style' ? '🎨' :
                   c.type === 'preference' ? '⭐' :
                   c.type === 'technical' ? '🔧' :
                   c.type === 'tone' ? '🎭' :
                   c.type === 'format' ? '📋' : '📝';
  const status = c.applied ? '✅' : '⏳';

  console.log(`${status} ${typeIcon} ${c.timestamp.split('T')[0]} | ${c.type}`);
  console.log(`   Original:  ${c.original.substring(0, 60)}...`);
  console.log(`   Corrected: ${c.corrected.substring(0, 60)}...`);
  if (c.context) {
    console.log(`   Context:   ${c.context.substring(0, 60)}...`);
  }
}

function printPattern(p: Pattern): void {
  console.log(`🔄 ${p.type} (${p.occurrences} occurrences)`);
  console.log(`   ${p.description}`);
  if (p.suggestedRule) {
    console.log(`   💡 Suggested: ${p.suggestedRule}`);
  }
}

switch (command) {
  case 'log':
  case 'add': {
    const [type, ...rest] = args;
    if (!type || rest.length < 2) {
      console.error('Usage: improve log <type> <original> | <corrected>');
      console.error('Types: factual, style, preference, technical, context, tone, format, other');
      console.error('Example: improve log preference "used em-dash" | "should use regular dash"');
      process.exit(1);
    }

    // Parse "original | corrected" format
    const fullText = rest.join(' ');
    const parts = fullText.split('|').map(s => s.trim());

    if (parts.length < 2) {
      console.error('Format: <original> | <corrected>');
      process.exit(1);
    }

    const [original, corrected, context] = parts;
    const correction = store.logCorrection(
      type as CorrectionType,
      original,
      corrected,
      context
    );

    console.log(`✅ Logged correction: ${correction.id.substring(0, 8)}`);
    console.log(`   Type: ${type}`);
    console.log(`   Original: ${original}`);
    console.log(`   Corrected: ${corrected}`);
    break;
  }

  case 'recent': {
    const limit = parseInt(args[0]) || 10;
    const corrections = store.getCorrections({ limit });

    console.log('\n📝 Recent Corrections');
    console.log('====================');

    if (corrections.length === 0) {
      console.log('No corrections logged yet');
    } else {
      corrections.forEach(printCorrection);
    }
    break;
  }

  case 'patterns': {
    const patterns = store.getPatterns();

    console.log('\n🔄 Detected Patterns');
    console.log('====================');

    if (patterns.length === 0) {
      console.log('No patterns detected yet (need 3+ similar corrections)');
    } else {
      patterns.forEach(printPattern);
    }
    break;
  }

  case 'suggest':
  case 'suggestions': {
    const suggestions = store.getSuggestedRules();

    console.log('\n💡 Suggested Updates');
    console.log('====================');

    if (suggestions.length === 0) {
      console.log('No suggestions at this time');
    } else {
      suggestions.forEach((s, i) => {
        console.log(`${i + 1}. ${s}`);
      });
    }
    break;
  }

  case 'report': {
    const date = args[0];
    const report = store.generateDailyReport(date);

    console.log(`\n📊 Daily Report: ${report.date}`);
    console.log('='.repeat(30));
    console.log(`Total corrections: ${report.totalCorrections}`);

    if (report.totalCorrections > 0) {
      console.log('\nBy type:');
      for (const [type, count] of Object.entries(report.byType)) {
        if (count > 0) {
          console.log(`  ${type}: ${count}`);
        }
      }
    }

    if (report.patterns.length > 0) {
      console.log('\nActive patterns:');
      report.patterns.forEach(p => console.log(`  - ${p.type}: ${p.description}`));
    }

    if (report.suggestedUpdates.length > 0) {
      console.log('\nSuggested updates:');
      report.suggestedUpdates.forEach(s => console.log(`  - ${s}`));
    }
    break;
  }

  case 'apply': {
    const correctionId = args[0];
    if (!correctionId) {
      console.error('Usage: improve apply <correction-id>');
      process.exit(1);
    }

    const success = store.markApplied(correctionId);
    if (success) {
      console.log(`✅ Marked as applied: ${correctionId}`);
    } else {
      console.error('Correction not found');
      process.exit(1);
    }
    break;
  }

  case 'update-claude': {
    const [section, ...contentWords] = args;
    const content = contentWords.join(' ');

    if (!section || !content) {
      console.error('Usage: improve update-claude <section> <content>');
      console.error('Example: improve update-claude "Preferences" "- Always use regular dashes"');
      process.exit(1);
    }

    store.appendToClaudeMd(section, content);
    console.log(`✅ Added to CLAUDE.md section: ${section}`);
    console.log(`   Content: ${content}`);
    break;
  }

  case 'stats': {
    const stats = store.getStats();

    console.log('\n📈 Self-Improvement Stats');
    console.log('========================');
    console.log(`Total corrections: ${stats.totalCorrections}`);
    console.log(`Unapplied: ${stats.unappliedCorrections}`);
    console.log(`Patterns detected: ${stats.patterns}`);
    if (stats.lastAnalysis) {
      console.log(`Last analysis: ${stats.lastAnalysis}`);
    }
    break;
  }

  case 'analyze': {
    console.log('Running daily analysis...');
    const report = store.generateDailyReport();
    store.setLastAnalysis();

    console.log(`\n✅ Analysis complete for ${report.date}`);
    console.log(`   Corrections: ${report.totalCorrections}`);
    console.log(`   Patterns: ${report.patterns.length}`);
    console.log(`   Suggestions: ${report.suggestedUpdates.length}`);

    if (report.suggestedUpdates.length > 0) {
      console.log('\n💡 Suggested updates:');
      report.suggestedUpdates.forEach(s => console.log(`   - ${s}`));
    }
    break;
  }

  default:
    console.log(`
Self-Improvement - Learning from Corrections

Usage: improve <command> [args]

Commands:
  log <type> <orig> | <corr>  Log a correction
  recent [n]                   Show recent corrections
  patterns                     Show detected patterns
  suggestions                  Show suggested rules
  report [date]                Generate daily report
  apply <id>                   Mark correction as applied
  update-claude <sec> <text>   Add content to CLAUDE.md
  stats                        Show statistics
  analyze                      Run daily analysis

Correction types:
  factual, style, preference, technical, context, tone, format, other
`);
}
