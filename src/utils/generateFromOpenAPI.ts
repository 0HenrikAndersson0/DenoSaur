import { exists } from "jsr:@std/fs@1.0.19/exists";
import { parse } from "jsr:@std/yaml@1.0.9";
import { createTypesFromApiData } from "./type-generators.ts";
import { generateClientFromOpenAPI } from "./dynamic-client-generator.ts";
import type { OpenAPIData } from "../types/interfaces.ts";

export interface GenerateOptions {
  /** Output directory for generated files (default: "src/out") */
  outputDir?: string;
  /** Whether to generate types file (default: true) */
  generateTypes?: boolean;
  /** Whether to generate client file (default: true) */
  generateClient?: boolean;
  /** Custom filename for types file (default: "types.ts") */
  typesFilename?: string;
  /** Custom filename for client file (default: "client.ts") */
  clientFilename?: string;
}

export interface GenerateResult {
  /** Path to the generated types file (if generated) */
  typesPath?: string;
  /** Path to the generated client file (if generated) */
  clientPath?: string;
  /** Content of the generated types */
  typesContent?: string;
  /** Content of the generated client */
  clientContent?: string;
}

/**
 * Generates TypeScript types and API client from an OpenAPI specification file
 * 
 * @param specPath - Path to the OpenAPI specification file (JSON or YAML)
 * @param options - Configuration options for generation
 * @returns Promise<GenerateResult> - Information about generated files
 * 
 * @example
 * ```typescript
 * import { generateFromOpenAPI } from "jsr:@upnorth/denosaur/generate";
 * 
 * const result = await generateFromOpenAPI("api-spec.json", {
 *   outputDir: "generated",
 *   typesFilename: "api-types.ts",
 *   clientFilename: "api-client.ts"
 * });
 * 
 * console.log("Generated files:", result.typesPath, result.clientPath);
 * ```
 */
export async function generateFromOpenAPI(
  specPath: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const {
    outputDir = "src/out",
    generateTypes = true,
    generateClient = true,
    typesFilename = "types.ts",
    clientFilename = "client.ts"
  } = options;

  // Validate input file exists
  if (!await exists(specPath, { isFile: true })) {
    throw new Error(`OpenAPI specification file not found: ${specPath}`);
  }

  // Read and parse the OpenAPI specification
  const data = await Deno.readTextFile(specPath);
  const apiData: OpenAPIData = specPath.endsWith('.json') 
    ? JSON.parse(data) 
    : parse(data) as OpenAPIData;

  const result: GenerateResult = {};

  // Ensure output directory exists
  try {
    await Deno.mkdir(outputDir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }

  // Generate types if requested
  if (generateTypes) {
    const typesContent = createTypesFromApiData(apiData);
    if(typesContent !== "") {
      const typesPath = `${outputDir}/${typesFilename}`;
    
      await Deno.writeTextFile(typesPath, typesContent);
      result.typesPath = typesPath;
      result.typesContent = typesContent;
      
      console.log(`✅ TypeScript types generated: ${typesPath}`);
    }
    else console.log(`❗No TypeScript types generated`)
  }

  // Generate client if requested
  if (generateClient) {
    const clientContent = generateClientFromOpenAPI(apiData);
    const clientPath = `${outputDir}/${clientFilename}`;
    
    await Deno.writeTextFile(clientPath, clientContent);
    result.clientPath = clientPath;
    result.clientContent = clientContent;
    
    console.log(`✅ API client generated: ${clientPath}`);
  }

  return result;
}

/**
 * Generates only TypeScript types from an OpenAPI specification file
 * 
 * @param specPath - Path to the OpenAPI specification file
 * @param outputPath - Output path for the types file
 * @returns Promise<string> - Content of the generated types
 */
export async function generateTypesFromOpenAPI(
  specPath: string,
  outputPath: string = "src/out/types.ts"
): Promise<string> {
  const result = await generateFromOpenAPI(specPath, {
    outputDir: outputPath.substring(0, outputPath.lastIndexOf('/')),
    typesFilename: outputPath.substring(outputPath.lastIndexOf('/') + 1),
    generateClient: false
  });
  
  return result.typesContent!;
}

/**
 * Generates only API client from an OpenAPI specification file
 * 
 * @param specPath - Path to the OpenAPI specification file
 * @param outputPath - Output path for the client file
 * @returns Promise<string> - Content of the generated client
 */
export async function generateClientFromOpenAPIFile(
  specPath: string,
  outputPath: string = "src/out/client.ts"
): Promise<string> {
  const result = await generateFromOpenAPI(specPath, {
    outputDir: outputPath.substring(0, outputPath.lastIndexOf('/')),
    clientFilename: outputPath.substring(outputPath.lastIndexOf('/') + 1),
    generateTypes: false
  });
  
  return result.clientContent!;
}
