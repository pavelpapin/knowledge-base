/**
 * LinkedIn Scraper
 * Priority: OAuth API > Scrape.do > Jina Reader
 */

import { createHash } from 'crypto';
import * as scrapedo from '../scrapedo/index.js';
import * as oauth from './oauth.js';

// Cache for scraped profiles
const cache = new Map<string, { data: LinkedInProfile; expiresAt: number }>();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days for profiles

export interface LinkedInProfile {
  name: string;
  headline?: string;
  location?: string;
  about?: string;
  currentCompany?: string;
  currentTitle?: string;
  profileUrl: string;
  photoUrl?: string;
  email?: string;
  connections?: string;
  experience?: Array<{
    title: string;
    company: string;
    duration?: string;
    description?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    dates?: string;
  }>;
  skills?: string[];
  raw?: string;
  source: 'api' | 'scrapedo' | 'jina' | 'cache';
}

/**
 * Get current authenticated user's profile via OAuth API
 */
export async function getMyProfile(): Promise<LinkedInProfile | null> {
  if (!oauth.isAuthenticated()) {
    console.log('[LinkedIn] Not authenticated, use startAuth() first');
    return null;
  }

  const apiProfile = await oauth.getMyProfile();
  if (!apiProfile) return null;

  return {
    name: apiProfile.name,
    profileUrl: `https://www.linkedin.com/in/${apiProfile.id}/`,
    photoUrl: apiProfile.picture,
    email: apiProfile.email,
    source: 'api'
  };
}

/**
 * Start LinkedIn OAuth flow
 */
export function startAuth(): { authUrl: string; status: string } {
  const status = oauth.getAuthStatus();
  if (status.authenticated) {
    return { authUrl: '', status: 'Already authenticated' };
  }
  return {
    authUrl: status.authUrl || oauth.getAuthUrl(),
    status: 'Open URL to authenticate'
  };
}

/**
 * Exchange OAuth code for token
 */
export async function completeAuth(code: string): Promise<boolean> {
  try {
    await oauth.exchangeCode(code);
    return true;
  } catch (error) {
    console.error('[LinkedIn] Auth failed:', error);
    return false;
  }
}

/**
 * Get LinkedIn auth status
 */
export function getAuthStatus() {
  return oauth.getAuthStatus();
}

export interface LinkedInSearchResult {
  name: string;
  headline?: string;
  profileUrl: string;
  location?: string;
}

function getCacheKey(identifier: string): string {
  return `linkedin:${createHash('md5').update(identifier.toLowerCase()).digest('hex')}`;
}

/**
 * Search for LinkedIn profiles using Google via Scrape.do
 */
export async function searchProfiles(
  query: string,
  options: { limit?: number } = {}
): Promise<LinkedInSearchResult[]> {
  const limit = options.limit || 10;
  const searchQuery = `site:linkedin.com/in ${query}`;

  try {
    // Use Scrape.do to search Google (bypasses blocks)
    if (scrapedo.isAuthenticated()) {
      const result = await scrapedo.scrapeGoogle(searchQuery, { num: limit });
      if (result.success) {
        return parseGoogleResults(result.content);
      }
    }

    // Fallback to DuckDuckGo (free but less reliable)
    const { duckduckgoSearch } = await import('../webscraping/index.js');
    const results = await duckduckgoSearch(searchQuery, limit);

    return results
      .filter(r => r.url.includes('linkedin.com/in/'))
      .map(r => {
        const titleParts = r.title.replace(' | LinkedIn', '').split(' - ');
        return {
          name: titleParts[0]?.trim() || 'Unknown',
          headline: titleParts[1]?.trim(),
          profileUrl: r.url,
          location: extractLocation(r.snippet)
        };
      });
  } catch (error) {
    console.error('[LinkedIn] Search error:', error);
    return [];
  }
}

/**
 * Get LinkedIn profile - uses Scrape.do for reliable access
 */
export async function getProfile(
  profileUrl: string
): Promise<LinkedInProfile | null> {
  const normalizedUrl = normalizeLinkedInUrl(profileUrl);
  if (!normalizedUrl) {
    throw new Error('Invalid LinkedIn URL');
  }

  const cacheKey = getCacheKey(normalizedUrl);

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log('[LinkedIn] Cache HIT for:', normalizedUrl);
    return { ...cached.data, source: 'cache' };
  }

  // Try Scrape.do first (most reliable)
  if (scrapedo.isAuthenticated()) {
    console.log('[LinkedIn] Fetching via Scrape.do:', normalizedUrl);
    const result = await scrapedo.scrapeLinkedIn(normalizedUrl);

    if (result.success && result.content.length > 1000) {
      const profile = parseLinkedInHtml(result.content, normalizedUrl, 'scrapedo');
      cache.set(cacheKey, { data: profile, expiresAt: Date.now() + CACHE_TTL });
      return profile;
    }
    console.log('[LinkedIn] Scrape.do failed or empty, trying Jina...');
  }

  // Fallback to Jina Reader
  console.log('[LinkedIn] Fetching via Jina:', normalizedUrl);
  try {
    const { jinaReader } = await import('../webscraping/index.js');
    const result = await jinaReader(normalizedUrl);

    if (!result.success) {
      console.error('[LinkedIn] Jina failed:', result.error);
      return null;
    }

    const profile = parseLinkedInContent(result.content, normalizedUrl);
    cache.set(cacheKey, { data: profile, expiresAt: Date.now() + CACHE_TTL });
    return profile;
  } catch (error) {
    console.error('[LinkedIn] All methods failed:', error);
    return null;
  }
}

/**
 * Search and get profile in one call
 */
export async function findPerson(
  name: string,
  context?: { company?: string; title?: string; location?: string }
): Promise<LinkedInProfile | null> {
  let query = name;
  if (context?.company) query += ` ${context.company}`;
  if (context?.title) query += ` ${context.title}`;
  if (context?.location) query += ` ${context.location}`;

  const results = await searchProfiles(query, { limit: 5 });

  if (results.length === 0) {
    return null;
  }

  return getProfile(results[0].profileUrl);
}

// Helper functions

function normalizeLinkedInUrl(url: string): string | null {
  if (url.startsWith('https://linkedin.com')) {
    url = url.replace('https://linkedin.com', 'https://www.linkedin.com');
  }
  if (url.startsWith('linkedin.com')) {
    url = 'https://www.' + url;
  }
  if (url.startsWith('www.linkedin.com')) {
    url = 'https://' + url;
  }
  if (!url.includes('linkedin.com') && !url.includes('/')) {
    // Just a username
    url = `https://www.linkedin.com/in/${url}/`;
  }

  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/);
  if (match) {
    return `https://www.linkedin.com/in/${match[1].toLowerCase()}/`;
  }

  return null;
}

function extractLocation(text: string): string | undefined {
  const patterns = [
    /(?:located?\s+in|based\s+in|from)\s+([^.]+)/i,
    /([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return undefined;
}

function parseGoogleResults(html: string): LinkedInSearchResult[] {
  const results: LinkedInSearchResult[] = [];

  // Find LinkedIn URLs in search results
  const urlPattern = /https?:\/\/(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-]+)/g;
  const matches = html.matchAll(urlPattern);

  const seen = new Set<string>();
  for (const match of matches) {
    const url = match[0];
    const username = match[1];

    if (seen.has(username)) continue;
    seen.add(username);

    // Try to find title near this URL
    const titleMatch = html.match(new RegExp(`([^<>]{10,100})\\s*[-–]\\s*[^<>]*${username}`, 'i'));
    const name = titleMatch ? titleMatch[1].trim() : username;

    results.push({
      name,
      profileUrl: url,
      headline: undefined
    });

    if (results.length >= 10) break;
  }

  return results;
}

function parseLinkedInHtml(html: string, url: string, source: 'scrapedo' | 'jina'): LinkedInProfile {
  const profile: LinkedInProfile = {
    name: 'Unknown',
    profileUrl: url,
    source,
    raw: html.slice(0, 10000)
  };

  // Extract name from title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1];
    // "Pavel Papin - Head of Sales - Nebius | LinkedIn"
    const parts = title.split(/\s*[-–|]\s*/);
    if (parts[0]) profile.name = parts[0].trim();
    if (parts[1]) profile.headline = parts[1].trim();
  }

  // Extract from JSON-LD if available
  const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      if (data.name) profile.name = data.name;
      if (data.jobTitle) profile.headline = data.jobTitle;
      if (data.address?.addressLocality) {
        profile.location = data.address.addressLocality;
        if (data.address.addressCountry) {
          profile.location += ', ' + data.address.addressCountry;
        }
      }
      if (data.worksFor?.name) profile.currentCompany = data.worksFor.name;
    } catch {
      // JSON parse failed
    }
  }

  // Extract location from HTML
  const locationMatch = html.match(/class="[^"]*location[^"]*"[^>]*>([^<]+)/i);
  if (locationMatch && !profile.location) {
    profile.location = locationMatch[1].trim();
  }

  // Extract about/summary
  const aboutMatch = html.match(/class="[^"]*summary[^"]*"[^>]*>([^<]+)/i) ||
                     html.match(/About\s*<\/[^>]+>\s*<[^>]+>([^<]{50,500})/i);
  if (aboutMatch) {
    profile.about = aboutMatch[1].trim().slice(0, 500);
  }

  // Extract experience entries
  profile.experience = [];
  const expPattern = /class="[^"]*experience[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<p[^>]*>([^<]+)/gi;
  let expMatch;
  while ((expMatch = expPattern.exec(html)) !== null && profile.experience.length < 5) {
    profile.experience.push({
      title: expMatch[1].trim(),
      company: expMatch[2].trim()
    });
  }

  // Set current from first experience
  if (!profile.currentTitle && profile.experience[0]) {
    profile.currentTitle = profile.experience[0].title;
    profile.currentCompany = profile.experience[0].company;
  }

  return profile;
}

function parseLinkedInContent(content: string, url: string): LinkedInProfile {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  const profile: LinkedInProfile = {
    name: 'Unknown',
    profileUrl: url,
    source: 'jina',
    raw: content.slice(0, 5000)
  };

  // Parse from Title: line
  const titleIndex = lines.findIndex(l => l.startsWith('Title:'));
  if (titleIndex >= 0) {
    const titleLine = lines[titleIndex].replace('Title:', '').trim();
    const namePart = titleLine.split(' - ')[0]?.split(' | ')[0];
    if (namePart) profile.name = namePart.trim();
    const headlinePart = titleLine.split(' - ')[1]?.split(' | ')[0];
    if (headlinePart) profile.headline = headlinePart.trim();
  }

  // About section
  const aboutIndex = lines.findIndex(l => l.toLowerCase().includes('about'));
  if (aboutIndex >= 0 && aboutIndex < lines.length - 1) {
    const aboutLines = [];
    for (let i = aboutIndex + 1; i < Math.min(aboutIndex + 5, lines.length); i++) {
      if (lines[i].length > 20 && !lines[i].includes('Experience')) {
        aboutLines.push(lines[i]);
      } else break;
    }
    if (aboutLines.length) profile.about = aboutLines.join(' ');
  }

  // Experience
  const expIndex = lines.findIndex(l => l.toLowerCase() === 'experience');
  if (expIndex >= 0) {
    profile.experience = [];
    let i = expIndex + 1;
    while (i < lines.length && !['Education', 'Skills', 'Licenses'].includes(lines[i])) {
      const line = lines[i];
      if (line.includes(' at ') || line.includes(' - ')) {
        const parts = line.split(/ at | - /);
        if (parts.length >= 2) {
          profile.experience.push({
            title: parts[0].trim(),
            company: parts[1].trim()
          });
        }
      }
      i++;
      if (profile.experience.length >= 5) break;
    }
  }

  // Location
  const locationMatch = content.match(/📍\s*([^\n]+)|Location[:\s]+([^\n]+)/i);
  if (locationMatch) {
    profile.location = (locationMatch[1] || locationMatch[2]).trim();
  }

  // Current position
  if (!profile.currentTitle && profile.experience?.[0]) {
    profile.currentTitle = profile.experience[0].title;
    profile.currentCompany = profile.experience[0].company;
  }

  return profile;
}

// Cache management
export function getCacheStats(): { size: number } {
  return { size: cache.size };
}

export function clearCache(): void {
  cache.clear();
}
