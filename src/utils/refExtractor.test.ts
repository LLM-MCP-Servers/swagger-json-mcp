import { describe, it, expect } from 'vitest';
import { extractRefs, extractFirstRef, hasRefs } from './refExtractor';

describe('refExtractor', () => {
  describe('extractRefs', () => {
    it('應該能找到簡單的 $ref', () => {
      const obj = {
        $ref: '#/components/schemas/User'
      };
      
      const refs = extractRefs(obj);
      expect(refs).toHaveLength(1);
      expect(refs[0].$ref).toBe('#/components/schemas/User');
      expect(refs[0].path).toEqual([]);
    });

    it('應該能找到嵌套的 $ref', () => {
      const obj = {
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/LoginRequest'
            }
          }
        }
      };
      
      const refs = extractRefs(obj);
      expect(refs).toHaveLength(1);
      expect(refs[0].$ref).toBe('#/components/schemas/LoginRequest');
      expect(refs[0].path).toEqual(['content', 'application/json', 'schema']);
    });

    it('應該能找到多個 $ref', () => {
      const obj = {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateUserRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserResponse'
                }
              }
            }
          },
          '400': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      };
      
      const refs = extractRefs(obj);
      expect(refs).toHaveLength(3);
      expect(refs.map(r => r.$ref)).toContain('#/components/schemas/CreateUserRequest');
      expect(refs.map(r => r.$ref)).toContain('#/components/schemas/UserResponse');
      expect(refs.map(r => r.$ref)).toContain('#/components/schemas/ErrorResponse');
    });

    it('應該能處理 Swagger 2.x 格式', () => {
      const obj = {
        schema: {
          $ref: '#/definitions/PatientInfoDTO'
        }
      };
      
      const refs = extractRefs(obj);
      expect(refs).toHaveLength(1);
      expect(refs[0].$ref).toBe('#/definitions/PatientInfoDTO');
      expect(refs[0].path).toEqual(['schema']);
    });

    it('應該處理沒有 $ref 的情況', () => {
      const obj = {
        type: 'object',
        properties: {
          name: {
            type: 'string'
          }
        }
      };
      
      const refs = extractRefs(obj);
      expect(refs).toHaveLength(0);
    });

    it('應該處理空物件', () => {
      const refs = extractRefs({});
      expect(refs).toHaveLength(0);
    });

    it('應該處理 null 和 undefined', () => {
      expect(extractRefs(null)).toHaveLength(0);
      expect(extractRefs(undefined)).toHaveLength(0);
    });

    it('應該遵守最大深度限制', () => {
      const deepObj = {
        level1: {
          level2: {
            level3: {
              schema: {
                $ref: '#/components/schemas/DeepSchema'
              }
            }
          }
        }
      };
      
      // 限制深度為 3，應該找不到 $ref
      const refs = extractRefs(deepObj, 3);
      expect(refs).toHaveLength(0);
      
      // 增加深度限制，應該能找到
      const refsWithHigherLimit = extractRefs(deepObj, 5);
      expect(refsWithHigherLimit).toHaveLength(1);
      expect(refsWithHigherLimit[0].$ref).toBe('#/components/schemas/DeepSchema');
    });
  });

  describe('extractFirstRef', () => {
    it('應該返回第一個找到的 $ref', () => {
      const obj = {
        first: {
          schema: {
            $ref: '#/components/schemas/First'
          }
        },
        second: {
          schema: {
            $ref: '#/components/schemas/Second'
          }
        }
      };
      
      const ref = extractFirstRef(obj);
      // 順序可能因為 Object.entries 而不確定，但應該是其中一個
      expect(['#/components/schemas/First', '#/components/schemas/Second']).toContain(ref);
    });

    it('應該在沒有 $ref 時返回 null', () => {
      const obj = {
        type: 'object',
        properties: {}
      };
      
      const ref = extractFirstRef(obj);
      expect(ref).toBeNull();
    });
  });

  describe('hasRefs', () => {
    it('應該在有 $ref 時返回 true', () => {
      const obj = {
        schema: {
          $ref: '#/components/schemas/Test'
        }
      };
      
      expect(hasRefs(obj)).toBe(true);
    });

    it('應該在沒有 $ref 時返回 false', () => {
      const obj = {
        type: 'string'
      };
      
      expect(hasRefs(obj)).toBe(false);
    });
  });
});