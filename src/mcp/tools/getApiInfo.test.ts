import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getApiInfo } from './getApiInfo';
import { SwaggerManager } from '../../core/SwaggerManager';
import { TestEnvironment, TestSwagger, mockProcessCwd } from '../../test/utils/testHelper';

describe('getApiInfo', () => {
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
        '/login': {
          post: {
            tags: ['Authentication'],
            summary: '用戶登入',
            description: '用戶登入系統',
            operationId: 'auth.login',
            parameters: [
              {
                name: 'X-Client-Version',
                in: 'header',
                description: '客戶端版本',
                required: false,
                schema: { type: 'string' },
              },
            ],
            requestBody: {
              description: '登入請求',
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: '登入成功',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/LoginResponse' },
                  },
                },
              },
              '400': {
                description: '請求錯誤',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                  },
                },
              },
              '401': {
                description: '認證失敗',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/ErrorResponse' },
                  },
                },
              },
            },
          },
        },
        '/users/{userId}': {
          get: {
            tags: ['Users'],
            summary: '獲取用戶資訊',
            operationId: 'users.getById',
            parameters: [
              {
                name: 'userId',
                in: 'path',
                description: '用戶ID',
                required: true,
                schema: { type: 'integer' },
              },
            ],
            responses: {
              '200': {
                description: '用戶資訊',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          put: {
            tags: ['Users'],
            summary: '更新用戶資訊',
            operationId: 'users.update',
            parameters: [
              {
                name: 'userId',
                in: 'path',
                description: '用戶ID',
                required: true,
                schema: { type: 'integer' },
              },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UserUpdateRequest' },
                },
              },
            },
            responses: {
              '200': {
                description: '更新成功',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          LoginRequest: {
            type: 'object',
            description: '登入請求',
            properties: {
              username: { type: 'string', description: '用戶名' },
              password: { type: 'string', description: '密碼' },
            },
            required: ['username', 'password'],
          },
          LoginResponse: {
            type: 'object',
            description: '登入回應',
            properties: {
              token: { type: 'string', description: 'JWT Token' },
              user: { $ref: '#/components/schemas/User' },
              expires: { type: 'number', description: '過期時間戳' },
            },
            required: ['token', 'user'],
          },
          User: {
            type: 'object',
            description: '用戶資訊',
            properties: {
              id: { type: 'integer', description: '用戶ID' },
              username: { type: 'string', description: '用戶名' },
              email: { type: 'string', format: 'email', description: '電子郵件' },
              profile: { $ref: '#/components/schemas/UserProfile' },
            },
            required: ['id', 'username', 'email'],
          },
          UserProfile: {
            type: 'object',
            description: '用戶檔案',
            properties: {
              firstName: { type: 'string', description: '名字' },
              lastName: { type: 'string', description: '姓氏' },
              avatar: { type: 'string', format: 'uri', description: '頭像URL' },
            },
          },
          UserUpdateRequest: {
            type: 'object',
            description: '用戶更新請求',
            properties: {
              email: { type: 'string', format: 'email' },
              profile: { $ref: '#/components/schemas/UserProfile' },
            },
          },
          ErrorResponse: {
            type: 'object',
            description: '錯誤回應',
            properties: {
              error: { type: 'string', description: '錯誤代碼' },
              message: { type: 'string', description: '錯誤訊息' },
              details: { type: 'object', description: '錯誤詳情' },
            },
            required: ['error', 'message'],
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
    it('應該能獲取有效 API 的完整資訊', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/login',
          method: 'post',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.swaggerName).toBe('test-swagger');
      expect(result.path).toBe('/login');
      expect(result.method).toBe('post');

      // 驗證 operation 資訊
      expect(result.operation?.summary).toBe('用戶登入');
      expect(result.operation?.tags).toContain('Authentication');
      expect(result.operation?.operationId).toBe('auth.login');
      expect(result.operation?.description).toBe('用戶登入系統');
    });

    it('應該能解析 requestBody schema', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/login',
          method: 'post',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.requestBodySchema).toBeDefined();
      expect(result.requestBodySchema?.type).toBe('object');
      expect(result.requestBodySchema?.description).toBe('登入請求');
      expect(result.requestBodySchema?.properties?.username?.type).toBe('string');
      expect(result.requestBodySchema?.properties?.password?.type).toBe('string');
      expect(result.requestBodySchema?.required).toEqual(['username', 'password']);
    });

    it('應該能解析 response schemas', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/login',
          method: 'post',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.responseSchemas).toBeDefined();
      expect(Object.keys(result.responseSchemas).length).toBe(3); // 200, 400, 401

      // 檢查 200 response
      const response200 = result.responseSchemas['200'];
      expect(response200).toBeDefined();
      expect(response200.description).toBe('登入成功');
      expect(response200.schema?.type).toBe('object');
      expect(response200.schema?.properties?.token?.type).toBe('string');
      expect(response200.schema?.properties?.user?.type).toBe('object'); // 應該已解析 User schema
    });

    it('應該能包含參數資訊', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/users/{userId}',
          method: 'get',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.parameters).toBeDefined();
      expect(result.parameters.length).toBe(1);
      expect(result.parameters[0].name).toBe('userId');
      expect(result.parameters[0].in).toBe('path');
      expect(result.parameters[0].required).toBe(true);
      expect(result.parameters[0].schema?.type).toBe('integer');
    });

    it('應該正確處理大小寫不敏感的 method', async () => {
      const result1 = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/login',
          method: 'POST',
        },
        swaggerManager,
      );

      const result2 = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/login',
          method: 'post',
        },
        swaggerManager,
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.method).toBe('post');
      expect(result2.method).toBe('post');
      expect(result1.operation?.summary).toBe(result2.operation?.summary);
    });
  });

  describe('Schema 解析深度測試', () => {
    it('應該遞歸解析巢狀的 $ref 引用', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/login',
          method: 'post',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);

      // 檢查 LoginResponse 中的 User schema 是否完全解析
      const response200 = result.responseSchemas['200'].schema;
      expect(response200.properties?.user?.type).toBe('object');
      expect(response200.properties?.user?.properties?.profile?.type).toBe('object');
      expect(response200.properties?.user?.properties?.profile?.properties?.firstName?.type).toBe(
        'string',
      );
    });

    it('應該能檢測並處理沒有未解析的 $ref', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/users/{userId}',
          method: 'put',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);

      // 檢查 schema 是否完全解析，沒有未解析的 $ref
      const checkNoUnresolvedRefs = (obj: any): boolean => {
        if (typeof obj !== 'object' || obj === null) return true;

        if ('$ref' in obj && typeof obj.$ref === 'string') {
          return false; // 發現未解析的 $ref
        }

        return Object.values(obj).every(checkNoUnresolvedRefs);
      };

      if (result.requestBodySchema) {
        expect(checkNoUnresolvedRefs(result.requestBodySchema)).toBe(true);
      }

      Object.values(result.responseSchemas).forEach((schema) => {
        expect(checkNoUnresolvedRefs(schema)).toBe(true);
      });
    });
  });

  describe('錯誤處理', () => {
    it('應該處理不存在的 swagger ', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'non-existent',
          path: '/login',
          method: 'post',
        },
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Swagger "non-existent" not found');
    });

    it('應該處理不存在的 API path', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/non-existent-path',
          method: 'post',
        },
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('API "POST /non-existent-path" not found');
    });

    it('應該處理不存在的 HTTP method', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/login',
          method: 'delete',
        },
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('API "DELETE /login" not found');
    });

    it('應該處理缺少的必需參數', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/login',
        } as any,
        swaggerManager,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('method');
    });
  });

  describe('輸出格式', () => {
    it('應該返回完整的解析結果', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/login',
          method: 'post',
        },
        swaggerManager,
      );

      expect(result).toMatchObject({
        success: true,
        swaggerName: 'test-swagger',
        path: '/login',
        method: 'post',
        operation: expect.any(Object),
        parameters: expect.any(Array),
        requestBodySchema: expect.any(Object),
        responseSchemas: expect.any(Object),
        metadata: {
          hasRequestBody: true,
          responseCount: 3,
          parameterCount: 1,
          resolvedAt: expect.any(String),
        },
      });
    });

    it('應該包含正確的統計資訊', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'test-swagger',
          path: '/users/{userId}',
          method: 'get',
        },
        swaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.hasRequestBody).toBe(false);
      expect(result.metadata?.responseCount).toBe(1);
      expect(result.metadata?.parameterCount).toBe(1);
      expect(new Date(result.metadata?.resolvedAt || '')).toBeInstanceOf(Date);
    });
  });

  describe('Swagger 2.x 格式相容性測試', () => {
    let swagger2SwaggerManager: SwaggerManager;
    let swagger2TestEnv: TestEnvironment;
    let swagger2RestoreCwd: () => void;

    beforeEach(async () => {
      // 清理之前的環境
      if (swagger2TestEnv) {
        await swagger2TestEnv.cleanup();
      }
      if (swagger2RestoreCwd) {
        swagger2RestoreCwd();
      }

      // 建立 Swagger 2.x 測試環境
      swagger2TestEnv = new TestEnvironment();

      // 建立 Swagger 2.x 格式的測試文檔
      const swagger2Doc = {
        swagger: '2.0',
        info: { title: 'Swagger 2.x Test API', version: '1.0.0' },
        paths: {
          '/api/patient': {
            get: {
              operationId: 'getPatient',
              summary: '獲取病患資訊',
              responses: {
                '200': {
                  description: '成功',
                  schema: {
                    $ref: '#/definitions/PatientInfoDTO',
                  },
                },
                '400': {
                  description: '錯誤',
                  schema: {
                    $ref: '#/definitions/ErrorResponse',
                  },
                },
              },
            },
            post: {
              operationId: 'createPatient',
              summary: '建立病患',
              parameters: [
                {
                  name: 'body',
                  in: 'body',
                  required: true,
                  schema: {
                    $ref: '#/definitions/CreatePatientRequest',
                  },
                },
              ],
              responses: {
                '201': {
                  description: '建立成功',
                  schema: {
                    $ref: '#/definitions/PatientInfoDTO',
                  },
                },
              },
            },
          },
        },
        definitions: {
          PatientInfoDTO: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              age: { type: 'integer' },
              profile: {
                $ref: '#/definitions/PatientProfile',
              },
            },
          },
          PatientProfile: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              phone: { type: 'string' },
            },
          },
          CreatePatientRequest: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'integer' },
            },
            required: ['name', 'age'],
          },
          ErrorResponse: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'integer' },
            },
          },
        },
      };

      const tempDir = await swagger2TestEnv.setupSwaggers([
        {
          name: 'swagger2-swagger',
          fileName: 'swagger2-swagger.json',
          swaggerContent: swagger2Doc,
        },
      ]);
      swagger2RestoreCwd = mockProcessCwd(tempDir);
      swagger2SwaggerManager = new SwaggerManager();
    });

    afterEach(async () => {
      if (swagger2TestEnv) {
        await swagger2TestEnv.cleanup();
      }
      if (swagger2RestoreCwd) {
        swagger2RestoreCwd();
      }
    });

    it('應該能解析 Swagger 2.x 格式的 response schema', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'swagger2-swagger',
          path: '/api/patient',
          method: 'get',
        },
        swagger2SwaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.responseSchemas['200']).toBeDefined();
      expect(result.responseSchemas['400']).toBeDefined();

      // 檢查 PatientInfoDTO schema 是否正確解析
      const patientSchema = result.responseSchemas['200'].schema;
      expect(patientSchema?.type).toBe('object');
      expect(patientSchema?.properties?.id?.type).toBe('string');
      expect(patientSchema?.properties?.name?.type).toBe('string');
      expect(patientSchema?.properties?.age?.type).toBe('integer');

      // 檢查巢狀的 $ref 是否正確解析
      expect(patientSchema?.properties?.profile?.type).toBe('object');
      expect(patientSchema?.properties?.profile?.properties?.address?.type).toBe('string');
      expect(patientSchema?.properties?.profile?.properties?.phone?.type).toBe('string');
    });

    it('應該能解析 Swagger 2.x 格式的 request body schema', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'swagger2-swagger',
          path: '/api/patient',
          method: 'post',
        },
        swagger2SwaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.requestBodySchema).toBeDefined();

      // 檢查 CreatePatientRequest schema
      const requestSchema = result.requestBodySchema;
      expect(requestSchema?.type).toBe('object');
      expect(requestSchema?.properties?.name?.type).toBe('string');
      expect(requestSchema?.properties?.age?.type).toBe('integer');
      expect(requestSchema?.required).toEqual(['name', 'age']);
    });

    it('應該正確計算 Swagger 2.x 格式的統計資訊', async () => {
      const result = await getApiInfo(
        {
          swaggerName: 'swagger2-swagger',
          path: '/api/patient',
          method: 'post',
        },
        swagger2SwaggerManager,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.hasRequestBody).toBe(true);
      expect(result.metadata?.responseCount).toBe(1); // 只有 201 response
      expect(result.metadata?.parameterCount).toBe(1); // body parameter
    });

    it('應該能處理混合的 reference 和 inline schema', async () => {
      // 創建一個混合格式的測試
      const mixedDoc = {
        swagger: '2.0',
        info: { title: 'Mixed Format API', version: '1.0.0' },
        paths: {
          '/mixed': {
            post: {
              parameters: [
                {
                  name: 'body',
                  in: 'body',
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        $ref: '#/definitions/SimpleData',
                      },
                      metadata: {
                        type: 'object',
                        properties: {
                          timestamp: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              ],
              responses: {
                '200': {
                  description: 'Success with inline schema',
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                    },
                  },
                },
                '400': {
                  description: 'Error with reference',
                  schema: {
                    $ref: '#/definitions/ErrorResponse',
                  },
                },
              },
            },
          },
        },
        definitions: {
          SimpleData: {
            type: 'object',
            properties: {
              value: { type: 'string' },
            },
          },
          ErrorResponse: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      };

      const mixedTestEnv = new TestEnvironment();
      const mixedTempDir = await mixedTestEnv.setupSwaggers([
        {
          name: 'mixed-swagger',
          fileName: 'mixed-swagger.json',
          swaggerContent: mixedDoc,
        },
      ]);
      const mixedRestoreCwd = mockProcessCwd(mixedTempDir);
      const mixedSwaggerManager = new SwaggerManager();

      try {
        const result = await getApiInfo(
          {
            swaggerName: 'mixed-swagger',
            path: '/mixed',
            method: 'post',
          },
          mixedSwaggerManager,
        );

        expect(result.success).toBe(true);

        // 檢查 request body 中的 reference 是否解析
        expect(result.requestBodySchema?.properties?.data?.type).toBe('object');
        expect(result.requestBodySchema?.properties?.data?.properties?.value?.type).toBe('string');

        // 檢查 inline schema 是否正確處理
        expect(result.requestBodySchema?.properties?.metadata?.type).toBe('object');
        expect(result.requestBodySchema?.properties?.metadata?.properties?.timestamp?.type).toBe(
          'string',
        );

        // 檢查 response 的混合處理
        expect(result.responseSchemas['200']?.schema?.properties?.success?.type).toBe('boolean');
        expect(result.responseSchemas['400']?.schema?.properties?.error?.type).toBe('string');
      } finally {
        await mixedTestEnv.cleanup();
        mixedRestoreCwd();
      }
    });
  });
});
