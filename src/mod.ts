/**
 * DenoSaur - Dynamic OpenAPI Client Generator
 * 
 * A powerful Deno-based tool that generates type-safe API clients from OpenAPI specifications
 * with intelligent method naming and comprehensive security documentation.
 */

// Re-export main interfaces
export type { OpenAPIData, OpenAPISchema } from "./types/interfaces.ts";

// Re-export main generator functions
export { generateClientFromOpenAPI } from "./utils/dynamic-client-generator.ts";
export { createTypesFromApiData } from "./utils/type-generators.ts";

// Re-export convenience functions
export { 
  generateFromOpenAPI,
  generateTypesFromOpenAPI,
  generateClientFromOpenAPIFile,
  type GenerateOptions,
  type GenerateResult
} from "./utils/generateFromOpenAPI.ts";
