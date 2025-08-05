/**
 * list_swaggers MCP Tool tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listSwaggers, listSwaggersInputSchema, listSwaggersOutputSchema } from './listSwaggers.js';
import { SwaggerManager } from '../../core/SwaggerManager.js';
import { TestEnvironment, TestSwagger, mockProcessCwd } from '../../test/utils/testHelper.js';

describe('listSwaggers MCP Tool', () => {
  let swaggerManager: SwaggerManager;
  let testEnv: TestEnvironment;
  let restoreCwd: () => void;

  const testSwaggers: TestSwagger[] = [
    {
      name: 'medical-system',
      fileName: 'medical-system.json',
      swaggerContent: {
        openapi: '3.0.0',
        info: {
          title: 'Medical System API',
          description: 'API for medical management',
          version: '1.0.0',
        },
        paths: {
          '/patients': {
            get: {
              tags: ['Patients'],
              summary: 'Get patients',
              responses: { '200': { description: 'Success' } },
            },
            post: {
              tags: ['Patients'],
              summary: 'Create patient',
              responses: { '201': { description: 'Created' } },
            },
          },
        },
        components: {
          schemas: {
            Patient: {
              type: 'object',
              properties: { id: { type: 'integer' }, name: { type: 'string' } },
            },
          },
        },
      },
    },
    {
      name: 'user-management',
      fileName: 'user-management.json',
      swaggerContent: {
        openapi: '3.0.0',
        info: {
          title: 'User Management API',
          description: 'User management system',
          version: '2.1.0',
        },
        paths: {
          '/users': {
            get: {
              tags: ['Users'],
              summary: 'Get users',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/roles': {
            get: {
              tags: ['Roles'],
              summary: 'Get roles',
              responses: { '200': { description: 'Success' } },
            },
          },
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: { id: { type: 'integer' }, username: { type: 'string' } },
            },
            Role: {
              type: 'object',
              properties: { id: { type: 'integer' }, name: { type: 'string' } },
            },
            Permission: {
              type: 'object',
              properties: { id: { type: 'integer' }, action: { type: 'string' } },
            },
          },
        },
      },
    },
  ];

  beforeEach(async () => {
    swaggerManager = new SwaggerManager();
    testEnv = new TestEnvironment();

    const testDir = await testEnv.setupSwaggers(testSwaggers);
    restoreCwd = mockProcessCwd(testDir);
  });

  afterEach(async () => {
    restoreCwd();
    await testEnv.cleanup();
  });

  describe('Input Schema Validation', () => {
    it('should accept empty input object', () => {
      const result = listSwaggersInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept input with extra properties', () => {
      const result = listSwaggersInputSchema.safeParse({ extra: 'property' });
      expect(result.success).toBe(true);
    });
  });

  describe('Tool Implementation', () => {
    it('should return all available swagger files', async () => {
      const input = {};
      const result = await listSwaggers(input, swaggerManager);

      // Validate output schema
      const schemaValidation = listSwaggersOutputSchema.safeParse(result);
      expect(schemaValidation.success).toBe(true);

      // Check results
      expect(result.swaggers).toHaveLength(2);

      const swaggerNames = result.swaggers.map((s) => s.name).sort();
      expect(swaggerNames).toEqual(['medical-system', 'user-management']);

      // Check medical-system swagger
      const medicalSwagger = result.swaggers.find((s) => s.name === 'medical-system');
      expect(medicalSwagger).toEqual({
        name: 'medical-system',
        fileName: 'medical-system.json',
        title: 'Medical System API',
        version: '1.0.0',
        description: 'API for medical management',
        apiCount: 2,
        schemaCount: 1,
        lastModified: expect.any(Date),
      });

      // Check user-management swagger
      const userSwagger = result.swaggers.find((s) => s.name === 'user-management');
      expect(userSwagger).toEqual({
        name: 'user-management',
        fileName: 'user-management.json',
        title: 'User Management API',
        version: '2.1.0',
        description: 'User management system',
        apiCount: 2,
        schemaCount: 3,
        lastModified: expect.any(Date),
      });
    });

    it('should return empty array when no swagger files exist', async () => {
      // Setup empty environment
      await testEnv.cleanup();
      testEnv = new TestEnvironment();
      const emptyTestDir = await testEnv.setupSwaggers([]);
      restoreCwd();
      restoreCwd = mockProcessCwd(emptyTestDir);

      const input = {};
      const result = await listSwaggers(input, swaggerManager);

      expect(result.swaggers).toHaveLength(0);
      expect(result.swaggers).toEqual([]);
    });

    it('should handle swagger files without description', async () => {
      const swaggerWithoutDesc: TestSwagger = {
        name: 'no-desc-api',
        fileName: 'no-desc-api.json',
        swaggerContent: {
          openapi: '3.0.0',
          info: {
            title: 'No Description API',
            version: '1.0.0',
            // description is missing
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
      const testDir = await testEnv.setupSwaggers([swaggerWithoutDesc]);
      restoreCwd();
      restoreCwd = mockProcessCwd(testDir);

      const input = {};
      const result = await listSwaggers(input, swaggerManager);

      expect(result.swaggers).toHaveLength(1);
      expect(result.swaggers[0]).toEqual({
        name: 'no-desc-api',
        fileName: 'no-desc-api.json',
        title: 'No Description API',
        version: '1.0.0',
        description: undefined,
        apiCount: 1,
        schemaCount: 0,
        lastModified: expect.any(Date),
      });
    });

    it('should throw meaningful error when swagger scanning fails', async () => {
      // Mock swaggerManager to throw error
      const failingSwaggerManager = {
        scanSwaggers: async () => {
          throw new Error('Failed to scan swagger directory');
        },
      } as unknown as SwaggerManager;

      const input = {};

      await expect(listSwaggers(input, failingSwaggerManager)).rejects.toThrow(
        'Failed to list swagger files: Failed to scan swagger directory',
      );
    });

    it('should use SwaggerManager cache for subsequent calls', async () => {
      const input = {};

      // First call
      const result1 = await listSwaggers(input, swaggerManager);

      // Second call should use cache
      const result2 = await listSwaggers(input, swaggerManager);

      expect(result1).toEqual(result2);

      // Verify cache was used (same instance, same timing)
      const cacheInfo = swaggerManager.getCacheInfo();
      expect(cacheInfo.size).toBe(2);
      expect(cacheInfo.isExpired).toBe(false);
    });

    it('should handle lastModified dates correctly', async () => {
      const input = {};
      const result = await listSwaggers(input, swaggerManager);

      // Check that lastModified is a valid date
      for (const swagger of result.swaggers) {
        expect(swagger.lastModified).toBeInstanceOf(Date);
        expect(swagger.lastModified.getTime()).toBeGreaterThan(0);
      }
    });
  });

  describe('Output Schema Validation', () => {
    it('should validate correct output format', () => {
      const validOutput = {
        swaggers: [
          {
            name: 'test-swagger',
            fileName: 'test-swagger.json',
            title: 'Test API',
            version: '1.0.0',
            description: 'Test description',
            apiCount: 5,
            schemaCount: 3,
            lastModified: new Date(),
          },
        ],
      };

      const result = listSwaggersOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid output format', () => {
      const invalidOutputs = [
        // Missing swaggers array
        {},
        // Invalid swagger structure
        {
          swaggers: [
            {
              name: 'test',
              // missing required fields
            },
          ],
        },
        // Invalid types
        {
          swaggers: [
            {
              name: 123, // should be string
              fileName: 'test.json',
              title: 'Test',
              version: '1.0.0',
              apiCount: 5,
              schemaCount: 3,
              lastModified: new Date(),
            },
          ],
        },
      ];

      for (const invalidOutput of invalidOutputs) {
        const result = listSwaggersOutputSchema.safeParse(invalidOutput);
        expect(result.success).toBe(false);
      }
    });
  });
});