/**
 * Google Docs Integration
 * Read, create, and edit Google Documents
 */

import { httpRequest, HttpError } from '../utils/http.js';
import { getGoogleToken } from '../utils/credentials.js';

interface Document {
  documentId: string;
  title: string;
  body: { content: StructuralElement[] };
  revisionId: string;
}

interface StructuralElement {
  startIndex: number;
  endIndex: number;
  paragraph?: { elements: Array<{ textRun?: { content: string } }> };
  table?: { tableRows: Array<{ tableCells: Array<{ content: StructuralElement[] }> }> };
}

async function docsRequest<T>(endpoint: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getGoogleToken();
  if (!token) throw new HttpError('Google not authenticated');

  return httpRequest<T>({
    hostname: 'docs.googleapis.com',
    path: `/v1/documents${endpoint}`,
    method: method as 'GET' | 'POST',
    headers: { Authorization: `Bearer ${token.access_token}` },
    body
  });
}

function extractText(body: { content: StructuralElement[] }): string {
  const parts: string[] = [];
  for (const element of body.content) {
    if (element.paragraph) {
      for (const pe of element.paragraph.elements) {
        if (pe.textRun?.content) parts.push(pe.textRun.content);
      }
    } else if (element.table) {
      for (const row of element.table.tableRows) {
        const cells = row.tableCells.map(cell => extractText({ content: cell.content }).trim());
        parts.push(cells.join('\t'));
      }
      parts.push('\n');
    }
  }
  return parts.join('');
}

export async function getDocument(documentId: string): Promise<{
  id: string; title: string; content: string; revisionId: string;
}> {
  const doc = await docsRequest<Document>(`/${documentId}`);
  return { id: doc.documentId, title: doc.title, content: extractText(doc.body), revisionId: doc.revisionId };
}

export async function createDocument(title: string): Promise<{ id: string; title: string; url: string }> {
  const doc = await docsRequest<Document>('', 'POST', { title });
  return { id: doc.documentId, title: doc.title, url: `https://docs.google.com/document/d/${doc.documentId}/edit` };
}

export async function appendText(documentId: string, text: string): Promise<boolean> {
  const doc = await docsRequest<Document>(`/${documentId}`);
  const endIndex = doc.body.content[doc.body.content.length - 1]?.endIndex || 1;
  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [{ insertText: { location: { index: endIndex - 1 }, text } }]
  });
  return true;
}

export async function insertText(documentId: string, text: string, index: number): Promise<boolean> {
  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [{ insertText: { location: { index }, text } }]
  });
  return true;
}

export async function replaceText(
  documentId: string, searchText: string, replaceText: string, matchCase = false
): Promise<number> {
  const response = await docsRequest<{ replies: Array<{ replaceAllText: { occurrencesChanged: number } }> }>(
    `/${documentId}:batchUpdate`, 'POST', {
      requests: [{ replaceAllText: { containsText: { text: searchText, matchCase }, replaceText } }]
    }
  );
  return response.replies[0]?.replaceAllText?.occurrencesChanged || 0;
}

export async function deleteContent(documentId: string, startIndex: number, endIndex: number): Promise<boolean> {
  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [{ deleteContentRange: { range: { startIndex, endIndex } } }]
  });
  return true;
}

export async function insertHeading(
  documentId: string, text: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 1, index?: number
): Promise<boolean> {
  const doc = await docsRequest<Document>(`/${documentId}`);
  const insertIndex = index ?? (doc.body.content[doc.body.content.length - 1]?.endIndex || 1) - 1;
  const textWithNewline = text + '\n';

  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [
      { insertText: { location: { index: insertIndex }, text: textWithNewline } },
      {
        updateParagraphStyle: {
          range: { startIndex: insertIndex, endIndex: insertIndex + textWithNewline.length },
          paragraphStyle: { namedStyleType: `HEADING_${level}` },
          fields: 'namedStyleType'
        }
      }
    ]
  });
  return true;
}

export async function insertBulletList(documentId: string, items: string[], index?: number): Promise<boolean> {
  const doc = await docsRequest<Document>(`/${documentId}`);
  const insertIndex = index ?? (doc.body.content[doc.body.content.length - 1]?.endIndex || 1) - 1;
  const text = items.join('\n') + '\n';

  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [
      { insertText: { location: { index: insertIndex }, text } },
      {
        createParagraphBullets: {
          range: { startIndex: insertIndex, endIndex: insertIndex + text.length },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
        }
      }
    ]
  });
  return true;
}

export async function insertTable(documentId: string, rows: number, columns: number, index?: number): Promise<boolean> {
  const doc = await docsRequest<Document>(`/${documentId}`);
  const insertIndex = index ?? (doc.body.content[doc.body.content.length - 1]?.endIndex || 1) - 1;

  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [{ insertTable: { rows, columns, location: { index: insertIndex } } }]
  });
  return true;
}

export async function searchDocuments(query: string, maxResults = 10): Promise<Array<{ id: string; name: string; url: string }>> {
  const token = getGoogleToken();
  if (!token) throw new HttpError('Google not authenticated');

  const params = new URLSearchParams({
    q: `mimeType='application/vnd.google-apps.document' and fullText contains '${query.replace(/'/g, "\\'")}'`,
    pageSize: String(maxResults),
    fields: 'files(id,name,webViewLink)'
  });

  const response = await httpRequest<{ files?: Array<{ id: string; name: string; webViewLink: string }> }>({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files?${params}`,
    headers: { Authorization: `Bearer ${token.access_token}` }
  });

  return (response.files || []).map(f => ({ id: f.id, name: f.name, url: f.webViewLink }));
}

export function isAuthenticated(): boolean {
  return getGoogleToken() !== null;
}

export function getAuthInstructions(): string {
  return `Google Docs: Uses same auth as Gmail/Calendar. Required scopes: documents, drive.readonly`;
}
