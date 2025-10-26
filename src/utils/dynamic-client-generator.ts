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

  // Extract types from all operations - only include actual type names, not inline types
  for (const pathInfo of pathInfos) {
    // Get request body type
    if (pathInfo.operation.requestBody) {
      const requestType = getRequestType(pathInfo.operation);
      // Only add if it's a valid type name (not inline type with {)
      if (requestType && requestType !== "any" && !requestType.includes("{")) {
        // Check if it's an array and extract the base type
        const baseType = requestType.includes("[]") ? requestType.replace("[]", "") : requestType;
        if (baseType && baseType !== "any") {
          usedTypes.add(baseType);
        }
      }
    }

    // Get response type
    const responseType = getResponseType(pathInfo.operation);
    // Only add if it's a valid type name (not inline type with {)
    if (responseType && responseType !== "any" && !responseType.includes("{")) {
      // Check if it's an array and extract the base type
      if (responseType.includes("[]")) {
        const baseType = responseType.replace("[]", "");
        if (baseType && baseType !== "any") {
          usedTypes.add(baseType);
        }
      } else {
        usedTypes.add(responseType);
      }
    }
  }

  // Also include all schema types from the API
  if (apiData.components?.schemas) {
    for (const schemaName of Object.keys(apiData.components.schemas)) {
      usedTypes.add(schemaName);
    }
  }

  // Filter out TypeScript built-in types that shouldn't be imported
  const builtInTypes = ['string', 'number', 'boolean', 'any', 'unknown', 'never', 'void'];
  const filteredTypes = Array.from(usedTypes).filter(type => !builtInTypes.includes(type));
  
  return filteredTypes.sort();
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
${usedTypes.length > 0 ? usedTypes.map((type) => `import { ${type} } from "./types.ts";`).join("\n") : ""}

type Servers = ${
    apiData.servers?.map((s, i) => {
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
  // Check if there are any query parameters defined
  const hasQueryParams = pathInfo.operation.parameters?.some(
    (p: any) => p.in === "query"
  ) || false;
  
  // For GET requests without query params, use direct method
  // For POST/PUT/PATCH with requestBody but no query params, use direct method
  // Only use nested structure if there are query params
  const useNestedStructure = hasQueryParams;
  
  let code = useNestedStructure ? `    ${resourceName}: {\n` : `    ${resourceName}: `;

  // For GET requests
  if (pathInfo.method === "get") {
    const responseType = getResponseType(pathInfo.operation);
    const methodName = useNestedStructure ? getMethodName(pathInfo.operation, "queryParams") : "";
    const securityRequirements = getSecurityRequirements(pathInfo.operation, apiData);
    
    if (useNestedStructure) {
      code += `      /**\n`;
      code += `       * ${pathInfo.operation.summary || methodName}\n`;
      if (pathInfo.operation.description) {
        code += `       * ${pathInfo.operation.description}\n`;
      }
      if (securityRequirements.length > 0) {
        code += `       * @requires ${securityRequirements.join(', ')}\n`;
      }
      code += `       */\n`;
      const { type: queryParamsType, hasRequired: hasRequiredParams } = getQueryParamsType(pathInfo.operation);
      const defaultValue = hasRequiredParams ? "" : " = {}";
      code +=
        `      ${methodName}: async (params: ${queryParamsType}${defaultValue}): Promise<ApiResponse<${responseType}>> => {\n`;
    } else {
      code += `/**\n`;
      code += ` * ${pathInfo.operation.summary || resourceName}\n`;
      if (pathInfo.operation.description) {
        code += ` * ${pathInfo.operation.description}\n`;
      }
      if (securityRequirements.length > 0) {
        code += ` * @requires ${securityRequirements.join(', ')}\n`;
      }
      code += ` */\n`;
      const { type: queryParamsType, hasRequired: hasRequiredParams } = getQueryParamsType(pathInfo.operation);
      const defaultValue = hasRequiredParams ? "" : " = {}";
      code +=
        `async (params: ${queryParamsType}${defaultValue}): Promise<ApiResponse<${responseType}>> => {\n`;
      code += `      `;
    }
    code +=
      `const url = new URL(\`\${this.config.baseUrl}${pathInfo.path}\`);\n`;
    code += `${useNestedStructure ? '' : '      '}Object.entries(params).forEach(([key, value]) => {\n`;
    code += `${useNestedStructure ? '' : '      '}  if (value !== undefined) {\n`;
    code += `${useNestedStructure ? '' : '      '}    url.searchParams.append(key, String(value));\n`;
    code += `${useNestedStructure ? '' : '      '}  }\n`;
    code += `${useNestedStructure ? '' : '      '}});\n`;
    code += `        \n`;
    code += `${useNestedStructure ? '' : '      '}const response = await fetch(url.toString(), {\n`;
    code += `${useNestedStructure ? '' : '      '}  method: '${pathInfo.method.toUpperCase()}',\n`;
    code += `${useNestedStructure ? '' : '      '}  headers: this.config.headers,\n`;
    code += `${useNestedStructure ? '' : '      '}});\n`;
    code += `        \n`;
    code += `${useNestedStructure ? '' : '      '}const data = await response.json();\n`;
    code += `${useNestedStructure ? '' : '      '}return {\n`;
    code += `${useNestedStructure ? '' : '      '}  data,\n`;
    code += `${useNestedStructure ? '' : '      '}  status: response.status,\n`;
    code += `${useNestedStructure ? '' : '      '}  statusText: response.statusText,\n`;
    code += `${useNestedStructure ? '' : '      '}};\n`;
    code += useNestedStructure ? `      },\n` : `    },\n`;
  }

  // Generate data method for POST/PUT/PATCH requests
  if (pathInfo.operation.requestBody) {
    const requestType = getRequestType(pathInfo.operation);
    const responseType = getResponseType(pathInfo.operation);
    const methodName = useNestedStructure ? getMethodName(pathInfo.operation, "data") : "";
    const securityRequirements = getSecurityRequirements(pathInfo.operation, apiData);
    
    if (useNestedStructure) {
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
    } else {
      code += `/**\n`;
      code += ` * ${pathInfo.operation.summary || resourceName}\n`;
      if (pathInfo.operation.description) {
        code += ` * ${pathInfo.operation.description}\n`;
      }
      if (securityRequirements.length > 0) {
        code += ` * @requires ${securityRequirements.join(', ')}\n`;
      }
      code += ` */\n`;
      code +=
        `async (body: ${requestType}): Promise<ApiResponse<${responseType}>> => {\n`;
      code += `      `;
    }
    code +=
      `const response = await fetch(\`\${this.config.baseUrl}${pathInfo.path}\`, {\n`;
    code += `${useNestedStructure ? '' : '      '}  method: '${pathInfo.method.toUpperCase()}',\n`;
    code += `${useNestedStructure ? '' : '      '}  headers: {\n`;
    code += `${useNestedStructure ? '' : '      '}    'Content-Type': 'application/json',\n`;
    code += `${useNestedStructure ? '' : '      '}    ...this.config.headers,\n`;
    code += `${useNestedStructure ? '' : '      '}  },\n`;
    code += `${useNestedStructure ? '' : '      '}  body: JSON.stringify(body),\n`;
    code += `${useNestedStructure ? '' : '      '}});\n`;
    code += `        \n`;
    code += `${useNestedStructure ? '' : '      '}const data = await response.json();\n`;
    code += `${useNestedStructure ? '' : '      '}return {\n`;
    code += `${useNestedStructure ? '' : '      '}  data,\n`;
    code += `${useNestedStructure ? '' : '      '}  status: response.status,\n`;
    code += `${useNestedStructure ? '' : '      '}  statusText: response.statusText,\n`;
    code += `${useNestedStructure ? '' : '      '}};\n`;
    code += useNestedStructure ? `      },\n` : `    },\n`;
  }

  // Close the structure properly based on whether we used nested or direct structure
  // Only add closing if we're using nested structure and haven't closed it yet
  if (useNestedStructure) {
    code += `    },\n`;
  }
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

  const responseType = getResponseType(pathInfo.operation);
  const securityRequirements = getSecurityRequirements(pathInfo.operation, apiData);

  // If this is a GET request, return the old structure with .get() method
  if (pathInfo.method === "get") {
    const methodName = getMethodName(pathInfo.operation, "get");
    
    let code = `    ${singularName}: (${paramName}: string) => ({\n`;
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
    code += `    }),\n`;
    return code;
  }

  // For POST/PUT/PATCH requests with requestBody, make it return a function that takes the body
  if (pathInfo.operation.requestBody) {
    const requestType = getRequestType(pathInfo.operation);
    
    let code = `    ${singularName}: (${paramName}: string) => `;
    code += `/**\n`;
    code += ` * ${pathInfo.operation.summary || resourceName}\n`;
    if (pathInfo.operation.description) {
      code += ` * ${pathInfo.operation.description}\n`;
    }
    if (securityRequirements.length > 0) {
      code += ` * @requires ${securityRequirements.join(', ')}\n`;
    }
    code += ` */\n`;
    code +=
      `async (body: ${requestType}): Promise<ApiResponse<${responseType}>> => {\n`;
    code += `      const response = await fetch(\`\${this.config.baseUrl}${
      pathInfo.path.replace("{" + paramName + "}", "${" + paramName + "}")
    }\`, {\n`;
    code += `        method: '${pathInfo.method.toUpperCase()}',\n`;
    code += `        headers: {\n`;
    code += `          'Content-Type': 'application/json',\n`;
    code += `          ...this.config.headers,\n`;
    code += `        },\n`;
    code += `        body: JSON.stringify(body),\n`;
    code += `      });\n`;
    code += `      \n`;
    code += `      const data = await response.json();\n`;
    code += `      return {\n`;
    code += `        data,\n`;
    code += `        status: response.status,\n`;
    code += `        statusText: response.statusText,\n`;
    code += `      };\n`;
    code += `    },\n`;
    return code;
  }

  // Generate delete method
  if (pathInfo.method === "delete") {
    let code = `    ${singularName}: (${paramName}: string) => `;
    code += `/**\n`;
    code += ` * ${pathInfo.operation.summary || resourceName}\n`;
    if (pathInfo.operation.description) {
      code += ` * ${pathInfo.operation.description}\n`;
    }
    if (securityRequirements.length > 0) {
      code += ` * @requires ${securityRequirements.join(', ')}\n`;
    }
    code += ` */\n`;
    code += `async (): Promise<ApiResponse<void>> => {\n`;
    code += `      const response = await fetch(\`\${this.config.baseUrl}${
      pathInfo.path.replace("{" + paramName + "}", "${" + paramName + "}")
    }\`, {\n`;
    code += `        method: '${pathInfo.method.toUpperCase()}',\n`;
    code += `        headers: this.config.headers,\n`;
    code += `      });\n`;
    code += `      \n`;
    code += `      return {\n`;
    code += `        data: undefined,\n`;
    code += `        status: response.status,\n`;
    code += `        statusText: response.statusText,\n`;
    code += `      };\n`;
    code += `    },\n`;
    return code;
  }

  // Fallback: should not reach here
  return `    ${singularName}: () => {},\n`;
}

function getQueryParamsType(operation: any): { type: string, hasRequired: boolean } {
  if (!operation.parameters || !Array.isArray(operation.parameters)) {
    return { type: "QueryParams", hasRequired: false };
  }

  const queryParams = operation.parameters.filter((p: any) => p.in === "query");
  
  if (queryParams.length === 0) {
    return { type: "QueryParams", hasRequired: false };
  }

  const properties: string[] = [];
  let hasRequired = false;
  
  for (const param of queryParams) {
    const isRequired = param.required === true;
    if (isRequired) hasRequired = true;
    const optional = isRequired ? "" : "?";
    const paramType = convertSchemaToType(param.schema || { type: "string" });
    const paramName = param.name;
    // Escape property names that aren't valid identifiers
    const escapedParamName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(paramName) ? paramName : `"${paramName}"`;
    properties.push(`${escapedParamName}${optional}: ${paramType}`);
  }

  const type = properties.length > 0 ? `{ ${properties.join("; ")} }` : "QueryParams";
  return { type, hasRequired };
}

function getResponseType(operation: any): string {
  const response = operation.responses?.["200"] ||
    operation.responses?.["201"] || operation.responses?.["204"];
  if (!response) return "any";

  const schema = response.content?.["application/json"]?.schema;
  if (!schema) return "any";

  return convertSchemaToType(schema);
}

function getRequestType(operation: any): string {
  const schema = operation.requestBody?.content?.["application/json"]?.schema ||
                  operation.requestBody?.content?.["application/x-www-form-urlencoded"]?.schema;
  if (!schema) return "any";

  return convertSchemaToType(schema);
}

function convertSchemaToType(schema: any): string {
  if (!schema || typeof schema !== "object") {
    return "any";
  }

  if (schema.$ref) {
    // Extract type name from reference like "#/components/schemas/Todo"
    const refName = schema.$ref.split("/").pop() || "unknown";
    return refName;
  }
  
  // Handle anyOf, oneOf, allOf
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const types = schema.anyOf.map((s: any) => convertSchemaToType(s));
    return types.join(" | ");
  }
  
  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    const types = schema.oneOf.map((s: any) => convertSchemaToType(s));
    return types.join(" | ");
  }
  
  if (schema.allOf && Array.isArray(schema.allOf)) {
    const types = schema.allOf.map((s: any) => convertSchemaToType(s));
    return types.join(" & ");
  }
  
  if (schema.type === "string") {
    return "string";
  }
  
  if (schema.type === "number" || schema.type === "integer") {
    return "number";
  }
  
  if (schema.type === "boolean") {
    return "boolean";
  }
  
  if (schema.type === "array") {
    if (schema.items) {
      const itemType = convertSchemaToType(schema.items);
      return `${itemType}[]`;
    }
    return "any[]";
  }
  
  if (schema.type === "object") {
    // If it has properties, generate an inline type
    if (schema.properties) {
      const properties: string[] = [];
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = schema.required?.includes(propName) ?? false;
        const optional = isRequired ? "" : "?";
        const propType = convertSchemaToType(propSchema as any);
        // Escape property names that aren't valid identifiers
        const escapedPropName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName) ? propName : `"${propName}"`;
        properties.push(`${escapedPropName}${optional}: ${propType}`);
      }
      return `{ ${properties.join("; ")} }`;
    }
    return "Record<string, any>";
  }
  
  if (schema.enum) {
    const enumValues = schema.enum
      .map((value: any) => typeof value === "string" ? `"${value}"` : String(value))
      .join(" | ");
    return enumValues;
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
  
  // Determine parameters based on path and operation
  const pathParams = pathInfo.pathParams;
  const hasRequestBody = !!pathInfo.operation.requestBody;
  const hasPathParams = pathParams.length > 0;
  
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
  
  // For resource endpoints (with path params) with POST/PUT/DELETE, use curried function
  if (hasPathParams && (pathInfo.method === "post" || pathInfo.method === "put" || pathInfo.method === "delete" || pathInfo.method === "patch")) {
    const paramName = pathParams[0];
    
    // First function: takes the path parameter
    code += `(${paramName}: string) => `;
    
    if (hasRequestBody) {
      const requestType = getRequestType(pathInfo.operation);
      // Second function: takes the body
      code += `async (body: ${requestType}): Promise<ApiResponse<${responseType}>> => {\n`;
    } else {
      // Second function: no parameters (for DELETE)
      code += `async (): Promise<ApiResponse<${responseType}>> => {\n`;
    }
    
    // Build URL with path parameters
    let urlTemplate = pathInfo.path;
    pathParams.forEach(param => {
      urlTemplate = urlTemplate.replace(`{${param}}`, `\${${param}}`);
    });
    
    code += `      const response = await fetch(\`\${this.config.baseUrl}${urlTemplate}\`, {\n`;
    code += `        method: '${pathInfo.method.toUpperCase()}',\n`;
    
    if (hasRequestBody) {
      code += `        headers: {\n`;
      code += `          'Content-Type': 'application/json',\n`;
      code += `          ...this.config.headers,\n`;
      code += `        },\n`;
      code += `        body: JSON.stringify(body),\n`;
    } else {
      code += `        headers: this.config.headers,\n`;
    }
    
    code += `      });\n`;
    code += `      \n`;
    
    // Handle response
    if (pathInfo.method === "delete" && responseType.includes("void")) {
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
  
  // For collection endpoints or GET requests, use the original non-curried approach
  // Build parameter list
  const params: string[] = [];
  
  // Add path parameters
  pathParams.forEach(param => {
    params.push(`${param}: string`);
  });
  
  // Add query parameters for GET requests
  if (pathInfo.method === "get") {
    const { type: queryParamsType, hasRequired: hasRequiredParams } = getQueryParamsType(pathInfo.operation);
    const defaultValue = hasRequiredParams ? "" : " = {}";
    params.push(`params: ${queryParamsType}${defaultValue}`);
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
  if (pathInfo.method === "delete" && responseType.includes("void")) {
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
