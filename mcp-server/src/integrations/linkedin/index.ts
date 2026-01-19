/**
 * LinkedIn Integration
 * Profile lookup, search, and messaging via unofficial methods
 * Note: Uses scraping/unofficial APIs - use responsibly
 */

import { proxycurlRequest, rapidApiRequest, isAuthenticated, getAuthInstructions } from './api.js';
import type {
  LinkedInProfile,
  LinkedInSearchResult,
  LinkedInCompany,
  ProxycurlProfileResponse,
  ProxycurlSearchResponse,
  ProxycurlCompanySearchResponse,
  ProxycurlEmployeesResponse
} from './types.js';

export type { LinkedInProfile, LinkedInSearchResult, LinkedInCompany } from './types.js';
export { isAuthenticated, getAuthInstructions } from './api.js';

export async function getProfile(linkedinUrl: string): Promise<LinkedInProfile | null> {
  try {
    const response = await proxycurlRequest('/v2/linkedin', {
      url: linkedinUrl
    }) as ProxycurlProfileResponse;

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

    const response = await proxycurlRequest('/search/person', params) as ProxycurlSearchResponse;

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
): Promise<LinkedInCompany[]> {
  try {
    const response = await proxycurlRequest('/search/company', {
      name: keywords,
      per_page: String(options.limit || 10)
    }) as ProxycurlCompanySearchResponse;

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

    const response = await proxycurlRequest('/linkedin/company/employees', params) as ProxycurlEmployeesResponse;

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
