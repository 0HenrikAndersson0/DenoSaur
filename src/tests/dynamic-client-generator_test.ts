import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateClientFromOpenAPI } from "../utils/dynamic-client-generator.ts";
import { OpenAPIData } from "../types/interfaces.ts";

const testApiData: OpenAPIData = {
  servers: [{ url: "https://api.example.com" }],
  paths: {
    "/todos": {
      get: {
        operationId: "getTodos",
        summary: "Get all todos",
        responses: {
          "200": {
            description: "List of todos",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Todo" },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: "createTodo",
        summary: "Create a todo",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TodoInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created todo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Todo" },
              },
            },
          },
        },
      },
    },
    "/todos/{id}": {
      get: {
        operationId: "getTodoById",
        summary: "Get a todo by ID",
        responses: {
          "200": {
            description: "Todo details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Todo" },
              },
            },
          },
        },
      },
      put: {
        operationId: "updateTodo",
        summary: "Update a todo",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TodoInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated todo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Todo" },
              },
            },
          },
        },
      },
      delete: {
        operationId: "deleteTodo",
        summary: "Delete a todo",
        responses: {
          "204": {
            description: "Todo deleted",
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Todo: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          completed: { type: "boolean" },
        },
        required: ["id", "title"],
      },
      TodoInput: {
        type: "object",
        properties: {
          title: { type: "string" },
          completed: { type: "boolean" },
        },
        required: ["title"],
      },
    },
    securitySchemes: {},
  },
};

Deno.test("generateClientFromOpenAPI - generates client code", () => {
  const result = generateClientFromOpenAPI(testApiData);
  
  assertExists(result);
  assertEquals(typeof result, "string");
  assertEquals(result.includes("class ApiClient"), true);
  assertEquals(result.includes("createClient"), true);
});

Deno.test("generateClientFromOpenAPI - includes operationId methods", () => {
  const result = generateClientFromOpenAPI(testApiData);
  
  assertEquals(result.includes("gettodos"), true);
  assertEquals(result.includes("createtodo"), true);
  assertEquals(result.includes("gettodobyid"), true);
  assertEquals(result.includes("updatetodo"), true);
  assertEquals(result.includes("deletetodo"), true);
});

Deno.test("generateClientFromOpenAPI - generates GET methods", () => {
  const result = generateClientFromOpenAPI(testApiData);
  
  assertEquals(result.includes('get = {'), true);
  assertEquals(result.includes("async (params:"), true);
});

Deno.test("generateClientFromOpenAPI - generates POST methods", () => {
  const result = generateClientFromOpenAPI(testApiData);
  
  assertEquals(result.includes('post = {'), true);
  assertEquals(result.includes("async (body:"), true);
});

Deno.test("generateClientFromOpenAPI - generates PUT methods with curried function", () => {
  const result = generateClientFromOpenAPI(testApiData);
  
  assertEquals(result.includes('put = {'), true);
  // Should have curried function pattern: (id: string) => async (body: ...)
  const putMethodPattern = /updatetodo.*\(id: string\).*=.*async.*\(body:/;
  assertEquals(putMethodPattern.test(result), true);
});

Deno.test("generateClientFromOpenAPI - generates DELETE methods", () => {
  const result = generateClientFromOpenAPI(testApiData);
  
  assertEquals(result.includes('delete = {'), true);
  // DELETE with response should parse JSON
  assertEquals(result.includes("deletetodo"), true);
});

Deno.test("generateClientFromOpenAPI - includes security documentation", () => {
  const apiDataWithSecurity: OpenAPIData = {
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/secure": {
        get: {
          operationId: "getSecure",
          summary: "Secure endpoint",
          security: [{ "basicAuth": [] }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {},
      securitySchemes: {
        basicAuth: {
          type: "http",
          scheme: "basic",
          description: "Basic authentication",
        },
      },
    },
    security: [{ "basicAuth": [] }],
  };

  const result = generateClientFromOpenAPI(apiDataWithSecurity);
  
  assertEquals(result.includes("@requires"), true);
  assertEquals(result.includes("Basic Authentication"), true);
});

Deno.test("generateClientFromOpenAPI - handles query parameters", () => {
  const apiDataWithParams: OpenAPIData = {
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/search": {
        get: {
          operationId: "search",
          summary: "Search",
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "number" },
            },
          ],
          responses: {
            "200": {
              description: "Results",
              content: {
                "application/json": {
                  schema: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  const result = generateClientFromOpenAPI(apiDataWithParams);
  
  assertEquals(result.includes('q: string'), true);
  assertEquals(result.includes('limit?: number'), true);
});

Deno.test("generateClientFromOpenAPI - handles inline response types", () => {
  const apiDataWithInlineTypes: OpenAPIData = {
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/inline": {
        get: {
          operationId: "getInline",
          summary: "Get inline response",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      count: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  const result = generateClientFromOpenAPI(apiDataWithInlineTypes);
  
  assertEquals(result.includes('{ message?: string; count?: number }'), true);
});

Deno.test("generateClientFromOpenAPI - handles property names with special characters", () => {
  const apiDataWithSpecialChars: OpenAPIData = {
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/special": {
        get: {
          operationId: "getSpecial",
          summary: "Get special",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      "taxonomy/id": { type: "string" },
                      "taxonomy/type": { type: "string" },
                    },
                    required: ["taxonomy/id"],
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  const result = generateClientFromOpenAPI(apiDataWithSpecialChars);
  
  assertEquals(result.includes('"taxonomy/id": string'), true);
  assertEquals(result.includes('"taxonomy/type"?: string'), true);
});

Deno.test("generateClientFromOpenAPI - handles anyOf in responses", () => {
  const apiDataWithAnyOf: OpenAPIData = {
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/anyof": {
        get: {
          operationId: "getAnyOf",
          summary: "Get anyOf",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    anyOf: [
                      { type: "string" },
                      { type: "number" },
                      { type: "boolean" },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  const result = generateClientFromOpenAPI(apiDataWithAnyOf);
  
  assertEquals(result.includes('string | number | boolean'), true);
});
