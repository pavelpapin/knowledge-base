/**
 * Google Sheets Integration
 * Read, write, and manage spreadsheets
 */

import * as fs from 'fs';
import * as https from 'https';

const TOKEN_PATH = '/root/.claude/secrets/google-token.json';

interface GoogleToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

interface SheetRange {
  values: string[][];
  range: string;
}

interface Spreadsheet {
  spreadsheetId: string;
  title: string;
  sheets: Array<{
    sheetId: number;
    title: string;
    rowCount: number;
    columnCount: number;
  }>;
}

function loadToken(): GoogleToken | null {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
}

async function sheetsRequest(
  spreadsheetId: string,
  endpoint: string,
  method = 'GET',
  body?: unknown
): Promise<unknown> {
  const token = loadToken();
  if (!token) {
    throw new Error('Google not authenticated. Run gmail-auth first.');
  }

  return new Promise((resolve, reject) => {
    const path = endpoint.startsWith('/')
      ? `/v4/spreadsheets/${spreadsheetId}${endpoint}`
      : `/v4/spreadsheets/${spreadsheetId}/${endpoint}`;

    const options: https.RequestOptions = {
      hostname: 'sheets.googleapis.com',
      path,
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

// Spreadsheet operations

export async function getSpreadsheet(spreadsheetId: string): Promise<Spreadsheet> {
  const response = await sheetsRequest(spreadsheetId, '') as {
    spreadsheetId: string;
    properties: { title: string };
    sheets: Array<{
      properties: {
        sheetId: number;
        title: string;
        gridProperties: {
          rowCount: number;
          columnCount: number;
        };
      };
    }>;
  };

  return {
    spreadsheetId: response.spreadsheetId,
    title: response.properties.title,
    sheets: response.sheets.map(s => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      rowCount: s.properties.gridProperties.rowCount,
      columnCount: s.properties.gridProperties.columnCount
    }))
  };
}

// Reading data

export async function getRange(
  spreadsheetId: string,
  range: string
): Promise<SheetRange> {
  const response = await sheetsRequest(
    spreadsheetId,
    `values/${encodeURIComponent(range)}`
  ) as { range: string; values?: string[][] };

  return {
    range: response.range,
    values: response.values || []
  };
}

export async function getMultipleRanges(
  spreadsheetId: string,
  ranges: string[]
): Promise<SheetRange[]> {
  const rangesParam = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');

  const response = await sheetsRequest(
    spreadsheetId,
    `values:batchGet?${rangesParam}`
  ) as { valueRanges: Array<{ range: string; values?: string[][] }> };

  return response.valueRanges.map(vr => ({
    range: vr.range,
    values: vr.values || []
  }));
}

export async function getSheetData(
  spreadsheetId: string,
  sheetName: string
): Promise<SheetRange> {
  return getRange(spreadsheetId, sheetName);
}

// Writing data

export async function updateRange(
  spreadsheetId: string,
  range: string,
  values: string[][],
  options: { raw?: boolean } = {}
): Promise<{ updatedCells: number; updatedRows: number; updatedColumns: number }> {
  const valueInputOption = options.raw ? 'RAW' : 'USER_ENTERED';

  const response = await sheetsRequest(
    spreadsheetId,
    `values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`,
    'PUT',
    { values }
  ) as {
    updatedCells: number;
    updatedRows: number;
    updatedColumns: number;
  };

  return response;
}

export async function appendRows(
  spreadsheetId: string,
  range: string,
  values: string[][],
  options: { raw?: boolean } = {}
): Promise<{ updatedCells: number; updatedRows: number }> {
  const valueInputOption = options.raw ? 'RAW' : 'USER_ENTERED';

  const response = await sheetsRequest(
    spreadsheetId,
    `values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`,
    'POST',
    { values }
  ) as { updates: { updatedCells: number; updatedRows: number } };

  return response.updates;
}

export async function clearRange(
  spreadsheetId: string,
  range: string
): Promise<boolean> {
  await sheetsRequest(
    spreadsheetId,
    `values/${encodeURIComponent(range)}:clear`,
    'POST'
  );
  return true;
}

// Batch operations

export async function batchUpdate(
  spreadsheetId: string,
  updates: Array<{ range: string; values: string[][] }>
): Promise<{ totalUpdatedCells: number }> {
  const response = await sheetsRequest(
    spreadsheetId,
    'values:batchUpdate',
    'POST',
    {
      valueInputOption: 'USER_ENTERED',
      data: updates
    }
  ) as { totalUpdatedCells: number };

  return response;
}

// Sheet management

export async function addSheet(
  spreadsheetId: string,
  title: string,
  options: { rowCount?: number; columnCount?: number } = {}
): Promise<{ sheetId: number; title: string }> {
  const response = await sheetsRequest(
    spreadsheetId,
    ':batchUpdate',
    'POST',
    {
      requests: [{
        addSheet: {
          properties: {
            title,
            gridProperties: {
              rowCount: options.rowCount || 1000,
              columnCount: options.columnCount || 26
            }
          }
        }
      }]
    }
  ) as { replies: Array<{ addSheet: { properties: { sheetId: number; title: string } } }> };

  return response.replies[0].addSheet.properties;
}

export async function deleteSheet(
  spreadsheetId: string,
  sheetId: number
): Promise<boolean> {
  await sheetsRequest(
    spreadsheetId,
    ':batchUpdate',
    'POST',
    {
      requests: [{
        deleteSheet: { sheetId }
      }]
    }
  );
  return true;
}

export async function renameSheet(
  spreadsheetId: string,
  sheetId: number,
  newTitle: string
): Promise<boolean> {
  await sheetsRequest(
    spreadsheetId,
    ':batchUpdate',
    'POST',
    {
      requests: [{
        updateSheetProperties: {
          properties: { sheetId, title: newTitle },
          fields: 'title'
        }
      }]
    }
  );
  return true;
}

// Utility functions

export function columnToLetter(column: number): string {
  let result = '';
  while (column > 0) {
    const mod = (column - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    column = Math.floor((column - mod) / 26);
  }
  return result;
}

export function letterToColumn(letter: string): number {
  let column = 0;
  for (let i = 0; i < letter.length; i++) {
    column = column * 26 + (letter.charCodeAt(i) - 64);
  }
  return column;
}

export function rangeA1(
  sheet: string,
  startCol: number,
  startRow: number,
  endCol?: number,
  endRow?: number
): string {
  const start = `${columnToLetter(startCol)}${startRow}`;
  if (endCol && endRow) {
    const end = `${columnToLetter(endCol)}${endRow}`;
    return `'${sheet}'!${start}:${end}`;
  }
  return `'${sheet}'!${start}`;
}

// Find and search

export async function findInSheet(
  spreadsheetId: string,
  sheetName: string,
  searchValue: string,
  column?: number
): Promise<Array<{ row: number; column: number; value: string }>> {
  const data = await getSheetData(spreadsheetId, sheetName);
  const results: Array<{ row: number; column: number; value: string }> = [];

  data.values.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (column !== undefined && colIndex !== column - 1) return;

      if (cell.toLowerCase().includes(searchValue.toLowerCase())) {
        results.push({
          row: rowIndex + 1,
          column: colIndex + 1,
          value: cell
        });
      }
    });
  });

  return results;
}

export function isAuthenticated(): boolean {
  return loadToken() !== null;
}

export function getAuthInstructions(): string {
  return `
Google Sheets Integration:

Uses the same authentication as Gmail/Calendar.
Make sure you've authenticated with Google and have the correct scopes.

Required scope: https://www.googleapis.com/auth/spreadsheets

The token is stored at: /root/.claude/secrets/google-token.json
`;
}
