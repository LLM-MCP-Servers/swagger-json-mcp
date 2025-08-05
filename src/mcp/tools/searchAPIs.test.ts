import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { searchAPIs } from './searchAPIs';
import { SwaggerManager } from '../../core/SwaggerManager';
import { TestEnvironment, TestSwagger, mockProcessCwd } from '../../test/utils/testHelper';

describe('searchAPIs', () => {
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
      paths: {
        '/auth/login': {
          post: {
            tags: ['Authentication'],
            summary: '用戶登入',
            description: '用戶登入系統獲取認證令牌',
            operationId: 'auth.login',
            responses: { '200': { description: '登入成功' } },
          },
        },
        '/auth/logout': {
          post: {
            tags: ['Authentication'],
            summary: '用戶登出',
            description: '用戶登出系統清除令牌',
            operationId: 'auth.logout',
            responses: { '200': { description: '登出成功' } },
          },
        },
        '/users': {
          get: {
            tags: ['Users'],
            summary: '獲取用戶列表',
            description: '獲取系統中所有用戶的列表',
            operationId: 'users.index',
            responses: { '200': { description: '成功' } },
          },
          post: {
            tags: ['Users'],
            summary: '創建新用戶',
            description: '在系統中創建一個新的用戶',
            operationId: 'users.store',
            responses: { '201': { description: '創建成功' } },
          },
        },
        '/users/{id}': {
          get: {
            tags: ['Users'],
            summary: '獲取用戶詳情',
            description: '根據ID獲取特定用戶的詳細資訊',
            operationId: 'users.show',
            responses: { '200': { description: '成功' } },
          },
          put: {
            tags: ['Users'],
            summary: '更新用戶',
            description: '更新指定用戶的資訊',
            operationId: 'users.update',
            responses: { '200': { description: '更新成功' } },
          },
          delete: {
            tags: ['Users'],
            summary: '刪除用戶',
            description: '從系統中刪除指定用戶',
            operationId: 'users.destroy',
            responses: { '204': { description: '刪除成功' } },
          },
        },
        '/products': {
          get: {
            tags: ['Products'],
            summary: '獲取產品列表',
            description: '獲取所有可用產品的列表',
            operationId: 'products.index',
            responses: { '200': { description: '成功' } },
          },
        },
      },
      components: { schemas: {} },
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
    it('應該能搜索到包含關鍵字的 API', async () => {
      const result = await searchAPIs({ query: '登入' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);

      const loginApi = result.results.find(
        (api) => api.path === '/auth/login' && api.method === 'post',
      );
      expect(loginApi).toBeDefined();
      expect(loginApi?.summary).toContain('登入');
      expect(loginApi?.score).toBeGreaterThan(0);
    });

    it('應該能搜索到多個相關的 API', async () => {
      const result = await searchAPIs({ query: 'users' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(1);

      const userApis = result.results.filter(
        (api) => api.path.includes('users') || api.tags?.includes('Users'),
      );
      expect(userApis.length).toBeGreaterThan(1);
    });

    it('應該按相關性排序結果', async () => {
      const result = await searchAPIs({ query: '用戶' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(1);

      // 檢查分數遞減排序
      for (let i = 0; i < result.results.length - 1; i++) {
        expect(result.results[i].score).toBeGreaterThanOrEqual(result.results[i + 1].score);
      }
    });
  });

  describe('過濾條件', () => {
    it('應該能按 HTTP 方法過濾', async () => {
      const result = await searchAPIs({ query: 'users', method: 'get' }, swaggerManager);

      expect(result.success).toBe(true);
      result.results.forEach((api) => {
        expect(api.method).toBe('get');
      });
    });

    it('應該能按標籤過濾', async () => {
      const result = await searchAPIs({ query: 'API', tag: 'Authentication' }, swaggerManager);

      expect(result.success).toBe(true);
      result.results.forEach((api) => {
        expect(api.tags).toContain('Authentication');
      });
    });

    it('應該能限制結果數量', async () => {
      const result = await searchAPIs({ query: 'API', limit: 2 }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('應該能按 swagger 名稱過濾', async () => {
      const result = await searchAPIs(
        { query: 'users', swaggerName: 'test-swagger' },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      result.results.forEach((api) => {
        expect(api.swaggerName).toBe('test-swagger');
      });
    });
  });

  describe('錯誤處理', () => {
    it('應該處理不存在的 swagger ', async () => {
      const result = await searchAPIs(
        { query: 'test', swaggerName: 'non-existent' },
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Swagger "non-existent" not found');
    });

    it('應該處理空的查詢字串錯誤', async () => {
      const result = await searchAPIs({ query: '' }, swaggerManager);

      expect(result.success).toBe(false);
      expect(result.error).toContain('query is required');
    });

    it('應該處理無效的 limit 參數', async () => {
      const result = await searchAPIs({ query: 'test', limit: 0 }, swaggerManager);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('搜索準確性', () => {
    it('應該能搜索 operationId', async () => {
      const result = await searchAPIs({ query: 'auth.login' }, swaggerManager);

      expect(result.success).toBe(true);
      const loginApi = result.results.find((api) => api.operationId === 'auth.login');
      expect(loginApi).toBeDefined();
    });

    it('應該能搜索路徑', async () => {
      const result = await searchAPIs({ query: '/auth/login' }, swaggerManager);

      expect(result.success).toBe(true);
      const loginApi = result.results.find((api) => api.path === '/auth/login');
      expect(loginApi).toBeDefined();
    });

    it('應該能搜索描述內容', async () => {
      const result = await searchAPIs({ query: '認證令牌' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  describe('metadata 資訊', () => {
    it('應該包含完整的 metadata', async () => {
      const result = await searchAPIs({ query: 'users' }, swaggerManager);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.totalResults).toBe(result.results.length);
      expect(result.metadata?.searchTime).toBeGreaterThan(0);
      expect(result.metadata?.swaggersSearched).toContain('test-swagger');
    });
  });
});
