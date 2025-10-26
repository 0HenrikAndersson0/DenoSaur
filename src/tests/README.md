# DenoSaur Tests

This directory contains comprehensive tests for the DenoSaur OpenAPI client generator.

## Test Files

### `type-generators_test.ts`
Tests for the type generation utilities (`src/utils/type-generators.ts`):

- Basic type conversion (string, number, boolean, arrays)
- Object type generation with properties
- Property names with special characters (e.g., `taxonomy/id`)
- `anyOf`, `oneOf`, `allOf` union and intersection types
- Enum type generation
- Nested arrays and objects
- Complex inline types

### `dynamic-client-generator_test.ts`
Tests for the client generation logic (`src/utils/dynamic-client-generator.ts`):

- Client class generation
- Method generation with `operationId`
- HTTP method handling (GET, POST, PUT, DELETE)
- Curried function patterns for resource endpoints
- Query parameter typing
- Security documentation
- Inline response types
- Property name escaping
- `anyOf` in responses

## Running Tests

```bash
# Run all tests
deno task test

# Run specific test file
deno test src/tests/type-generators_test.ts
deno test src/tests/dynamic-client-generator_test.ts

# Run with verbose output
deno test --allow-read --reporter=verbose src/tests/
```

## Test Coverage

The test suite aims for:
- ✅ All type conversion scenarios
- ✅ All HTTP method patterns
- ✅ Edge cases (empty schemas, no parameters, etc.)
- ✅ Special characters in property names
- ✅ Complex nested types
- ✅ Union and intersection types

## Continuous Integration

Tests should pass before:
- Creating a pull request
- Publishing a new version
- Merging to main branch

Run `deno task test` to verify all tests pass locally.
