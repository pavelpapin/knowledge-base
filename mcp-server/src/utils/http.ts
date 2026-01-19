/**
 * Shared HTTP client utilities
 */

import * as https from 'https';

export interface HttpRequestOptions {
  hostname: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Make an HTTPS request and return parsed JSON response
 */
export async function httpRequest<T>(options: HttpRequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const contentType = options.headers?.['Content-Type'] || 'application/json';
    const isFormData = contentType.includes('x-www-form-urlencoded');

    const reqOptions: https.RequestOptions = {
      hostname: options.hostname,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': contentType,
        ...options.headers,
      },
      timeout: options.timeout || 30000,
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error && typeof json.error === 'object') {
            reject(new HttpError(json.error.message || JSON.stringify(json.error), res.statusCode, json));
          } else {
            resolve(json as T);
          }
        } catch {
          resolve(data as unknown as T);
        }
      });
    });

    req.on('error', (err) => reject(new HttpError(err.message)));
    req.on('timeout', () => {
      req.destroy();
      reject(new HttpError('Request timeout'));
    });

    if (options.body) {
      const bodyStr = isFormData && typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
      req.write(bodyStr);
    }
    req.end();
  });
}

/**
 * Make a Google API request with authentication
 */
export async function googleApiRequest<T>(
  service: string,
  endpoint: string,
  accessToken: string,
  options: Partial<HttpRequestOptions> = {}
): Promise<T> {
  const hostname = service === 'drive'
    ? 'www.googleapis.com'
    : `${service}.googleapis.com`;

  const path = service === 'drive'
    ? `/drive/v3${endpoint}`
    : `/v1${endpoint}`;

  return httpRequest<T>({
    hostname,
    path,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
    ...options,
  });
}

/**
 * Build URL query string from params
 */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const filtered = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);

  return filtered.length > 0 ? `?${filtered.join('&')}` : '';
}
