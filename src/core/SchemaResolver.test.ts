import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaResolver } from './SchemaResolver';

describe('SchemaResolver', () => {
  let resolver: SchemaResolver;

  beforeEach(async () => {
    // 創建測試用的 swagger 文件
    const swaggerDoc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              profile: { $ref: '#/components/schemas/Profile' },
            },
          },
          Profile: {
            type: 'object',
            properties: {
              bio: { type: 'string' },
              avatar: { type: 'string' },
              settings: { $ref: '#/components/schemas/Settings' },
            },
          },
          Settings: {
            type: 'object',
            properties: {
              theme: { type: 'string' },
              notifications: { type: 'boolean' },
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
    };

    resolver = new SchemaResolver(swaggerDoc);
  });

  describe('resolveSchema', () => {
    it('應該能解析簡單的 schema 引用', () => {
      const result = resolver.resolveSchema('Settings');

      expect(result.success).toBe(true);
      expect(result.schema).toEqual({
        type: 'object',
        properties: {
          theme: { type: 'string' },
          notifications: { type: 'boolean' },
        },
      });
      expect(result.dependencies).toEqual(['Settings']);
    });

    it('應該能遞歸解析嵌套的 schema 引用', () => {
      const result = resolver.resolveSchema('User', { maxDepth: 5 });

      expect(result.success).toBe(true);
      expect(result.schema.type).toBe('object');
      expect(result.schema.properties.profile.type).toBe('object');
      expect(result.schema.properties.profile.properties.settings.type).toBe('object');
      expect(result.dependencies).toEqual(['User', 'Profile', 'Settings']);
    });

    it('應該能檢測循環引用', () => {
      const result = resolver.resolveSchema('CircularA');

      expect(result.success).toBe(true);
      expect(result.circularReferences.length).toBeGreaterThan(0);
      expect(result.dependencies).toEqual(['CircularA', 'CircularB']);
    });

    it('應該遵守最大深度限制', () => {
      const result = resolver.resolveSchema('User', { maxDepth: 0 });

      expect(result.success).toBe(true);
      // 在深度 0 時，profile 應該還是 $ref
      expect(result.schema.properties.profile).toEqual({ $ref: '#/components/schemas/Profile' });
      expect(result.dependencies).toEqual(['User', 'Profile']);
    });

    it('應該快取解析結果', () => {
      const result1 = resolver.resolveSchema('Settings');
      const result2 = resolver.resolveSchema('Settings');

      expect(result1.schema).toEqual(result2.schema);
      expect(result1.dependencies).toEqual(result2.dependencies);
    });

    it('應該處理不存在的 schema', () => {
      const result = resolver.resolveSchema('NonExistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Schema "NonExistent" not found');
    });

    it('應該處理不存在的 $ref 引用', () => {
      const invalidDoc = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            Invalid: {
              type: 'object',
              properties: {
                ref: { $ref: '#/components/schemas/NonExistentSchema' },
              },
            },
          },
        },
      };

      const invalidResolver = new SchemaResolver(invalidDoc);
      const result = invalidResolver.resolveSchema('Invalid');

      expect(result.success).toBe(true);
      expect(result.schema.properties.ref).toEqual({
        $ref: '#/components/schemas/NonExistentSchema',
        $unresolved: true,
        $error: 'Reference not found: #/components/schemas/NonExistentSchema',
      });
    });
  });

  describe('resolveRef', () => {
    it('應該能解析有效的 $ref 路徑', () => {
      const result = resolver.resolveRef('#/components/schemas/Settings');

      expect(result).toEqual({
        type: 'object',
        properties: {
          theme: { type: 'string' },
          notifications: { type: 'boolean' },
        },
      });
    });

    it('應該處理無效的 $ref 格式', () => {
      expect(() => resolver.resolveRef('invalid-ref')).toThrow('Invalid $ref format');
    });

    it('應該處理不存在的 $ref 路徑', () => {
      const result = resolver.resolveRef('#/components/schemas/NonExistent');
      expect(result).toEqual({
        $ref: '#/components/schemas/NonExistent',
        $unresolved: true,
        $error: 'Reference not found: #/components/schemas/NonExistent',
      });
    });
  });

  describe('getDependencies', () => {
    it('應該返回 schema 的所有依賴', () => {
      const dependencies = resolver.getDependencies('User');

      expect(dependencies).toEqual(['Profile', 'Settings']);
    });

    it('應該處理無依賴的 schema', () => {
      const dependencies = resolver.getDependencies('Settings');

      expect(dependencies).toEqual([]);
    });

    it('應該處理不存在的 schema', () => {
      const dependencies = resolver.getDependencies('NonExistent');

      expect(dependencies).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('應該清除解析快取', () => {
      // 先解析一次建立快取
      resolver.resolveSchema('Settings');

      // 修改 schema
      const modifiedDoc = { ...resolver['document'] };
      modifiedDoc.components!.schemas!.Settings.properties!.newField = { type: 'string' };

      // 清除快取並重新創建 resolver
      resolver = new SchemaResolver(modifiedDoc);
      const result = resolver.resolveSchema('Settings');

      expect(result.schema.properties.newField).toEqual({ type: 'string' });
    });
  });
});
