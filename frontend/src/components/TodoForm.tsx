"use client";

import { useState } from "react";
import { createTodo } from "@/lib/api";
import type { Todo } from "@/lib/api";

interface Props {
  onCreated: (todo: Todo) => void;
}

export default function TodoForm({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const todo = await createTodo(title.trim(), description.trim());
      onCreated(todo);
      setTitle("");
      setDescription("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.heading}>Новая задача</h2>
      <input
        style={styles.input}
        placeholder="Название задачи"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        style={styles.textarea}
        placeholder="Описание (необязательно)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />
      <button style={styles.btn} type="submit" disabled={loading}>
        {loading ? "Добавляю..." : "Добавить"}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    background: "#fff",
    borderRadius: 12,
    padding: "24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 32,
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
  },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #e0e0e0",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.2s",
  },
  textarea: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #e0e0e0",
    fontSize: 15,
    outline: "none",
    resize: "vertical",
    transition: "border-color 0.2s",
  },
  btn: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    alignSelf: "flex-start",
    transition: "background 0.2s",
  },
};
