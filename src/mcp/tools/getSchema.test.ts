import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSchema } from './getSchema';
import { SwaggerManager } from '../../core/SwaggerManager';
import { TestEnvironment, TestSwagger, mockProcessCwd } from '../../test/utils/testHelper';

describe('getSchema', () => {
  let testEnv: TestEnvironment;
  let swaggerManager: SwaggerManager;
  let restoreCwd: () => void;

  beforeEach(async () => {
    // 清理之前的環境
    if (testEnv) {
      await testEnv.cleanup();
    }
    if (restoreCwd) {
      restoreCwd();
    }

    testEnv = new TestEnvironment();

    // 創建測試 swagger
    const testSwagger: TestSwagger = {
      name: 'test-swagger',
      fileName: 'test-swagger.json',
      swaggerContent: {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            description: 'User entity',
            properties: {
              id: { type: 'number', description: 'User ID' },
              name: { type: 'string', description: 'User name' },
              profile: { $ref: '#/components/schemas/Profile' },
            },
            required: ['id', 'name'],
          },
          Profile: {
            type: 'object',
            description: 'User profile',
            properties: {
              bio: { type: 'string', description: 'Biography' },
              avatar: { type: 'string', format: 'uri', description: 'Avatar URL' },
              settings: { $ref: '#/components/schemas/Settings' },
            },
          },
          Settings: {
            type: 'object',
            description: 'User settings',
            properties: {
              theme: { type: 'string', enum: ['light', 'dark'], default: 'light' },
              notifications: { type: 'boolean', default: true },
            },
          },
          CircularA: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              b: { $ref: '#/components/schemas/CircularB' },
            },
          },
          CircularB: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              a: { $ref: '#/components/schemas/CircularA' },
            },
          },
        },
      },
      },
    };

    const tempDir = await testEnv.setupSwaggers([testSwagger]);

    // Mock process.cwd 到測試目錄
    restoreCwd = mockProcessCwd(tempDir);

    swaggerManager = new SwaggerManager();
  });

  afterEach(async () => {
    if (restoreCwd) {
      restoreCwd();
    }
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe('基本功能', () => {
    it('應該能獲取簡單的 schema', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
          schemaName: 'Settings',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.schema.type).toBe('object');
      expect(result.schema.description).toBe('User settings');
      expect(result.schema.properties.theme.enum).toEqual(['light', 'dark']);
      expect(result.dependencies).toEqual(['Settings']);
      expect(result.circularReferences).toEqual([]);
    });

    it('應該能獲取包含引用的 schema', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
          schemaName: 'User',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.schema.type).toBe('object');
      expect(result.schema.properties.profile.type).toBe('object');
      expect(result.schema.properties.profile.properties.settings.type).toBe('object');
      expect(result.dependencies).toEqual(['User', 'Profile', 'Settings']);
    });

    it('應該能檢測循環引用', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
          schemaName: 'CircularA',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.circularReferences.length).toBeGreaterThan(0);
      expect(result.dependencies).toEqual(['CircularA', 'CircularB']);
    });
  });

  describe('選項參數', () => {
    it('應該遵守 maxDepth 參數', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
          schemaName: 'User',
          maxDepth: 1,
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.schema.properties.profile.type).toBe('object');
      // 在深度 1 時，settings 應該還是 $ref
      expect(result.schema.properties.profile.properties.settings).toEqual({
        $ref: '#/components/schemas/Settings',
      });
      expect(result.dependencies).toEqual(['User', 'Profile', 'Settings']);
    });

    it('應該支援 includeCircular 參數', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
          schemaName: 'CircularA',
          includeCircular: false,
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.dependencies).toEqual(['CircularA', 'CircularB']);
    });
  });

  describe('錯誤處理', () => {
    it('應該處理不存在的 swagger ', async () => {
      const result = await getSchema(
        {
          swaggerName: 'non-existent',
          schemaName: 'User',
        },
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Swagger "non-existent" not found');
    });

    it('應該處理不存在的 schema', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
          schemaName: 'NonExistent',
        },
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Schema "NonExistent" not found');
    });

    it('應該處理缺少的必需參數', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
        } as any,
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('schemaName');
    });

    it('應該處理無效的 maxDepth', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
          schemaName: 'User',
          maxDepth: -1,
        },
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('maxDepth must be >= 0');
    });
  });

  describe('輸出格式', () => {
    it('應該返回完整的解析結果', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
          schemaName: 'Profile',
        },
        swaggerManager,
      );

      expect(result).toMatchObject({
        success: true,
        swaggerName: 'test-swagger',
        schemaName: 'Profile',
        schema: expect.any(Object),
        dependencies: expect.any(Array),
        circularReferences: expect.any(Array),
        metadata: {
          totalDependencies: expect.any(Number),
          hasCircularReferences: expect.any(Boolean),
          resolvedAt: expect.any(String),
        },
      });
    });

    it('應該包含 schema 統計資訊', async () => {
      const result = await getSchema(
        {
          swaggerName: 'test-swagger',
          schemaName: 'User',
        },
        swaggerManager,
      );

      expect(result.metadata?.totalDependencies).toBe(3); // User, Profile, Settings
      expect(result.metadata?.hasCircularReferences).toBe(false);
      expect(new Date(result.metadata?.resolvedAt || '')).toBeInstanceOf(Date);
    });
  });
});
