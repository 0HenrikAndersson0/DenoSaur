import { generateClientFromOpenAPI } from "./utils/dynamic-client-generator.ts";
import { OpenAPIData } from "./types/interfaces.ts";

const testApi = async () => {
  // Load the test API data
  const data = await Deno.readTextFile("test-api.json");
  const apiData: OpenAPIData = JSON.parse(data);
  
  // Generate client from the complex API
  const clientContent = generateClientFromOpenAPI(apiData);
  await Deno.writeTextFile("src/out/test-client.ts", clientContent);
  
  console.log("Generated client for complex API:");
  console.log("=====================================");
  console.log(clientContent);
};

testApi();
