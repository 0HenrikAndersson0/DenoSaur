import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  convertSchemaToType,
  generateTypeDefinition,
  generateInterface,
  generateEnum,
  createTypesFromApiData,
} from "../utils/type-generators.ts";
import { OpenAPIData } from "../types/interfaces.ts";

Deno.test("convertSchemaToType - basic types", () => {
  assertEquals(convertSchemaToType({ type: "string" }), "string");
  assertEquals(convertSchemaToType({ type: "number" }), "number");
  assertEquals(convertSchemaToType({ type: "integer" }), "number");
  assertEquals(convertSchemaToType({ type: "boolean" }), "boolean");
  assertEquals(convertSchemaToType({ type: "array", items: { type: "string" } }), "string[]");
  assertEquals(convertSchemaToType({ type: "array" }), "any[]");
});

Deno.test("convertSchemaToType - object with properties", () => {
  const schema = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
      active: { type: "boolean" },
    },
    required: ["name"],
  };
  
  const result = convertSchemaToType(schema);
  assertEquals(result, '{ name: string; age?: number; active?: boolean }');
});

Deno.test("convertSchemaToType - property names with special characters", () => {
  const schema = {
    type: "object",
    properties: {
      "taxonomy/id": { type: "string" },
      normalProp: { type: "number" },
      "taxonomy/type": { type: "string" },
    },
    required: ["taxonomy/id"],
  };
  
  const result = convertSchemaToType(schema);
  assertEquals(result, '{ "taxonomy/id": string; normalProp?: number; "taxonomy/type"?: string }');
});

Deno.test("convertSchemaToType - anyOf", () => {
  const schema = {
    anyOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
    ],
  };
  
  const result = convertSchemaToType(schema);
  assertEquals(result, "string | number | boolean");
});

Deno.test("convertSchemaToType - oneOf", () => {
  const schema = {
    oneOf: [
      { type: "string" },
      { type: "number" },
    ],
  };
  
  const result = convertSchemaToType(schema);
  assertEquals(result, "string | number");
});

Deno.test("convertSchemaToType - allOf", () => {
  const schema = {
    allOf: [
      { type: "object", properties: { name: { type: "string" } } },
      { type: "object", properties: { age: { type: "number" } } },
    ],
  };
  
  const result = convertSchemaToType(schema);
  assertEquals(result, '{ name?: string } & { age?: number }');
});

Deno.test("convertSchemaToType - $ref", () => {
  const schema = {
    $ref: "#/components/schemas/User",
  };
  
  const result = convertSchemaToType(schema);
  assertEquals(result, "User");
});

Deno.test("convertSchemaToType - enum", () => {
  const schema = {
    enum: ["red", "green", "blue"],
  };
  
  const result = convertSchemaToType(schema);
  assertEquals(result, '"red" | "green" | "blue"');
});

Deno.test("generateInterface", () => {
  const schema = {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["id", "name"],
  };
  
  const result = generateInterface("User", schema);
  assertExists(result);
  assertEquals(result.includes("interface User"), true);
  assertEquals(result.includes("id: string"), true);
  assertEquals(result.includes("name: string"), true);
  assertEquals(result.includes("age?: number"), true);
});

Deno.test("generateEnum", () => {
  const schema = {
    enum: ["admin", "user", "guest"],
  };
  
  const result = generateEnum("Role", schema);
  assertEquals(result, 'export type Role = "admin" | "user" | "guest";');
});

Deno.test("createTypesFromApiData", () => {
  const apiData = {
    servers: [{ url: "https://api.example.com" }],
    paths: {},
    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
          required: ["id"],
        },
        Role: {
          enum: ["admin", "user"],
        },
      },
      securitySchemes: {},
    },
  } as OpenAPIData;
  
  const result = createTypesFromApiData(apiData);
  assertExists(result);
  assertEquals(result.includes("export interface User"), true);
  assertEquals(result.includes("export type Role"), true);
});

Deno.test("createTypesFromApiData - no schemas", () => {
  const apiData = {
    servers: [{ url: "https://api.example.com" }],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
  } as OpenAPIData;
  
  const result = createTypesFromApiData(apiData);
  assertEquals(result, "");
});

Deno.test("convertSchemaToType - nested arrays and objects", () => {
  const schema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  };
  
  const result = convertSchemaToType(schema);
  assertEquals(result, '{ id?: string; tags?: string[] }[]');
});

Deno.test("convertSchemaToType - complex anyOf with objects", () => {
  const schema = {
    anyOf: [
      { type: "string" },
      {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
    ],
  };
  
  const result = convertSchemaToType(schema);
  assertEquals(result, 'string | { message?: string }');
});
