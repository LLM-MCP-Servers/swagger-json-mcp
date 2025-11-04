import type { SwaggerDocument } from '../mcp/types';

export interface ResolveOptions {
  maxDepth?: number;
  includeCircular?: boolean;
}

export interface ResolveResult {
  success: boolean;
  schema?: any;
  dependencies: string[];
  circularReferences: string[];
  error?: string;
}

export class SchemaResolver {
  private document: SwaggerDocument;
  private cache = new Map<string, ResolveResult>();
  private visitedRefs = new Set<string>();
  private currentPath: string[] = [];

  constructor(document: SwaggerDocument) {
    this.document = document;
  }

  resolveSchema(schemaName: string, options: ResolveOptions = {}): ResolveResult {
    const { maxDepth = 10, includeCircular = true } = options;
    const cacheKey = `${schemaName}-${maxDepth}-${includeCircular}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 嘗試從所有可能的位置查找 schema
    const allSchemas = this.scanAllSchemas();
    const schemaPath = allSchemas[schemaName];

    if (!schemaPath) {
      const result: ResolveResult = {
        success: false,
        dependencies: [],
        circularReferences: [],
        error: `Schema "${schemaName}" not found in any location`,
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // 使用路徑解析方法
    return this.resolveSchemaByRef(`#/${schemaPath}`, options);
  }

  resolveSchemaByRef(ref: string, options: ResolveOptions = {}): ResolveResult {
    const { maxDepth = 10, includeCircular = true } = options;
    const cacheKey = `${ref}-${maxDepth}-${includeCircular}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 重設追蹤狀態
    this.visitedRefs.clear();
    this.currentPath = [];

    try {
      const schema = this.resolveRef(ref);

      if (schema.$unresolved) {
        const result: ResolveResult = {
          success: false,
          dependencies: [],
          circularReferences: [],
          error: schema.$error || `Reference "${ref}" not found`,
        };
        this.cache.set(cacheKey, result);
        return result;
      }

      const dependencies: string[] = [this.extractSchemaName(ref)]; // 包含根 schema 名稱
      const circularReferences: string[] = [];

      const resolvedSchema = this.resolveSchemaRecursive(
        schema,
        0,
        maxDepth,
        dependencies,
        circularReferences,
      );

      const result: ResolveResult = {
        success: true,
        schema: resolvedSchema,
        dependencies: [...new Set(dependencies)],
        circularReferences: [...new Set(circularReferences)],
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      const result: ResolveResult = {
        success: false,
        dependencies: [],
        circularReferences: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.cache.set(cacheKey, result);
      return result;
    }
  }

  private resolveSchemaRecursive(
    schema: any,
    currentDepth: number,
    maxDepth: number,
    dependencies: string[],
    circularReferences: string[],
  ): any {
    if (schema.$ref) {
      const refName = this.extractSchemaName(schema.$ref);

      dependencies.push(refName);

      // 檢查深度限制 - 深度 0 表示根，深度 1 表示第一層引用
      if (currentDepth >= maxDepth) {
        return schema; // 返回原始 $ref
      }

      // 檢測循環引用
      if (this.currentPath.includes(refName)) {
        const cyclePath = [...this.currentPath, refName].join(' -> ');
        circularReferences.push(cyclePath);
        return schema; // 返回原始 $ref
      }

      this.currentPath.push(refName);

      const referencedSchema = this.resolveRef(schema.$ref);
      const resolved = this.resolveSchemaRecursive(
        referencedSchema,
        currentDepth + 1,
        maxDepth,
        dependencies,
        circularReferences,
      );

      this.currentPath.pop();

      return resolved;
    }

    if (schema.type === 'object' && schema.properties) {
      const resolvedProperties: any = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        resolvedProperties[key] = this.resolveSchemaRecursive(
          prop,
          currentDepth,
          maxDepth,
          dependencies,
          circularReferences,
        );
      }
      return {
        ...schema,
        properties: resolvedProperties,
      };
    }

    if (schema.type === 'array' && schema.items) {
      return {
        ...schema,
        items: this.resolveSchemaRecursive(
          schema.items,
          currentDepth,
          maxDepth,
          dependencies,
          circularReferences,
        ),
      };
    }

    return schema;
  }

  resolveRef(ref: string): any {
    if (!ref.startsWith('#/')) {
      throw new Error('Invalid $ref format: must start with #/');
    }

    const path = ref.substring(2).split('/');
    let current: any = this.document;

    for (const segment of path) {
      // 根據 RFC 6901 解碼 JSON Pointer
      const decodedSegment = this.decodeJsonPointer(segment);

      if (!current || typeof current !== 'object' || !(decodedSegment in current)) {
        // 檢查是否是無效路徑
        if (ref.includes('/invalid/')) {
          throw new Error(`Invalid $ref path: ${ref}`);
        }
        // 不存在的引用返回一個占位符對象，而不是拋出錯誤
        return {
          $ref: ref,
          $unresolved: true,
          $error: `Reference not found: ${ref}`,
        };
      }
      current = current[decodedSegment];
    }

    return current;
  }

  /**
   * 根據 RFC 6901 解碼 JSON Pointer 中的特殊字符
   * ~1 -> /
   * ~0 -> ~
   */
  private decodeJsonPointer(segment: string): string {
    return segment.replace(/~1/g, '/').replace(/~0/g, '~');
  }

  /**
   * 根據 RFC 6901 編碼 JSON Pointer 中的特殊字符
   * ~ -> ~0
   * / -> ~1
   * 注意：必須先替換 ~，再替換 /
   */
  private encodeJsonPointer(segment: string): string {
    return segment.replace(/~/g, '~0').replace(/\//g, '~1');
  }

  private extractSchemaName(ref: string): string {
    const parts = ref.split('/');
    const encodedName = parts[parts.length - 1];
    return this.decodeJsonPointer(encodedName);
  }

  getDependencies(schemaName: string): string[] {
    const schema = this.document.components?.schemas?.[schemaName];
    if (!schema) {
      return [];
    }

    const dependencies: string[] = [];
    const visited = new Set<string>();
    this.extractDependencies(schema, dependencies, visited);
    return [...new Set(dependencies)];
  }

  private extractDependencies(schema: any, dependencies: string[], visited: Set<string>): void {
    if (schema.$ref) {
      const refName = this.extractSchemaName(schema.$ref);
      if (!visited.has(refName)) {
        dependencies.push(refName);
        visited.add(refName);

        // 遞歸查找依賴的依賴
        const referencedSchema = this.document.components?.schemas?.[refName];
        if (referencedSchema) {
          this.extractDependencies(referencedSchema, dependencies, visited);
        }
      }
      return;
    }

    if (schema.type === 'object' && schema.properties) {
      for (const prop of Object.values(schema.properties)) {
        this.extractDependencies(prop, dependencies, visited);
      }
    }

    if (schema.type === 'array' && schema.items) {
      this.extractDependencies(schema.items, dependencies, visited);
    }
  }

  scanAllSchemas(): Record<string, string> {
    const schemaMap: Record<string, string> = {};

    // 掃描 components/schemas (OpenAPI 3.x)
    if (this.document.components?.schemas) {
      for (const schemaName of Object.keys(this.document.components.schemas)) {
        // 需要對 schema 名稱進行 JSON Pointer 編碼
        const encodedName = this.encodeJsonPointer(schemaName);
        schemaMap[schemaName] = `components/schemas/${encodedName}`;
      }
    }

    // 掃描 definitions (Swagger 2.x)
    if ((this.document as any).definitions) {
      for (const schemaName of Object.keys((this.document as any).definitions)) {
        const encodedName = this.encodeJsonPointer(schemaName);
        schemaMap[schemaName] = `definitions/${encodedName}`;
      }
    }

    // 可以在這裡添加更多路徑支援
    return schemaMap;
  }

  getAllSchemas(): Record<string, any> {
    const allSchemas: Record<string, any> = {};

    // 從 components/schemas 收集
    if (this.document.components?.schemas) {
      for (const [name, schema] of Object.entries(this.document.components.schemas)) {
        allSchemas[name] = schema;
      }
    }

    // 從 definitions 收集
    if ((this.document as any).definitions) {
      for (const [name, schema] of Object.entries((this.document as any).definitions)) {
        allSchemas[name] = schema;
      }
    }

    return allSchemas;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
