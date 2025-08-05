#!/usr/bin/env node

/**
 * Swagger JSON MCP Server
 * A Model Context Protocol server for querying Swagger/OpenAPI JSON documents
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { SwaggerManager } from './core/SwaggerManager.js';
import { logger } from './utils/logger.js';

// Import MCP tools
import { listSwaggers, listSwaggersToolDefinition } from './mcp/tools/listSwaggers.js';
import {
  getSwaggerOverview,
  getSwaggerOverviewToolDefinition,
} from './mcp/tools/getSwaggerOverview.js';
import { getSchema, getSchemaToolDefinition } from './mcp/tools/getSchema.js';
import { getApiInfo, getApiInfoToolDefinition } from './mcp/tools/getApiInfo.js';
import { searchAPIs, searchAPIsToolDefinition } from './mcp/tools/searchAPIs.js';
import { searchSchemas, searchSchemasToolDefinition } from './mcp/tools/searchSchemas.js';

async function main() {
  // Initialize swagger manager
  const swaggerManager = new SwaggerManager();

  const server = new Server(
    {
      name: 'swagger-json-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        listSwaggersToolDefinition,
        getSwaggerOverviewToolDefinition,
        getSchemaToolDefinition,
        getApiInfoToolDefinition,
        searchAPIsToolDefinition,
        searchSchemasToolDefinition,
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'list_swaggers': {
          const result = await listSwaggers((args as Record<string, never>) || {}, swaggerManager);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'get_swagger_overview': {
          if (!args || typeof args !== 'object') {
            throw new Error('Missing or invalid arguments for get_swagger_overview');
          }
          const result = await getSwaggerOverview(args as { swaggerName: string }, swaggerManager);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'get_schema': {
          if (!args || typeof args !== 'object') {
            throw new Error('Missing or invalid arguments for get_schema');
          }
          const result = await getSchema(args as any, swaggerManager);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'get_api_info': {
          if (!args || typeof args !== 'object') {
            throw new Error('Missing or invalid arguments for get_api_info');
          }
          const result = await getApiInfo(args as any, swaggerManager);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'search_apis': {
          if (!args || typeof args !== 'object') {
            throw new Error('Missing or invalid arguments for search_apis');
          }
          const result = await searchAPIs(args as any, swaggerManager);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'search_schemas': {
          if (!args || typeof args !== 'object') {
            throw new Error('Missing or invalid arguments for search_schemas');
          }
          const result = await searchSchemas(args as any, swaggerManager);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error executing tool ${name}:`, error);
      throw error;
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Swagger JSON MCP Server running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Fatal error in main():', error);
    process.exit(1);
  });
}
