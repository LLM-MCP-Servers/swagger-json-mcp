/**
 * SwaggerParser tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SwaggerParser } from './SwaggerParser.js';
import { TestEnvironment, TestSwagger, mockProcessCwd } from '../test/utils/testHelper.js';

describe('SwaggerParser', () => {
  let parser: SwaggerParser;
  let testEnv: TestEnvironment;
  let restoreCwd: () => void;
  let testSwagger: TestSwagger;

  beforeEach(async () => {
    parser = new SwaggerParser();
    testEnv = new TestEnvironment();

    // Define test swagger
    testSwagger = {
      name: 'test-api',
      fileName: 'test-api.json',
      swaggerContent: {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          description: 'A simple test API',
          version: '1.0.0',
        },
        paths: {
          '/users': {
            get: {
              tags: ['Users'],
              summary: 'Get all users',
              operationId: 'users.index',
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
            post: {
              tags: ['Users'],
              summary: 'Create user',
              operationId: 'users.store',
              responses: {
                '201': {
                  description: 'Created',
                },
              },
            },
          },
          '/users/{id}': {
            get: {
              tags: ['Users'],
              summary: 'Get user by ID',
              operationId: 'users.show',
              responses: {
                '200': {
                  description: 'Success',
                },
              },
            },
          },
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
              },
            },
            UserProfile: {
              type: 'object',
              properties: {
                bio: { type: 'string' },
              },
            },
          },
        },
        tags: [
          {
            name: 'Users',
            description: 'User management',
          },
        ],
      },
    };

    const testDir = await testEnv.setupSwaggers([testSwagger]);
    restoreCwd = mockProcessCwd(testDir);
  });

  afterEach(async () => {
    if (restoreCwd) {
      restoreCwd();
    }
    await testEnv.cleanup();
  });

  describe('loadSwagger', () => {
    it('should load valid swagger document', async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');

      await expect(parser.loadSwagger(swaggerPath)).resolves.not.toThrow();

      const document = parser.getDocument();
      expect(document).not.toBeNull();
      expect(document?.info.title).toBe('Test API');
    });

    it('should throw error for non-existent file', async () => {
      await expect(parser.loadSwagger('/non/existent/path.json')).rejects.toThrow();
    });

    it('should throw error for invalid swagger document', async () => {
      const invalidSwagger: TestSwagger = {
        name: 'invalid-api',
        fileName: 'invalid-api.json',
        swaggerContent: { invalid: 'document' },
      };

      // Create invalid swagger
      await testEnv.cleanup();
      testEnv = new TestEnvironment();
      const invalidTestDir = await testEnv.setupSwaggers([invalidSwagger]);
      restoreCwd();
      restoreCwd = mockProcessCwd(invalidTestDir);

      const invalidPath = testEnv.getSwaggerFilePath('invalid-api.json');

      await expect(parser.loadSwagger(invalidPath)).rejects.toThrow(
        'Invalid Swagger/OpenAPI document',
      );
    });
  });

  describe('getInfo', () => {
    it('should return swagger info', async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');
      await parser.loadSwagger(swaggerPath);

      const info = parser.getInfo();
      expect(info.title).toBe('Test API');
      expect(info.version).toBe('1.0.0');
      expect(info.description).toBe('A simple test API');
    });

    it('should throw error if document not loaded', () => {
      expect(() => parser.getInfo()).toThrow('Swagger document not loaded');
    });
  });

  describe('getAllPaths', () => {
    it('should return all paths', async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');
      await parser.loadSwagger(swaggerPath);

      const paths = parser.getAllPaths();
      expect(paths).toHaveLength(2);
      expect(paths.map((p) => p.path)).toEqual(['/users', '/users/{id}']);
    });
  });

  describe('getPathItem', () => {
    beforeEach(async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');
      await parser.loadSwagger(swaggerPath);
    });

    it('should return path item without method', () => {
      const result = parser.getPathItem('/users');
      expect(result).not.toBeNull();
      expect(result?.pathItem).toBeDefined();
      expect(result?.operation).toBeUndefined();
    });

    it('should return path item with specific method', () => {
      const result = parser.getPathItem('/users', 'get');
      expect(result).not.toBeNull();
      expect(result?.pathItem).toBeDefined();
      expect(result?.operation).toBeDefined();
      expect(result?.operation?.summary).toBe('Get all users');
    });

    it('should return null for non-existent path', () => {
      const result = parser.getPathItem('/non-existent');
      expect(result).toBeNull();
    });

    it('should return null for non-existent method', () => {
      const result = parser.getPathItem('/users', 'delete');
      expect(result).toBeNull();
    });
  });

  describe('getAllSchemas', () => {
    it('should return all schemas', async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');
      await parser.loadSwagger(swaggerPath);

      const schemas = parser.getAllSchemas();
      expect(Object.keys(schemas)).toHaveLength(2);
      expect(schemas).toHaveProperty('User');
      expect(schemas).toHaveProperty('UserProfile');
    });
  });

  describe('getSchema', () => {
    beforeEach(async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');
      await parser.loadSwagger(swaggerPath);
    });

    it('should return specific schema', () => {
      const schema = parser.getSchema('User');
      expect(schema).not.toBeNull();
      expect(schema?.type).toBe('object');
      expect(schema?.properties).toHaveProperty('id');
      expect(schema?.properties).toHaveProperty('name');
    });

    it('should return null for non-existent schema', () => {
      const schema = parser.getSchema('NonExistent');
      expect(schema).toBeNull();
    });
  });

  describe('getBasicStats', () => {
    it('should return correct basic stats', async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');
      await parser.loadSwagger(swaggerPath);

      const stats = parser.getBasicStats();
      expect(stats.totalApis).toBe(3); // GET /users, POST /users, GET /users/{id}
      expect(stats.totalSchemas).toBe(2); // User, UserProfile
    });
  });

  describe('getDetailedStats', () => {
    it('should return detailed stats', async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');
      await parser.loadSwagger(swaggerPath);

      const stats = parser.getDetailedStats();
      expect(stats.totalApis).toBe(3);
      expect(stats.totalSchemas).toBe(2);
      expect(stats.methodBreakdown).toEqual({
        GET: 2,
        POST: 1,
      });
      expect(stats.tagBreakdown).toEqual({
        Users: 3,
      });
    });
  });

  describe('searchApis', () => {
    beforeEach(async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');
      await parser.loadSwagger(swaggerPath);
    });

    it('should find APIs by path', () => {
      const results = parser.searchApis('users');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.path.includes('users'))).toBe(true);
    });

    it('should find APIs by summary', () => {
      const results = parser.searchApis('Create');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.operation.summary?.includes('Create'))).toBe(true);
    });

    it('should return results sorted by score', () => {
      const results = parser.searchApis('users');
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it('should return empty array for no matches', () => {
      const results = parser.searchApis('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchSchemas', () => {
    beforeEach(async () => {
      const swaggerPath = testEnv.getSwaggerFilePath('test-api.json');
      await parser.loadSwagger(swaggerPath);
    });

    it('should find schemas by name', () => {
      const results = parser.searchSchemas('User');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name.includes('User'))).toBe(true);
    });

    it('should return results sorted by score', () => {
      const results = parser.searchSchemas('User');
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it('should return empty array for no matches', () => {
      const results = parser.searchSchemas('nonexistent');
      expect(results).toHaveLength(0);
    });
  });
});
