/**
 * SQL Adapter
 * Direct PostgreSQL access for migrations and raw queries
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as postgres from '../../integrations/supabase/postgres.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = '/root/.claude/mcp-server/migrations';

// Schemas
const querySchema = z.object({
  sql: z.string().describe('SQL query to execute'),
  params: z.array(z.unknown()).optional().describe('Query parameters (for parameterized queries)')
});

const executeSchema = z.object({
  sql: z.string().describe('SQL statement to execute (CREATE, ALTER, INSERT, etc)')
});

const migrationSchema = z.object({
  name: z.string().optional().describe('Migration file name (e.g., "002_extended_schema.sql"). If not provided, lists available migrations')
});

const tablesSchema = z.object({});

const tools: AdapterTool[] = [
  {
    name: 'query',
    description: 'Execute SELECT query and return results',
    type: 'read',
    schema: querySchema,
    execute: async (params) => {
      const p = params as z.infer<typeof querySchema>;
      const result = await postgres.query(p.sql, p.params);
      return JSON.stringify({
        rows: result.rows,
        rowCount: result.rowCount
      }, null, 2);
    }
  },
  {
    name: 'execute',
    description: 'Execute SQL statement (CREATE, ALTER, INSERT, UPDATE, DELETE)',
    type: 'dangerous',
    schema: executeSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof executeSchema>;
      const result = await postgres.execute(p.sql);
      return JSON.stringify(result, null, 2);
    }
  },
  {
    name: 'migrate',
    description: 'Run a migration file or list available migrations',
    type: 'dangerous',
    schema: migrationSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof migrationSchema>;

      // List migrations if no name provided
      if (!p.name) {
        if (!existsSync(MIGRATIONS_DIR)) {
          return JSON.stringify({ error: 'Migrations directory not found' });
        }

        const files = readdirSync(MIGRATIONS_DIR)
          .filter(f => f.endsWith('.sql'))
          .sort();

        return JSON.stringify({
          migrations: files,
          path: MIGRATIONS_DIR
        }, null, 2);
      }

      // Security: whitelist validation to prevent path traversal
      const allowedMigrations = readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'));

      if (!allowedMigrations.includes(p.name)) {
        return JSON.stringify({
          error: `Invalid migration: ${p.name}`,
          available: allowedMigrations
        });
      }

      const migrationPath = join(MIGRATIONS_DIR, p.name);
      const sql = readFileSync(migrationPath, 'utf-8');
      const result = await postgres.execute(sql);

      return JSON.stringify({
        migration: p.name,
        ...result
      }, null, 2);
    }
  },
  {
    name: 'tables',
    description: 'List all tables in the database',
    type: 'read',
    schema: tablesSchema,
    execute: async () => {
      const result = await postgres.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      return JSON.stringify({
        tables: result.rows.map(r => r.table_name),
        count: result.rowCount
      }, null, 2);
    }
  },
  {
    name: 'describe',
    description: 'Describe table structure (columns, types)',
    type: 'read',
    schema: z.object({
      table: z.string().describe('Table name to describe')
    }),
    execute: async (params) => {
      const p = params as { table: string };

      const result = await postgres.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position
      `, [p.table]);

      return JSON.stringify({
        table: p.table,
        columns: result.rows,
        count: result.rowCount
      }, null, 2);
    }
  },
  {
    name: 'health',
    description: 'Check PostgreSQL connection health',
    type: 'read',
    schema: z.object({}),
    execute: async () => {
      const healthy = await postgres.healthCheck();
      const configured = postgres.isConfigured();

      return JSON.stringify({
        configured,
        connected: healthy,
        status: healthy ? 'ok' : configured ? 'connection_failed' : 'not_configured'
      }, null, 2);
    }
  }
];

export const sqlAdapter: Adapter = {
  name: 'sql',
  isAuthenticated: postgres.isConfigured,
  tools
};
