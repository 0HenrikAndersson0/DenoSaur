
import { generateFromOpenAPI } from "./utils/generateFromOpenAPI.ts";

const args = Deno.args;

const init = async () => {
  const file = args[0] ?? "spec-files/demo-api.json";
  
  try {
    const result = await generateFromOpenAPI(file);
    console.log("🎉 Generation completed successfully!");
    
    if (result.typesPath) {
      console.log(`📄 Types: ${result.typesPath}`);
    }
    if (result.clientPath) {
      console.log(`🔧 Client: ${result.clientPath}`);
    }
  } catch (error) {
    console.error("❌ Error generating client:", (error as Error).message);
    Deno.exit(1);
  }
};

init();