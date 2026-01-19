/**
 * Perplexity Integration
 * AI-powered search and research via Perplexity API
 */

import * as fs from 'fs';
import * as https from 'https';

const CREDENTIALS_PATH = '/root/.claude/secrets/perplexity-token.json';

interface PerplexityCredentials {
  api_key: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface SearchResult {
  answer: string;
  citations: string[];
  model: string;
  tokensUsed: number;
}

function loadCredentials(): PerplexityCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

async function perplexityRequest(body: Record<string, unknown>): Promise<PerplexityResponse> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('Perplexity not authenticated. Add api_key to /root/.claude/secrets/perplexity-token.json');
  }

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.perplexity.ai',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.api_key}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'Perplexity API error'));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error('Invalid response from Perplexity'));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

export async function search(
  query: string,
  options: {
    model?: 'llama-3.1-sonar-small-128k-online' | 'llama-3.1-sonar-large-128k-online' | 'llama-3.1-sonar-huge-128k-online';
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    searchRecency?: 'month' | 'week' | 'day' | 'hour';
  } = {}
): Promise<SearchResult> {
  const model = options.model || 'llama-3.1-sonar-small-128k-online';

  const messages = [];

  if (options.systemPrompt) {
    messages.push({
      role: 'system',
      content: options.systemPrompt
    });
  }

  messages.push({
    role: 'user',
    content: query
  });

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature || 0.2,
    return_citations: true
  };

  if (options.searchRecency) {
    body.search_recency_filter = options.searchRecency;
  }

  const response = await perplexityRequest(body);

  return {
    answer: response.choices[0]?.message?.content || '',
    citations: response.citations || [],
    model: response.model,
    tokensUsed: response.usage.total_tokens
  };
}

export async function research(
  topic: string,
  options: {
    depth?: 'quick' | 'standard' | 'deep';
    focus?: 'general' | 'academic' | 'news' | 'code';
  } = {}
): Promise<SearchResult> {
  const depth = options.depth || 'standard';
  const focus = options.focus || 'general';

  let systemPrompt = '';
  let model: 'llama-3.1-sonar-small-128k-online' | 'llama-3.1-sonar-large-128k-online' | 'llama-3.1-sonar-huge-128k-online';
  let maxTokens: number;

  switch (depth) {
    case 'quick':
      model = 'llama-3.1-sonar-small-128k-online';
      maxTokens = 512;
      systemPrompt = 'Provide a brief, focused answer with key facts only.';
      break;
    case 'deep':
      model = 'llama-3.1-sonar-huge-128k-online';
      maxTokens = 4096;
      systemPrompt = 'Provide comprehensive analysis with multiple perspectives, data points, and citations. Be thorough and detailed.';
      break;
    default:
      model = 'llama-3.1-sonar-large-128k-online';
      maxTokens = 2048;
      systemPrompt = 'Provide a well-structured answer with relevant details and citations.';
  }

  switch (focus) {
    case 'academic':
      systemPrompt += ' Focus on academic sources, research papers, and scholarly analysis.';
      break;
    case 'news':
      systemPrompt += ' Focus on recent news, current events, and latest developments.';
      break;
    case 'code':
      systemPrompt += ' Focus on technical documentation, code examples, and implementation details.';
      break;
  }

  return search(topic, {
    model,
    systemPrompt,
    maxTokens,
    searchRecency: focus === 'news' ? 'week' : undefined
  });
}

export async function factCheck(claim: string): Promise<{
  verdict: 'true' | 'false' | 'partially_true' | 'unverifiable';
  explanation: string;
  citations: string[];
}> {
  const result = await search(
    `Fact check the following claim and provide a verdict (true, false, partially true, or unverifiable): "${claim}"`,
    {
      model: 'llama-3.1-sonar-large-128k-online',
      systemPrompt: 'You are a fact-checker. Analyze claims objectively using reliable sources. Provide clear verdicts with evidence.',
      temperature: 0.1
    }
  );

  // Parse verdict from response
  let verdict: 'true' | 'false' | 'partially_true' | 'unverifiable' = 'unverifiable';
  const lowerAnswer = result.answer.toLowerCase();

  if (lowerAnswer.includes('verdict: true') || lowerAnswer.includes('is true')) {
    verdict = 'true';
  } else if (lowerAnswer.includes('verdict: false') || lowerAnswer.includes('is false')) {
    verdict = 'false';
  } else if (lowerAnswer.includes('partially true') || lowerAnswer.includes('partly true')) {
    verdict = 'partially_true';
  }

  return {
    verdict,
    explanation: result.answer,
    citations: result.citations
  };
}

export async function summarize(
  url: string,
  options: { maxLength?: number } = {}
): Promise<{ summary: string; citations: string[] }> {
  const maxLength = options.maxLength || 500;

  const result = await search(
    `Summarize the main points from this article/page: ${url}`,
    {
      model: 'llama-3.1-sonar-small-128k-online',
      systemPrompt: `Provide a concise summary in ${maxLength} words or less. Focus on key takeaways and main arguments.`,
      maxTokens: 1024
    }
  );

  return {
    summary: result.answer,
    citations: result.citations
  };
}

export async function compare(
  items: string[],
  criteria?: string[]
): Promise<{ comparison: string; citations: string[] }> {
  let query = `Compare and contrast: ${items.join(' vs ')}`;

  if (criteria && criteria.length > 0) {
    query += `. Focus on these criteria: ${criteria.join(', ')}`;
  }

  const result = await search(query, {
    model: 'llama-3.1-sonar-large-128k-online',
    systemPrompt: 'Create a structured comparison with clear pros/cons for each option. Use bullet points or tables where helpful.',
    maxTokens: 2048
  });

  return {
    comparison: result.answer,
    citations: result.citations
  };
}

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

export function getAuthInstructions(): string {
  return `
Perplexity Integration Setup:

1. Go to https://www.perplexity.ai/settings/api
2. Create an API key
3. Create /root/.claude/secrets/perplexity-token.json:
   { "api_key": "pplx-YOUR_API_KEY" }
`;
}
