# 🦖 DenoSaur - Dynamic OpenAPI Client Generator

A powerful Deno-based tool that generates type-safe API clients from OpenAPI specifications.

## Features

- **Dynamic Method Generation**: Automatically creates client methods based on API paths
- **Type Safety**: Generates TypeScript types from OpenAPI schemas
- **Flexible Syntax**: Supports intuitive method chaining like `client.get.products.queryParams({})`
- **Auto Imports**: Automatically imports all required types
- **Full HTTP Support**: Handles GET, POST, PUT, DELETE, PATCH methods
- **Query Parameters**: Built-in query parameter handling
- **Request Bodies**: Proper request body typing and serialization

## Generated Client Syntax

```typescript
// Collection endpoints
client.get.products.queryParams({ category: 'electronics' })
client.get.users.queryParams({})
client.post.products.data({ name: 'Widget', price: 29.99 })

// Individual resource endpoints  
client.get.product('123').get()
client.put.product('123').data({ name: 'Updated Widget' })
client.delete.product('123').delete()
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
     headers: { 'Authorization': 'Bearer token' }
   });
   
   // Get all products
   const products = await client.get.products.queryParams({});
   
   // Create a product
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

1. **Path Analysis**: Analyzes OpenAPI paths to extract resource names and patterns
2. **Type Extraction**: Identifies all types used in request/response schemas
3. **Method Generation**: Creates appropriate client methods for each endpoint
4. **Type Imports**: Automatically imports all required types at the top of the generated file
5. **Dynamic Naming**: Method names are generated based on actual API structure

The generator handles:
- Collection endpoints (`/products` → `client.get.products.queryParams()`)
- Resource endpoints (`/products/{id}` → `client.get.product(id).get()`)
- Different parameter names (`{userId}` vs `{id}`)
- All HTTP methods with proper typing
- Query parameters and request bodies