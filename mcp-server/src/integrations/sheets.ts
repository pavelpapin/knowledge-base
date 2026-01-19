/**
 * Google Sheets Integration
 * Read, write, and manage spreadsheets
 */

import { httpRequest, HttpError } from '../utils/http.js';
import { getGoogleToken } from '../utils/credentials.js';

interface SheetRange {
  values: string[][];
  range: string;
}

interface Spreadsheet {
  spreadsheetId: string;
  title: string;
  sheets: Array<{ sheetId: number; title: string; rowCount: number; columnCount: number }>;
}

async function sheetsRequest<T>(spreadsheetId: string, endpoint: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getGoogleToken();
  if (!token) throw new HttpError('Google not authenticated. Run gmail-auth first.');

  const path = endpoint.startsWith('/')
    ? `/v4/spreadsheets/${spreadsheetId}${endpoint}`
    : `/v4/spreadsheets/${spreadsheetId}/${endpoint}`;

  return httpRequest<T>({
    hostname: 'sheets.googleapis.com',
    path,
    method: method as 'GET' | 'POST' | 'PUT',
    headers: { Authorization: `Bearer ${token.access_token}` },
    body
  });
}

export async function getSpreadsheet(spreadsheetId: string): Promise<Spreadsheet> {
  const response = await sheetsRequest<{
    spreadsheetId: string;
    properties: { title: string };
    sheets: Array<{ properties: { sheetId: number; title: string; gridProperties: { rowCount: number; columnCount: number } } }>;
  }>(spreadsheetId, '');

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

export async function getRange(spreadsheetId: string, range: string): Promise<SheetRange> {
  const response = await sheetsRequest<{ range: string; values?: string[][] }>(
    spreadsheetId, `values/${encodeURIComponent(range)}`
  );
  return { range: response.range, values: response.values || [] };
}

export async function getMultipleRanges(spreadsheetId: string, ranges: string[]): Promise<SheetRange[]> {
  const rangesParam = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
  const response = await sheetsRequest<{ valueRanges: Array<{ range: string; values?: string[][] }> }>(
    spreadsheetId, `values:batchGet?${rangesParam}`
  );
  return response.valueRanges.map(vr => ({ range: vr.range, values: vr.values || [] }));
}

export async function getSheetData(spreadsheetId: string, sheetName: string): Promise<SheetRange> {
  return getRange(spreadsheetId, sheetName);
}

export async function updateRange(
  spreadsheetId: string, range: string, values: string[][], options: { raw?: boolean } = {}
): Promise<{ updatedCells: number; updatedRows: number; updatedColumns: number }> {
  const valueInputOption = options.raw ? 'RAW' : 'USER_ENTERED';
  return sheetsRequest<{ updatedCells: number; updatedRows: number; updatedColumns: number }>(
    spreadsheetId, `values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`, 'PUT', { values }
  );
}

export async function appendRows(
  spreadsheetId: string, range: string, values: string[][], options: { raw?: boolean } = {}
): Promise<{ updatedCells: number; updatedRows: number }> {
  const valueInputOption = options.raw ? 'RAW' : 'USER_ENTERED';
  const response = await sheetsRequest<{ updates: { updatedCells: number; updatedRows: number } }>(
    spreadsheetId,
    `values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`,
    'POST', { values }
  );
  return response.updates;
}

export async function clearRange(spreadsheetId: string, range: string): Promise<boolean> {
  await sheetsRequest(spreadsheetId, `values/${encodeURIComponent(range)}:clear`, 'POST');
  return true;
}

export async function batchUpdate(
  spreadsheetId: string, updates: Array<{ range: string; values: string[][] }>
): Promise<{ totalUpdatedCells: number }> {
  return sheetsRequest<{ totalUpdatedCells: number }>(
    spreadsheetId, 'values:batchUpdate', 'POST', { valueInputOption: 'USER_ENTERED', data: updates }
  );
}

export async function addSheet(
  spreadsheetId: string, title: string, options: { rowCount?: number; columnCount?: number } = {}
): Promise<{ sheetId: number; title: string }> {
  const response = await sheetsRequest<{ replies: Array<{ addSheet: { properties: { sheetId: number; title: string } } }> }>(
    spreadsheetId, ':batchUpdate', 'POST', {
      requests: [{
        addSheet: {
          properties: {
            title,
            gridProperties: { rowCount: options.rowCount || 1000, columnCount: options.columnCount || 26 }
          }
        }
      }]
    }
  );
  return response.replies[0].addSheet.properties;
}

export async function deleteSheet(spreadsheetId: string, sheetId: number): Promise<boolean> {
  await sheetsRequest(spreadsheetId, ':batchUpdate', 'POST', { requests: [{ deleteSheet: { sheetId } }] });
  return true;
}

export async function renameSheet(spreadsheetId: string, sheetId: number, newTitle: string): Promise<boolean> {
  await sheetsRequest(spreadsheetId, ':batchUpdate', 'POST', {
    requests: [{ updateSheetProperties: { properties: { sheetId, title: newTitle }, fields: 'title' } }]
  });
  return true;
}

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

export function rangeA1(sheet: string, startCol: number, startRow: number, endCol?: number, endRow?: number): string {
  const start = `${columnToLetter(startCol)}${startRow}`;
  if (endCol && endRow) return `'${sheet}'!${start}:${columnToLetter(endCol)}${endRow}`;
  return `'${sheet}'!${start}`;
}

export async function findInSheet(
  spreadsheetId: string, sheetName: string, searchValue: string, column?: number
): Promise<Array<{ row: number; column: number; value: string }>> {
  const data = await getSheetData(spreadsheetId, sheetName);
  const results: Array<{ row: number; column: number; value: string }> = [];

  data.values.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (column !== undefined && colIndex !== column - 1) return;
      if (cell.toLowerCase().includes(searchValue.toLowerCase())) {
        results.push({ row: rowIndex + 1, column: colIndex + 1, value: cell });
      }
    });
  });
  return results;
}

export function isAuthenticated(): boolean {
  return getGoogleToken() !== null;
}

export function getAuthInstructions(): string {
  return `Google Sheets: Uses same auth as Gmail/Calendar. Required scope: spreadsheets`;
}
