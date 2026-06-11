"use client";

import { useRef, useState } from "react";
import { uploadFile, deleteFile, downloadUrl, formatBytes } from "@/lib/api";
import type { TodoFile } from "@/lib/api";

interface Props {
  todoId: number;
  files: TodoFile[];
  onFilesChange: (files: TodoFile[]) => void;
}

export default function FileList({ todoId, files, onFilesChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(todoId, file);
      onFilesChange([...files, uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(fileId: number) {
    await deleteFile(fileId);
    onFilesChange(files.filter((f) => f.id !== fileId));
  }

  return (
    <div style={styles.wrapper}>
      {files.length > 0 && (
        <ul style={styles.list}>
          {files.map((f) => (
            <li key={f.id} style={styles.item}>
              <a href={downloadUrl(f.id)} target="_blank" rel="noopener" style={styles.link}>
                {f.original_name}
              </a>
              <span style={styles.size}>{formatBytes(f.file_size)}</span>
              <button style={styles.delBtn} onClick={() => handleDelete(f.id)} title="Удалить файл">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <label style={styles.uploadLabel}>
        <input ref={inputRef} type="file" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
        <span style={styles.uploadBtn}>{uploading ? "Загружаю..." : "Прикрепить файл"}</span>
      </label>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { marginTop: 10 },
  list: { listStyle: "none", display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#f8f9ff",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13,
  },
  link: { color: "#4f46e5", textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  size: { color: "#888", fontSize: 12, whiteSpace: "nowrap" },
  delBtn: {
    background: "none",
    border: "none",
    color: "#d00",
    fontSize: 18,
    lineHeight: 1,
    padding: "0 2px",
  },
  uploadLabel: { cursor: "pointer" },
  uploadBtn: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 6,
    border: "1.5px dashed #4f46e5",
    color: "#4f46e5",
    fontSize: 13,
    fontWeight: 500,
  },
};
