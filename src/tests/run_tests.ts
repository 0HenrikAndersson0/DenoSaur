#!/usr/bin/env -S deno run --allow-read --allow-run

/**
 * Test runner for the DenoSaur project
 * 
 * Run all tests: deno run --allow-read src/tests/run_tests.ts
 * Run specific test file: deno run --allow-read src/tests/run_tests.ts type-generators
 * Run specific test file: deno run --allow-read src/tests/run_tests.ts dynamic-client-generator
 */

const testFiles = {
  "type-generators": "src/tests/type-generators_test.ts",
  "dynamic-client-generator": "src/tests/dynamic-client-generator_test.ts",
};

async function runTests(filter?: string) {
  console.log("🧪 Running DenoSaur Tests\n");

  const testsToRun = filter 
    ? Object.entries(testFiles).filter(([name]) => name.includes(filter))
    : Object.entries(testFiles);

  if (testsToRun.length === 0) {
    console.log(`❌ No tests found matching: ${filter}`);
    console.log("\nAvailable test files:");
    Object.keys(testFiles).forEach(name => console.log(`  - ${name}`));
    Deno.exit(1);
  }

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [name, path] of testsToRun) {
    console.log(`\n📝 Running: ${name}\n`);
    
    const command = new Deno.Command("deno", {
      args: ["test", "--allow-read", path],
    });

    const { code, stdout, stderr } = await command.output();
    const decoder = new TextDecoder();
    const output = decoder.decode(stdout);
    const error = decoder.decode(stderr);
    
    console.log(output);
    if (error) console.error(error);

    if (code === 0) {
      totalPassed++;
      console.log(`✅ ${name} passed\n`);
    } else {
      totalFailed++;
      console.log(`❌ ${name} failed\n`);
    }
  }

  console.log("=" .repeat(50));
  console.log(`\n📊 Test Summary: ${totalPassed} passed, ${totalFailed} failed\n`);

  if (totalFailed > 0) {
    Deno.exit(1);
  }
}

const filter = Deno.args[0];
await runTests(filter);
