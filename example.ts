/**
 * Example usage of DenoSaur package
 * 
 * This demonstrates how to use the published @upnorth/denosaur package
 * to generate OpenAPI clients programmatically.
 */

import { 
  generateFromOpenAPI,
  generateTypesFromOpenAPI,
  generateClientFromOpenAPIFile,
  type GenerateOptions
} from "jsr:@upnorth/denosaur";

// Method 1: Generate both types and client from a file (recommended)
async function generateFromFile() {
  try {
    const result = await generateFromOpenAPI("api-spec.json", {
      outputDir: "generated",
      typesFilename: "api-types.ts",
      clientFilename: "api-client.ts"
    });
    
    console.log("✅ Generated files:");
    console.log(`📄 Types: ${result.typesPath}`);
    console.log(`🔧 Client: ${result.clientPath}`);
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  }
}

// Method 2: Generate only types
async function generateTypesOnly() {
  try {
    const typesContent = await generateTypesFromOpenAPI(
      "api-spec.json", 
      "generated/types.ts"
    );
    console.log("✅ Types generated successfully!");
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  }
}

// Method 3: Generate only client
async function generateClientOnly() {
  try {
    const clientContent = await generateClientFromOpenAPIFile(
      "api-spec.json", 
      "generated/client.ts"
    );
    console.log("✅ Client generated successfully!");
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  }
}

// Method 4: Custom options
async function generateWithCustomOptions() {
  const options: GenerateOptions = {
    outputDir: "src/api",
    generateTypes: true,
    generateClient: true,
    typesFilename: "types.ts",
    clientFilename: "client.ts"
  };
  
  try {
    const result = await generateFromOpenAPI("api-spec.json", options);
    console.log("✅ Custom generation completed!");
    return result;
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  }
}

// Run examples
console.log("🚀 DenoSaur Examples");
console.log("===================");

// Uncomment to run specific examples:
// await generateFromFile();
// await generateTypesOnly();
// await generateClientOnly();
// await generateWithCustomOptions();
