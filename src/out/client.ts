
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

class ApiClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  get = {
    todos: {
      queryParams: async (params: QueryParams = {}): Promise<ApiResponse<Todo[]>> => {
        const url = new URL(`${this.config.baseUrl}/todos`);
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            url.searchParams.append(key, String(value));
          }
        });
        
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: this.config.headers,
        });
        
        const data = await response.json();
        return {
          data,
          status: response.status,
          statusText: response.statusText,
        };
      },
    },
    todo: (id: string) => ({
      get: async (): Promise<ApiResponse<Todo>> => {
        const response = await fetch(`${this.config.baseUrl}/todos/${id}`, {
          method: 'GET',
          headers: this.config.headers,
        });
        
        const data = await response.json();
        return {
          data,
          status: response.status,
          statusText: response.statusText,
        };
      },
    }),
  };

  post = {
    todos: {
      data: async (body: TodoInput): Promise<ApiResponse<Todo>> => {
        const response = await fetch(`${this.config.baseUrl}/todos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
          },
          body: JSON.stringify(body),
        });
        
        const data = await response.json();
        return {
          data,
          status: response.status,
          statusText: response.statusText,
        };
      },
    },
  };

  put = {
    todo: (id: string) => ({
      data: async (body: TodoInput): Promise<ApiResponse<Todo>> => {
        const response = await fetch(`${this.config.baseUrl}/todos/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
          },
          body: JSON.stringify(body),
        });
        
        const data = await response.json();
        return {
          data,
          status: response.status,
          statusText: response.statusText,
        };
      },
    }),
  };

  delete = {
    todo: (id: string) => ({
      delete: async (): Promise<ApiResponse<void>> => {
        const response = await fetch(`${this.config.baseUrl}/todos/${id}`, {
          method: 'DELETE',
          headers: this.config.headers,
        });
        
        return {
          data: undefined,
          status: response.status,
          statusText: response.statusText,
        };
      },
    }),
  };

  patch = {
  };

}

export function createClient(config: ClientConfig): ApiClient {
  return new ApiClient(config);
}

// Type definitions
interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoInput {
  title: string;
  completed?: boolean;
}

// Example usage:
// const client = createClient({ baseUrl: 'https://api.example.com' });
// const todos = await client.get.todos.queryParams({});
// const newTodo = await client.post.todos.data({ title: 'New Todo', completed: false });
// const todo = await client.get.todo('123').get();
// const updatedTodo = await client.put.todo('123').data({ title: 'Updated Todo' });
// await client.delete.todo('123').delete();
