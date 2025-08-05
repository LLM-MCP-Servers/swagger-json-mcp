/**
 * File system utility functions for the Swagger JSON MCP Server
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { logger } from './logger.js';

export interface DirectoryInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  hasSwaggerJson: boolean;
}

export interface SwaggerFileInfo {
  name: string;
  fileName: string;
  path: string;
  lastModified: Date;
}

/**
 * Check if a file exists and is readable
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse JSON file
 */
export async function readJsonFile<T = any>(filePath: string): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    logger.error(`Failed to read JSON file: ${filePath}`, error);
    throw new Error(`Failed to read JSON file: ${filePath}`);
  }
}

/**
 * Scan directory for subdirectories
 */
export async function scanDirectory(dirPath: string): Promise<DirectoryInfo[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const directories: DirectoryInfo[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = join(dirPath, entry.name);
        const swaggerPath = join(fullPath, 'swagger.json');
        const hasSwaggerJson = await fileExists(swaggerPath);

        directories.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          hasSwaggerJson,
        });
      }
    }

    return directories;
  } catch (error) {
    logger.error(`Failed to scan directory: ${dirPath}`, error);
    throw new Error(`Failed to scan directory: ${dirPath}`);
  }
}

/**
 * Get absolute path relative to project root
 */
export function getProjectPath(...paths: string[]): string {
  return resolve(process.cwd(), ...paths);
}

/**
 * Get docs directory path
 */
export function getDocsPath(): string {
  return getProjectPath('docs');
}

/**
 * Get swaggers directory path
 */
export function getSwaggersPath(): string {
  return getProjectPath('docs', 'swaggers');
}

/**
 * Scan swagger files in docs/swaggers/ directory
 */
export async function scanSwaggerFiles(): Promise<SwaggerFileInfo[]> {
  try {
    const swaggersPath = getSwaggersPath();
    const entries = await readdir(swaggersPath, { withFileTypes: true });
    const swaggerFiles: SwaggerFileInfo[] = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const fullPath = join(swaggersPath, entry.name);
        const stats = await stat(fullPath);
        const nameWithoutExt = entry.name.replace('.json', '');

        swaggerFiles.push({
          name: nameWithoutExt,
          fileName: entry.name,
          path: fullPath,
          lastModified: stats.mtime,
        });
      }
    }

    return swaggerFiles.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    logger.error(`Failed to scan swagger files:`, error);
    throw new Error(`Failed to scan swagger files`);
  }
}
