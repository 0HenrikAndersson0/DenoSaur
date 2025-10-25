
import { generateFromOpenAPI } from "./utils/generateFromOpenAPI.ts";

const args = Deno.args;

const init = async () => {
  try {
    const result = await generateFromOpenAPI(args[0]);
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