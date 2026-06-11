const BASE = "https://api.malikarakh.uz";

export interface TodoFile {
  id: number;
  original_name: string;
  file_size: number;
  uploaded_at: string;
}

export interface Todo {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  created_at: string;
  files: TodoFile[];
}

export async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch(`${BASE}/todos`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch todos");
  return res.json();
}

export async function createTodo(title: string, description: string): Promise<Todo> {
  const res = await fetch(`${BASE}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
  if (!res.ok) throw new Error("Failed to create todo");
  return res.json();
}

export async function updateTodo(id: number, data: Partial<Pick<Todo, "title" | "description" | "completed">>): Promise<Todo> {
  const res = await fetch(`${BASE}/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update todo");
  return res.json();
}

export async function deleteTodo(id: number): Promise<void> {
  const res = await fetch(`${BASE}/todos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete todo");
}

export async function uploadFile(todoId: number, file: File): Promise<TodoFile> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/todos/${todoId}/files`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload file");
  return res.json();
}

export async function deleteFile(fileId: number): Promise<void> {
  const res = await fetch(`${BASE}/files/${fileId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete file");
}

export function downloadUrl(fileId: number): string {
  return `${BASE}/files/${fileId}/download`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
