"use client";

import { useEffect, useState } from "react";
import { fetchTodos } from "@/lib/api";
import type { Todo } from "@/lib/api";
import TodoForm from "@/components/TodoForm";
import TodoItem from "@/components/TodoItem";

type Filter = "all" | "active" | "done";

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTodos()
      .then(setTodos)
      .catch(() => setError("Не удалось загрузить задачи. Запущен ли бэкенд?"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = todos.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  const doneCount = todos.filter((t) => t.completed).length;

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <header style={styles.headerBlock}>
          <h1 style={styles.h1}>Todo</h1>
          <p style={styles.sub}>
            {todos.length} задач · {doneCount} выполнено
          </p>
        </header>

        <TodoForm onCreated={(todo) => setTodos((prev) => [todo, ...prev])} />

        <div style={styles.filters}>
          {(["all", "active", "done"] as Filter[]).map((f) => (
            <button
              key={f}
              style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Все" : f === "active" ? "Активные" : "Выполненные"}
            </button>
          ))}
        </div>

        {loading && <p style={styles.msg}>Загрузка...</p>}
        {error && <p style={{ ...styles.msg, color: "#d00" }}>{error}</p>}

        <div style={styles.list}>
          {!loading && filtered.length === 0 && (
            <p style={styles.msg}>Нет задач</p>
          )}
          {filtered.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onUpdated={(updated) => setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
              onDeleted={(id) => setTodos((prev) => prev.filter((t) => t.id !== id))}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    padding: "40px 16px",
  },
  container: {
    maxWidth: 680,
    margin: "0 auto",
  },
  headerBlock: {
    marginBottom: 32,
  },
  h1: {
    fontSize: 36,
    fontWeight: 700,
    color: "#4f46e5",
  },
  sub: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  filters: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
  },
  filterBtn: {
    padding: "6px 16px",
    borderRadius: 20,
    border: "1.5px solid #e0e0e0",
    background: "#fff",
    fontSize: 13,
    color: "#555",
    transition: "all 0.15s",
  },
  filterBtnActive: {
    background: "#4f46e5",
    borderColor: "#4f46e5",
    color: "#fff",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  msg: {
    textAlign: "center",
    color: "#aaa",
    fontSize: 15,
    padding: "20px 0",
  },
};
