/**
 * Elio MCP Server v3
 * Gateway architecture with adapters
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { registerAdapter, getRegisteredTools, executeTool, getToolCount } from './gateway/index.js';
import { adapters } from './adapters/index.js';
import { loadSkills, runSkill } from './skills.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('mcp');

// Register all adapters
for (const adapter of adapters) {
  registerAdapter(adapter);
}

// Load skills
const skills = loadSkills();

// Create MCP server
const server = new Server(
  { name: 'elio-mcp-server', version: '3.0.0' },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [];

  // Add adapter tools via gateway
  for (const tool of getRegisteredTools()) {
    tools.push(tool);
  }

  // Add skill-based tools
  for (const [name, metadata] of skills) {
    const inputSchema: Record<string, unknown> = {
      type: 'object',
      properties: {} as Record<string, unknown>,
      required: [] as string[]
    };

    for (const [inputName, input] of Object.entries(metadata.inputs)) {
      (inputSchema.properties as Record<string, unknown>)[inputName] = {
        type: input.type,
        description: input.description,
        default: input.default
      };
      if (input.required) {
        (inputSchema.required as string[]).push(inputName);
      }
    }

    tools.push({
      name: `elio_${name.replace(/-/g, '_')}`,
      description: metadata.description,
      inputSchema
    });
  }

  return { tools };
});

// Execute tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const params = request.params.arguments as Record<string, unknown> || {};

  // Try gateway first (adapter tools)
  const result = await executeTool(toolName, params);

  if (result.status === 'success') {
    const output = typeof result.data === 'string'
      ? result.data
      : JSON.stringify(result.data, null, 2);
    return { content: [{ type: 'text', text: output }] };
  }

  if (result.status === 'error') {
    return {
      content: [{ type: 'text', text: `Error: ${result.error}` }],
      isError: true
    };
  }

  if (result.status === 'rate_limited') {
    return {
      content: [{ type: 'text', text: `Rate limited. Retry after ${result.retryAfter}ms` }],
      isError: true
    };
  }

  // If blocked (unknown tool), try skills
  if (result.status === 'blocked') {
    const skillName = toolName.replace(/^elio_/, '').replace(/_/g, '-');
    const skill = skills.get(skillName);

    if (!skill) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true
      };
    }

    // Convert args to array based on skill inputs
    const args: string[] = [];
    for (const inputName of Object.keys(skill.inputs)) {
      if (params[inputName] !== undefined) {
        args.push(String(params[inputName]));
      }
    }

    const skillResult = await runSkill(skillName, args);

    if (skillResult.success) {
      return {
        content: [{
          type: 'text',
          text: typeof skillResult.output === 'string'
            ? skillResult.output
            : JSON.stringify(skillResult.output, null, 2)
        }]
      };
    }

    return {
      content: [{ type: 'text', text: `Error: ${skillResult.error}` }],
      isError: true
    };
  }

  return {
    content: [{ type: 'text', text: 'Unexpected error' }],
    isError: true
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`Elio MCP Server v3.0 running with ${getToolCount()} gateway tools + ${skills.size} skills`);
}

main().catch(err => logger.error('Server failed to start', err));
