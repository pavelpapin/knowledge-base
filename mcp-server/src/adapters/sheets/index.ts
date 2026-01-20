/**
 * Google Sheets Adapter
 * Exposes Sheets API as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as sheets from '../../integrations/sheets.js';

const readSchema = z.object({
  spreadsheetId: z.string().describe('Spreadsheet ID'),
  range: z.string().describe('A1 notation range, e.g. Sheet1!A1:D10')
});

const writeSchema = z.object({
  spreadsheetId: z.string().describe('Spreadsheet ID'),
  range: z.string().describe('A1 notation range'),
  values: z.string().describe('JSON 2D array of values')
});

const appendSchema = z.object({
  spreadsheetId: z.string().describe('Spreadsheet ID'),
  range: z.string().describe('A1 notation range'),
  values: z.string().describe('JSON 2D array of values')
});

const tools: AdapterTool[] = [
  {
    name: 'read',
    description: 'Read data from Google Sheets',
    type: 'read',
    schema: readSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof readSchema>;
      const result = await sheets.getRange(p.spreadsheetId, p.range);
      return JSON.stringify(result, null, 2);
    }
  },
  {
    name: 'write',
    description: 'Write data to Google Sheets',
    type: 'write',
    schema: writeSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof writeSchema>;
      const values = JSON.parse(p.values);
      const result = await sheets.updateRange(p.spreadsheetId, p.range, values);
      return JSON.stringify(result);
    }
  },
  {
    name: 'append',
    description: 'Append rows to Google Sheets',
    type: 'write',
    schema: appendSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof appendSchema>;
      const values = JSON.parse(p.values);
      const result = await sheets.appendRows(p.spreadsheetId, p.range, values);
      return JSON.stringify(result);
    }
  }
];

export const sheetsAdapter: Adapter = {
  name: 'sheets',
  isAuthenticated: sheets.isAuthenticated,
  tools
};
