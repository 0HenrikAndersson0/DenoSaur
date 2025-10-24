/**
 * Example usage of DenoSaur package
 * 
 * This demonstrates how to use the published @upnorth/denosaur package
 * to generate OpenAPI clients programmatically.
 */

import { 
  generateClientFromOpenAPI, 
  createTypesFromApiData,
  type OpenAPIData 
} from "jsr:@upnorth/denosaur";

// Example OpenAPI data
const apiData: OpenAPIData = {
  servers: [{ url: "https://api.example.com" }],
  paths: {
    "/users": {
      get: {
        operationId: "getAllUsers",
        summary: "Get all users",
        responses: {
          "200": {
            description: "List of users",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/User" }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" }
        },
        required: ["id", "name", "email"]
      }
    }
  }
};

// Generate TypeScript types
const typesContent = createTypesFromApiData(apiData);
console.log("Generated types:");
console.log(typesContent);

// Generate API client
const clientContent = generateClientFromOpenAPI(apiData);
console.log("\nGenerated client:");
console.log(clientContent);

// Save to files
await Deno.writeTextFile("generated-types.ts", typesContent);
await Deno.writeTextFile("generated-client.ts", clientContent);

console.log("\nFiles generated successfully!");
