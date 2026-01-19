/**
 * Google Sheets tools
 */

import * as sheets from '../integrations/sheets.js';
import { Tool, paramString, safeJsonParse } from './types.js';

export const sheetsTools: Tool[] = [
  {
    name: 'sheets_read',
    description: 'Read data from Google Sheets',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string', description: 'A1 notation, e.g. Sheet1!A1:D10' }
      },
      required: ['spreadsheetId', 'range']
    },
    handler: async (params) => {
      const data = await sheets.getRange(
        paramString(params.spreadsheetId),
        paramString(params.range)
      );
      if (!data.values.length) return 'No data';
      return data.values.map(row => row.join('\t')).join('\n');
    }
  },
  {
    name: 'sheets_write',
    description: 'Write data to Google Sheets',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string' },
        values: { type: 'string', description: 'JSON 2D array' }
      },
      required: ['spreadsheetId', 'range', 'values']
    },
    handler: async (params) => {
      const values = safeJsonParse<string[][]>(paramString(params.values), []);
      const result = await sheets.updateRange(
        paramString(params.spreadsheetId),
        paramString(params.range),
        values
      );
      return `Updated ${result.updatedCells} cells`;
    }
  },
  {
    name: 'sheets_append',
    description: 'Append rows to Google Sheets',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string' },
        values: { type: 'string', description: 'JSON 2D array' }
      },
      required: ['spreadsheetId', 'range', 'values']
    },
    handler: async (params) => {
      const values = safeJsonParse<string[][]>(paramString(params.values), []);
      const result = await sheets.appendRows(
        paramString(params.spreadsheetId),
        paramString(params.range),
        values
      );
      return `Appended ${result.updatedRows} rows`;
    }
  }
];
