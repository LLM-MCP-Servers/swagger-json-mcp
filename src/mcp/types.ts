/**
 * TypeScript type definitions for the Swagger JSON MCP Server
 */

export interface SwaggerDocument {
  openapi?: string;
  swagger?: string; // For Swagger 2.0 compatibility
  info: SwaggerDocumentInfo;
  servers?: ServerObject[];
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  tags?: Tag[];
}

export interface SwaggerDocumentInfo {
  title: string;
  description?: string;
  version: string;
  contact?: ContactObject;
}

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

export interface ServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface PathItem {
  summary?: string;
  description?: string;
  get?: Operation;
  put?: Operation;
  post?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  patch?: Operation;
  trace?: Operation;
}

export interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: SecurityRequirement[];
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body' | 'formData'; // 加入 Swagger 2.x 支援
  description?: string;
  required?: boolean;
  schema?: Schema;
  // Swagger 2.x body parameter 可能直接有 schema
}

export interface RequestBody {
  description?: string;
  content: Record<string, MediaType>;
  required?: boolean;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

export interface MediaType {
  schema?: Schema;
}

export interface Schema {
  type?: string;
  format?: string;
  description?: string;
  example?: any;
  enum?: any[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  nullable?: boolean;
  $ref?: string;
}

export interface SecurityScheme {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
}

export interface SecurityRequirement {
  [key: string]: string[];
}

export interface Tag {
  name: string;
  description?: string;
}

// MCP Tool related types
export interface Project {
  name: string;
  title: string;
  version: string;
  description?: string;
  apiCount: number;
  schemaCount: number;
}

export interface ProjectStats {
  totalApis: number;
  totalSchemas: number;
  methodBreakdown: Record<string, number>;
  tagBreakdown: Record<string, number>;
}

// New Swagger file management types
export interface SwaggerInfo {
  name: string;
  fileName: string;
  title: string;
  version: string;
  description?: string;
  apiCount: number;
  schemaCount: number;
  lastModified: Date;
}

export interface SwaggerStats {
  totalApis: number;
  totalSchemas: number;
  methodBreakdown: Record<string, number>;
  tagBreakdown: Record<string, number>;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  swaggerName: string;
  path?: string;
  method?: string;
  schemaName?: string;
}

export interface ResolvedSchema extends Schema {
  _resolved: boolean;
  _dependencies?: string[];
  _depth?: number;
}

// Error types
export class SwaggerMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'SwaggerMCPError';
  }
}

export class ProjectNotFoundError extends SwaggerMCPError {
  constructor(projectName: string) {
    super(`Project "${projectName}" not found`, 'PROJECT_NOT_FOUND', { projectName });
  }
}

export class SwaggerNotFoundError extends SwaggerMCPError {
  constructor(swaggerName: string) {
    super(`Swagger "${swaggerName}" not found`, 'SWAGGER_NOT_FOUND', { swaggerName });
  }
}

export class SchemaNotFoundError extends SwaggerMCPError {
  constructor(schemaName: string, swaggerName: string) {
    super(`Schema "${schemaName}" not found in swagger "${swaggerName}"`, 'SCHEMA_NOT_FOUND', {
      schemaName,
      swaggerName,
    });
  }
}

export class ApiNotFoundError extends SwaggerMCPError {
  constructor(path: string, method: string, swaggerName: string) {
    super(
      `API "${method.toUpperCase()} ${path}" not found in swagger "${swaggerName}"`,
      'API_NOT_FOUND',
      {
        path,
        method,
        swaggerName,
      },
    );
  }
}
