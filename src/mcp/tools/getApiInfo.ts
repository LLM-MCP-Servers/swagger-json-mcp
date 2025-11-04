import { z } from 'zod';
import { SchemaResolver } from '../../core/SchemaResolver.js';
import type { SwaggerManager } from '../../core/SwaggerManager.js';
import type { Operation, Parameter, Schema } from '../types.js';

// 輸入參數 schema
const GetApiInfoInputSchema = z.object({
  swaggerName: z.string().min(1, 'swaggerName is required'),
  path: z.string().min(1, 'path is required'),
  method: z.string().min(1, 'method is required'),
});

// 輸出結果 schema - 精簡版（移除冗餘，提升 token 效率）
const GetApiInfoOutputSchema = z.object({
  success: z.boolean(),
  swaggerName: z.string(),
  path: z.string(),
  method: z.string(),
  // 從 operation 提取的關鍵資訊
  summary: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  operationId: z.string().optional(),
  deprecated: z.boolean().optional(),
  // 已解析的結構化資料
  parameters: z.array(z.any()),
  requestBodySchema: z.any().optional(),
  responseSchemas: z.record(z.string(), z.any()),
  // 簡化的 metadata（僅保留關鍵資訊）
  metadata: z
    .object({
      responseStatusCodes: z.array(z.string()),
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
 * @param maxDepth 最大解析深度，避免無限遞歸（預設 5 層，足夠大多數 API）
 * @param currentDepth 當前解析深度
 * @returns 解析後的 schema
 * @note 如需更深層的 schema 解析，請使用 get_schema 工具單獨查詢
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

  // 扁平化 allOf 結構,減少 token 使用
  if (schema.allOf && Array.isArray(schema.allOf)) {
    const merged: any = { type: schema.type || 'object' };
    const properties: any = {};
    const required: string[] = [];

    // 合併所有 allOf 子 schema
    for (const subSchema of schema.allOf) {
      const resolved = resolveSchemaRecursively(subSchema, resolver, maxDepth, currentDepth + 1);

      // 合併 properties
      if (resolved.properties) {
        Object.assign(properties, resolved.properties);
      }

      // 合併 required
      if (resolved.required && Array.isArray(resolved.required)) {
        required.push(...resolved.required);
      }

      // 合併其他屬性 (保留重要的 schema 屬性)
      for (const [key, value] of Object.entries(resolved)) {
        if (key !== 'properties' && key !== 'required' && key !== 'type' && key !== 'allOf') {
          // 如果是陣列,合併內容
          if (Array.isArray(value) && Array.isArray(merged[key])) {
            merged[key] = [...merged[key], ...value];
          }
          // 否則直接覆蓋 (後面的優先)
          else {
            merged[key] = value;
          }
        }
      }
    }

    // 設定合併後的 properties 和 required
    if (Object.keys(properties).length > 0) {
      merged.properties = properties;
    }
    if (required.length > 0) {
      merged.required = [...new Set(required)]; // 去重
    }

    return merged;
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
 * 建立精簡的 metadata 資訊（僅保留關鍵資訊，提升 token 效率）
 */
function buildSimplifiedMetadata(responseSchemas: Record<string, Schema>): {
  responseStatusCodes: string[];
} {
  // 僅保留回應狀態碼 (其他資訊可從 parameters/requestBodySchema 推斷)
  const responseStatusCodes = Object.keys(responseSchemas).sort();

  return {
    responseStatusCodes,
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

    // 構建成功結果 - 精簡版（移除 operation 冗餘，提取關鍵資訊）
    const result: GetApiInfoOutput = {
      success: true,
      swaggerName,
      path,
      method,
      // 從 operation 提取關鍵資訊
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags,
      operationId: operation.operationId,
      deprecated: (operation as any).deprecated,
      // 已解析的結構化資料
      parameters: parameterSchemas,
      requestBodySchema,
      responseSchemas,
      // 精簡的 metadata
      metadata: buildSimplifiedMetadata(responseSchemas),
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
