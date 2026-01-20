/**
 * Google Calendar Types
 */

export interface GoogleToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface CalendarEvent {
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

export interface CalendarList {
  id: string;
  summary: string;
  primary: boolean;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees?: string[];
}

export interface CreateEventResult {
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
}
