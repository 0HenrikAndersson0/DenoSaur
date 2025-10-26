# 🦖 DenoSaur - Dynamic OpenAPI Client Generator

A powerful Deno-based tool that generates type-safe API clients from OpenAPI specifications with intelligent method naming and comprehensive security documentation.

## Features

- **🎯 Smart Method Naming**: Uses `operationId` for direct method names when available, falls back to resource-based structure
- **🔒 Security Documentation**: Automatically analyzes and documents authentication requirements for each endpoint
- **📝 Comprehensive JSDoc**: Generates detailed documentation with summaries, descriptions, and security requirements
- **🛡️ Type Safety**: Generates TypeScript types from OpenAPI schemas with full type checking
- **🔄 Flexible Structure**: Smart method generation based on endpoint type - direct methods, curried functions, or nested structures
- **🎣 Curried Functions**: Resource endpoints use curried functions consistently - same pattern with or without operationId! `client.put.todo(id)(body)` or `client.put.updateproduct(id)(body)`
- **📦 Auto Imports**: Automatically imports all required types
- **🌐 Full HTTP Support**: Handles GET, POST, PUT, DELETE, PATCH methods
- **🔍 Query Parameters**: Built-in query parameter handling with proper typing
- **📤 Request Bodies**: Proper request body typing and JSON serialization

## Generated Client Syntax

### With OperationId (Preferred)
When your OpenAPI spec includes `operationId`, methods use the same clean API structure:

```typescript
// Collection endpoints
client.get.getallpersons({ limit: 10 })

// Resource endpoints with operationId - same curried pattern!
client.put.updateproduct('123')({ name: 'Updated Product', price: 99.99 })
client.delete.removeitem('123')()
client.get.getpersonbyid('123')

// Standalone endpoints
client.get.healthcheck()
```

### Without OperationId (Fallback)
When no `operationId` is present, falls back to intelligent resource-based structure:

```typescript
// Collection endpoints
client.get.todos()                              // GET /todos
client.post.todos({ title: "New todo" })        // POST /todos

// Resource endpoints (curried functions)
client.get.todo("123").get()                    // GET /todos/{id}
client.put.todo("123")({ title: "Updated" })    // PUT /todos/{id}
client.delete.todo("123")()                     // DELETE /todos/{id}

// With query parameters
client.get.products.queryParams({ category: 'electronics' })
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

## Getting Started

### 1. Generate the Client


#### Option A: Specifying a Custom OpenAPI File
```bash
deno run --allow-read --allow-write src/main.ts path/to/your/api.json
```

#### Option B: Using the Published Package
```typescript
import { generateFromOpenAPI } from "jsr:@upnorth/denosaur";

const result = await generateFromOpenAPI("api-spec.json", {
  outputDir: "generated",
  typesFilename: "api-types.ts",
  clientFilename: "api-client.ts"
});

console.log("Generated:", result.typesPath, result.clientPath);
```

#### Option C: CLI Direct Invocation
```bash
deno run --allow-read --allow-write src/main.ts spec-files/api-data.json
```

### 2. Use the Generated Client
   ```typescript
   import { createClient } from "./out/client.ts";
   
   const client = createClient({ 
     baseUrl: 'https://api.example.com',
     headers: { 
       'Authorization': 'Basic ' + btoa('admin:secret'),
       'Content-Type': 'application/json'
     }
   });
   
   // Collection endpoints (with operationId)
   const persons = await client.get.getallpersons({ limit: 10 });
   const persons2 = await client.get.todos(); // Without operationId
   
   // Resource endpoints - SAME CURRIED PATTERN for both with/without operationId! ✨
   // With operationId:
   const updated = await client.put.updateproduct('123')({ name: 'Updated Product', price: 99.99 });
   await client.delete.removeitem('123')();
   
   // Without operationId:
   const todo = await client.get.todo('123').get();
   const updatedTodo = await client.put.todo('123')({ title: 'Updated Todo', completed: true });
   await client.delete.todo('123')();
   
   // Collection creation
   const newTodo = await client.post.todos({ title: 'New Todo', completed: false });
   
   // With query parameters
   const products = await client.get.products.queryParams({ category: 'electronics' });
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
- **Collection endpoints**: 
  - `GET /persons` with `operationId: "getAllPersons"` → `client.get.getallpersons(params)`
  - `POST /products` with `operationId: "createProduct"` → `client.post.createproduct(body)`

- **Resource endpoints (curried) - same pattern as without operationId!**:
  - `GET /person/{id}` with `operationId: "getPersonById"` → `client.get.getpersonbyid(id)` (direct for GET)
  - `PUT /product/{id}` with `operationId: "updateProduct"` → `client.put.updateproduct(id)(body)` 🎯
  - `DELETE /item/{id}` with `operationId: "removeItem"` → `client.delete.removeitem(id)()` 🎯

**Without OperationId** (Intelligent Fallback):
- **Collection endpoints**: 
  - `GET /todos` (no query params) → `client.get.todos()`
  - `POST /todos` → `client.post.todos(body)`
  - `GET /products?category=...` (with query params) → `client.get.products.queryParams()`

- **Resource endpoints (curried)**:
  - `GET /todos/{id}` → `client.get.todo(id).get()`
  - `PUT /todos/{id}` → `client.put.todo(id)(body)` ✨
  - `DELETE /todos/{id}` → `client.delete.todo(id)()` ✨

**Key Point**: Resource endpoints with PUT/DELETE/PATCH use the **same curried function pattern** whether they have an operationId or not! This provides a consistent, intuitive API across all endpoints. 🎉

### Supported Authentication Types

- **Basic Authentication**: `@requires Basic Authentication`
- **Bearer Token**: `@requires Bearer Token`
- **API Key**: `@requires API Key (header: X-API-Key)`
- **OAuth2**: `@requires OAuth2 (read, write)`
- **OpenID Connect**: `@requires OpenID Connect`

### Key Features of Generated Client

**Collection Endpoints:**
- ✅ Direct methods when no query parameters: `client.get.todos()`
- ✅ Nested structure with query params: `client.get.products.queryParams()`
- ✅ POST/PUT directly accept body: `client.post.todos(body)`

**Resource Endpoints (Path Parameters):**
- ✅ GET resources: `client.get.todo(id).get()`
- ✅ PUT resources: `client.put.todo(id)(body)` or `client.put.updateproduct(id)(body)` - Curried function pattern! 🎯
- ✅ DELETE resources: `client.delete.todo(id)()` or `client.delete.removeitem(id)()` - Empty parameter
- ✅ **Consistent API**: Same curried pattern whether you use operationId or not!
- ✅ Full type safety with path parameters (`{userId}` vs `{id}`)

**General:**
- ✅ All HTTP methods (GET, POST, PUT, DELETE, PATCH)
- ✅ Full type safety for requests and responses
- ✅ Comprehensive JSDoc with operation summaries and security requirements
- ✅ Automatic query parameter handling
- ✅ Proper JSON serialization for request bodies

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




