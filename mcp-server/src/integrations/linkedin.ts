/**
 * LinkedIn Integration
 * Profile lookup, search, and messaging via unofficial methods
 * Note: Uses scraping/unofficial APIs - use responsibly
 */

import * as fs from 'fs';
import * as https from 'https';

const CREDENTIALS_PATH = '/root/.claude/secrets/linkedin-credentials.json';

interface LinkedInCredentials {
  li_at?: string;           // LinkedIn session cookie
  jsessionid?: string;      // JSESSIONID cookie
  rapidapi_key?: string;    // RapidAPI key for LinkedIn API
}

interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  profileUrl: string;
  imageUrl?: string;
  summary?: string;
  currentCompany?: string;
  currentTitle?: string;
  connections?: number;
}

interface LinkedInSearchResult {
  profiles: LinkedInProfile[];
  total: number;
}

function loadCredentials(): LinkedInCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

// RapidAPI-based search (requires subscription)
async function rapidApiRequest(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const credentials = loadCredentials();
  if (!credentials?.rapidapi_key) {
    throw new Error('RapidAPI key not configured');
  }

  const queryString = new URLSearchParams(params).toString();

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'linkedin-api8.p.rapidapi.com',
      path: `${endpoint}?${queryString}`,
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': credentials.rapidapi_key,
        'X-RapidAPI-Host': 'linkedin-api8.p.rapidapi.com'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Alternative: Proxycurl API (more reliable)
async function proxycurlRequest(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const credentials = loadCredentials();
  const apiKey = (credentials as Record<string, string>)?.proxycurl_key;

  if (!apiKey) {
    throw new Error('Proxycurl API key not configured');
  }

  const queryString = new URLSearchParams(params).toString();

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'nubela.co',
      path: `/proxycurl/api${endpoint}?${queryString}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

export async function getProfile(linkedinUrl: string): Promise<LinkedInProfile | null> {
  try {
    // Try Proxycurl first
    const response = await proxycurlRequest('/v2/linkedin', {
      url: linkedinUrl
    }) as {
      public_identifier?: string;
      first_name?: string;
      last_name?: string;
      headline?: string;
      city?: string;
      country?: string;
      profile_pic_url?: string;
      summary?: string;
      experiences?: Array<{
        company?: string;
        title?: string;
        starts_at?: { year: number };
        ends_at?: { year: number } | null;
      }>;
      connections?: number;
    };

    if (!response.public_identifier) {
      return null;
    }

    const currentExp = response.experiences?.find(e => !e.ends_at);

    return {
      id: response.public_identifier,
      firstName: response.first_name || '',
      lastName: response.last_name || '',
      headline: response.headline || '',
      location: [response.city, response.country].filter(Boolean).join(', '),
      profileUrl: linkedinUrl,
      imageUrl: response.profile_pic_url,
      summary: response.summary,
      currentCompany: currentExp?.company,
      currentTitle: currentExp?.title,
      connections: response.connections
    };
  } catch (error) {
    console.error('Proxycurl failed:', error);

    // Try RapidAPI as fallback
    try {
      const username = linkedinUrl.split('/in/')[1]?.split('/')[0]?.split('?')[0];
      if (!username) return null;

      const response = await rapidApiRequest('/get-profile-data-by-url', {
        url: linkedinUrl
      }) as Record<string, unknown>;

      return {
        id: username,
        firstName: String(response.firstName || ''),
        lastName: String(response.lastName || ''),
        headline: String(response.headline || ''),
        location: String(response.location || ''),
        profileUrl: linkedinUrl,
        imageUrl: response.profilePicture as string | undefined,
        summary: response.summary as string | undefined
      };
    } catch {
      return null;
    }
  }
}

export async function searchPeople(
  keywords: string,
  options: {
    location?: string;
    currentCompany?: string;
    title?: string;
    limit?: number;
  } = {}
): Promise<LinkedInSearchResult> {
  try {
    const params: Record<string, string> = {
      keywords,
      per_page: String(options.limit || 10)
    };

    if (options.location) params.country = options.location;
    if (options.currentCompany) params.current_company_name = options.currentCompany;
    if (options.title) params.current_job_title = options.title;

    const response = await proxycurlRequest('/search/person', params) as {
      results?: Array<{
        linkedin_profile_url: string;
        profile: {
          public_identifier: string;
          first_name: string;
          last_name: string;
          headline: string;
          city: string;
          country: string;
        };
      }>;
      total_result_count?: number;
    };

    const profiles = (response.results || []).map(r => ({
      id: r.profile.public_identifier,
      firstName: r.profile.first_name,
      lastName: r.profile.last_name,
      headline: r.profile.headline,
      location: [r.profile.city, r.profile.country].filter(Boolean).join(', '),
      profileUrl: r.linkedin_profile_url
    }));

    return {
      profiles,
      total: response.total_result_count || profiles.length
    };
  } catch (error) {
    console.error('LinkedIn search failed:', error);
    return { profiles: [], total: 0 };
  }
}

export async function searchCompanies(
  keywords: string,
  options: { limit?: number } = {}
): Promise<Array<{
  id: string;
  name: string;
  industry: string;
  location: string;
  linkedinUrl: string;
  employeeCount?: string;
}>> {
  try {
    const response = await proxycurlRequest('/search/company', {
      name: keywords,
      per_page: String(options.limit || 10)
    }) as {
      results?: Array<{
        linkedin_profile_url: string;
        profile: {
          universal_name_id: string;
          name: string;
          industry: string;
          city: string;
          country: string;
          company_size_on_linkedin: number;
        };
      }>;
    };

    return (response.results || []).map(r => ({
      id: r.profile.universal_name_id,
      name: r.profile.name,
      industry: r.profile.industry,
      location: [r.profile.city, r.profile.country].filter(Boolean).join(', '),
      linkedinUrl: r.linkedin_profile_url,
      employeeCount: r.profile.company_size_on_linkedin ? String(r.profile.company_size_on_linkedin) : undefined
    }));
  } catch (error) {
    console.error('Company search failed:', error);
    return [];
  }
}

export async function getCompanyEmployees(
  companyLinkedinUrl: string,
  options: { limit?: number; role?: string } = {}
): Promise<LinkedInProfile[]> {
  try {
    const params: Record<string, string> = {
      linkedin_company_profile_url: companyLinkedinUrl,
      page_size: String(options.limit || 10)
    };

    if (options.role) {
      params.role_search = options.role;
    }

    const response = await proxycurlRequest('/linkedin/company/employees', params) as {
      employees?: Array<{
        profile_url: string;
        profile: {
          public_identifier: string;
          first_name: string;
          last_name: string;
          headline: string;
          city: string;
          country: string;
        };
      }>;
    };

    return (response.employees || []).map(e => ({
      id: e.profile.public_identifier,
      firstName: e.profile.first_name,
      lastName: e.profile.last_name,
      headline: e.profile.headline,
      location: [e.profile.city, e.profile.country].filter(Boolean).join(', '),
      profileUrl: e.profile_url
    }));
  } catch (error) {
    console.error('Employee search failed:', error);
    return [];
  }
}

export function isAuthenticated(): boolean {
  const credentials = loadCredentials();
  return credentials !== null && (
    !!credentials.rapidapi_key ||
    !!(credentials as Record<string, string>).proxycurl_key
  );
}

export function getAuthInstructions(): string {
  return `
LinkedIn Integration Setup:

Option 1: Proxycurl (Recommended)
1. Sign up at https://nubela.co/proxycurl
2. Get your API key
3. Create /root/.claude/secrets/linkedin-credentials.json:
   { "proxycurl_key": "YOUR_API_KEY" }

Option 2: RapidAPI LinkedIn API
1. Subscribe to LinkedIn API on RapidAPI
2. Get your API key
3. Create /root/.claude/secrets/linkedin-credentials.json:
   { "rapidapi_key": "YOUR_API_KEY" }
`;
}
