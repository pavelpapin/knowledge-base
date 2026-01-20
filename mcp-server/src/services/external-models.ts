/**
 * External Models Service
 * Интеграция с внешними AI моделями для проверки и второго мнения
 */

import * as https from 'https';

// API Keys from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

export interface ModelResponse {
  model: string;
  response: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  latency_ms: number;
  error?: string;
}

export interface ReviewRequest {
  task_description: string;
  result: string;
  criteria?: string[];
}

export interface ReviewResponse {
  model: string;
  score: number; // 0-100
  verdict: 'approved' | 'needs_revision' | 'rejected';
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  latency_ms: number;
}

/**
 * Call OpenAI API
 */
export async function callOpenAI(
  prompt: string,
  systemPrompt?: string,
  model: string = 'gpt-4o'
): Promise<ModelResponse> {
  const startTime = Date.now();

  if (!OPENAI_API_KEY) {
    return { model, response: '', latency_ms: 0, error: 'No OPENAI_API_KEY' };
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const body = JSON.stringify({
    model,
    messages,
    max_tokens: 4096,
    temperature: 0.7
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 60000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency_ms = Date.now() - startTime;

        if (res.statusCode !== 200) {
          console.log('OpenAI API error:', res.statusCode, data.slice(0, 200));
          resolve({ model, response: '', latency_ms, error: `OpenAI error: ${res.statusCode}` });
          return;
        }

        try {
          const json = JSON.parse(data);
          const response = json.choices?.[0]?.message?.content || '';
          const usage = json.usage;
          console.log(`OpenAI ${model}: ${latency_ms}ms, ${response.length} chars`);
          resolve({ model, response, usage, latency_ms });
        } catch (e) {
          resolve({ model, response: '', latency_ms, error: 'Parse error' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ model, response: '', latency_ms: Date.now() - startTime, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ model, response: '', latency_ms: Date.now() - startTime, error: 'Timeout' });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Call Groq API (fast, free tier)
 */
export async function callGroq(
  prompt: string,
  systemPrompt?: string,
  model: string = 'llama-3.3-70b-versatile'
): Promise<ModelResponse> {
  const startTime = Date.now();

  if (!GROQ_API_KEY) {
    return { model, response: '', latency_ms: 0, error: 'No GROQ_API_KEY' };
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const body = JSON.stringify({
    model,
    messages,
    max_tokens: 4096,
    temperature: 0.7
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency_ms = Date.now() - startTime;

        if (res.statusCode !== 200) {
          resolve({ model, response: '', latency_ms, error: `Groq error: ${res.statusCode}` });
          return;
        }

        try {
          const json = JSON.parse(data);
          const response = json.choices?.[0]?.message?.content || '';
          console.log(`Groq ${model}: ${latency_ms}ms, ${response.length} chars`);
          resolve({ model, response, latency_ms });
        } catch (e) {
          resolve({ model, response: '', latency_ms, error: 'Parse error' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ model, response: '', latency_ms: Date.now() - startTime, error: err.message });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Scientific Advisor Review
 * OpenAI как "научный руководитель" проверяет результат работы
 */
export async function scientificReview(request: ReviewRequest): Promise<ReviewResponse> {
  const startTime = Date.now();

  const systemPrompt = `Ты научный руководитель и эксперт по оценке качества исследований и аналитических работ.

Твоя задача - объективно оценить выполненную работу по критериям:
1. Полнота - все ли аспекты задачи раскрыты?
2. Точность - есть ли ошибки или неточности?
3. Источники - подкреплены ли выводы данными?
4. Практичность - можно ли на основе работы принять решение?
5. Структура - логична ли подача материала?

Будь строгим но справедливым. Если работа хорошая - признай это. Если есть проблемы - укажи конкретно.`;

  const criteriaText = request.criteria?.length
    ? `\n\nДополнительные критерии оценки:\n${request.criteria.map(c => `- ${c}`).join('\n')}`
    : '';

  const prompt = `## Задача которая была поставлена:
${request.task_description}

## Результат выполнения:
${request.result}
${criteriaText}

## Твоя оценка

Проанализируй результат и дай оценку в формате JSON:
{
  "score": <число 0-100>,
  "verdict": "<approved|needs_revision|rejected>",
  "feedback": "<общая оценка 2-3 предложения>",
  "strengths": ["<сильная сторона 1>", "<сильная сторона 2>"],
  "weaknesses": ["<слабая сторона 1>", "<слабая сторона 2>"],
  "suggestions": ["<рекомендация 1>", "<рекомендация 2>"]
}

Критерии verdict:
- approved (80-100): работа выполнена качественно, можно использовать
- needs_revision (50-79): есть существенные замечания, нужна доработка
- rejected (<50): работа не соответствует требованиям`;

  const result = await callOpenAI(prompt, systemPrompt, 'gpt-4o');

  if (result.error || !result.response) {
    return {
      model: 'gpt-4o',
      score: 0,
      verdict: 'needs_revision',
      feedback: `Review failed: ${result.error}`,
      strengths: [],
      weaknesses: ['Could not complete review'],
      suggestions: ['Retry review'],
      latency_ms: Date.now() - startTime
    };
  }

  try {
    // Extract JSON from response
    const jsonMatch = result.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const review = JSON.parse(jsonMatch[0]);
    return {
      model: 'gpt-4o',
      score: review.score || 0,
      verdict: review.verdict || 'needs_revision',
      feedback: review.feedback || '',
      strengths: review.strengths || [],
      weaknesses: review.weaknesses || [],
      suggestions: review.suggestions || [],
      latency_ms: Date.now() - startTime
    };
  } catch (e) {
    return {
      model: 'gpt-4o',
      score: 0,
      verdict: 'needs_revision',
      feedback: result.response.slice(0, 500),
      strengths: [],
      weaknesses: ['Could not parse structured review'],
      suggestions: [],
      latency_ms: Date.now() - startTime
    };
  }
}

/**
 * Quick validation with Groq (fast, free)
 */
export async function quickValidation(
  content: string,
  checkType: 'facts' | 'grammar' | 'logic' | 'completeness'
): Promise<{ valid: boolean; issues: string[]; model: string }> {

  const prompts: Record<string, string> = {
    facts: 'Проверь текст на фактические ошибки. Если нашел - перечисли. Если все ок - напиши "OK".',
    grammar: 'Проверь текст на грамматические и стилистические ошибки. Если нашел - перечисли. Если все ок - напиши "OK".',
    logic: 'Проверь текст на логические противоречия и несоответствия. Если нашел - перечисли. Если все ок - напиши "OK".',
    completeness: 'Оцени полноту текста. Чего не хватает? Если все полно - напиши "OK".'
  };

  const result = await callGroq(
    `${prompts[checkType]}\n\nТекст:\n${content.slice(0, 8000)}`,
    'Ты редактор и корректор. Отвечай кратко и по делу.'
  );

  if (result.error) {
    return { valid: false, issues: [`Validation error: ${result.error}`], model: 'groq' };
  }

  const isOk = result.response.includes('OK') || result.response.includes('ок');
  const issues = isOk ? [] : result.response.split('\n').filter(l => l.trim());

  return { valid: isOk, issues, model: 'groq' };
}

/**
 * Get available models
 */
export function getAvailableModels(): string[] {
  const models: string[] = [];

  if (OPENAI_API_KEY) {
    models.push('openai:gpt-4o', 'openai:gpt-4o-mini');
  }
  if (GROQ_API_KEY) {
    models.push('groq:llama-3.3-70b', 'groq:mixtral-8x7b');
  }

  return models;
}
