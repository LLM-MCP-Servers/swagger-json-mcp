import { z } from 'zod';
import Fuse from 'fuse.js';
import type { SwaggerManager } from '../../core/SwaggerManager.js';
import { SchemaResolver } from '../../core/SchemaResolver.js';
import type { Schema } from '../types.js';

// 搜尋結果項目介面
interface SchemaSearchItem {
  schemaName: string;
  swaggerName: string;
  schema: Schema;
  type?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
}

// 輸入參數 schema
const SearchSchemasInputSchema = z.object({
  query: z.string().min(1, 'query is required'),
  swaggerName: z.string().optional(),
  type: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(10),
});

// 輸出結果 schema
const SearchSchemasOutputSchema = z.object({
  success: z.boolean(),
  query: z.string(),
  results: z.array(
    z.object({
      schemaName: z.string(),
      swaggerName: z.string(),
      type: z.string().optional(),
      description: z.string().optional(),
      properties: z.record(z.string(), z.any()).optional(),
      required: z.array(z.string()).optional(),
      score: z.number(),
    }),
  ),
  metadata: z
    .object({
      totalResults: z.number(),
      searchTime: z.number(),
      swaggersSearched: z.array(z.string()),
      typeBreakdown: z.record(z.string(), z.number()),
    })
    .optional(),
  error: z.string().optional(),
});

export type SearchSchemasInput = {
  query: string;
  swaggerName?: string;
  type?: string;
  limit?: number;
};
export type SearchSchemasOutput = z.infer<typeof SearchSchemasOutputSchema>;

/**
 * 搜索 schema 定義
 */
export async function searchSchemas(
  input: SearchSchemasInput,
  swaggerManager: SwaggerManager,
): Promise<SearchSchemasOutput> {
  const startTime = Date.now();

  try {
    // 驗證輸入參數
    const validatedInput = SearchSchemasInputSchema.parse(input);
    const { query, swaggerName, type, limit } = validatedInput;

    // 獲取要搜索的 swagger 列表
    const swaggersToSearch = swaggerName ? [swaggerName] : await swaggerManager.getSwaggerList();

    if (swaggersToSearch.length === 0) {
      return {
        success: false,
        query,
        results: [],
        error: swaggerName ? `Swagger "${swaggerName}" not found` : 'No swaggers found',
      };
    }

    // 收集所有 Schema 項目
    const allSchemas: SchemaSearchItem[] = [];
    const typeBreakdown: Record<string, number> = {};

    for (const swaggerName of swaggersToSearch) {
      try {
        const parser = await swaggerManager.loadSwagger(swaggerName);
        const swagger = parser.getDocument();
        if (!swagger) continue;

        // 使用 SchemaResolver 的 getAllSchemas 方法掃描所有位置
        const resolver = new SchemaResolver(swagger);
        const swaggerSchemas = resolver.getAllSchemas();

        if (Object.keys(swaggerSchemas).length === 0) continue;

        // 遍歷所有 schemas
        for (const [schemaName, schema] of Object.entries(swaggerSchemas)) {
          if (!schema) continue;

          // 應用類型過濾條件
          if (type && schema.type !== type) continue;

          // 統計類型分布
          const schemaType = schema.type || 'unknown';
          typeBreakdown[schemaType] = (typeBreakdown[schemaType] || 0) + 1;

          // 收集屬性名稱用於搜索
          // const propertyNames = schema.properties ? Object.keys(schema.properties) : [];
          // const propertyDescriptions = schema.properties
          //   ? Object.values(schema.properties)
          //       .map((prop: any) => prop.description)
          //       .filter(Boolean)
          //   : [];

          allSchemas.push({
            schemaName,
            swaggerName,
            schema,
            type: schema.type,
            description: schema.description,
            properties: schema.properties,
            required: schema.required,
          });
        }
      } catch (error) {
        // 如果指定了特定 swagger 但載入失敗，返回錯誤
        if (validatedInput.swaggerName) {
          return {
            success: false,
            query,
            results: [],
            error: `Swagger "${swaggerName}" not found`,
          };
        }
        // 否則略過載入失敗的 swagger
        console.warn(`Failed to load swagger ${swaggerName}:`, error);
      }
    }

    // 使用 Fuse.js 進行模糊搜索
    const fuseOptions = {
      keys: [
        { name: 'schemaName', weight: 0.4 },
        { name: 'description', weight: 0.3 },
        { name: 'type', weight: 0.2 },
        {
          name: 'properties',
          weight: 0.1,
          getFn: (obj: SchemaSearchItem) => {
            // 將屬性名稱和描述合併為搜索字串
            if (!obj.properties) return '';
            const propNames = Object.keys(obj.properties);
            const propDescs = Object.values(obj.properties)
              .map((prop) => prop.description)
              .filter(Boolean);
            return [...propNames, ...propDescs].join(' ');
          },
        },
      ],
      threshold: 0.6, // 較寬鬆的匹配閾值
      includeScore: true,
      ignoreLocation: true,
    };

    const fuse = new Fuse(allSchemas, fuseOptions);
    const searchResults = fuse.search(query);

    // 格式化結果
    const results = searchResults.slice(0, limit).map((result) => {
      const item = result.item;
      return {
        schemaName: item.schemaName,
        swaggerName: item.swaggerName,
        type: item.type,
        description: item.description,
        properties: item.properties
          ? Object.fromEntries(
              Object.entries(item.properties).map(([key, value]) => [
                key,
                {
                  type: value.type,
                  description: value.description,
                  format: value.format,
                  example: value.example,
                },
              ]),
            )
          : undefined,
        required: item.required,
        score: 1 - (result.score || 0), // 轉換為相似度分數（越高越相似）
      };
    });

    const endTime = Date.now();

    // 構建成功結果
    const output: SearchSchemasOutput = {
      success: true,
      query,
      results,
      metadata: {
        totalResults: results.length,
        searchTime: endTime - startTime,
        swaggersSearched: swaggersToSearch,
        typeBreakdown,
      },
    };

    // 驗證輸出
    return SearchSchemasOutputSchema.parse(output);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      query: input.query || 'unknown',
      results: [],
      error: errorMessage,
    };
  }
}

// MCP 工具定義
export const searchSchemasToolDefinition = {
  name: 'search_schemas',
  description: '搜索 schema 定義，支援模糊搜索和類型過濾',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索關鍵字（可搜索 schema 名稱、描述、屬性名稱）',
      },
      swaggerName: {
        type: 'string',
        description: '限制搜索的 Swagger 檔案名稱（可選）',
      },
      type: {
        type: 'string',
        description: 'Schema 類型過濾（如：object, string, array, number）（可選）',
      },
      limit: {
        type: 'number',
        description: '最大回傳結果數量，預設為 10，最大 100',
        minimum: 1,
        maximum: 100,
        default: 10,
      },
    },
    required: ['query'],
  },
};

// 導出 Zod schemas 用於 MCP 工具定義
export { SearchSchemasInputSchema, SearchSchemasOutputSchema };
