import { getDb } from "./db";
import type { Priority, Tag, Todo, TodoInput } from "../types";

interface TodoRow {
  id: number;
  title: string;
  notes: string;
  priority: number;
  due_at: string | null;
  completed: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  id: number;
  name: string;
  color: string;
}

interface TodoTagRow {
  todo_id: number;
  id: number;
  name: string;
  color: string;
}

const TAG_COLORS = ["#5b7cfa", "#2fa38a", "#d98b3a", "#b564d6", "#d95b7a", "#4f9cc9", "#8a7f52"];

function toTodo(row: TodoRow, tags: Tag[]): Todo {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    priority: Math.min(2, Math.max(0, row.priority)) as Priority,
    dueAt: row.due_at,
    completed: row.completed === 1,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
  };
}

export async function listTodos(): Promise<Todo[]> {
  const db = await getDb();
  const [rows, links] = await Promise.all([
    db.select<TodoRow[]>("SELECT * FROM todos ORDER BY created_at DESC"),
    db.select<TodoTagRow[]>(
      "SELECT tt.todo_id, t.id, t.name, t.color FROM todo_tags tt JOIN tags t ON t.id = tt.tag_id ORDER BY t.name",
    ),
  ]);

  const tagsByTodo = new Map<number, Tag[]>();
  for (const link of links) {
    const tags = tagsByTodo.get(link.todo_id) ?? [];
    tags.push({ id: link.id, name: link.name, color: link.color });
    tagsByTodo.set(link.todo_id, tags);
  }

  return rows.map((row) => toTodo(row, tagsByTodo.get(row.id) ?? []));
}

async function replaceTodoTags(todoId: number, tagIds: number[]): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM todo_tags WHERE todo_id = ?", [todoId]);
  const unique = [...new Set(tagIds)];
  for (const tagId of unique) {
    await db.execute("INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)", [todoId, tagId]);
  }
}

export async function createTodo(input: TodoInput): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.execute(
    `INSERT INTO todos (title, notes, priority, due_at, completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [
      input.title.trim(),
      input.notes?.trim() ?? "",
      input.priority ?? 1,
      input.dueAt ?? null,
      now,
      now,
    ],
  );
  const id = Number(result.lastInsertId);
  await replaceTodoTags(id, input.tagIds ?? []);
  return id;
}

export async function updateTodo(id: number, input: TodoInput): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE todos
     SET title = ?, notes = ?, priority = ?, due_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.title.trim(),
      input.notes?.trim() ?? "",
      input.priority ?? 1,
      input.dueAt ?? null,
      now,
      id,
    ],
  );
  await replaceTodoTags(id, input.tagIds ?? []);
}

export async function setTodoCompleted(id: number, completed: boolean): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    "UPDATE todos SET completed = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    [completed ? 1 : 0, completed ? now : null, now, id],
  );
}

export async function deleteTodo(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM todo_tags WHERE todo_id = ?", [id]);
  await db.execute("DELETE FROM todos WHERE id = ?", [id]);
}

export async function listTags(): Promise<Tag[]> {
  const db = await getDb();
  return db.select<TagRow[]>("SELECT * FROM tags ORDER BY name COLLATE NOCASE");
}

export async function createTag(name: string): Promise<Tag> {
  const db = await getDb();
  const trimmed = name.trim();
  const existing = await db.select<TagRow[]>("SELECT * FROM tags WHERE name = ?", [trimmed]);
  if (existing.length > 0) return existing[0];

  const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  const result = await db.execute("INSERT INTO tags (name, color) VALUES (?, ?)", [trimmed, color]);
  return { id: Number(result.lastInsertId), name: trimmed, color };
}

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM todo_tags WHERE tag_id = ?", [id]);
  await db.execute("DELETE FROM tags WHERE id = ?", [id]);
}
