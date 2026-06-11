"use client";

import { useState } from "react";
import { updateTodo, deleteTodo } from "@/lib/api";
import type { Todo, TodoFile } from "@/lib/api";
import FileList from "./FileList";

interface Props {
  todo: Todo;
  onUpdated: (todo: Todo) => void;
  onDeleted: (id: number) => void;
}

export default function TodoItem({ todo, onUpdated, onDeleted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description);
  const [saving, setSaving] = useState(false);

  async function toggleComplete() {
    const updated = await updateTodo(todo.id, { completed: !todo.completed });
    onUpdated(updated);
  }

  async function saveEdit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const updated = await updateTodo(todo.id, { title: title.trim(), description: description.trim() });
      onUpdated(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteTodo(todo.id);
    onDeleted(todo.id);
  }

  function handleFilesChange(files: TodoFile[]) {
    onUpdated({ ...todo, files });
  }

  const date = new Date(todo.created_at).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <div style={{ ...styles.card, opacity: todo.completed ? 0.7 : 1 }}>
      <div style={styles.header}>
        <button
          style={{ ...styles.checkbox, ...(todo.completed ? styles.checkboxDone : {}) }}
          onClick={toggleComplete}
          title={todo.completed ? "Отметить незавершённой" : "Отметить завершённой"}
        >
          {todo.completed && "✓"}
        </button>

        <div style={styles.meta} onClick={() => !editing && setExpanded((v) => !v)}>
          {editing ? (
            <input
              style={styles.editInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span style={{ ...styles.title, textDecoration: todo.completed ? "line-through" : "none" }}>
              {todo.title}
            </span>
          )}
          <span style={styles.date}>{date} · {todo.files.length} файл(ов)</span>
        </div>

        <div style={styles.actions}>
          {editing ? (
            <>
              <button style={styles.saveBtn} onClick={saveEdit} disabled={saving}>
                {saving ? "..." : "Сохранить"}
              </button>
              <button style={styles.cancelBtn} onClick={() => { setEditing(false); setTitle(todo.title); setDescription(todo.description); }}>
                Отмена
              </button>
            </>
          ) : (
            <>
              <button style={styles.iconBtn} onClick={() => { setEditing(true); setExpanded(true); }} title="Редактировать">✎</button>
              <button style={styles.iconBtnDel} onClick={handleDelete} title="Удалить">🗑</button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div style={styles.body}>
          {editing ? (
            <textarea
              style={styles.editTextarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Описание"
            />
          ) : (
            todo.description && <p style={styles.desc}>{todo.description}</p>
          )}
          <FileList todoId={todo.id} files={todo.files} onFilesChange={handleFilesChange} />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    overflow: "hidden",
    transition: "opacity 0.2s",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    cursor: "pointer",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: "2px solid #d0d0d0",
    background: "none",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    color: "#fff",
    transition: "all 0.15s",
  },
  checkboxDone: {
    background: "#4f46e5",
    borderColor: "#4f46e5",
  },
  meta: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 },
  title: { fontSize: 16, fontWeight: 500, color: "#1a1a2e" },
  date: { fontSize: 12, color: "#999" },
  actions: { display: "flex", gap: 6, flexShrink: 0 },
  iconBtn: { background: "none", border: "none", fontSize: 16, color: "#555" },
  iconBtnDel: { background: "none", border: "none", fontSize: 16, color: "#d00" },
  saveBtn: {
    padding: "5px 12px", borderRadius: 6, border: "none",
    background: "#4f46e5", color: "#fff", fontSize: 13, fontWeight: 600,
  },
  cancelBtn: {
    padding: "5px 12px", borderRadius: 6, border: "1.5px solid #ddd",
    background: "none", color: "#555", fontSize: 13,
  },
  body: { padding: "0 20px 16px 54px", display: "flex", flexDirection: "column", gap: 10 },
  desc: { fontSize: 14, color: "#555", lineHeight: 1.6 },
  editInput: {
    padding: "6px 10px", borderRadius: 6, border: "1.5px solid #4f46e5",
    fontSize: 15, width: "100%", outline: "none",
  },
  editTextarea: {
    padding: "8px 10px", borderRadius: 6, border: "1.5px solid #e0e0e0",
    fontSize: 14, width: "100%", outline: "none", resize: "vertical",
  },
};
