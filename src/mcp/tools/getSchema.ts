import { z } from 'zod';
import type { SwaggerManager } from '../../core/SwaggerManager.js';
import { SchemaResolver } from '../../core/SchemaResolver.js';

// 輸入參數 schema
const GetSchemaInputSchema = z.object({
  swaggerName: z.string().min(1, 'swaggerName is required'),
  schemaName: z.string().min(1, 'schemaName is required'),
  maxDepth: z.number().int().min(0, 'maxDepth must be >= 0').optional().default(10),
  includeCircular: z.boolean().optional().default(true),
});

// 輸出結果 schema
const GetSchemaOutputSchema = z.object({
  success: z.boolean(),
  swaggerName: z.string(),
  schemaName: z.string(),
  schema: z.any().optional(),
  dependencies: z.array(z.string()),
  circularReferences: z.array(z.string()),
  metadata: z
    .object({
      totalDependencies: z.number(),
      hasCircularReferences: z.boolean(),
      resolvedAt: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export type GetSchemaInput = {
  swaggerName: string;
  schemaName: string;
  maxDepth?: number;
  includeCircular?: boolean;
};
export type GetSchemaOutput = z.infer<typeof GetSchemaOutputSchema>;

/**
 * 獲取指定 schema 的完整定義，自動解析所有 $ref 引用
 */
export async function getSchema(
  input: GetSchemaInput,
  swaggerManager: SwaggerManager,
): Promise<GetSchemaOutput> {
  try {
    // 驗證輸入參數
    const validatedInput = GetSchemaInputSchema.parse(input);
    const { swaggerName, schemaName, maxDepth, includeCircular } = validatedInput;

    // 載入 Swagger
    const parser = await swaggerManager.loadSwagger(swaggerName);
    if (!parser) {
      return {
        success: false,
        swaggerName,
        schemaName,
        dependencies: [],
        circularReferences: [],
        error: `Swagger "${swaggerName}" not found`,
      };
    }

    // 獲取 swagger document
    const document = parser.getDocument();
    if (!document) {
      return {
        success: false,
        swaggerName,
        schemaName,
        dependencies: [],
        circularReferences: [],
        error: `Failed to get document for swagger "${swaggerName}"`,
      };
    }

    // 使用 SchemaResolver 的自動搜尋功能檢查 schema 是否存在
    const resolver = new SchemaResolver(document);
    const allSchemas = resolver.scanAllSchemas();
    if (!allSchemas[schemaName]) {
      return {
        success: false,
        swaggerName,
        schemaName,
        dependencies: [],
        circularReferences: [],
        error: `Schema "${schemaName}" not found in swagger "${swaggerName}"`,
      };
    }

    // 使用 SchemaResolver 解析 schema
    const resolveResult = resolver.resolveSchema(schemaName, {
      maxDepth,
      includeCircular,
    });

    if (!resolveResult.success) {
      return {
        success: false,
        swaggerName,
        schemaName,
        dependencies: [],
        circularReferences: [],
        error: resolveResult.error || 'Failed to resolve schema',
      };
    }

    // 構建成功結果
    const result: GetSchemaOutput = {
      success: true,
      swaggerName,
      schemaName,
      schema: resolveResult.schema,
      dependencies: resolveResult.dependencies,
      circularReferences: resolveResult.circularReferences,
      metadata: {
        totalDependencies: resolveResult.dependencies.length,
        hasCircularReferences: resolveResult.circularReferences.length > 0,
        resolvedAt: new Date().toISOString(),
      },
    };

    // 驗證輸出
    return GetSchemaOutputSchema.parse(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      swaggerName: input.swaggerName || 'unknown',
      schemaName: input.schemaName || 'unknown',
      dependencies: [],
      circularReferences: [],
      error: errorMessage,
    };
  }
}

// MCP 工具定義
export const getSchemaToolDefinition = {
  name: 'get_schema',
  description: '獲取指定 schema 的完整定義，自動解析所有 $ref 引用',
  inputSchema: {
    type: 'object',
    properties: {
      swaggerName: {
        type: 'string',
        description: 'Swagger 檔案名稱',
      },
      schemaName: {
        type: 'string',
        description: 'Schema 名稱',
      },
      maxDepth: {
        type: 'number',
        description: '最大解析深度，預設為 10',
        minimum: 0,
        default: 10,
      },
      includeCircular: {
        type: 'boolean',
        description: '是否包含循環引用，預設為 true',
        default: true,
      },
    },
    required: ['swaggerName', 'schemaName'],
  },
};

// 導出 Zod schemas 用於 MCP 工具定義
export { GetSchemaInputSchema, GetSchemaOutputSchema };
