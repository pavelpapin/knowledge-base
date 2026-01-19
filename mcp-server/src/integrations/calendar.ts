/**
 * Google Calendar Integration
 * Read, create, and manage calendar events
 */

import * as fs from 'fs';
import * as https from 'https';

const TOKEN_PATH = '/root/.claude/secrets/google-token.json';

interface GoogleToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees: string[];
  status: string;
  htmlLink: string;
}

interface CalendarList {
  id: string;
  summary: string;
  primary: boolean;
}

function loadToken(): GoogleToken | null {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
}

async function calendarRequest(endpoint: string, method = 'GET', body?: unknown): Promise<unknown> {
  const token = loadToken();
  if (!token) {
    throw new Error('Not authenticated. Run gmail-auth to authenticate.');
  }

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'www.googleapis.com',
      path: `/calendar/v3${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json'
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
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

export async function listCalendars(): Promise<CalendarList[]> {
  const response = await calendarRequest('/users/me/calendarList') as {
    items?: Array<{
      id: string;
      summary: string;
      primary?: boolean;
    }>;
  };

  if (!response.items) {
    return [];
  }

  return response.items.map(c => ({
    id: c.id,
    summary: c.summary,
    primary: c.primary || false
  }));
}

export async function listEvents(
  calendarId = 'primary',
  options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    query?: string;
  } = {}
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    maxResults: String(options.maxResults || 10),
    singleEvents: 'true',
    orderBy: 'startTime'
  });

  if (options.timeMin) {
    params.set('timeMin', options.timeMin);
  } else {
    params.set('timeMin', new Date().toISOString());
  }

  if (options.timeMax) {
    params.set('timeMax', options.timeMax);
  }

  if (options.query) {
    params.set('q', options.query);
  }

  const response = await calendarRequest(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
  ) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      attendees?: Array<{ email: string }>;
      status?: string;
      htmlLink?: string;
    }>;
  };

  if (!response.items) {
    return [];
  }

  return response.items.map(e => ({
    id: e.id,
    summary: e.summary || '(no title)',
    description: e.description,
    location: e.location,
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    attendees: (e.attendees || []).map(a => a.email),
    status: e.status || 'confirmed',
    htmlLink: e.htmlLink || ''
  }));
}

export async function getEvent(calendarId: string, eventId: string): Promise<CalendarEvent | null> {
  const e = await calendarRequest(
    `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`
  ) as {
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: Array<{ email: string }>;
    status?: string;
    htmlLink?: string;
  };

  if (!e.id) return null;

  return {
    id: e.id,
    summary: e.summary || '(no title)',
    description: e.description,
    location: e.location,
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    attendees: (e.attendees || []).map(a => a.email),
    status: e.status || 'confirmed',
    htmlLink: e.htmlLink || ''
  };
}

export async function createEvent(
  calendarId = 'primary',
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: string;
    end: string;
    attendees?: string[];
  }
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.start,
        timeZone: 'UTC'
      },
      end: {
        dateTime: event.end,
        timeZone: 'UTC'
      }
    };

    if (event.attendees && event.attendees.length > 0) {
      body.attendees = event.attendees.map(email => ({ email }));
    }

    const response = await calendarRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      'POST',
      body
    ) as { id?: string; htmlLink?: string; error?: { message: string } };

    if (response.id) {
      return {
        success: true,
        eventId: response.id,
        htmlLink: response.htmlLink
      };
    }

    return { success: false, error: response.error?.message || 'Unknown error' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await calendarRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      'DELETE'
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function getTodayEvents(calendarId = 'primary'): Promise<CalendarEvent[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return listEvents(calendarId, {
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    maxResults: 50
  });
}

export async function getWeekEvents(calendarId = 'primary'): Promise<CalendarEvent[]> {
  const now = new Date();
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return listEvents(calendarId, {
    timeMin: now.toISOString(),
    timeMax: endOfWeek.toISOString(),
    maxResults: 100
  });
}

export function isAuthenticated(): boolean {
  return loadToken() !== null;
}
