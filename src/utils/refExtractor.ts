/**
 * 遞迴搜尋 $ref 工具
 * 用於在任意 JSON 物件中找出所有的 $ref 引用
 */

export interface RefInfo {
  $ref: string;
  path: string[]; // 到達此 $ref 的路徑
}

/**
 * 在物件中遞迴搜尋所有 $ref 引用
 * @param obj 要搜尋的物件
 * @param maxDepth 最大搜尋深度，防止循環引用
 * @param currentPath 目前路徑（內部使用）
 * @returns 找到的所有 $ref 資訊
 */
export function extractRefs(
  obj: any, 
  maxDepth: number = 10, 
  currentPath: string[] = []
): RefInfo[] {
  const refs: RefInfo[] = [];
  
  if (currentPath.length >= maxDepth) {
    return refs;
  }
  
  if (!obj || typeof obj !== 'object') {
    return refs;
  }
  
  // 如果當前物件有 $ref，記錄它
  if (typeof obj.$ref === 'string') {
    refs.push({
      $ref: obj.$ref,
      path: [...currentPath]
    });
  }
  
  // 遞迴搜尋所有屬性
  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref') {
      // 跳過 $ref 屬性本身，因為已經在上面處理了
      continue;
    }
    
    const childRefs = extractRefs(value, maxDepth, [...currentPath, key]);
    refs.push(...childRefs);
  }
  
  return refs;
}

/**
 * 提取第一個找到的 $ref
 * @param obj 要搜尋的物件
 * @param maxDepth 最大搜尋深度
 * @returns 第一個找到的 $ref，如果沒有則返回 null
 */
export function extractFirstRef(obj: any, maxDepth: number = 10): string | null {
  const refs = extractRefs(obj, maxDepth);
  return refs.length > 0 ? refs[0].$ref : null;
}

/**
 * 檢查物件是否包含任何 $ref 引用
 * @param obj 要檢查的物件
 * @param maxDepth 最大搜尋深度
 * @returns 是否包含 $ref
 */
export function hasRefs(obj: any, maxDepth: number = 10): boolean {
  return extractRefs(obj, maxDepth).length > 0;
}

// 移除專門的 request/response 函數，使用通用的 extractFirstRef