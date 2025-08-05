/**
 * list_swaggers MCP Tool
 * 列出所有可用的 Swagger 檔案
 */

import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { SwaggerManager } from '../../core/SwaggerManager.js';

// Input schema (no parameters required)
export const listSwaggersInputSchema = z.object({});

// Output schema
export const listSwaggersOutputSchema = z.object({
  swaggers: z.array(
    z.object({
      name: z.string(),
      fileName: z.string(),
      title: z.string(),
      version: z.string(),
      description: z.string().optional(),
      apiCount: z.number(),
      schemaCount: z.number(),
      lastModified: z.date(),
    })
  ),
});

export type ListSwaggersInput = z.infer<typeof listSwaggersInputSchema>;
export type ListSwaggersOutput = z.infer<typeof listSwaggersOutputSchema>;

/**
 * Implementation of list_swaggers tool
 */
export async function listSwaggers(
  _input: ListSwaggersInput,
  swaggerManager: SwaggerManager
): Promise<ListSwaggersOutput> {
  try {
    logger.info('Executing list_swaggers tool');
    
    const swaggers = await swaggerManager.scanSwaggers();
    
    logger.info(`Found ${swaggers.length} swagger files`);
    
    return {
      swaggers: swaggers.map(swagger => ({
        name: swagger.name,
        fileName: swagger.fileName,
        title: swagger.title,
        version: swagger.version,
        description: swagger.description,
        apiCount: swagger.apiCount,
        schemaCount: swagger.schemaCount,
        lastModified: swagger.lastModified,
      })),
    };
  } catch (error) {
    logger.error('Error in list_swaggers tool:', error);
    throw new Error(`Failed to list swagger files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Tool definition for MCP server
export const listSwaggersToolDefinition = {
  name: 'list_swaggers',
  description: '列出所有可用的 Swagger 檔案',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};