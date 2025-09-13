import { OpenAPIData } from "../types/interfaces.ts";

interface ClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

interface RequestBody {
  [key: string]: any;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

interface PathInfo {
  path: string;
  method: string;
  operation: any;
  resourceName: string;
  isCollection: boolean;
  isResource: boolean;
  pathParams: string[];
}

function extractUsedTypes(
  pathInfos: PathInfo[],
  apiData: OpenAPIData,
): string[] {
  const usedTypes = new Set<string>();

  // Extract types from all operations
  for (const pathInfo of pathInfos) {
    // Get request body type
    if (pathInfo.operation.requestBody) {
      const requestType = getRequestType(pathInfo.operation);
      if (requestType && requestType !== "any") {
        usedTypes.add(requestType);
      }
    }

    // Get response type
    const responseType = getResponseType(pathInfo.operation);
    if (
      responseType && responseType !== "any" && !responseType.includes("[]")
    ) {
      usedTypes.add(responseType);
    }
  }

  // Also include all schema types from the API
  if (apiData.components?.schemas) {
    for (const schemaName of Object.keys(apiData.components.schemas)) {
      usedTypes.add(schemaName);
    }
  }

  return Array.from(usedTypes).sort();
}

export function generateClientFromOpenAPI(apiData: OpenAPIData): string {
  const paths = apiData.paths;

  // Analyze all paths and extract resource information
  const pathInfos: PathInfo[] = [];

  for (const [path, pathObj] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathObj)) {
      if (typeof operation === "object" && operation !== null) {
        const pathInfo = analyzePath(path, method, operation);
        pathInfos.push(pathInfo);
      }
    }
  }

  // Group paths by resource and HTTP method
  const resourceGroups = groupPathsByResource(pathInfos);

  // Extract all unique types used in the API
  const usedTypes = extractUsedTypes(pathInfos, apiData);

  let clientCode = `// Auto-generated API client from OpenAPI specification
// Generated on: ${new Date().toISOString()}

// Import generated types
${usedTypes.map((type) => `import { ${type} } from "./types.ts";`).join("\n")}

type Servers = ${
    apiData.servers.map((s, i) => {
      return (i > 0 ? "|" : "") + "'" + s.url + "'";
    })
  };

interface ClientConfig {
  baseUrl: Servers | string & {};
  headers?: Record<string, string>;
}

interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

interface RequestBody {
  [key: string]: any;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

class ApiClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

`;

  // Generate HTTP method handlers dynamically
  const httpMethods = ["get", "post", "put", "delete", "patch"];

  for (const method of httpMethods) {
    clientCode += `  ${method} = {\n`;

    const methodPaths = resourceGroups[method] || {};

    for (let [resourceName, paths] of Object.entries(methodPaths)) {
      const collectionPath = paths.find((p) => p.isCollection);
      const resourcePath = paths.find((p) => p.isResource);
      resourceName = resourceName
        .replaceAll(".", "_")
        .replaceAll("-", "_")
        .toLowerCase();
      if (collectionPath) {
        clientCode += generateCollectionMethods(resourceName, collectionPath);
      }

      if (resourcePath) {
        clientCode += generateResourceMethods(resourceName, resourcePath);
      }
    }

    clientCode += `  };\n\n`;
  }

  clientCode += `}

export function createClient(config: ClientConfig): ApiClient {
  return new ApiClient(config);
}

`;

  return clientCode;
}

function analyzePath(path: string, method: string, operation: any): PathInfo {
  // Extract resource name from path
  const pathSegments = path.split("/").filter((segment) =>
    segment && !segment.startsWith("{")
  );
  const resourceName = pathSegments[pathSegments.length - 1] || "root";

  // Determine if this is a collection or resource endpoint
  const isCollection = !path.includes("{");
  const isResource = path.includes("{");

  // Extract path parameters
  const pathParams =
    path.match(/\{([^}]+)\}/g)?.map((param) => param.slice(1, -1)) || [];

  return {
    path,
    method,
    operation,
    resourceName,
    isCollection,
    isResource,
    pathParams,
  };
}

function groupPathsByResource(
  pathInfos: PathInfo[],
): Record<string, Record<string, PathInfo[]>> {
  const groups: Record<string, Record<string, PathInfo[]>> = {};

  for (const pathInfo of pathInfos) {
    if (!groups[pathInfo.method]) {
      groups[pathInfo.method] = {};
    }

    if (!groups[pathInfo.method][pathInfo.resourceName]) {
      groups[pathInfo.method][pathInfo.resourceName] = [];
    }

    groups[pathInfo.method][pathInfo.resourceName].push(pathInfo);
  }

  return groups;
}

function generateCollectionMethods(
  resourceName: string,
  pathInfo: PathInfo,
): string {
  let code = `    ${resourceName}: {\n`;

  // For GET requests, always generate queryParams method
  if (pathInfo.method === "get") {
    const responseType = getResponseType(pathInfo.operation);
    code +=
      `      queryParams: async (params: QueryParams = {}): Promise<ApiResponse<${responseType}>> => {\n`;
    code +=
      `        const url = new URL(\`\${this.config.baseUrl}${pathInfo.path}\`);\n`;
    code += `        Object.entries(params).forEach(([key, value]) => {\n`;
    code += `          if (value !== undefined) {\n`;
    code += `            url.searchParams.append(key, String(value));\n`;
    code += `          }\n`;
    code += `        });\n`;
    code += `        \n`;
    code += `        const response = await fetch(url.toString(), {\n`;
    code += `          method: '${pathInfo.method.toUpperCase()}',\n`;
    code += `          headers: this.config.headers,\n`;
    code += `        });\n`;
    code += `        \n`;
    code += `        const data = await response.json();\n`;
    code += `        return {\n`;
    code += `          data,\n`;
    code += `          status: response.status,\n`;
    code += `          statusText: response.statusText,\n`;
    code += `        };\n`;
    code += `      },\n`;
  }

  // Generate data method for POST/PUT/PATCH requests
  if (pathInfo.operation.requestBody) {
    const requestType = getRequestType(pathInfo.operation);
    const responseType = getResponseType(pathInfo.operation);
    code +=
      `      data: async (body: ${requestType}): Promise<ApiResponse<${responseType}>> => {\n`;
    code +=
      `        const response = await fetch(\`\${this.config.baseUrl}${pathInfo.path}\`, {\n`;
    code += `          method: '${pathInfo.method.toUpperCase()}',\n`;
    code += `          headers: {\n`;
    code += `            'Content-Type': 'application/json',\n`;
    code += `            ...this.config.headers,\n`;
    code += `          },\n`;
    code += `          body: JSON.stringify(body),\n`;
    code += `        });\n`;
    code += `        \n`;
    code += `        const data = await response.json();\n`;
    code += `        return {\n`;
    code += `          data,\n`;
    code += `          status: response.status,\n`;
    code += `          statusText: response.statusText,\n`;
    code += `        };\n`;
    code += `      },\n`;
  }

  code += `    },\n`;
  return code;
}

function generateResourceMethods(
  resourceName: string,
  pathInfo: PathInfo,
): string {
  const singularName = resourceName.endsWith("s")
    ? resourceName.slice(0, -1)
    : resourceName;
  const paramName = pathInfo.pathParams[0] || "id";

  let code = `    ${singularName}: (${paramName}: string) => ({\n`;

  // Generate get method for individual resources
  if (pathInfo.method === "get") {
    const responseType = getResponseType(pathInfo.operation);
    code += `      get: async (): Promise<ApiResponse<${responseType}>> => {\n`;
    code += `        const response = await fetch(\`\${this.config.baseUrl}${
      pathInfo.path.replace("{" + paramName + "}", "${" + paramName + "}")
    }\`, {\n`;
    code += `          method: '${pathInfo.method.toUpperCase()}',\n`;
    code += `          headers: this.config.headers,\n`;
    code += `        });\n`;
    code += `        \n`;
    code += `        const data = await response.json();\n`;
    code += `        return {\n`;
    code += `          data,\n`;
    code += `          status: response.status,\n`;
    code += `          statusText: response.statusText,\n`;
    code += `        };\n`;
    code += `      },\n`;
  }

  // Generate data method for POST/PUT/PATCH requests
  if (pathInfo.operation.requestBody) {
    const requestType = getRequestType(pathInfo.operation);
    const responseType = getResponseType(pathInfo.operation);
    code +=
      `      data: async (body: ${requestType}): Promise<ApiResponse<${responseType}>> => {\n`;
    code += `        const response = await fetch(\`\${this.config.baseUrl}${
      pathInfo.path.replace("{" + paramName + "}", "${" + paramName + "}")
    }\`, {\n`;
    code += `          method: '${pathInfo.method.toUpperCase()}',\n`;
    code += `          headers: {\n`;
    code += `            'Content-Type': 'application/json',\n`;
    code += `            ...this.config.headers,\n`;
    code += `          },\n`;
    code += `          body: JSON.stringify(body),\n`;
    code += `        });\n`;
    code += `        \n`;
    code += `        const data = await response.json();\n`;
    code += `        return {\n`;
    code += `          data,\n`;
    code += `          status: response.status,\n`;
    code += `          statusText: response.statusText,\n`;
    code += `        };\n`;
    code += `      },\n`;
  }

  // Generate delete method
  if (pathInfo.method === "delete") {
    code += `      delete: async (): Promise<ApiResponse<void>> => {\n`;
    code += `        const response = await fetch(\`\${this.config.baseUrl}${
      pathInfo.path.replace("{" + paramName + "}", "${" + paramName + "}")
    }\`, {\n`;
    code += `          method: '${pathInfo.method.toUpperCase()}',\n`;
    code += `          headers: this.config.headers,\n`;
    code += `        });\n`;
    code += `        \n`;
    code += `        return {\n`;
    code += `          data: undefined,\n`;
    code += `          status: response.status,\n`;
    code += `          statusText: response.statusText,\n`;
    code += `        };\n`;
    code += `      },\n`;
  }

  code += `    }),\n`;
  return code;
}

function getResponseType(operation: any): string {
  const response = operation.responses?.["200"] ||
    operation.responses?.["201"] || operation.responses?.["204"];
  if (!response) return "any";

  const schema = response.content?.["application/json"]?.schema;
  if (!schema) return "any";

  if (schema.$ref) {
    return schema.$ref.split("/").pop() || "any";
  }

  if (schema.type === "array") {
    const itemType = schema.items?.$ref
      ? schema.items.$ref.split("/").pop()
      : "any";
    return `${itemType}[]`;
  }

  return "any";
}

function getRequestType(operation: any): string {
  const schema = operation.requestBody?.content?.["application/json"]?.schema;
  if (!schema) return "any";

  if (schema.$ref) {
    return schema.$ref.split("/").pop() || "any";
  }

  return "any";
}
