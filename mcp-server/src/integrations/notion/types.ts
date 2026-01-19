/**
 * Notion Integration Types
 */

export interface NotionCredentials {
  api_key: string;
}

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  properties: Record<string, unknown>;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  properties: Record<string, { type: string; name: string }>;
}

export interface NotionBlock {
  id: string;
  type: string;
  content: string;
}

export type BlockType = 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'numbered_list_item' | 'to_do';

// API Response types
export interface NotionDatabaseResponse {
  id: string;
  url: string;
  title: Array<{ plain_text: string }>;
  properties: Record<string, { type: string; name: string }>;
}

export interface NotionPageResponse {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
}

export interface NotionSearchResponse {
  results: Array<{
    object: string;
    id: string;
    url: string;
    created_time?: string;
    last_edited_time?: string;
    title?: Array<{ plain_text: string }>;
    properties?: Record<string, unknown>;
  }>;
}

export interface NotionBlocksResponse {
  results: Array<{
    id: string;
    type: string;
    [key: string]: unknown;
  }>;
}
