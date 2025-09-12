
import {createTypesFromApiData} from "./utils/type-generators.ts";
import { generateClientFromOpenAPI } from "./utils/dynamic-client-generator.ts";
import { OpenAPIData } from "./types/interfaces.ts";

const init = async () => {
  const data = await Deno.readTextFile("1password.json");
  const apiData: OpenAPIData = JSON.parse(data);
  
  // Generate types
  const typesContent = createTypesFromApiData(apiData);
  await Deno.writeTextFile("src/out/types.ts", typesContent);
  console.log("TypeScript types generated successfully!");
  
  // Generate client
  const clientContent = generateClientFromOpenAPI(apiData);
  await Deno.writeTextFile("src/out/client.ts", clientContent);
  console.log("API client generated successfully!");
};

init();