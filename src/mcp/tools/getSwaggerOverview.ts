/**
 * get_swagger_overview MCP Tool
 * 獲取 Swagger 檔案的整體概覽和統計資訊
 */

import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { SwaggerManager } from '../../core/SwaggerManager.js';

// Input schema
export const getSwaggerOverviewInputSchema = z.object({
  swaggerName: z.string().min(1, 'Swagger name is required'),
});

// Output schema
export const getSwaggerOverviewOutputSchema = z.object({
  info: z.object({
    name: z.string(),
    fileName: z.string(),
    title: z.string(),
    version: z.string(),
    description: z.string().optional(),
    lastModified: z.date(),
  }),
  stats: z.object({
    totalApis: z.number(),
    totalSchemas: z.number(),
    methodBreakdown: z.record(z.string(), z.number()),
    tagBreakdown: z.record(z.string(), z.number()),
  }),
  servers: z.array(
    z.object({
      url: z.string(),
      description: z.string().optional(),
      variables: z.record(z.string(), z.any()).optional(),
    })
  ).optional(),
  tags: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
    })
  ).optional(),
});

export type GetSwaggerOverviewInput = z.infer<typeof getSwaggerOverviewInputSchema>;
export type GetSwaggerOverviewOutput = z.infer<typeof getSwaggerOverviewOutputSchema>;

/**
 * Implementation of get_swagger_overview tool
 */
export async function getSwaggerOverview(
  input: GetSwaggerOverviewInput,
  swaggerManager: SwaggerManager
): Promise<GetSwaggerOverviewOutput> {
  try {
    logger.info(`Executing get_swagger_overview tool for swagger: ${input.swaggerName}`);
    
    // Get basic swagger info
    const swaggerInfo = await swaggerManager.getSwagger(input.swaggerName);
    
    // Load the swagger parser
    const parser = await swaggerManager.loadSwagger(input.swaggerName);
    
    // Get basic document info
    const docInfo = parser.getInfo();
    
    // Get detailed statistics
    const stats = parser.getDetailedStats();
    
    // Get the full document to extract servers and tags
    const document = parser.getDocument();
    
    const result: GetSwaggerOverviewOutput = {
      info: {
        name: swaggerInfo.name,
        fileName: swaggerInfo.fileName,
        title: docInfo.title,
        version: docInfo.version,
        description: docInfo.description,
        lastModified: swaggerInfo.lastModified,
      },
      stats: {
        totalApis: stats.totalApis,
        totalSchemas: stats.totalSchemas,
        methodBreakdown: stats.methodBreakdown,
        tagBreakdown: stats.tagBreakdown,
      },
      servers: document?.servers?.map(server => ({
        url: server.url,
        description: server.description,
        variables: server.variables,
      })),
      tags: document?.tags?.map(tag => ({
        name: tag.name,
        description: tag.description,
      })),
    };
    
    logger.info(`Successfully generated overview for swagger: ${input.swaggerName}`);
    
    return result;
  } catch (error) {
    logger.error(`Error in get_swagger_overview tool for swagger ${input.swaggerName}:`, error);
    
    // Check if it's a swagger not found error
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Error(`Swagger "${input.swaggerName}" not found`);
    }
    
    throw new Error(`Failed to get swagger overview: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Tool definition for MCP server
export const getSwaggerOverviewToolDefinition = {
  name: 'get_swagger_overview',
  description: '獲取 Swagger 檔案的整體概覽和統計資訊',
  inputSchema: {
    type: 'object' as const,
    properties: {
      swaggerName: {
        type: 'string' as const,
        description: 'Swagger 檔案名稱',
      },
    },
    required: ['swaggerName'],
  },
};