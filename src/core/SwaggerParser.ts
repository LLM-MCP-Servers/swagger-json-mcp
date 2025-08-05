/**
 * SwaggerParser - Swagger JSON 解析器
 */

import { readJsonFile } from '../utils/fileSystem.js';
import { logger } from '../utils/logger.js';
import type {
  SwaggerDocument,
  SwaggerDocumentInfo,
  PathItem,
  Schema,
  Tag,
  SwaggerStats,
  Operation,
} from '../mcp/types.js';

export interface BasicStats {
  totalApis: number;
  totalSchemas: number;
}

export class SwaggerParser {
  private document: SwaggerDocument | null = null;
  private filePath: string | null = null;

  /**
   * 載入並解析 swagger.json
   */
  async loadSwagger(filePath: string): Promise<void> {
    try {
      logger.debug(`Loading Swagger document from: ${filePath}`);

      const document = await readJsonFile<SwaggerDocument>(filePath);

      // Basic validation
      if (!document.openapi && !document.swagger) {
        throw new Error('Invalid Swagger/OpenAPI document: missing version field');
      }

      if (!document.paths) {
        throw new Error('Invalid Swagger/OpenAPI document: missing paths');
      }

      this.document = document;
      this.filePath = filePath;

      logger.info(`Successfully loaded Swagger document: ${document.info?.title || 'Unknown'}`);
    } catch (error) {
      logger.error(`Failed to load Swagger document from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 獲取文檔基本資訊
   */
  getInfo(): SwaggerDocumentInfo {
    this.ensureLoaded();
    return this.document!.info;
  }

  /**
   * 獲取所有 API paths
   */
  getAllPaths(): Array<{ path: string; pathItem: PathItem }> {
    this.ensureLoaded();

    const paths: Array<{ path: string; pathItem: PathItem }> = [];

    for (const [path, pathItem] of Object.entries(this.document!.paths)) {
      if (pathItem) {
        paths.push({ path, pathItem });
      }
    }

    return paths;
  }

  /**
   * 獲取特定路徑的 API
   */
  getPathItem(path: string, method?: string): { pathItem: PathItem; operation?: Operation } | null {
    this.ensureLoaded();

    const pathItem = this.document!.paths[path];
    if (!pathItem) {
      return null;
    }

    if (method) {
      const operation = pathItem[method.toLowerCase() as keyof PathItem] as Operation;
      if (!operation) {
        return null;
      }
      return { pathItem, operation };
    }

    return { pathItem };
  }

  /**
   * 獲取所有 schemas
   */
  getAllSchemas(): Record<string, Schema> {
    this.ensureLoaded();
    return this.document!.components?.schemas || {};
  }

  /**
   * 獲取特定 schema
   */
  getSchema(schemaName: string): Schema | null {
    const schemas = this.getAllSchemas();
    return schemas[schemaName] || null;
  }

  /**
   * 獲取所有 tags
   */
  getTags(): Tag[] {
    this.ensureLoaded();
    return this.document!.tags || [];
  }

  /**
   * 獲取所有 HTTP methods 從 paths
   */
  getAllMethods(): string[] {
    this.ensureLoaded();

    const methods = new Set<string>();
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];

    for (const pathItem of Object.values(this.document!.paths)) {
      if (pathItem) {
        for (const method of httpMethods) {
          if (pathItem[method as keyof PathItem]) {
            methods.add(method.toUpperCase());
          }
        }
      }
    }

    return Array.from(methods);
  }

  /**
   * 獲取基本統計資訊
   */
  getBasicStats(): BasicStats {
    this.ensureLoaded();

    const paths = this.getAllPaths();
    let totalApis = 0;

    // Count all operations across all paths
    for (const { pathItem } of paths) {
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
      for (const method of httpMethods) {
        if (pathItem[method as keyof PathItem]) {
          totalApis++;
        }
      }
    }

    const schemas = this.getAllSchemas();

    return {
      totalApis,
      totalSchemas: Object.keys(schemas).length,
    };
  }

  /**
   * 獲取詳細統計資訊
   */
  getDetailedStats(): SwaggerStats {
    this.ensureLoaded();

    const paths = this.getAllPaths();
    const methodBreakdown: Record<string, number> = {};
    const tagBreakdown: Record<string, number> = {};
    let totalApis = 0;

    // Analyze all operations
    for (const { pathItem } of paths) {
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];

      for (const method of httpMethods) {
        const operation = pathItem[method as keyof PathItem] as Operation;
        if (operation) {
          totalApis++;

          // Count methods
          const methodUpper = method.toUpperCase();
          methodBreakdown[methodUpper] = (methodBreakdown[methodUpper] || 0) + 1;

          // Count tags
          if (operation.tags) {
            for (const tag of operation.tags) {
              tagBreakdown[tag] = (tagBreakdown[tag] || 0) + 1;
            }
          }
        }
      }
    }

    const schemas = this.getAllSchemas();

    return {
      totalApis,
      totalSchemas: Object.keys(schemas).length,
      methodBreakdown,
      tagBreakdown,
    };
  }

  /**
   * 搜索 APIs
   */
  searchApis(
    query: string,
  ): Array<{ path: string; method: string; operation: Operation; score: number }> {
    this.ensureLoaded();

    const results: Array<{ path: string; method: string; operation: Operation; score: number }> =
      [];
    const queryLower = query.toLowerCase();

    for (const { path, pathItem } of this.getAllPaths()) {
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];

      for (const method of httpMethods) {
        const operation = pathItem[method as keyof PathItem] as Operation;
        if (operation) {
          let score = 0;

          // Search in path
          if (path.toLowerCase().includes(queryLower)) {
            score += 10;
          }

          // Search in summary
          if (operation.summary?.toLowerCase().includes(queryLower)) {
            score += 8;
          }

          // Search in description
          if (operation.description?.toLowerCase().includes(queryLower)) {
            score += 6;
          }

          // Search in tags
          if (operation.tags?.some((tag) => tag.toLowerCase().includes(queryLower))) {
            score += 5;
          }

          // Search in operationId
          if (operation.operationId?.toLowerCase().includes(queryLower)) {
            score += 7;
          }

          if (score > 0) {
            results.push({ path, method: method.toUpperCase(), operation, score });
          }
        }
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 搜索 Schemas
   */
  searchSchemas(query: string): Array<{ name: string; schema: Schema; score: number }> {
    this.ensureLoaded();

    const results: Array<{ name: string; schema: Schema; score: number }> = [];
    const queryLower = query.toLowerCase();
    const schemas = this.getAllSchemas();

    for (const [name, schema] of Object.entries(schemas)) {
      let score = 0;

      // Search in schema name
      if (name.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Search in description
      if (schema.description?.toLowerCase().includes(queryLower)) {
        score += 8;
      }

      // Search in properties
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propName.toLowerCase().includes(queryLower)) {
            score += 5;
          }
          if (propSchema.description?.toLowerCase().includes(queryLower)) {
            score += 3;
          }
        }
      }

      if (score > 0) {
        results.push({ name, schema, score });
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 檢查文檔是否已載入
   */
  private ensureLoaded(): void {
    if (!this.document) {
      throw new Error('Swagger document not loaded. Call loadSwagger() first.');
    }
  }

  /**
   * 獲取載入的文檔
   */
  getDocument(): SwaggerDocument | null {
    return this.document;
  }

  /**
   * 獲取文檔文件路徑
   */
  getFilePath(): string | null {
    return this.filePath;
  }
}
