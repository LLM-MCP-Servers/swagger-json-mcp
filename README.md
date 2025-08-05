# Swagger JSON MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js->=18.0.0-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.16.0-purple.svg)](https://modelcontextprotocol.io/)

A powerful Model Context Protocol (MCP) server designed to efficiently query and process large Swagger/OpenAPI JSON documents. This server solves the common problem of LLMs being unable to process large API documentation files (typically 4000+ lines) by providing structured, intelligent query interfaces.

## 🚀 Features

### Core Capabilities
- **📋 Multi-project Management**: Seamlessly handle multiple Swagger/OpenAPI projects
- **🔍 Smart $ref Resolution**: Automatically resolve JSON Schema references and handle circular dependencies
- **🔎 Intelligent Search**: Advanced search capabilities for APIs and schemas with fuzzy matching
- **⚡ Efficient Querying**: Get specific API or schema information without loading entire documents
- **🔄 Real-time Updates**: Automatically detect and reload changes in Swagger files

### MCP Tools
- `list_swaggers`: List all available Swagger projects
- `get_swagger_overview`: Get project overview and statistics
- `get_api_info`: Retrieve complete API information with resolved schemas
- `get_schema`: Get fully resolved schema definitions
- `search_apis`: Search API endpoints with advanced filtering
- `search_schemas`: Search schema definitions with type filtering

## 📁 Project Structure

```
swagger-json-mcp/
├── src/
│   ├── core/                    # Core functionality modules
│   │   ├── SwaggerParser.ts     # Swagger JSON parser
│   │   ├── SchemaResolver.ts    # $ref reference resolver
│   │   └── SwaggerManager.ts    # Multi-project manager
│   ├── mcp/                     # MCP server implementation
│   │   ├── tools/              # MCP tool definitions
│   │   └── types.ts            # TypeScript type definitions
│   ├── utils/                   # Utility functions
│   └── index.ts                # Main entry point
├── docs/                       # Swagger documentation directory
│   └── [project-name]/         # Individual project folders
│       └── swagger.json        # Swagger/OpenAPI JSON files
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Installation

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd swagger-json-mcp

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test
```

## 🚀 Quick Start

### 1. Prepare Your Swagger Files
Create project directories under `docs/` and place your `swagger.json` files:

```
docs/
├── your-api-project/
│   └── swagger.json
└── another-project/
    └── swagger.json
```

### 2. Start the MCP Server
```bash
# Development mode
pnpm dev

# Production mode
pnpm start
```

### 3. Configure MCP Client
Add to your MCP client configuration:

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

## 📖 Usage Examples

### List Available Projects
```typescript
// MCP Tool Call
{
  "name": "list_swaggers",
  "arguments": {}
}

// Response
{
  "projects": [
    {
      "name": "your-api-project",
      "title": "Your API",
      "version": "1.0.0",
      "apiCount": 42,
      "schemaCount": 28
    }
  ]
}
```

### Get API Information
```typescript
// MCP Tool Call
{
  "name": "get_api_info",
  "arguments": {
    "swaggerName": "your-api-project",
    "path": "/api/users",
    "method": "post"
  }
}

// Response includes fully resolved schemas
{
  "path": "/api/users",
  "method": "post",
  "summary": "Create user",
  "requestBody": {
    // Fully resolved schema without $ref
  },
  "responses": {
    // Fully resolved response schemas
  }
}
```

### Search APIs
```typescript
// MCP Tool Call
{
  "name": "search_apis",
  "arguments": {
    "query": "user login",
    "swaggerName": "your-api-project",
    "method": "post"
  }
}

// Response
{
  "results": [
    {
      "path": "/auth/login",
      "method": "post",
      "summary": "User login",
      "score": 0.95
    }
  ]
}
```

### Resolve Complex Schemas
```typescript
// MCP Tool Call
{
  "name": "get_schema",
  "arguments": {
    "swaggerName": "your-api-project",
    "schemaName": "UserProfile",
    "maxDepth": 10
  }
}

// Response includes all nested schemas resolved
{
  "schema": {
    "type": "object",
    "properties": {
      // All $ref references resolved recursively
    }
  },
  "dependencies": ["Address", "ContactInfo"],
  "circularReferences": []
}
```

## 🧪 Development

### Available Scripts
```bash
pnpm build      # Compile TypeScript
pnpm dev        # Development with hot reload
pnpm test       # Run test suite
pnpm lint       # Run ESLint
pnpm typecheck  # TypeScript type checking
pnpm prettier   # Format code
pnpm clean      # Clean build directory
```

### Code Quality
- **TypeScript**: Strict mode enabled with comprehensive type definitions
- **ESLint**: Configured with TypeScript and Prettier rules
- **Vitest**: Fast unit testing with full coverage
- **Prettier**: Consistent code formatting

### Testing
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage
```

## 🏗️ Architecture

### Core Components

#### SwaggerParser
- Validates and parses Swagger/OpenAPI JSON files
- Handles multiple OpenAPI versions (2.0, 3.0.x)
- Provides structured access to API definitions

#### SchemaResolver
- Recursively resolves `$ref` references
- Detects and handles circular dependencies
- Configurable resolution depth
- Caches resolved schemas for performance

#### SwaggerManager
- Manages multiple Swagger projects
- Automatic file discovery and loading
- Project lifecycle management
- Thread-safe operations

### MCP Integration
- Full compliance with Model Context Protocol specification
- Structured tool definitions with comprehensive validation
- Error handling and logging
- Async/await throughout for optimal performance

## 🔧 Configuration

### Environment Variables
```bash
# Optional: Set log level
LOG_LEVEL=info

# Optional: Custom docs directory
DOCS_DIR=./custom-docs

# Optional: Maximum schema resolution depth
MAX_SCHEMA_DEPTH=10
```

### Customization
- Modify `src/utils/logger.ts` for custom logging
- Extend `src/core/SwaggerManager.ts` for additional project types
- Add new MCP tools in `src/mcp/tools/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes with tests
4. Run the test suite: `pnpm test`
5. Ensure code quality: `pnpm lint && pnpm typecheck`
6. Commit changes: `git commit -m 'Add new feature'`
7. Push to branch: `git push origin feature/new-feature`
8. Submit a pull request

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new functionality
- Update documentation for API changes
- Ensure TypeScript compliance
- Write clear, descriptive commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**Project not loading**
- Verify `docs/` directory structure
- Check `swagger.json` file validity
- Ensure proper JSON formatting

**$ref resolution failing**
- Validate JSON Schema reference paths
- Check for circular references
- Verify component definitions exist

**MCP connection issues**
- Confirm server startup success
- Validate MCP client configuration
- Check Node.js version compatibility

### Debug Mode
Enable detailed logging:
```bash
LOG_LEVEL=debug pnpm start
```

## 🌟 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) - Protocol specification
- [OpenAPI Specification](https://swagger.io/specification/) - API documentation standard
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vitest](https://vitest.dev/) - Fast testing framework

---

Made with ❤️ for better API documentation accessibility