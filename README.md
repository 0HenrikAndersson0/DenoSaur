# 🦖 DenoSaur - Dynamic OpenAPI Client Generator

A powerful Deno-based tool that generates type-safe API clients from OpenAPI specifications with intelligent method naming and comprehensive security documentation.

## Features

- **🎯 Smart Method Naming**: Uses `operationId` for direct method names when available, falls back to resource-based structure
- **🔒 Security Documentation**: Automatically analyzes and documents authentication requirements for each endpoint
- **📝 Comprehensive JSDoc**: Generates detailed documentation with summaries, descriptions, and security requirements
- **🛡️ Type Safety**: Generates TypeScript types from OpenAPI schemas with full type checking
- **🔄 Flexible Structure**: Supports both direct methods (`client.get.getpersonbyid(id)`) and resource-based methods (`client.get.person(id)`)
- **📦 Auto Imports**: Automatically imports all required types
- **🌐 Full HTTP Support**: Handles GET, POST, PUT, DELETE, PATCH methods
- **🔍 Query Parameters**: Built-in query parameter handling with proper typing
- **📤 Request Bodies**: Proper request body typing and JSON serialization

## Generated Client Syntax

### With OperationId (Preferred)
When your OpenAPI spec includes `operationId`, methods are generated as direct calls:

```typescript
// Direct methods based on operationId
client.get.getallpersons({ limit: 10 })
client.get.getpersonbyid('123')
client.put.createorupdateperson('123', { name: 'John', age: 30 })
client.delete.deleteperson('123')
client.get.healthcheck()
```

### Without OperationId (Fallback)
When no `operationId` is present, falls back to resource-based structure:

```typescript
// Resource-based methods (fallback)
client.get.persons.queryParams({ category: 'electronics' })
client.get.person('123').get()
client.put.person('123').data({ name: 'Updated Widget' })
client.delete.person('123').delete()
```

### Security Documentation
Each method includes comprehensive JSDoc with security requirements:

```typescript
/**
 * Get person by ID
 * Retrieve a specific person by their ID
 * @requires Basic Authentication
 */
getpersonbyid: async (id: string, params: QueryParams = {}): Promise<ApiResponse<Person>> => {
  // ... implementation
}
```

## Usage

1. **Generate types and client**:
   ```bash
   deno task generate
   ```

2. **Use the generated client**:
   ```typescript
   import { createClient } from "./out/client.ts";
   
   const client = createClient({ 
     baseUrl: 'https://api.example.com',
     headers: { 
       'Authorization': 'Basic ' + btoa('admin:secret'),
       'Content-Type': 'application/json'
     }
   });
   
   // Direct methods (with operationId)
   const persons = await client.get.getallpersons({ limit: 10 });
   const person = await client.get.getpersonbyid('123');
   const updated = await client.put.createorupdateperson('123', {
     name: 'John Doe',
     age: 30
   });
   
   // Fallback methods (without operationId)
   const products = await client.get.products.queryParams({ category: 'electronics' });
   const newProduct = await client.post.products.data({
     name: 'New Product',
     price: 29.99
   });
   ```

## Available Tasks

- `deno task generate` - Generate types and client from OpenAPI spec
- `deno task start` - Run the main application
- `deno task dev` - Run in development mode with file watching
- `deno task fmt` - Format code
- `deno task lint` - Lint code

## Project Structure

```
src/
├── main.ts                    # Main entry point
├── utils/
│   ├── type-generators.ts    # Type generation utilities
│   └── dynamic-client-generator.ts  # Client generation
├── types/
│   └── interfaces.ts         # TypeScript interfaces
└── out/
    ├── types.ts              # Generated types
    └── client.ts             # Generated client
```

## How It Works

1. **🔍 Path Analysis**: Analyzes OpenAPI paths to extract resource names and patterns
2. **🔒 Security Analysis**: Examines security requirements (global and operation-specific)
3. **📝 Type Extraction**: Identifies all types used in request/response schemas
4. **🎯 Smart Method Generation**: Creates methods based on `operationId` or falls back to resource structure
5. **📚 Documentation Generation**: Adds JSDoc comments with summaries, descriptions, and security requirements
6. **📦 Type Imports**: Automatically imports all required types at the top of the generated file

### Method Generation Logic

**With OperationId** (Preferred):
- `/api/persons` with `operationId: "getAllPersons"` → `client.get.getallpersons()`
- `/api/person/{id}` with `operationId: "getPersonById"` → `client.get.getpersonbyid(id)`

**Without OperationId** (Fallback):
- `/api/products` → `client.get.products.queryParams()`
- `/api/products/{id}` → `client.get.product(id).get()`

### Supported Authentication Types

- **Basic Authentication**: `@requires Basic Authentication`
- **Bearer Token**: `@requires Bearer Token`
- **API Key**: `@requires API Key (header: X-API-Key)`
- **OAuth2**: `@requires OAuth2 (read, write)`
- **OpenID Connect**: `@requires OpenID Connect`

The generator handles:
- ✅ Collection and resource endpoints with intelligent naming
- ✅ Path parameters with proper typing (`{userId}` vs `{id}`)
- ✅ All HTTP methods (GET, POST, PUT, DELETE, PATCH)
- ✅ Query parameters and request bodies with full type safety
- ✅ Security documentation for all authentication schemes
- ✅ Comprehensive JSDoc with operation summaries and descriptions

## Best Practices

### Using OperationId
For the best developer experience, include `operationId` in your OpenAPI specification:

```yaml
paths:
  /api/persons:
    get:
      operationId: "getAllPersons"  # ✅ Creates: client.get.getallpersons()
      summary: "Get all persons"
  /api/person/{id}:
    get:
      operationId: "getPersonById"  # ✅ Creates: client.get.getpersonbyid(id)
      summary: "Get person by ID"
```

### Security Configuration
Define security schemes in your OpenAPI spec for automatic documentation:

```yaml
components:
  securitySchemes:
    basicAuth:
      type: http
      scheme: basic
      description: "Basic authentication with username and password"
security:
  - basicAuth: []
```

### Generated Documentation
The client automatically includes comprehensive documentation:

```typescript
/**
 * Get person by ID
 * Retrieve a specific person by their ID
 * @requires Basic Authentication
 */
getpersonbyid: async (id: string, params: QueryParams = {}): Promise<ApiResponse<Person>>
```