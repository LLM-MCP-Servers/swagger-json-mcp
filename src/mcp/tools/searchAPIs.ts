import { z } from 'zod';
import Fuse from 'fuse.js';
import type { SwaggerManager } from '../../core/SwaggerManager.js';
import type { Operation } from '../types.js';

// 搜尋結果項目介面
interface ApiSearchItem {
  path: string;
  method: string;
  swaggerName: string;
  operation: Operation;
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
}

// 輸入參數 schema
const SearchAPIsInputSchema = z.object({
  query: z.string().min(1, 'query is required'),
  swaggerName: z.string().optional(),
  tag: z.string().optional(),
  method: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(10),
});

// 輸出結果 schema
const SearchAPIsOutputSchema = z.object({
  success: z.boolean(),
  query: z.string(),
  results: z.array(
    z.object({
      path: z.string(),
      method: z.string(),
      swaggerName: z.string(),
      summary: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      operationId: z.string().optional(),
      score: z.number(),
    }),
  ),
  metadata: z
    .object({
      totalResults: z.number(),
      searchTime: z.number(),
      swaggersSearched: z.array(z.string()),
    })
    .optional(),
  error: z.string().optional(),
});

export type SearchAPIsInput = {
  query: string;
  swaggerName?: string;
  tag?: string;
  method?: string;
  limit?: number;
};
export type SearchAPIsOutput = z.infer<typeof SearchAPIsOutputSchema>;

/**
 * 搜索 API endpoints
 */
export async function searchAPIs(
  input: SearchAPIsInput,
  swaggerManager: SwaggerManager,
): Promise<SearchAPIsOutput> {
  const startTime = Date.now();

  try {
    // 驗證輸入參數
    const validatedInput = SearchAPIsInputSchema.parse(input);
    const { query, swaggerName, tag, method, limit } = validatedInput;

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

    // 收集所有 API 項目
    const allApis: ApiSearchItem[] = [];

    for (const swaggerName of swaggersToSearch) {
      try {
        const parser = await swaggerManager.loadSwagger(swaggerName);
        const swagger = parser.getDocument();
        if (!swagger?.paths) continue;

        // 遍歷所有路徑和方法
        for (const [path, pathItem] of Object.entries(swagger.paths)) {
          if (!pathItem) continue;

          const methods = [
            'get',
            'post',
            'put',
            'delete',
            'patch',
            'head',
            'options',
            'trace',
          ] as const;

          for (const httpMethod of methods) {
            const operation = pathItem[httpMethod] as Operation | undefined;
            if (!operation) continue;

            // 應用過濾條件
            if (method && httpMethod.toLowerCase() !== method.toLowerCase()) continue;
            if (tag && (!operation.tags || !operation.tags.includes(tag))) continue;

            allApis.push({
              path,
              method: httpMethod,
              swaggerName,
              operation,
              summary: operation.summary,
              description: operation.description,
              tags: operation.tags,
              operationId: operation.operationId,
            });
          }
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
        { name: 'path', weight: 0.3 },
        { name: 'summary', weight: 0.25 },
        { name: 'description', weight: 0.2 },
        { name: 'operationId', weight: 0.15 },
        { name: 'tags', weight: 0.1 },
      ],
      threshold: 0.6, // 較寬鬆的匹配閾值
      includeScore: true,
      ignoreLocation: true,
    };

    const fuse = new Fuse(allApis, fuseOptions);
    const searchResults = fuse.search(query);

    // 格式化結果
    const results = searchResults.slice(0, limit).map((result) => ({
      path: result.item.path,
      method: result.item.method,
      swaggerName: result.item.swaggerName,
      summary: result.item.summary,
      description: result.item.description,
      tags: result.item.tags,
      operationId: result.item.operationId,
      score: 1 - (result.score || 0), // 轉換為相似度分數（越高越相似）
    }));

    const endTime = Date.now();

    // 構建成功結果
    const output: SearchAPIsOutput = {
      success: true,
      query,
      results,
      metadata: {
        totalResults: results.length,
        searchTime: endTime - startTime,
        swaggersSearched: swaggersToSearch,
      },
    };

    // 驗證輸出
    return SearchAPIsOutputSchema.parse(output);
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
export const searchAPIsToolDefinition = {
  name: 'search_apis',
  description: '搜索 API endpoints，支援模糊搜索和多種過濾條件',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索關鍵字（可搜索路徑、摘要、描述、operationId、標籤）',
      },
      swaggerName: {
        type: 'string',
        description: '限制搜索的 Swagger 檔案名稱（可選）',
      },
      tag: {
        type: 'string',
        description: '限制搜索的標籤（可選）',
      },
      method: {
        type: 'string',
        description: 'HTTP 方法過濾（如：get, post, put, delete）（可選）',
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
export { SearchAPIsInputSchema, SearchAPIsOutputSchema };
