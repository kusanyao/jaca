import { useCallback, useEffect, useState } from "react";
import type { Tag, Todo, TodoInput } from "../types";
import * as api from "../lib/todos";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextTodos, nextTags] = await Promise.all([api.listTodos(), api.listTags()]);
      setTodos(nextTodos);
      setTags(nextTags);
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const guard = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      const result = await action();
      setError(null);
      return result;
    } catch (err) {
      setError(messageOf(err));
      throw err;
    }
  }, []);

  const addTodo = useCallback(
    (input: TodoInput) =>
      guard(async () => {
        await api.createTodo(input);
        await refresh();
      }),
    [guard, refresh],
  );

  const editTodo = useCallback(
    (id: number, input: TodoInput) =>
      guard(async () => {
        await api.updateTodo(id, input);
        await refresh();
      }),
    [guard, refresh],
  );

  const toggleTodo = useCallback(
    (todo: Todo) =>
      guard(async () => {
        await api.setTodoCompleted(todo.id, !todo.completed);
        await refresh();
      }),
    [guard, refresh],
  );

  const removeTodo = useCallback(
    (id: number) =>
      guard(async () => {
        await api.deleteTodo(id);
        await refresh();
      }),
    [guard, refresh],
  );

  const addTag = useCallback(
    (name: string) =>
      guard(async () => {
        const tag = await api.createTag(name);
        await refresh();
        return tag;
      }),
    [guard, refresh],
  );

  const removeTag = useCallback(
    (id: number) =>
      guard(async () => {
        await api.deleteTag(id);
        await refresh();
      }),
    [guard, refresh],
  );

  return {
    todos,
    tags,
    loading,
    error,
    refresh,
    addTodo,
    editTodo,
    toggleTodo,
    removeTodo,
    addTag,
    removeTag,
  };
}
