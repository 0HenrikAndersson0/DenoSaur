import { createClient } from "./client.ts";

const client = createClient({
  baseUrl: "https://api.example.com",
});

const todos = await client.post.todos.data({
  title: "New Todo",
  completed: false,
});

console.log(todos);