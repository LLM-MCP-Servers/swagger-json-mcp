# Swagger JSON MCP Server

## 專案概述

這是一個 Model Context Protocol (MCP) Server，專門用於處理和查詢 Swagger/OpenAPI JSON 文件。主要解決 LLM 無法一次性處理大型 Swagger 文件（通常 4000+ 行）的問題，通過結構化的工具介面讓 LLM 能夠高效查詢 API 文檔。

## 核心功能

### 主要問題解決
- **大文件處理**: LLM 不需要一次讀取完整 swagger.json
- **$ref 引用解析**: 自動追蹤和解析 JSON Schema 引用關係
- **多專案管理**: 支援 docs/ 目錄下多個專案的統一管理
- **智能查詢**: 提供結構化的 API 和 Schema 查詢介面

### 架構設計
```
swagger-json-mcp/
├── src/
│   ├── core/                    # 核心功能模組
│   │   ├── SwaggerParser.ts     # Swagger 解析器
│   │   ├── SchemaResolver.ts    # $ref 引用解析器
│   │   ├── ProjectManager.ts    # 專案管理器
│   │   └── SearchEngine.ts      # 搜索引擎
│   ├── mcp/                     # MCP Server 實現
│   │   ├── server.ts           # MCP Server 主程式
│   │   ├── tools/              # MCP 工具定義
│   │   └── types.ts            # TypeScript 類型定義
│   ├── utils/                   # 工具函數
│   └── index.ts                # 主入口
├── docs/                       # Swagger 文件目錄
│   ├── great-medical-alliance/  # 範例專案
│   │   └── swagger.json
│   └── [其他專案]/
├── package.json
├── tsconfig.json
└── CLAUDE.md                   # 本文件
```

## MCP 工具介面

### 1. list_projects
- **功能**: 列出所有可用的 Swagger 專案
- **輸入**: 無參數
- **輸出**: 專案清單，包含名稱、標題、版本、API 數量等

### 2. get_project_overview
- **功能**: 獲取專案的整體概覽和統計資訊
- **輸入**: projectName (專案名稱)
- **輸出**: 專案基本資訊、統計數據、伺服器資訊、標籤清單

### 3. get_api_info
- **功能**: 獲取特定 API 的完整資訊，自動解析所有相關 schemas
- **輸入**: projectName, path, method
- **輸出**: 完整的 API 定義，包括請求/回應的 schema（已解析 $ref）
- **重要**: 這是核心工具，會自動處理複雜的 $ref 引用關係

### 4. get_schema
- **功能**: 獲取特定 schema 的完整定義，遞歸解析所有引用
- **輸入**: projectName, schemaName, maxDepth (可選)
- **輸出**: 完全解析的 schema 定義、依賴關係、循環引用檢測

### 5. search_apis
- **功能**: 搜索 API endpoints
- **輸入**: query, projectName (可選), tag (可選), method (可選)
- **輸出**: 匹配的 API 清單，按相關性排序

### 6. search_schemas
- **功能**: 搜索 schema 定義
- **輸入**: query, projectName (可選), type (可選)
- **輸出**: 匹配的 schema 清單

## 開發原則

### 技術棧
- **語言**: TypeScript
- **運行時**: Node.js
- **包管理**: pnpm
- **主要依賴**: @modelcontextprotocol/sdk, zod, fuse.js

### 程式碼風格
- 使用 TypeScript 嚴格模式
- 所有公開介面都需要完整的類型定義
- 錯誤處理採用 Result 模式或適當的異常處理
- 使用 Zod 進行輸入驗證

### 開發階段
1. **階段一 (MVP)**: SwaggerParser, ProjectManager, 基礎 MCP 工具
2. **階段二 (核心)**: SchemaResolver, get_api_info, get_schema 
3. **階段三 (進階)**: SearchEngine, 搜索工具, 效能優化

## 專案文件結構

### docs/ 目錄規範
- 每個子目錄代表一個專案 (例如: great-medical-alliance/)
- 每個專案目錄必須包含 swagger.json 文件
- 支援自動掃描和發現新專案

### 範例專案
- `docs/great-medical-alliance/swagger.json`: 格瑞特豐牙醫系統 API 文檔
- 包含完整的 OpenAPI 3.0.0 規範
- 示範了複雜的 $ref 引用關係處理

## 重要技術細節

### Schema 解析策略
```typescript
// 處理 $ref 引用的核心邏輯
"$ref": "#/components/schemas/LoginRequest"

// 解析流程:
// 1. 定位到 components.schemas.LoginRequest
// 2. 遞歸解析內部的所有 $ref
// 3. 檢測循環引用
// 4. 控制解析深度
// 5. 快取解析結果
```

### 錯誤處理
- 檔案不存在: 提供清晰的錯誤訊息
- JSON 格式錯誤: 指出具體的解析錯誤位置
- $ref 引用失敗: 列出無法解析的引用路徑
- 循環引用: 提供檢測結果和建議

## 使用範例

### 典型查詢流程
```bash
# 1. 查看可用專案
list_projects()

# 2. 獲取專案概覽
get_project_overview({"projectName": "great-medical-alliance"})

# 3. 查詢特定 API
get_api_info({
  "projectName": "great-medical-alliance",
  "path": "/login",
  "method": "post"
})

# 4. 查詢 Schema 定義
get_schema({
  "projectName": "great-medical-alliance", 
  "schemaName": "LoginRequest"
})
```

### 搜索範例
```bash
# 搜索登入相關的 API
search_apis({
  "query": "login",
  "projectName": "great-medical-alliance"
})

# 搜索用戶相關的 Schema
search_schemas({
  "query": "user",
  "type": "object"
})
```

## 測試策略

### 單元測試重點
- SwaggerParser: JSON 解析正確性
- SchemaResolver: $ref 解析邏輯，循環引用檢測
- ProjectManager: 專案發現和載入
- SearchEngine: 搜索準確性和排序

### 整合測試
- MCP 工具的完整呼叫流程
- 多專案管理
- 錯誤情況處理

## 部署和配置

### 環境要求
- Node.js >= 18
- pnpm >= 8
- TypeScript >= 5

### 建置指令
```bash
pnpm install     # 安裝依賴
pnpm build      # 編譯 TypeScript
pnpm test       # 執行測試
pnpm dev        # 開發模式
pnpm start      # 生產模式啟動
```

### MCP 配置
```json
{
  "mcpServers": {
    "swagger-json": {
      "command": "node",
      "args": ["path/to/swagger-json-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

## 貢獻指南

### 新增功能
1. 先在 `src/core/` 實作核心邏輯
2. 在 `src/mcp/tools/` 新增對應的 MCP 工具
3. 更新 `src/mcp/types.ts` 的類型定義
4. 新增對應的測試案例

### 程式碼品質
- 遵循 ESLint 規則
- 確保 TypeScript 編譯無錯誤
- 新增功能必須包含測試
- 更新相關文檔

## 故障排除

### 常見問題
1. **專案無法載入**: 檢查 docs/ 目錄結構和 swagger.json 格式
2. **$ref 解析失敗**: 檢查 JSON Schema 引用路徑是否正確
3. **MCP 連接失敗**: 確認伺服器啟動成功和配置正確
4. **搜索結果不準確**: 檢查搜索關鍵字和過濾條件

### 日誌和除錯
- 使用內建的 logger 模組記錄關鍵操作
- 開發模式下啟用詳細日誌
- 錯誤發生時提供完整的堆疊追蹤

## 專案目標

這個 MCP Server 的最終目標是成為處理 Swagger/OpenAPI 文檔的標準工具，讓 LLM 能夠高效、準確地查詢和理解 API 文檔，大幅提升 API 開發和維護的效率。