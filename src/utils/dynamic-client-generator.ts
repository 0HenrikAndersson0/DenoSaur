import type { OpenAPIData } from "../types/interfaces.ts";

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
    const directMethods: string[] = [];
    const fallbackMethods: string[] = [];

    for (let [resourceName, paths] of Object.entries(methodPaths)) {
      const collectionPath = paths.find((p) => p.isCollection);
      const resourcePath = paths.find((p) => p.isResource);
      resourceName = resourceName
        .replaceAll(".", "_")
        .replaceAll("-", "_")
        .toLowerCase();

      // Check if paths have operationId
      if (collectionPath && collectionPath.operation.operationId) {
        directMethods.push(generateDirectMethod(collectionPath, apiData));
      } else if (collectionPath) {
        fallbackMethods.push(generateCollectionMethods(resourceName, collectionPath, apiData));
      }

      if (resourcePath && resourcePath.operation.operationId) {
        directMethods.push(generateDirectMethod(resourcePath, apiData));
      } else if (resourcePath) {
        fallbackMethods.push(generateResourceMethods(resourceName, resourcePath, apiData));
      }
    }

    // Add direct methods first
    directMethods.forEach(methodCode => {
      clientCode += methodCode;
    });

    // Add fallback methods
    fallbackMethods.forEach(methodCode => {
      clientCode += methodCode;
    });

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
  apiData: OpenAPIData,
): string {
  let code = `    ${resourceName}: {\n`;

  // For GET requests, always generate queryParams method
  if (pathInfo.method === "get") {
    const responseType = getResponseType(pathInfo.operation);
    const methodName = getMethodName(pathInfo.operation, "queryParams");
    const securityRequirements = getSecurityRequirements(pathInfo.operation, apiData);
    
    code += `      /**\n`;
    code += `       * ${pathInfo.operation.summary || methodName}\n`;
    if (pathInfo.operation.description) {
      code += `       * ${pathInfo.operation.description}\n`;
    }
    if (securityRequirements.length > 0) {
      code += `       * @requires ${securityRequirements.join(', ')}\n`;
    }
    code += `       */\n`;
    code +=
      `      ${methodName}: async (params: QueryParams = {}): Promise<ApiResponse<${responseType}>> => {\n`;
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
    const methodName = getMethodName(pathInfo.operation, "data");
    const securityRequirements = getSecurityRequirements(pathInfo.operation, apiData);
    
    code += `      /**\n`;
    code += `       * ${pathInfo.operation.summary || methodName}\n`;
    if (pathInfo.operation.description) {
      code += `       * ${pathInfo.operation.description}\n`;
    }
    if (securityRequirements.length > 0) {
      code += `       * @requires ${securityRequirements.join(', ')}\n`;
    }
    code += `       */\n`;
    code +=
      `      ${methodName}: async (body: ${requestType}): Promise<ApiResponse<${responseType}>> => {\n`;
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
  apiData: OpenAPIData,
): string {
  const singularName = resourceName.endsWith("s")
    ? resourceName.slice(0, -1)
    : resourceName;
  const paramName = pathInfo.pathParams[0] || "id";

  let code = `    ${singularName}: (${paramName}: string) => ({\n`;

  // Generate get method for individual resources
  if (pathInfo.method === "get") {
    const responseType = getResponseType(pathInfo.operation);
    const methodName = getMethodName(pathInfo.operation, "get");
    const securityRequirements = getSecurityRequirements(pathInfo.operation, apiData);
    
    code += `      /**\n`;
    code += `       * ${pathInfo.operation.summary || methodName}\n`;
    if (pathInfo.operation.description) {
      code += `       * ${pathInfo.operation.description}\n`;
    }
    if (securityRequirements.length > 0) {
      code += `       * @requires ${securityRequirements.join(', ')}\n`;
    }
    code += `       */\n`;
    code += `      ${methodName}: async (): Promise<ApiResponse<${responseType}>> => {\n`;
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
    const methodName = getMethodName(pathInfo.operation, "data");
    const securityRequirements = getSecurityRequirements(pathInfo.operation, apiData);
    
    code += `      /**\n`;
    code += `       * ${pathInfo.operation.summary || methodName}\n`;
    if (pathInfo.operation.description) {
      code += `       * ${pathInfo.operation.description}\n`;
    }
    if (securityRequirements.length > 0) {
      code += `       * @requires ${securityRequirements.join(', ')}\n`;
    }
    code += `       */\n`;
    code +=
      `      ${methodName}: async (body: ${requestType}): Promise<ApiResponse<${responseType}>> => {\n`;
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
    const methodName = getMethodName(pathInfo.operation, "delete");
    const securityRequirements = getSecurityRequirements(pathInfo.operation, apiData);
    
    code += `      /**\n`;
    code += `       * ${pathInfo.operation.summary || methodName}\n`;
    if (pathInfo.operation.description) {
      code += `       * ${pathInfo.operation.description}\n`;
    }
    if (securityRequirements.length > 0) {
      code += `       * @requires ${securityRequirements.join(', ')}\n`;
    }
    code += `       */\n`;
    code += `      ${methodName}: async (): Promise<ApiResponse<void>> => {\n`;
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

function getMethodName(operation: any, fallback: string): string {
  if (operation.operationId) {
    // Convert operationId to camelCase and remove any special characters
    return operation.operationId
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map((word: string, index: number) => 
        index === 0 
          ? word.toLowerCase() 
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }
  return fallback;
}

function getSecurityRequirements(operation: any, apiData: OpenAPIData): string[] {
  // Check if operation has specific security requirements
  const operationSecurity = operation.security;
  
  // If operation has no specific security, use global security
  const securityToCheck = operationSecurity || apiData.security || [];
  
  const authTypes: string[] = [];
  
  for (const securityRequirement of securityToCheck) {
    for (const [schemeName, scopes] of Object.entries(securityRequirement)) {
      const scheme = apiData.components?.securitySchemes?.[schemeName];
      if (scheme) {
        switch (scheme.type) {
          case 'http':
            if (scheme.scheme === 'basic') {
              authTypes.push('Basic Authentication');
            } else if (scheme.scheme === 'bearer') {
              authTypes.push('Bearer Token');
            } else {
              authTypes.push(`HTTP ${scheme.scheme?.toUpperCase()}`);
            }
            break;
          case 'apiKey':
            authTypes.push(`API Key (${scheme.in}: ${scheme.name})`);
            break;
          case 'oauth2':
            authTypes.push(`OAuth2${Array.isArray(scopes) && scopes.length > 0 ? ` (${scopes.join(', ')})` : ''}`);
            break;
          case 'openIdConnect':
            authTypes.push('OpenID Connect');
            break;
          default:
            authTypes.push(schemeName);
        }
      }
    }
  }
  
  return authTypes;
}

function generateDirectMethod(pathInfo: PathInfo, apiData: OpenAPIData): string {
  const methodName = getMethodName(pathInfo.operation, "");
  const responseType = getResponseType(pathInfo.operation);
  const securityRequirements = getSecurityRequirements(pathInfo.operation, apiData);
  
  let code = `    /**\n`;
  code += `     * ${pathInfo.operation.summary || methodName}\n`;
  if (pathInfo.operation.description) {
    code += `     * ${pathInfo.operation.description}\n`;
  }
  if (securityRequirements.length > 0) {
    code += `     * @requires ${securityRequirements.join(', ')}\n`;
  }
  code += `     */\n`;
  code += `    ${methodName}: `;
  
  // Determine parameters based on path and operation
  const pathParams = pathInfo.pathParams;
  const hasRequestBody = !!pathInfo.operation.requestBody;
  
  // Build parameter list
  const params: string[] = [];
  
  // Add path parameters
  pathParams.forEach(param => {
    params.push(`${param}: string`);
  });
  
  // Add query parameters for GET requests
  if (pathInfo.method === "get") {
    params.push("params: QueryParams = {}");
  }
  
  // Add request body for POST/PUT/PATCH requests
  if (hasRequestBody) {
    const requestType = getRequestType(pathInfo.operation);
    params.push(`body: ${requestType}`);
  }
  
  const paramString = params.length > 0 ? `(${params.join(", ")})` : "()";
  
  code += `async ${paramString}: Promise<ApiResponse<${responseType}>> => {\n`;
  
  // Build URL with path parameters
  let urlTemplate = `\`\${this.config.baseUrl}${pathInfo.path}\``;
  pathParams.forEach(param => {
    urlTemplate = urlTemplate.replace(`{${param}}`, `\${${param}}`);
  });
  
  code += `      const url = new URL(${urlTemplate});\n`;
  
  // Add query parameters handling for GET requests
  if (pathInfo.method === "get") {
    code += `      Object.entries(params).forEach(([key, value]) => {\n`;
    code += `        if (value !== undefined) {\n`;
    code += `          url.searchParams.append(key, String(value));\n`;
    code += `        }\n`;
    code += `      });\n`;
  }
  
  code += `      \n`;
  
  // Build fetch options
  const fetchOptions: string[] = [];
  fetchOptions.push(`method: '${pathInfo.method.toUpperCase()}'`);
  
  if (hasRequestBody) {
    fetchOptions.push(`headers: {\n        'Content-Type': 'application/json',\n        ...this.config.headers,\n      }`);
    fetchOptions.push(`body: JSON.stringify(body)`);
  } else {
    fetchOptions.push(`headers: this.config.headers`);
  }
  
  const fetchOptionsString = fetchOptions.join(",\n      ");
  
  code += `      const response = await fetch(url.toString(), {\n`;
  code += `        ${fetchOptionsString}\n`;
  code += `      });\n`;
  code += `      \n`;
  
  // Handle response
  if (pathInfo.method === "delete" && !responseType.includes("void")) {
    code += `      return {\n`;
    code += `        data: undefined,\n`;
    code += `        status: response.status,\n`;
    code += `        statusText: response.statusText,\n`;
    code += `      };\n`;
  } else {
    code += `      const data = await response.json();\n`;
    code += `      return {\n`;
    code += `        data,\n`;
    code += `        status: response.status,\n`;
    code += `        statusText: response.statusText,\n`;
    code += `      };\n`;
  }
  
  code += `    },\n`;
  
  return code;
}
