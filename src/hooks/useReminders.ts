import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Reminder, ReminderInput } from "../types";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [fired, setFired] = useState<Reminder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await invoke<Reminder[]>("list_reminders");
      setReminders(list);
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

  // 定期刷新，更新“下次提醒”和到点自动停用的状态
  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen<Reminder>("reminder-fired", (event) => {
      if (cancelled) return;
      // 小怪兽模式只在屏幕边缘安静探头，不再弹应用内横幅
      if (event.payload.style !== "monster") {
        setFired({ ...event.payload });
      }
      void refresh();
    })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch((err) => {
        if (!cancelled) setError(messageOf(err));
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
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

  const createReminder = useCallback(
    (input: ReminderInput) =>
      guard(async () => {
        const reminder = await invoke<Reminder>("create_reminder", { input });
        await refresh();
        return reminder;
      }),
    [guard, refresh],
  );

  const updateReminder = useCallback(
    (id: number, input: ReminderInput) =>
      guard(async () => {
        const reminder = await invoke<Reminder>("update_reminder", { id, input });
        await refresh();
        return reminder;
      }),
    [guard, refresh],
  );

  const setEnabled = useCallback(
    (id: number, enabled: boolean) =>
      guard(async () => {
        await invoke<Reminder>("set_reminder_enabled", { id, enabled });
        await refresh();
      }),
    [guard, refresh],
  );

  const removeReminder = useCallback(
    (id: number) =>
      guard(async () => {
        await invoke("delete_reminder", { id });
        await refresh();
      }),
    [guard, refresh],
  );

  const setTodoRemindersEnabled = useCallback(
    (todoId: number, enabled: boolean) =>
      guard(async () => {
        await invoke("set_reminders_enabled_for_todo", { todoId, enabled });
        await refresh();
      }),
    [guard, refresh],
  );

  const removeRemindersForTodo = useCallback(
    (todoId: number) =>
      guard(async () => {
        await invoke("delete_reminders_for_todo", { todoId });
        await refresh();
      }),
    [guard, refresh],
  );

  const clearFired = useCallback(() => setFired(null), []);

  return {
    reminders,
    loading,
    fired,
    error,
    refresh,
    createReminder,
    updateReminder,
    setEnabled,
    removeReminder,
    setTodoRemindersEnabled,
    removeRemindersForTodo,
    clearFired,
  };
}
