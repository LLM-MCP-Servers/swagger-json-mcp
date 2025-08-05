import { z } from 'zod';
import type { SwaggerManager } from '../../core/SwaggerManager.js';
import { SchemaResolver } from '../../core/SchemaResolver.js';
import type { Operation, Parameter, Schema } from '../types.js';

// 輸入參數 schema
const GetApiInfoInputSchema = z.object({
  swaggerName: z.string().min(1, 'swaggerName is required'),
  path: z.string().min(1, 'path is required'),
  method: z.string().min(1, 'method is required'),
});

// 輸出結果 schema - 增強版
const GetApiInfoOutputSchema = z.object({
  success: z.boolean(),
  swaggerName: z.string(),
  path: z.string(),
  method: z.string(),
  operation: z.any().optional(),
  parameters: z.array(z.any()),
  requestBodySchema: z.any().optional(),
  responseSchemas: z.record(z.string(), z.any()),
  metadata: z
    .object({
      hasRequestBody: z.boolean(),
      responseCount: z.number(),
      parameterCount: z.number(),
      resolvedAt: z.string(),
      // 新增的統計資訊
      requiredParameters: z.number(),
      optionalParameters: z.number(),
      responseStatusCodes: z.array(z.string()),
      complexity: z.object({
        requestBodyDepth: z.number(),
        requestBodyProperties: z.number(),
        maxResponseDepth: z.number(),
        totalResponseProperties: z.number(),
        averageResponseDepth: z.number(),
      }),
    })
    .optional(),
  error: z.string().optional(),
});

export type GetApiInfoInput = {
  swaggerName: string;
  path: string;
  method: string;
};
export type GetApiInfoOutput = z.infer<typeof GetApiInfoOutputSchema>;

/**
 * 遞歸解析 schema，遇到 $ref 就查找並替換
 * @param schema 要解析的 schema
 * @param resolver SchemaResolver 實例
 * @param maxDepth 最大解析深度，避免無限遞歸
 * @param currentDepth 當前解析深度
 * @returns 解析後的 schema
 */
function resolveSchemaRecursively(
  schema: any,
  resolver: SchemaResolver,
  maxDepth: number = 20,
  currentDepth: number = 0,
): any {
  // 防止過深的遞歸
  if (currentDepth >= maxDepth) {
    return schema;
  }

  // 如果 schema 不存在或不是對象，直接返回
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // 如果是 $ref，直接解析並遞歸
  if (schema.$ref && typeof schema.$ref === 'string') {
    const resolveResult = resolver.resolveSchemaByRef(schema.$ref);
    if (resolveResult.success && resolveResult.schema) {
      return resolveSchemaRecursively(resolveResult.schema, resolver, maxDepth, currentDepth + 1);
    }
    return schema; // 解析失敗，返回原始 $ref
  }

  // 對於其他對象，遞歸處理所有屬性
  const resolved: any = Array.isArray(schema) ? [] : {};

  for (const [key, value] of Object.entries(schema)) {
    resolved[key] = resolveSchemaRecursively(value, resolver, maxDepth, currentDepth + 1);
  }

  return resolved;
}

/**
 * 解析 request body schema
 */
function resolveRequestBodySchema(
  operation: Operation,
  resolver: SchemaResolver,
): Schema | undefined {
  let foundRequestSchema: any = null;

  // OpenAPI 3.x: 從 requestBody.content 中找 schema
  if (operation.requestBody?.content) {
    for (const mediaType of Object.values(operation.requestBody.content)) {
      if (mediaType.schema) {
        foundRequestSchema = mediaType.schema;
        break;
      }
    }
  }

  // Swagger 2.x: 從 parameters 中找 body parameter
  if (!foundRequestSchema && operation.parameters) {
    const bodyParam = operation.parameters.find((param) => param.in === 'body');
    if (bodyParam?.schema) {
      foundRequestSchema = bodyParam.schema;
    }
  }

  // 如果找到 schema，進行遞歸解析
  if (foundRequestSchema) {
    return resolveSchemaRecursively(foundRequestSchema, resolver);
  }

  return undefined;
}

/**
 * 解析 response schemas
 */
function resolveResponseSchemas(
  operation: Operation,
  resolver: SchemaResolver,
): Record<string, { description: string; schema?: Schema }> {
  const responseSchemas: Record<string, { description: string; schema?: Schema }> = {};

  if (!operation.responses) {
    return responseSchemas;
  }

  for (const [statusCode, response] of Object.entries(operation.responses)) {
    let foundResponseSchema: any = null;

    // OpenAPI 3.x: 從 response.content 中找 schema
    if (response.content) {
      for (const mediaType of Object.values(response.content)) {
        if (mediaType.schema) {
          foundResponseSchema = mediaType.schema;
          break;
        }
      }
    }
    // Swagger 2.x: 直接在 response 下找 schema
    else if ((response as any).schema) {
      foundResponseSchema = (response as any).schema;
    }

    // 如果找到 schema，進行遞歸解析
    if (foundResponseSchema) {
      responseSchemas[statusCode] = {
        description: response.description,
        schema: resolveSchemaRecursively(foundResponseSchema, resolver),
      };
    } else {
      // 如果沒有找到，直接使用原始 response
      responseSchemas[statusCode] = response;
    }
  }

  return responseSchemas;
}

/**
 * 解析參數 schemas
 */
function resolveParameterSchemas(parameters: Parameter[], resolver: SchemaResolver): any[] {
  return parameters
    .map((param) => {
      if (param.in === 'body') return null;
      return resolveSchemaRecursively(param, resolver);
    })
    .filter(Boolean);
}

/**
 * 計算 schema 的複雜度指標
 */
function calculateSchemaComplexity(schema: any): {
  depth: number;
  propertyCount: number;
} {
  if (!schema || typeof schema !== 'object') {
    return { depth: 0, propertyCount: 0 };
  }

  let maxDepth = 0;
  let totalProperties = 0;

  function traverse(obj: any, currentDepth: number = 0): void {
    if (!obj || typeof obj !== 'object') return;

    maxDepth = Math.max(maxDepth, currentDepth);

    if (obj.properties && typeof obj.properties === 'object') {
      const propCount = Object.keys(obj.properties).length;
      totalProperties += propCount;

      for (const prop of Object.values(obj.properties)) {
        traverse(prop, currentDepth + 1);
      }
    }

    if (obj.items) {
      traverse(obj.items, currentDepth + 1);
    }

    if (obj.allOf || obj.oneOf || obj.anyOf) {
      const schemas = obj.allOf || obj.oneOf || obj.anyOf;
      for (const subSchema of schemas) {
        traverse(subSchema, currentDepth);
      }
    }
  }

  traverse(schema);
  return { depth: maxDepth, propertyCount: totalProperties };
}

/**
 * 建立增強的 metadata 資訊
 */
function buildEnhancedMetadata(
  parameters: Parameter[],
  requestBodySchema: Schema | undefined,
  responseSchemas: Record<string, Schema>,
): {
  hasRequestBody: boolean;
  responseCount: number;
  parameterCount: number;
  resolvedAt: string;
  requiredParameters: number;
  optionalParameters: number;
  responseStatusCodes: string[];
  complexity: {
    requestBodyDepth: number;
    requestBodyProperties: number;
    maxResponseDepth: number;
    totalResponseProperties: number;
    averageResponseDepth: number;
  };
} {
  // 參數分類統計
  const requiredParameters = parameters.filter((p) => p.required === true).length;
  const optionalParameters = parameters.length - requiredParameters;

  // 回應狀態碼
  const responseStatusCodes = Object.keys(responseSchemas).sort();

  // 複雜度計算
  const requestComplexity = calculateSchemaComplexity(requestBodySchema);

  let maxResponseDepth = 0;
  let totalResponseProperties = 0;
  let totalResponseDepth = 0;
  let responseCount = 0;

  for (const responseSchema of Object.values(responseSchemas)) {
    const complexity = calculateSchemaComplexity(responseSchema);
    maxResponseDepth = Math.max(maxResponseDepth, complexity.depth);
    totalResponseProperties += complexity.propertyCount;
    totalResponseDepth += complexity.depth;
    responseCount++;
  }

  const averageResponseDepth = responseCount > 0 ? totalResponseDepth / responseCount : 0;

  return {
    hasRequestBody: !!requestBodySchema,
    responseCount: Object.keys(responseSchemas).length,
    parameterCount: parameters.length,
    resolvedAt: new Date().toISOString(),
    requiredParameters,
    optionalParameters,
    responseStatusCodes,
    complexity: {
      requestBodyDepth: requestComplexity.depth,
      requestBodyProperties: requestComplexity.propertyCount,
      maxResponseDepth,
      totalResponseProperties,
      averageResponseDepth: Math.round(averageResponseDepth * 100) / 100,
    },
  };
}

/**
 * 獲取指定 API 的完整資訊，自動解析所有相關 schemas
 */
export async function getApiInfo(
  input: GetApiInfoInput,
  swaggerManager: SwaggerManager,
): Promise<GetApiInfoOutput> {
  try {
    // 驗證輸入參數
    const validatedInput = GetApiInfoInputSchema.parse(input);
    let { method } = validatedInput;
    const { swaggerName, path } = validatedInput;

    // 標準化 method 為小寫
    method = method.toLowerCase();

    // 載入 Swagger
    const parser = await swaggerManager.loadSwagger(swaggerName);
    if (!parser) {
      return {
        success: false,
        swaggerName,
        path,
        method,
        parameters: [],
        responseSchemas: {},
        error: `Swagger "${swaggerName}" not found`,
      };
    }

    // 獲取 swagger document
    const document = parser.getDocument();
    if (!document) {
      return {
        success: false,
        swaggerName,
        path,
        method,
        parameters: [],
        responseSchemas: {},
        error: `Failed to get document for swagger "${swaggerName}"`,
      };
    }

    // 檢查 path 是否存在
    const pathItem = document.paths[path];
    if (!pathItem) {
      return {
        success: false,
        swaggerName,
        path,
        method,
        parameters: [],
        responseSchemas: {},
        error: `API "${method.toUpperCase()} ${path}" not found in swagger "${swaggerName}"`,
      };
    }

    // 檢查 method 是否存在
    const operation = pathItem[method as keyof typeof pathItem] as Operation | undefined;
    if (!operation) {
      return {
        success: false,
        swaggerName,
        path,
        method,
        parameters: [],
        responseSchemas: {},
        error: `API "${method.toUpperCase()} ${path}" not found in swagger "${swaggerName}"`,
      };
    }

    // 初始化 SchemaResolver
    const resolver = new SchemaResolver(document);

    // 解析各種 schemas
    const parameters: Parameter[] = operation.parameters || [];
    const requestBodySchema = resolveRequestBodySchema(operation, resolver);
    const responseSchemas = resolveResponseSchemas(operation, resolver);
    const parameterSchemas = resolveParameterSchemas(parameters, resolver);

    // 構建成功結果 - 使用增強的 metadata
    const result: GetApiInfoOutput = {
      success: true,
      swaggerName,
      path,
      method,
      operation,
      parameters: parameterSchemas,
      requestBodySchema,
      responseSchemas,
      metadata: buildEnhancedMetadata(parameters, requestBodySchema, responseSchemas),
    };

    // 驗證輸出
    return GetApiInfoOutputSchema.parse(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      swaggerName: input.swaggerName || 'unknown',
      path: input.path || 'unknown',
      method: (input.method || 'unknown').toLowerCase(),
      parameters: [],
      responseSchemas: {},
      error: errorMessage,
    };
  }
}

// MCP 工具定義
export const getApiInfoToolDefinition = {
  name: 'get_api_info',
  description: '獲取特定 API 的完整資訊，自動解析所有相關 schemas',
  inputSchema: {
    type: 'object',
    properties: {
      swaggerName: {
        type: 'string',
        description: 'Swagger 檔案名稱',
      },
      path: {
        type: 'string',
        description: 'API 路徑（例如：/login）',
      },
      method: {
        type: 'string',
        description: 'HTTP 方法（例如：get, post, put, delete）',
      },
    },
    required: ['swaggerName', 'path', 'method'],
  },
};

// 導出 Zod schemas 用於 MCP 工具定義
export { GetApiInfoInputSchema, GetApiInfoOutputSchema };
