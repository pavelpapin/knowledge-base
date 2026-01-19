/**
 * Planner Agent
 * Creates research plan from topic
 */

import { ResearchPlan, Depth, SourceType } from '../types';

const DEPTH_CONFIG: Record<Depth, { subtopics: number; sources: SourceType[] }> = {
  quick: { subtopics: 3, sources: ['web'] },
  medium: { subtopics: 5, sources: ['web', 'youtube'] },
  deep: { subtopics: 7, sources: ['web', 'youtube', 'paper', 'social'] }
};

export function createPlan(topic: string, depth: Depth): ResearchPlan {
  const config = DEPTH_CONFIG[depth];

  // Generate subtopics (in real impl, would use Claude)
  const subtopics = generateSubtopics(topic, config.subtopics);
  const questions = generateQuestions(topic, subtopics);

  return {
    topic,
    depth,
    subtopics,
    questions,
    sources_strategy: config.sources,
    estimated_time_minutes: depth === 'quick' ? 5 : depth === 'medium' ? 15 : 30
  };
}

function generateSubtopics(topic: string, count: number): string[] {
  // Placeholder - in production, use Claude to generate
  return [
    `Overview of ${topic}`,
    `Current state of ${topic}`,
    `Key players in ${topic}`,
    `Trends in ${topic}`,
    `Challenges in ${topic}`,
    `Future of ${topic}`,
    `Use cases of ${topic}`
  ].slice(0, count);
}

function generateQuestions(topic: string, subtopics: string[]): string[] {
  return [
    `What is the current state of ${topic}?`,
    `Who are the main players in ${topic}?`,
    `What are the key trends in ${topic}?`,
    `What challenges exist in ${topic}?`,
    `What is the future outlook for ${topic}?`
  ];
}

export function planToPrompt(plan: ResearchPlan): string {
  return `
Research Topic: ${plan.topic}
Depth: ${plan.depth}

Subtopics to investigate:
${plan.subtopics.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Questions to answer:
${plan.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Sources to use: ${plan.sources_strategy.join(', ')}
`.trim();
}
