/**
 * Google Docs Integration
 * Read, create, and edit Google Documents
 */

import * as fs from 'fs';
import * as https from 'https';

const TOKEN_PATH = '/root/.claude/secrets/google-token.json';

interface GoogleToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

interface Document {
  documentId: string;
  title: string;
  body: DocumentBody;
  revisionId: string;
}

interface DocumentBody {
  content: StructuralElement[];
}

interface StructuralElement {
  startIndex: number;
  endIndex: number;
  paragraph?: Paragraph;
  table?: Table;
  sectionBreak?: object;
}

interface Paragraph {
  elements: ParagraphElement[];
  paragraphStyle?: {
    namedStyleType?: string;
    headingId?: string;
  };
}

interface ParagraphElement {
  startIndex: number;
  endIndex: number;
  textRun?: {
    content: string;
    textStyle?: object;
  };
}

interface Table {
  rows: number;
  columns: number;
  tableRows: TableRow[];
}

interface TableRow {
  tableCells: TableCell[];
}

interface TableCell {
  content: StructuralElement[];
}

function loadToken(): GoogleToken | null {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
}

async function docsRequest(
  endpoint: string,
  method = 'GET',
  body?: unknown
): Promise<unknown> {
  const token = loadToken();
  if (!token) {
    throw new Error('Google not authenticated');
  }

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'docs.googleapis.com',
      path: `/v1/documents${endpoint}`,
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
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
          } else {
            resolve(json);
          }
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

// Extract plain text from document
function extractText(body: DocumentBody): string {
  const parts: string[] = [];

  for (const element of body.content) {
    if (element.paragraph) {
      for (const pe of element.paragraph.elements) {
        if (pe.textRun?.content) {
          parts.push(pe.textRun.content);
        }
      }
    } else if (element.table) {
      for (const row of element.table.tableRows) {
        const cells: string[] = [];
        for (const cell of row.tableCells) {
          const cellText = extractText({ content: cell.content });
          cells.push(cellText.trim());
        }
        parts.push(cells.join('\t'));
      }
      parts.push('\n');
    }
  }

  return parts.join('');
}

// Document operations

export async function getDocument(documentId: string): Promise<{
  id: string;
  title: string;
  content: string;
  revisionId: string;
}> {
  const doc = await docsRequest(`/${documentId}`) as Document;

  return {
    id: doc.documentId,
    title: doc.title,
    content: extractText(doc.body),
    revisionId: doc.revisionId
  };
}

export async function createDocument(title: string): Promise<{
  id: string;
  title: string;
  url: string;
}> {
  const doc = await docsRequest('', 'POST', { title }) as Document;

  return {
    id: doc.documentId,
    title: doc.title,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`
  };
}

export async function appendText(
  documentId: string,
  text: string
): Promise<boolean> {
  // First get document to find end index
  const doc = await docsRequest(`/${documentId}`) as Document;
  const endIndex = doc.body.content[doc.body.content.length - 1]?.endIndex || 1;

  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [{
      insertText: {
        location: { index: endIndex - 1 },
        text
      }
    }]
  });

  return true;
}

export async function insertText(
  documentId: string,
  text: string,
  index: number
): Promise<boolean> {
  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [{
      insertText: {
        location: { index },
        text
      }
    }]
  });

  return true;
}

export async function replaceText(
  documentId: string,
  searchText: string,
  replaceText: string,
  matchCase = false
): Promise<number> {
  const response = await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [{
      replaceAllText: {
        containsText: {
          text: searchText,
          matchCase
        },
        replaceText
      }
    }]
  }) as { replies: Array<{ replaceAllText: { occurrencesChanged: number } }> };

  return response.replies[0]?.replaceAllText?.occurrencesChanged || 0;
}

export async function deleteContent(
  documentId: string,
  startIndex: number,
  endIndex: number
): Promise<boolean> {
  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [{
      deleteContentRange: {
        range: { startIndex, endIndex }
      }
    }]
  });

  return true;
}

export async function insertHeading(
  documentId: string,
  text: string,
  level: 1 | 2 | 3 | 4 | 5 | 6 = 1,
  index?: number
): Promise<boolean> {
  const doc = await docsRequest(`/${documentId}`) as Document;
  const insertIndex = index ?? (doc.body.content[doc.body.content.length - 1]?.endIndex || 1) - 1;

  const headingStyle = `HEADING_${level}`;
  const textWithNewline = text + '\n';

  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [
      {
        insertText: {
          location: { index: insertIndex },
          text: textWithNewline
        }
      },
      {
        updateParagraphStyle: {
          range: {
            startIndex: insertIndex,
            endIndex: insertIndex + textWithNewline.length
          },
          paragraphStyle: {
            namedStyleType: headingStyle
          },
          fields: 'namedStyleType'
        }
      }
    ]
  });

  return true;
}

export async function insertBulletList(
  documentId: string,
  items: string[],
  index?: number
): Promise<boolean> {
  const doc = await docsRequest(`/${documentId}`) as Document;
  const insertIndex = index ?? (doc.body.content[doc.body.content.length - 1]?.endIndex || 1) - 1;

  const text = items.join('\n') + '\n';

  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [
      {
        insertText: {
          location: { index: insertIndex },
          text
        }
      },
      {
        createParagraphBullets: {
          range: {
            startIndex: insertIndex,
            endIndex: insertIndex + text.length
          },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
        }
      }
    ]
  });

  return true;
}

export async function insertTable(
  documentId: string,
  rows: number,
  columns: number,
  index?: number
): Promise<boolean> {
  const doc = await docsRequest(`/${documentId}`) as Document;
  const insertIndex = index ?? (doc.body.content[doc.body.content.length - 1]?.endIndex || 1) - 1;

  await docsRequest(`/${documentId}:batchUpdate`, 'POST', {
    requests: [{
      insertTable: {
        rows,
        columns,
        location: { index: insertIndex }
      }
    }]
  });

  return true;
}

// Search in Drive for Docs
export async function searchDocuments(
  query: string,
  maxResults = 10
): Promise<Array<{ id: string; name: string; url: string }>> {
  const token = loadToken();
  if (!token) {
    throw new Error('Google not authenticated');
  }

  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      q: `mimeType='application/vnd.google-apps.document' and fullText contains '${query.replace(/'/g, "\\'")}'`,
      pageSize: String(maxResults),
      fields: 'files(id,name,webViewLink)'
    });

    const options: https.RequestOptions = {
      hostname: 'www.googleapis.com',
      path: `/drive/v3/files?${params}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.access_token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve((json.files || []).map((f: { id: string; name: string; webViewLink: string }) => ({
            id: f.id,
            name: f.name,
            url: f.webViewLink
          })));
        } catch {
          resolve([]);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

export function isAuthenticated(): boolean {
  return loadToken() !== null;
}

export function getAuthInstructions(): string {
  return `
Google Docs Integration:

Uses the same authentication as Gmail/Calendar/Sheets.
Make sure you've authenticated with Google and have the correct scopes.

Required scope: https://www.googleapis.com/auth/documents
Also needs: https://www.googleapis.com/auth/drive.readonly (for search)

The token is stored at: /root/.claude/secrets/google-token.json
`;
}
