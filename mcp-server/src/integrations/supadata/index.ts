/**
 * Supadata Integration
 * YouTube transcript extraction via Supadata API
 */

import { loadCredentialsSync } from '../../utils/credentials.js';
import { fileLogger } from '../../utils/file-logger.js';

interface SupadataCredentials {
  api_key: string;
}

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

interface TranscriptResponse {
  lang: string;
  availableLangs: string[];
  content: TranscriptSegment[] | string;
}

interface TranscriptResult {
  success: boolean;
  videoId?: string;
  language?: string;
  availableLanguages?: string[];
  transcript?: string;
  segments?: TranscriptSegment[];
  error?: string;
}

const CREDENTIALS_FILE = 'supadata.json';
const API_BASE = 'https://api.supadata.ai/v1';

function loadCredentials(): SupadataCredentials | null {
  return loadCredentialsSync<SupadataCredentials>(CREDENTIALS_FILE);
}

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/  // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get YouTube video transcript via Supadata API
 */
export async function getYoutubeTranscript(
  url: string,
  options?: {
    language?: string;
    textOnly?: boolean;
  }
): Promise<TranscriptResult> {
  const credentials = loadCredentials();
  if (!credentials) {
    return { success: false, error: 'Supadata not configured. Add api_key to /root/.claude/secrets/supadata.json' };
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return { success: false, error: `Invalid YouTube URL: ${url}` };
  }

  const textOnly = options?.textOnly ?? true;
  const lang = options?.language || 'en';

  try {
    const apiUrl = new URL(`${API_BASE}/youtube/transcript`);
    apiUrl.searchParams.set('url', url);
    apiUrl.searchParams.set('text', String(textOnly));
    if (lang) {
      apiUrl.searchParams.set('lang', lang);
    }

    fileLogger.info('supadata', `Fetching transcript for ${videoId}`, { lang, textOnly });

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': credentials.api_key
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      fileLogger.error('supadata', `API error: ${response.status}`, { error: errorText });
      return { success: false, error: `Supadata API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json() as TranscriptResponse;

    fileLogger.info('supadata', `Transcript fetched successfully`, {
      videoId,
      lang: data.lang,
      availableLangs: data.availableLangs
    });

    // Handle both text-only and segmented responses
    if (typeof data.content === 'string') {
      return {
        success: true,
        videoId,
        language: data.lang,
        availableLanguages: data.availableLangs,
        transcript: data.content
      };
    } else {
      // Segments array
      const fullText = data.content.map(s => s.text).join(' ');
      return {
        success: true,
        videoId,
        language: data.lang,
        availableLanguages: data.availableLangs,
        transcript: fullText,
        segments: data.content
      };
    }

  } catch (error) {
    fileLogger.error('supadata', `Request failed`, { error: String(error) });
    return { success: false, error: `Request failed: ${error}` };
  }
}

/**
 * Get transcript with timestamps (for reference/navigation)
 */
export async function getYoutubeTranscriptWithTimestamps(
  url: string,
  language?: string
): Promise<TranscriptResult> {
  return getYoutubeTranscript(url, { language, textOnly: false });
}

/**
 * Get available languages for a video
 */
export async function getAvailableLanguages(url: string): Promise<{
  success: boolean;
  languages?: string[];
  error?: string;
}> {
  const result = await getYoutubeTranscript(url, { textOnly: true });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    languages: result.availableLanguages
  };
}
