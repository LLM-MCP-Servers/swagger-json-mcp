/**
 * Test helper utilities
 */

import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';


export interface TestSwagger {
  name: string;
  fileName: string;
  swaggerContent: object;
}

/**
 * Create a temporary test environment with mock projects
 */
export class TestEnvironment {
  private tempDir: string;
  private docsDir: string;
  private swaggersDir: string;

  constructor() {
    // 使用更隨機的目錄名稱避免衝突
    const randomId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    this.tempDir = join(tmpdir(), `swagger-mcp-test-${randomId}`);
    this.docsDir = join(this.tempDir, 'docs');
    this.swaggersDir = join(this.docsDir, 'swaggers');
  }


  async setupSwaggers(swaggers: TestSwagger[]): Promise<string> {
    // Create temp directory structure
    await mkdir(this.swaggersDir, { recursive: true });

    // Create test swagger files
    for (const swagger of swaggers) {
      const swaggerPath = join(this.swaggersDir, swagger.fileName);
      await writeFile(swaggerPath, JSON.stringify(swagger.swaggerContent, null, 2));
    }

    return this.tempDir;
  }

  async cleanup(): Promise<void> {
    try {
      await rm(this.tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors in tests
    }
  }

  getDocsPath(): string {
    return this.docsDir;
  }


  getSwaggersDir(): string {
    return this.swaggersDir;
  }

  getSwaggerFilePath(fileName: string): string {
    return join(this.swaggersDir, fileName);
  }
}

/**
 * Mock process.cwd to return test directory
 */
export function mockProcessCwd(testDir: string): () => void {
  const originalCwd = process.cwd;
  process.cwd = () => testDir;

  return () => {
    process.cwd = originalCwd;
  };
}
