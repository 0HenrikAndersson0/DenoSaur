import { OpenAPISchema, OpenAPIData } from "../types/interfaces.ts";


export const createTypesFromApiData = (apiData: OpenAPIData): string => {
    const schemas = apiData.components.schemas;
    if(schemas == undefined) {
      return "";
    }
    let typesContent = `// Auto-generated TypeScript types from OpenAPI schema
  // Generated on: ${new Date().toISOString()}
  
  `;
  
    for (const [typeName, schema] of Object.entries(schemas)) {
      typesContent += generateTypeDefinition(typeName, schema);
      typesContent += "\n\n";
    }
  
    return typesContent;
  };
  
  export const generateTypeDefinition = (typeName: string, schema: OpenAPISchema): string => {
    if (schema.type === "object" && schema.properties) {
      return generateInterface(typeName, schema);
    }
    
    if (schema.enum) {
      return generateEnum(typeName, schema);
    }
    
    return generateTypeAlias(typeName, schema);
  };
  
  export const generateInterface = (typeName: string, schema: OpenAPISchema): string => {
    let interfaceContent = `export interface ${typeName} {\n`;
    
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = schema.required?.includes(propName) ?? false;
        const optional = isRequired ? "" : "?";
        const propType = convertSchemaToType(propSchema);
        
        interfaceContent += `  ${propName}${optional}: ${propType};\n`;
      }
    }
    
    interfaceContent += "}";
    return interfaceContent;
  };
  
  export const generateEnum = (typeName: string, schema: OpenAPISchema): string => {
    if (!schema.enum) return "";
    
    const enumValues = schema.enum
      .map(value => typeof value === "string" ? `"${value}"` : String(value))
      .join(" | ");
    
    return `export type ${typeName} = ${enumValues};`;
  };
  
  export const generateTypeAlias = (typeName: string, schema: OpenAPISchema): string => {
    const type = convertSchemaToType(schema);
    return `export type ${typeName} = ${type};`;
  };
  
  export const convertSchemaToType = (schema: OpenAPISchema): string => {
    if (schema.$ref) {
      // Extract type name from reference like "#/components/schemas/Todo"
      const refName = schema.$ref.split("/").pop() || "unknown";
      return refName;
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
      return "Record<string, any>";
    }
    
    if (schema.enum) {
      const enumValues = schema.enum
        .map(value => typeof value === "string" ? `"${value}"` : String(value))
        .join(" | ");
      return enumValues;
    }
    
    return "any";
  };