export interface OpenAPISchema {
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  enum?: any[];
  $ref?: string;
}

export interface OpenAPIData {
  servers: [
    {
      "url": string;
    },
  ];
  paths: Record<string, object>;
  security?: Array<Record<string, string[]>>;
  components: {
    schemas: Record<string, OpenAPISchema>;
    securitySchemes?: Record<string, {
      type: string;
      scheme?: string;
      name?: string;
      in?: string;
      description?: string;
    }>;
  };
}
