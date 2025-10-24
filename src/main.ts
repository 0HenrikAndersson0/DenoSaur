
import { exists } from "jsr:@std/fs/exists";
import { parse } from "jsr:@std/yaml";
import {createTypesFromApiData} from "./utils/type-generators.ts";
import { generateClientFromOpenAPI } from "./utils/dynamic-client-generator.ts";
import { OpenAPIData } from "./types/interfaces.ts";

const args = Deno.args;

const init = async () => {
  const file = args[0] ?? "spec-files/test-api.json";
  if(!await exists(file, { isFile: true })) {
    throw new Error("No schema");
  } 
  
  const data = await Deno.readTextFile(file);
  const apiData: OpenAPIData = file.endsWith('.json') ? JSON.parse(data) : parse(data);
  
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