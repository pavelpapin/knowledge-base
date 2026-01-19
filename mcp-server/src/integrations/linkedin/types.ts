/**
 * LinkedIn Integration Types
 */

export interface LinkedInCredentials {
  li_at?: string;           // LinkedIn session cookie
  jsessionid?: string;      // JSESSIONID cookie
  rapidapi_key?: string;    // RapidAPI key for LinkedIn API
  proxycurl_key?: string;   // Proxycurl API key
}

export interface LinkedInProfile {
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

export interface LinkedInSearchResult {
  profiles: LinkedInProfile[];
  total: number;
}

export interface LinkedInCompany {
  id: string;
  name: string;
  industry: string;
  location: string;
  linkedinUrl: string;
  employeeCount?: string;
}

// API Response types
export interface ProxycurlProfileResponse {
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
}

export interface ProxycurlSearchResponse {
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
}

export interface ProxycurlCompanySearchResponse {
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
}

export interface ProxycurlEmployeesResponse {
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
}
