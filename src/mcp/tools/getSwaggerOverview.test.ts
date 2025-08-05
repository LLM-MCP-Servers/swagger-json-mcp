/**
 * get_swagger_overview MCP Tool tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSwaggerOverview,
  getSwaggerOverviewInputSchema,
  getSwaggerOverviewOutputSchema,
} from './getSwaggerOverview.js';
import { SwaggerManager } from '../../core/SwaggerManager.js';
import { TestEnvironment, TestSwagger, mockProcessCwd } from '../../test/utils/testHelper.js';

describe('getSwaggerOverview MCP Tool', () => {
  let swaggerManager: SwaggerManager;
  let testEnv: TestEnvironment;
  let restoreCwd: () => void;

  const testSwagger: TestSwagger = {
    name: 'comprehensive-api',
    fileName: 'comprehensive-api.json',
    swaggerContent: {
      openapi: '3.0.0',
      info: {
        title: 'Comprehensive API',
        description: 'A comprehensive test API with multiple features',
        version: '1.2.3',
        contact: {
          name: 'API Team',
          email: 'api@example.com',
        },
      },
      servers: [
        {
          url: 'https://api.example.com/v1',
          description: 'Production server',
        },
        {
          url: 'https://staging-api.example.com/v1',
          description: 'Staging server',
        },
        {
          url: '{protocol}://{host}:{port}/api',
          description: 'Development server',
          variables: {
            protocol: {
              enum: ['http', 'https'],
              default: 'http',
            },
            host: {
              default: 'localhost',
            },
            port: {
              default: '3000',
            },
          },
        },
      ],
      paths: {
        '/users': {
          get: {
            tags: ['Users', 'Public'],
            summary: 'Get all users',
            responses: { '200': { description: 'Success' } },
          },
          post: {
            tags: ['Users', 'Admin'],
            summary: 'Create user',
            responses: { '201': { description: 'Created' } },
          },
        },
        '/users/{id}': {
          get: {
            tags: ['Users', 'Public'],
            summary: 'Get user by ID',
            responses: { '200': { description: 'Success' } },
          },
          put: {
            tags: ['Users', 'Admin'],
            summary: 'Update user',
            responses: { '200': { description: 'Updated' } },
          },
          delete: {
            tags: ['Users', 'Admin'],
            summary: 'Delete user',
            responses: { '204': { description: 'Deleted' } },
          },
        },
        '/posts': {
          get: {
            tags: ['Posts', 'Public'],
            summary: 'Get all posts',
            responses: { '200': { description: 'Success' } },
          },
        },
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              username: { type: 'string' },
              email: { type: 'string' },
            },
          },
          Post: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              title: { type: 'string' },
              content: { type: 'string' },
              authorId: { type: 'integer' },
            },
          },
          CreateUserRequest: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      },
      tags: [
        {
          name: 'Users',
          description: 'User management operations',
        },
        {
          name: 'Posts',
          description: 'Post management operations',
        },
        {
          name: 'Public',
          description: 'Publicly accessible endpoints',
        },
        {
          name: 'Admin',
          description: 'Admin-only endpoints',
        },
      ],
    },
  };

  beforeEach(async () => {
    swaggerManager = new SwaggerManager();
    testEnv = new TestEnvironment();

    const testDir = await testEnv.setupSwaggers([testSwagger]);
    restoreCwd = mockProcessCwd(testDir);
  });

  afterEach(async () => {
    restoreCwd();
    await testEnv.cleanup();
  });

  describe('Input Schema Validation', () => {
    it('should accept valid swagger name', () => {
      const result = getSwaggerOverviewInputSchema.safeParse({ swaggerName: 'test-swagger' });
      expect(result.success).toBe(true);
    });

    it('should reject empty swagger name', () => {
      const result = getSwaggerOverviewInputSchema.safeParse({ swaggerName: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing swagger name', () => {
      const result = getSwaggerOverviewInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-string swagger name', () => {
      const result = getSwaggerOverviewInputSchema.safeParse({ swaggerName: 123 });
      expect(result.success).toBe(false);
    });
  });

  describe('Tool Implementation', () => {
    it('should return comprehensive swagger overview', async () => {
      const input = { swaggerName: 'comprehensive-api' };
      const result = await getSwaggerOverview(input, swaggerManager);

      // Validate output schema
      const schemaValidation = getSwaggerOverviewOutputSchema.safeParse(result);
      expect(schemaValidation.success).toBe(true);

      // Check info section
      expect(result.info.name).toBe('comprehensive-api');
      expect(result.info.fileName).toBe('comprehensive-api.json');
      expect(result.info.title).toBe('Comprehensive API');
      expect(result.info.version).toBe('1.2.3');
      expect(result.info.description).toBe('A comprehensive test API with multiple features');
      expect(result.info.lastModified).toBeInstanceOf(Date);

      // Check stats section
      expect(result.stats).toEqual({
        totalApis: 6, // GET /users, POST /users, GET /users/{id}, PUT /users/{id}, DELETE /users/{id}, GET /posts
        totalSchemas: 3, // User, Post, CreateUserRequest
        methodBreakdown: {
          GET: 3,
          POST: 1,
          PUT: 1,
          DELETE: 1,
        },
        tagBreakdown: {
          Users: 5,
          Public: 3,
          Admin: 3,
          Posts: 1,
        },
      });

      // Check servers section
      expect(result.servers).toHaveLength(3);
      expect(result.servers![0]).toEqual({
        url: 'https://api.example.com/v1',
        description: 'Production server',
      });
      expect(result.servers![2]).toEqual({
        url: '{protocol}://{host}:{port}/api',
        description: 'Development server',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'http',
          },
          host: {
            default: 'localhost',
          },
          port: {
            default: '3000',
          },
        },
      });

      // Check tags section
      expect(result.tags).toHaveLength(4);
      expect(result.tags).toContainEqual({
        name: 'Users',
        description: 'User management operations',
      });
      expect(result.tags).toContainEqual({
        name: 'Admin',
        description: 'Admin-only endpoints',
      });
    });

    it('should handle swagger without servers', async () => {
      const minimalSwagger: TestSwagger = {
        name: 'minimal-api',
        fileName: 'minimal-api.json',
        swaggerContent: {
          openapi: '3.0.0',
          info: {
            title: 'Minimal API',
            version: '1.0.0',
          },
          paths: {
            '/test': {
              get: {
                responses: { '200': { description: 'Success' } },
              },
            },
          },
          components: { schemas: {} },
        },
      };

      await testEnv.cleanup();
      testEnv = new TestEnvironment();
      const testDir = await testEnv.setupSwaggers([minimalSwagger]);
      restoreCwd();
      restoreCwd = mockProcessCwd(testDir);

      const input = { swaggerName: 'minimal-api' };
      const result = await getSwaggerOverview(input, swaggerManager);

      expect(result.info.name).toBe('minimal-api');
      expect(result.info.fileName).toBe('minimal-api.json');
      expect(result.info.title).toBe('Minimal API');
      expect(result.info.version).toBe('1.0.0');
      expect(result.info.description).toBeUndefined();

      expect(result.stats.totalApis).toBe(1);
      expect(result.stats.totalSchemas).toBe(0);
      expect(result.servers).toBeUndefined();
      expect(result.tags).toBeUndefined();
    });

    it('should handle swagger without tags', async () => {
      const noTagsSwagger: TestSwagger = {
        name: 'no-tags-api',
        fileName: 'no-tags-api.json',
        swaggerContent: {
          openapi: '3.0.0',
          info: {
            title: 'No Tags API',
            version: '1.0.0',
          },
          paths: {
            '/test': {
              get: {
                responses: { '200': { description: 'Success' } },
              },
            },
          },
          components: { schemas: {} },
          // No tags array
        },
      };

      await testEnv.cleanup();
      testEnv = new TestEnvironment();
      const testDir = await testEnv.setupSwaggers([noTagsSwagger]);
      restoreCwd();
      restoreCwd = mockProcessCwd(testDir);

      const input = { swaggerName: 'no-tags-api' };
      const result = await getSwaggerOverview(input, swaggerManager);

      expect(result.tags).toBeUndefined();
      expect(result.stats.tagBreakdown).toEqual({});
    });

    it('should throw error for non-existent swagger', async () => {
      const input = { swaggerName: 'non-existent-swagger' };

      await expect(getSwaggerOverview(input, swaggerManager)).rejects.toThrow(
        'Swagger "non-existent-swagger" not found',
      );
    });

    it('should handle SwaggerManager errors gracefully', async () => {
      // Mock swaggerManager to throw a general error
      const failingSwaggerManager = {
        getSwagger: async () => {
          throw new Error('Database connection failed');
        },
      } as unknown as SwaggerManager;

      const input = { swaggerName: 'any-swagger' };

      await expect(getSwaggerOverview(input, failingSwaggerManager)).rejects.toThrow(
        'Failed to get swagger overview: Database connection failed',
      );
    });

    it('should use cached data from SwaggerManager', async () => {
      const input = { swaggerName: 'comprehensive-api' };

      // First call
      const result1 = await getSwaggerOverview(input, swaggerManager);

      // Second call should use cache
      const result2 = await getSwaggerOverview(input, swaggerManager);

      expect(result1).toEqual(result2);

      // Verify cache was used
      const cacheInfo = swaggerManager.getCacheInfo();
      expect(cacheInfo.size).toBe(1);
      expect(cacheInfo.isExpired).toBe(false);
    });

    it('should handle lastModified dates correctly', async () => {
      const input = { swaggerName: 'comprehensive-api' };
      const result = await getSwaggerOverview(input, swaggerManager);

      expect(result.info.lastModified).toBeInstanceOf(Date);
      expect(result.info.lastModified.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Output Schema Validation', () => {
    it('should validate correct output format', () => {
      const validOutput = {
        info: {
          name: 'test-api',
          fileName: 'test-api.json',
          title: 'Test API',
          version: '1.0.0',
          description: 'Test description',
          lastModified: new Date(),
        },
        stats: {
          totalApis: 5,
          totalSchemas: 3,
          methodBreakdown: { GET: 3, POST: 2 },
          tagBreakdown: { Users: 5 },
        },
        servers: [
          {
            url: 'https://api.example.com',
            description: 'Production server',
          },
        ],
        tags: [
          {
            name: 'Users',
            description: 'User operations',
          },
        ],
      };

      const result = getSwaggerOverviewOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('should validate minimal output format', () => {
      const minimalOutput = {
        info: {
          name: 'test-api',
          fileName: 'test-api.json',
          title: 'Test API',
          version: '1.0.0',
          lastModified: new Date(),
        },
        stats: {
          totalApis: 0,
          totalSchemas: 0,
          methodBreakdown: {},
          tagBreakdown: {},
        },
      };

      const result = getSwaggerOverviewOutputSchema.safeParse(minimalOutput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid output format', () => {
      const invalidOutputs = [
        // Missing required fields
        {
          info: { name: 'test', fileName: 'test.json', title: 'Test' },
          // missing stats
        },
        // Invalid types
        {
          info: {
            name: 'test-api',
            fileName: 'test-api.json',
            title: 'Test API',
            version: '1.0.0',
            lastModified: new Date(),
          },
          stats: {
            totalApis: '5', // should be number
            totalSchemas: 3,
            methodBreakdown: {},
            tagBreakdown: {},
          },
        },
      ];

      for (const invalidOutput of invalidOutputs) {
        const result = getSwaggerOverviewOutputSchema.safeParse(invalidOutput);
        expect(result.success).toBe(false);
      }
    });
  });
});