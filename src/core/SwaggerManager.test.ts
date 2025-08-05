/**
 * SwaggerManager tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SwaggerManager } from './SwaggerManager.js';
import { TestEnvironment, TestSwagger, mockProcessCwd } from '../test/utils/testHelper.js';

describe('SwaggerManager', () => {
  let swaggerManager: SwaggerManager;
  let testEnv: TestEnvironment;
  let restoreCwd: () => void;

  const testSwagger1: TestSwagger = {
    name: 'swagger-one',
    fileName: 'swagger-one.json',
    swaggerContent: {
      openapi: '3.0.0',
      info: {
        title: 'Swagger One API',
        description: 'First test swagger',
        version: '1.0.0',
      },
      paths: {
        '/test': {
          get: {
            tags: ['Test'],
            summary: 'Test endpoint',
            responses: { '200': { description: 'Success' } },
          },
        },
      },
      components: {
        schemas: {
          TestSchema: {
            type: 'object',
            properties: { id: { type: 'integer' } },
          },
        },
      },
    },
  };

  const testSwagger2: TestSwagger = {
    name: 'swagger-two',
    fileName: 'swagger-two.json',
    swaggerContent: {
      openapi: '3.0.0',
      info: {
        title: 'Swagger Two API',
        description: 'Second test swagger',
        version: '2.0.0',
      },
      paths: {
        '/users': {
          get: {
            tags: ['Users'],
            summary: 'Get users',
            responses: { '200': { description: 'Success' } },
          },
          post: {
            tags: ['Users'],
            summary: 'Create user',
            responses: { '201': { description: 'Created' } },
          },
        },
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: { id: { type: 'integer' }, name: { type: 'string' } },
          },
          CreateUserRequest: {
            type: 'object',
            properties: { name: { type: 'string' } },
          },
        },
      },
    },
  };

  beforeEach(async () => {
    // Cleanup any previous test environment
    if (testEnv) {
      await testEnv.cleanup();
    }
    if (restoreCwd) {
      restoreCwd();
    }

    swaggerManager = new SwaggerManager();
    testEnv = new TestEnvironment();

    const testDir = await testEnv.setupSwaggers([testSwagger1, testSwagger2]);
    restoreCwd = mockProcessCwd(testDir);
  });

  afterEach(async () => {
    // 清除快取確保測試隔離
    if (swaggerManager && typeof swaggerManager.clearCache === 'function') {
      swaggerManager.clearCache();
    }
    if (restoreCwd) {
      restoreCwd();
    }
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe('scanSwaggers', () => {
    it('should scan and return all swagger files', async () => {
      const swaggers = await swaggerManager.scanSwaggers();

      expect(swaggers).toHaveLength(2);

      const swaggerNames = swaggers.map((s) => s.name).sort();
      expect(swaggerNames).toEqual(['swagger-one', 'swagger-two']);

      const swagger1 = swaggers.find((s) => s.name === 'swagger-one');
      expect(swagger1).toBeDefined();
      expect(swagger1?.name).toBe('swagger-one');
      expect(swagger1?.fileName).toBe('swagger-one.json');
      expect(swagger1?.title).toBe('Swagger One API');
      expect(swagger1?.version).toBe('1.0.0');
      expect(swagger1?.description).toBe('First test swagger');
      expect(swagger1?.apiCount).toBe(1);
      expect(swagger1?.schemaCount).toBe(1);
      expect(swagger1?.lastModified).toBeInstanceOf(Date);

      const swagger2 = swaggers.find((s) => s.name === 'swagger-two');
      expect(swagger2).toBeDefined();
      expect(swagger2?.name).toBe('swagger-two');
      expect(swagger2?.fileName).toBe('swagger-two.json');
      expect(swagger2?.title).toBe('Swagger Two API');
      expect(swagger2?.version).toBe('2.0.0');
      expect(swagger2?.apiCount).toBe(2);
      expect(swagger2?.schemaCount).toBe(2);
      expect(swagger2?.lastModified).toBeInstanceOf(Date);
    });

    it('should use cache on subsequent calls', async () => {
      // First call
      const swaggers1 = await swaggerManager.scanSwaggers();
      const cacheInfo1 = swaggerManager.getCacheInfo();

      // Second call should use cache
      const swaggers2 = await swaggerManager.scanSwaggers();
      const cacheInfo2 = swaggerManager.getCacheInfo();

      expect(swaggers1).toEqual(swaggers2);
      expect(cacheInfo1.lastScanTime).toBe(cacheInfo2.lastScanTime);
      expect(cacheInfo2.size).toBe(2);
      expect(cacheInfo2.isExpired).toBe(false);
    });

    it('should return empty array when no swagger files exist', async () => {
      // Setup empty environment
      await testEnv.cleanup();
      testEnv = new TestEnvironment();
      const emptyTestDir = await testEnv.setupSwaggers([]);
      restoreCwd();
      restoreCwd = mockProcessCwd(emptyTestDir);

      const swaggers = await swaggerManager.scanSwaggers();
      expect(swaggers).toHaveLength(0);
    });

    it('should sort swagger files by name', async () => {
      const swaggers = await swaggerManager.scanSwaggers();
      const names = swaggers.map((s) => s.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });

  describe('loadSwagger', () => {
    it('should load and return SwaggerParser for existing swagger', async () => {
      const parser = await swaggerManager.loadSwagger('swagger-one');

      expect(parser).toBeDefined();
      const info = parser.getInfo();
      expect(info.title).toBe('Swagger One API');
    });

    it('should throw error for non-existent swagger', async () => {
      await expect(swaggerManager.loadSwagger('non-existent')).rejects.toThrow(
        'Swagger "non-existent" not found',
      );
    });

    it('should use cached parser on subsequent calls', async () => {
      const parser1 = await swaggerManager.loadSwagger('swagger-one');
      const parser2 = await swaggerManager.loadSwagger('swagger-one');

      expect(parser1).toBe(parser2); // Should be the same instance
    });
  });

  describe('getSwaggerList', () => {
    it('should return list of swagger names', async () => {
      const swaggerNames = await swaggerManager.getSwaggerList();

      expect(swaggerNames).toHaveLength(2);
      expect(swaggerNames.sort()).toEqual(['swagger-one', 'swagger-two']);
    });
  });

  describe('swaggerExists', () => {
    it('should return true for existing swagger', async () => {
      const exists = await swaggerManager.swaggerExists('swagger-one');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent swagger', async () => {
      const exists = await swaggerManager.swaggerExists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('getSwagger', () => {
    it('should return swagger info for existing swagger', async () => {
      const swagger = await swaggerManager.getSwagger('swagger-two');

      expect(swagger.name).toBe('swagger-two');
      expect(swagger.fileName).toBe('swagger-two.json');
      expect(swagger.title).toBe('Swagger Two API');
      expect(swagger.version).toBe('2.0.0');
      expect(swagger.description).toBe('Second test swagger');
      expect(swagger.apiCount).toBe(2);
      expect(swagger.schemaCount).toBe(2);
      expect(swagger.lastModified).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent swagger', async () => {
      await expect(swaggerManager.getSwagger('non-existent')).rejects.toThrow(
        'Swagger "non-existent" not found',
      );
    });
  });

  describe('getAllSwaggers', () => {
    it('should return all swagger infos', async () => {
      const swaggers = await swaggerManager.getAllSwaggers();

      expect(swaggers).toHaveLength(2);
      const names = swaggers.map((s) => s.name).sort();
      expect(names).toEqual(['swagger-one', 'swagger-two']);

      for (const swagger of swaggers) {
        expect(swagger.name).toBeDefined();
        expect(swagger.fileName).toBeDefined();
        expect(swagger.title).toBeDefined();
        expect(swagger.version).toBeDefined();
        expect(swagger.apiCount).toBeGreaterThanOrEqual(0);
        expect(swagger.schemaCount).toBeGreaterThanOrEqual(0);
        expect(swagger.lastModified).toBeInstanceOf(Date);
      }
    });
  });

  describe('getSwaggerStats', () => {
    it('should return detailed stats for existing swagger', async () => {
      const stats = await swaggerManager.getSwaggerStats('swagger-two');

      expect(stats.totalApis).toBe(2);
      expect(stats.totalSchemas).toBe(2);
      expect(stats.methodBreakdown).toEqual({
        GET: 1,
        POST: 1,
      });
      expect(stats.tagBreakdown).toEqual({
        Users: 2,
      });
    });

    it('should throw error for non-existent swagger', async () => {
      await expect(swaggerManager.getSwaggerStats('non-existent')).rejects.toThrow(
        'Swagger "non-existent" not found',
      );
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      // Load some data first
      await swaggerManager.scanSwaggers();
      await swaggerManager.loadSwagger('swagger-one');

      let cacheInfo = swaggerManager.getCacheInfo();
      expect(cacheInfo.size).toBe(2);
      expect(cacheInfo.lastScanTime).toBeGreaterThan(0);

      // Clear cache
      swaggerManager.clearCache();

      cacheInfo = swaggerManager.getCacheInfo();
      expect(cacheInfo.size).toBe(0);
      expect(cacheInfo.lastScanTime).toBe(0);
      expect(cacheInfo.isExpired).toBe(true);
    });
  });

  describe('getCacheInfo', () => {
    it('should return correct cache information', async () => {
      // Initially empty
      let cacheInfo = swaggerManager.getCacheInfo();
      expect(cacheInfo.size).toBe(0);
      expect(cacheInfo.lastScanTime).toBe(0);
      expect(cacheInfo.isExpired).toBe(true);

      // After scanning
      await swaggerManager.scanSwaggers();

      cacheInfo = swaggerManager.getCacheInfo();
      expect(cacheInfo.size).toBe(2);
      expect(cacheInfo.lastScanTime).toBeGreaterThan(0);
      expect(cacheInfo.isExpired).toBe(false);
    });
  });

  describe('lastModified handling', () => {
    it('should correctly track file modification dates', async () => {
      const swaggers = await swaggerManager.scanSwaggers();

      for (const swagger of swaggers) {
        expect(swagger.lastModified).toBeInstanceOf(Date);
        expect(swagger.lastModified.getTime()).toBeGreaterThan(0);
        // Should be within the last few seconds
        expect(Date.now() - swagger.lastModified.getTime()).toBeLessThan(10000);
      }
    });

    it('should maintain lastModified in cached results', async () => {
      const swaggers1 = await swaggerManager.scanSwaggers();
      const swaggers2 = await swaggerManager.scanSwaggers(); // from cache

      expect(swaggers1[0].lastModified).toEqual(swaggers2[0].lastModified);
      expect(swaggers1[1].lastModified).toEqual(swaggers2[1].lastModified);
    });
  });

  describe('error handling', () => {
    it('should handle directory scanning errors gracefully', async () => {
      // Setup environment without docs/swaggers directory
      await testEnv.cleanup();
      testEnv = new TestEnvironment();
      // Don't call setupSwaggers, just setup basic temp dir
      await testEnv.setupSwaggers([]);
      
      // Remove the swaggers directory to simulate error
      const { rm } = await import('fs/promises');
      await rm(testEnv.getSwaggersDir(), { recursive: true, force: true });
      
      restoreCwd();
      restoreCwd = mockProcessCwd(testEnv.getDocsPath().replace('/docs', ''));

      await expect(swaggerManager.scanSwaggers()).rejects.toThrow();
    });

    it('should skip invalid JSON files during scanning', async () => {
      // Create a non-JSON file in swaggers directory
      const { writeFile } = await import('fs/promises');
      await writeFile(testEnv.getSwaggerFilePath('invalid.json'), 'invalid json content');

      const swaggers = await swaggerManager.scanSwaggers();
      
      // Should still load the 2 valid swagger files, ignoring the invalid one
      expect(swaggers).toHaveLength(2);
      const names = swaggers.map((s) => s.name).sort();
      expect(names).toEqual(['swagger-one', 'swagger-two']);
    });
  });
});