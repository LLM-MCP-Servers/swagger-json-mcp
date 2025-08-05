import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { searchSchemas } from './searchSchemas';
import { SwaggerManager } from '../../core/SwaggerManager';
import { TestEnvironment, TestSwagger, mockProcessCwd } from '../../test/utils/testHelper';

describe('searchSchemas', () => {
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
            description: '用戶實體，包含基本的用戶資訊',
            properties: {
              id: { type: 'number', description: '用戶唯一標識符' },
              name: { type: 'string', description: '用戶姓名' },
              email: { type: 'string', format: 'email', description: '用戶電子郵件地址' },
              profile: { $ref: '#/components/schemas/Profile' },
              createdAt: { type: 'string', format: 'date-time', description: '創建時間' },
            },
            required: ['id', 'name', 'email'],
          },
          Profile: {
            type: 'object',
            description: '用戶檔案資訊',
            properties: {
              bio: { type: 'string', description: '個人簡介' },
              avatar: { type: 'string', format: 'uri', description: '頭像 URL' },
              website: { type: 'string', format: 'uri', description: '個人網站' },
              location: { type: 'string', description: '所在地區' },
            },
          },
          LoginRequest: {
            type: 'object',
            description: '登入請求參數',
            properties: {
              username: { type: 'string', description: '用戶名或電子郵件' },
              password: { type: 'string', description: '密碼' },
              rememberMe: { type: 'boolean', description: '記住我', default: false },
            },
            required: ['username', 'password'],
          },
          LoginResponse: {
            type: 'object',
            description: '登入回應資料',
            properties: {
              token: { type: 'string', description: 'JWT 認證令牌' },
              user: { $ref: '#/components/schemas/User' },
              expiresIn: { type: 'number', description: '令牌過期時間（秒）' },
            },
            required: ['token', 'user'],
          },
          Product: {
            type: 'object',
            description: '產品資訊',
            properties: {
              id: { type: 'number', description: '產品 ID' },
              name: { type: 'string', description: '產品名稱' },
              price: { type: 'number', format: 'float', description: '產品價格' },
              category: { type: 'string', description: '產品分類' },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: '產品標籤',
              },
            },
            required: ['id', 'name', 'price'],
          },
          ApiResponse: {
            type: 'object',
            description: 'API 標準回應格式',
            properties: {
              success: { type: 'boolean', description: '操作是否成功' },
              message: { type: 'string', description: '回應訊息' },
              data: { type: 'object', description: '資料內容' },
              errors: {
                type: 'array',
                items: { type: 'string' },
                description: '錯誤訊息列表',
              },
            },
            required: ['success'],
          },
          ErrorCode: {
            type: 'string',
            description: '系統錯誤代碼',
            enum: ['VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED', 'SERVER_ERROR'],
          },
          Status: {
            type: 'string',
            description: '狀態列舉',
            enum: ['active', 'inactive', 'pending', 'deleted'],
            default: 'active',
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

  describe('基本搜索功能', () => {
    it('應該能搜索到包含關鍵字的 Schema', async () => {
      const result = await searchSchemas({ query: '用戶' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);

      const userSchema = result.results.find((schema) => schema.schemaName === 'User');
      expect(userSchema).toBeDefined();
      expect(userSchema?.description).toContain('用戶');
      expect(userSchema?.score).toBeGreaterThan(0);
    });

    it('應該能搜索到多個相關的 Schema', async () => {
      const result = await searchSchemas({ query: 'Login' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(1);

      const loginSchemas = result.results.filter((schema) => schema.schemaName.includes('Login'));
      expect(loginSchemas.length).toBe(2); // LoginRequest 和 LoginResponse
    });

    it('應該按相關性排序結果', async () => {
      const result = await searchSchemas({ query: 'user' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(1);

      // 檢查分數遞減排序
      for (let i = 0; i < result.results.length - 1; i++) {
        expect(result.results[i].score).toBeGreaterThanOrEqual(result.results[i + 1].score);
      }
    });
  });

  describe('過濾條件', () => {
    it('應該能按類型過濾', async () => {
      const result = await searchSchemas({ query: 'schema', type: 'object' }, swaggerManager);

      expect(result.success).toBe(true);
      result.results.forEach((schema) => {
        expect(schema.type).toBe('object');
      });
    });

    it('應該能搜索 string 類型的 schema', async () => {
      const result = await searchSchemas({ query: 'Error', type: 'string' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      result.results.forEach((schema) => {
        expect(schema.type).toBe('string');
      });
    });

    it('應該能限制結果數量', async () => {
      const result = await searchSchemas({ query: 'schema', limit: 3 }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(3);
    });

    it('應該能按 swagger 名稱過濾', async () => {
      const result = await searchSchemas(
        { query: 'user', swaggerName: 'test-swagger' },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      result.results.forEach((schema) => {
        expect(schema.swaggerName).toBe('test-swagger');
      });
    });
  });

  describe('錯誤處理', () => {
    it('應該處理不存在的 swagger ', async () => {
      const result = await searchSchemas(
        { query: 'test', swaggerName: 'non-existent' },
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Swagger "non-existent" not found');
    });

    it('應該處理空的查詢字串錯誤', async () => {
      const result = await searchSchemas({ query: '' }, swaggerManager);

      expect(result.success).toBe(false);
      expect(result.error).toContain('query is required');
    });

    it('應該處理無效的 limit 參數', async () => {
      const result = await searchSchemas({ query: 'test', limit: 0 }, swaggerManager);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('搜索準確性', () => {
    it('應該能搜索 schema 名稱', async () => {
      const result = await searchSchemas({ query: 'User' }, swaggerManager);

      expect(result.success).toBe(true);
      const userSchema = result.results.find((schema) => schema.schemaName === 'User');
      expect(userSchema).toBeDefined();
    });

    it('應該能搜索 schema 描述', async () => {
      const result = await searchSchemas({ query: '認證令牌' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('應該能搜索屬性名稱', async () => {
      const result = await searchSchemas({ query: 'email' }, swaggerManager);

      expect(result.success).toBe(true);
      const userSchema = result.results.find(
        (schema) => schema.schemaName === 'User' && schema.properties?.email,
      );
      expect(userSchema).toBeDefined();
    });

    it('應該能搜索屬性描述', async () => {
      const result = await searchSchemas({ query: '頭像' }, swaggerManager);

      expect(result.success).toBe(true);
      const profileSchema = result.results.find((schema) => schema.schemaName === 'Profile');
      expect(profileSchema).toBeDefined();
    });
  });

  describe('返回的資料結構', () => {
    it('應該包含完整的 schema 資訊', async () => {
      const result = await searchSchemas({ query: 'User' }, swaggerManager);

      expect(result.success).toBe(true);
      const userSchema = result.results.find((schema) => schema.schemaName === 'User');

      expect(userSchema).toBeDefined();
      expect(userSchema?.schemaName).toBe('User');
      expect(userSchema?.swaggerName).toBe('test-swagger');
      expect(userSchema?.type).toBe('object');
      expect(userSchema?.description).toBeDefined();
      expect(userSchema?.properties).toBeDefined();
      expect(userSchema?.required).toEqual(['id', 'name', 'email']);
    });

    it('應該正確處理屬性資訊', async () => {
      const result = await searchSchemas({ query: 'User' }, swaggerManager);

      expect(result.success).toBe(true);
      const userSchema = result.results.find((schema) => schema.schemaName === 'User');

      expect(userSchema?.properties?.id).toBeDefined();
      expect(userSchema?.properties?.id.type).toBe('number');
      expect(userSchema?.properties?.id.description).toBeDefined();

      expect(userSchema?.properties?.email).toBeDefined();
      expect(userSchema?.properties?.email.type).toBe('string');
      expect(userSchema?.properties?.email.format).toBe('email');
    });
  });

  describe('metadata 資訊', () => {
    it('應該包含完整的 metadata', async () => {
      const result = await searchSchemas({ query: 'schema' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.totalResults).toBe(result.results.length);
      expect(result.metadata?.searchTime).toBeGreaterThan(0);
      expect(result.metadata?.swaggersSearched).toContain('test-swagger');
      expect(result.metadata?.typeBreakdown).toBeDefined();
    });

    it('應該正確統計類型分布', async () => {
      const result = await searchSchemas({ query: 'schema' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.metadata?.typeBreakdown).toBeDefined();

      const typeBreakdown = result.metadata!.typeBreakdown;
      expect(typeBreakdown['object']).toBeGreaterThan(0);
      expect(typeBreakdown['string']).toBeGreaterThan(0);
    });
  });
});
