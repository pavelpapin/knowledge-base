/**
 * Elio MCP Server
 * Exposes skills and integrations as MCP tools for Claude
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadSkills, runSkill } from './skills.js';
import { INTEGRATION_TOOLS } from './tools.js';

const skills = loadSkills();

const server = new Server(
  { name: 'elio-mcp-server', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [];

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

  // Add integration tools
  for (const tool of INTEGRATION_TOOLS) {
    tools.push({
      name: `elio_${tool.name}`,
      description: tool.description,
      inputSchema: tool.inputSchema
    });
  }

  return { tools };
});

// Execute tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const params = request.params.arguments as Record<string, unknown> || {};

  // Check for integration tools first
  const integrationName = toolName.replace(/^elio_/, '');
  const integrationTool = INTEGRATION_TOOLS.find(t => t.name === integrationName);

  if (integrationTool) {
    try {
      const result = await integrationTool.handler(params);
      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err}` }],
        isError: true
      };
    }
  }

  // Fall back to skill-based tools
  const skillName = integrationName.replace(/_/g, '-');
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

  const result = await runSkill(skillName, args);

  if (result.success) {
    return {
      content: [{
        type: 'text',
        text: typeof result.output === 'string'
          ? result.output
          : JSON.stringify(result.output, null, 2)
      }]
    };
  }

  return {
    content: [{ type: 'text', text: `Error: ${result.error}` }],
    isError: true
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Elio MCP Server v2.0 running with', INTEGRATION_TOOLS.length, 'integration tools');
}

main().catch(console.error);
