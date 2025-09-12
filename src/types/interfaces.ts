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
  components: {
    schemas: Record<string, OpenAPISchema>;
  };
}
