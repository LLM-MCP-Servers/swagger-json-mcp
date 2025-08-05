/**
 * SwaggerManager - Swagger 檔案掃描和管理
 */

import { scanSwaggerFiles } from '../utils/fileSystem.js';
import { SwaggerParser } from './SwaggerParser.js';
import { logger } from '../utils/logger.js';
import type { SwaggerInfo, SwaggerStats, SwaggerNotFoundError } from '../mcp/types.js';

export class SwaggerManager {
  private swaggers: Map<string, SwaggerInfo> = new Map();
  private parsers: Map<string, SwaggerParser> = new Map();
  private lastScanTime: number = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  /**
   * 掃描所有 Swagger 檔案
   */
  async scanSwaggers(): Promise<SwaggerInfo[]> {
    const now = Date.now();

    // Use cache if available and fresh
    if (this.swaggers.size > 0 && now - this.lastScanTime < this.CACHE_DURATION) {
      logger.debug('Using cached swagger list');
      return Array.from(this.swaggers.values());
    }

    logger.info('Scanning swagger files in docs/swaggers directory');

    try {
      const swaggerFiles = await scanSwaggerFiles();

      this.swaggers.clear();
      this.parsers.clear();

      for (const file of swaggerFiles) {
        try {
          const parser = new SwaggerParser();
          await parser.loadSwagger(file.path);

          const info = parser.getInfo();
          const stats = parser.getBasicStats();

          const swaggerInfo: SwaggerInfo = {
            name: file.name,
            fileName: file.fileName,
            title: info.title,
            version: info.version,
            description: info.description,
            apiCount: stats.totalApis,
            schemaCount: stats.totalSchemas,
            lastModified: file.lastModified,
          };

          this.swaggers.set(file.name, swaggerInfo);
          this.parsers.set(file.name, parser);

          logger.debug(`Loaded swagger: ${file.name}`);
        } catch (error) {
          logger.warn(`Failed to load swagger ${file.name}:`, error);
        }
      }

      this.lastScanTime = now;
      logger.info(`Successfully loaded ${this.swaggers.size} swagger files`);

      return Array.from(this.swaggers.values());
    } catch (error) {
      logger.error('Failed to scan swagger files:', error);
      throw new Error('Failed to scan swagger files');
    }
  }

  /**
   * 載入特定 Swagger 檔案
   */
  async loadSwagger(swaggerName: string): Promise<SwaggerParser> {
    // Check cache first
    if (this.parsers.has(swaggerName)) {
      logger.debug(`Using cached parser for swagger: ${swaggerName}`);
      return this.parsers.get(swaggerName)!;
    }

    // Ensure swaggers are scanned
    await this.scanSwaggers();

    const parser = this.parsers.get(swaggerName);
    if (!parser) {
      const error = new Error(`Swagger "${swaggerName}" not found`) as SwaggerNotFoundError;
      error.code = 'SWAGGER_NOT_FOUND';
      throw error;
    }

    return parser;
  }

  /**
   * 獲取 Swagger 檔案清單
   */
  async getSwaggerList(): Promise<string[]> {
    await this.scanSwaggers();
    return Array.from(this.swaggers.keys());
  }

  /**
   * 檢查 Swagger 檔案是否存在
   */
  async swaggerExists(swaggerName: string): Promise<boolean> {
    await this.scanSwaggers();
    return this.swaggers.has(swaggerName);
  }

  /**
   * 獲取 Swagger 檔案統計資訊
   */
  async getSwaggerStats(swaggerName: string): Promise<SwaggerStats> {
    const parser = await this.loadSwagger(swaggerName);
    return parser.getDetailedStats();
  }

  /**
   * 獲取 Swagger 檔案基本資訊
   */
  async getSwagger(swaggerName: string): Promise<SwaggerInfo> {
    await this.scanSwaggers();

    const swagger = this.swaggers.get(swaggerName);
    if (!swagger) {
      const error = new Error(`Swagger "${swaggerName}" not found`) as SwaggerNotFoundError;
      error.code = 'SWAGGER_NOT_FOUND';
      throw error;
    }

    return swagger;
  }

  /**
   * 獲取所有 Swagger 檔案的詳細資訊
   */
  async getAllSwaggers(): Promise<SwaggerInfo[]> {
    return await this.scanSwaggers();
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    this.swaggers.clear();
    this.parsers.clear();
    this.lastScanTime = 0;
    logger.debug('Swagger cache cleared');
  }

  /**
   * 取得快取狀態
   */
  getCacheInfo(): { size: number; lastScanTime: number; isExpired: boolean } {
    const now = Date.now();
    return {
      size: this.swaggers.size,
      lastScanTime: this.lastScanTime,
      isExpired: now - this.lastScanTime >= this.CACHE_DURATION,
    };
  }
}