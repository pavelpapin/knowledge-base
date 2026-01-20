/**
 * LinkedIn Enrichment API for Clay
 * Simple HTTP endpoint to enrich LinkedIn profiles
 * Also handles Clay webhook callbacks
 */

import { createServer } from 'http';
import * as linkedin from '../integrations/linkedin/index.js';
import * as clay from '../integrations/clay/index.js';

const PORT = 3100;
const API_KEY = process.env.ELIO_API_KEY || 'elio-linkedin-2024';

interface EnrichmentRequest {
  linkedin_url?: string;
  email?: string;
  name?: string;
  company?: string;
}

interface EnrichmentResponse {
  success: boolean;
  data?: {
    name: string;
    headline?: string;
    location?: string;
    current_title?: string;
    current_company?: string;
    profile_url: string;
    photo_url?: string;
    about?: string;
    email?: string;
  };
  error?: string;
  source?: string;
}

async function handleEnrichment(body: EnrichmentRequest): Promise<EnrichmentResponse> {
  try {
    let profile = null;

    // If LinkedIn URL provided, fetch directly
    if (body.linkedin_url) {
      profile = await linkedin.scrapeProfile(body.linkedin_url);
    }
    // If name/company provided, search first
    else if (body.name) {
      profile = await linkedin.findPerson(body.name, {
        company: body.company
      });
    }
    // If only email, we can't do much without additional services
    else if (body.email) {
      return {
        success: false,
        error: 'Email-only lookup requires additional services. Provide linkedin_url or name.'
      };
    }
    else {
      return {
        success: false,
        error: 'Provide linkedin_url, or name (with optional company)'
      };
    }

    if (!profile) {
      return {
        success: false,
        error: 'Profile not found'
      };
    }

    return {
      success: true,
      data: {
        name: profile.name,
        headline: profile.headline,
        location: profile.location,
        current_title: profile.currentTitle,
        current_company: profile.currentCompany,
        profile_url: profile.profileUrl,
        photo_url: profile.photoUrl,
        about: profile.about,
        email: profile.email
      },
      source: profile.source
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function startServer() {
  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Check API key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid API key' }));
      return;
    }

    // Route: POST /clay-callback - receive enriched data from Clay
    if (req.method === 'POST' && req.url?.startsWith('/clay-callback')) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log('[Clay Callback] Received:', JSON.stringify(data, null, 2));
          const result = clay.handleCallback(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Route: GET /clay-result/:id - get enrichment result
    if (req.method === 'GET' && req.url?.startsWith('/clay-result/')) {
      const requestId = req.url.replace('/clay-result/', '');
      const result = clay.getResult(requestId);
      if (result) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Result not found' }));
      }
      return;
    }

    // Route: GET /clay-status - get Clay integration status
    if (req.method === 'GET' && req.url === '/clay-status') {
      const status = clay.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...status }));
      return;
    }

    // Route: POST /clay-enrich - send to Clay for enrichment
    if (req.method === 'POST' && req.url?.startsWith('/clay-enrich')) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const result = await clay.enrich(data);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Only POST /enrich for direct LinkedIn enrichment
    if (req.method !== 'POST' || !req.url?.startsWith('/enrich')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Not found. Available: POST /enrich, POST /clay-enrich, GET /clay-status, GET /clay-result/:id'
      }));
      return;
    }

    // Parse body
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body) as EnrichmentRequest;
        const result = await handleEnrichment(data);

        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`[LinkedIn API] Server running on http://localhost:${PORT}`);
    console.log(`[LinkedIn API] Use POST /enrich with X-API-Key header`);
  });

  return server;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
