import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTodos } from "./hooks/useTodos";
import { useReminders } from "./hooks/useReminders";
import { Sidebar } from "./components/Sidebar";
import type { Counts } from "./components/Sidebar";
import { QuickAdd } from "./components/QuickAdd";
import { TodoList } from "./components/TodoList";
import { TodoEditor } from "./components/TodoEditor";
import { RemindersView } from "./components/RemindersView";
import { ReminderEditor } from "./components/ReminderEditor";
import { ReminderToast } from "./components/ReminderToast";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { IconPlus } from "./components/icons";
import type {
  Filter,
  Reminder,
  ReminderInput,
  Tag,
  Todo,
  TodoInput,
  TodoReminderDraft,
} from "./types";
import { isOverdue, isToday, todayLabel } from "./lib/date";

const FILTER_TITLES = {
  all: "全部任务",
  today: "今天",
  overdue: "已过期",
  completed: "已完成",
  reminders: "定时提醒",
} as const;

const EMPTY_COPY: Record<
  Exclude<Filter["kind"], "tag" | "reminders">,
  { title: string; hint: string }
> = {
  all: { title: "还没有待办", hint: "在上方输入框添加第一项工作内容。" },
  today: { title: "今天没有待办", hint: "给今天留点空隙，或者添加一项新任务。" },
  overdue: { title: "没有过期任务", hint: "所有任务都在计划之内。" },
  completed: { title: "还没有完成的任务", hint: "勾选完成的任务会出现在这里。" },
};

const TAG_EMPTY = { title: "这个标签下还没有任务", hint: "新建或编辑待办时选择该标签即可归类。" };

function dueTime(todo: Todo): number {
  return todo.dueAt ? new Date(todo.dueAt).getTime() : Number.POSITIVE_INFINITY;
}

function sortTodos(a: Todo, b: Todo): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  const dueDiff = dueTime(a) - dueTime(b);
  if (dueDiff !== 0) return dueDiff;
  if (a.priority !== b.priority) return b.priority - a.priority;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

interface ConfirmState {
  title: string;
  message: string;
  confirmText: string;
  action: () => Promise<void>;
}

export default function App() {
  const {
    todos,
    tags,
    loading,
    error: todoError,
    refresh,
    addTodo,
    editTodo,
    toggleTodo,
    removeTodo,
    addTag,
    removeTag,
  } = useTodos();

  const {
    reminders,
    loading: remindersLoading,
    fired,
    error: reminderError,
    refresh: refreshReminders,
    createReminder,
    updateReminder,
    setEnabled,
    removeReminder,
    setTodoRemindersEnabled,
    removeRemindersForTodo,
    clearFired,
  } = useReminders();

  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [editor, setEditor] = useState<{ todo: Todo | null } | null>(null);
  const [reminderEditor, setReminderEditor] = useState<{ reminder: Reminder | null } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const error = todoError ?? reminderError;
  const isReminders = filter.kind === "reminders";

  const counts = useMemo<Counts>(() => {
    const byTag: Record<number, number> = {};
    let all = 0;
    let today = 0;
    let overdue = 0;
    let completed = 0;

    for (const todo of todos) {
      if (todo.completed) {
        completed += 1;
        continue;
      }
      all += 1;
      if (isToday(todo.dueAt)) today += 1;
      if (isOverdue(todo.dueAt)) overdue += 1;
      for (const tag of todo.tags) {
        byTag[tag.id] = (byTag[tag.id] ?? 0) + 1;
      }
    }

    return {
      all,
      today,
      overdue,
      completed,
      reminders: reminders.filter((reminder) => reminder.enabled).length,
      byTag,
    };
  }, [todos, reminders]);

  const visibleTodos = useMemo(() => {
    const filtered = todos.filter((todo) => {
      switch (filter.kind) {
        case "all":
          return true;
        case "today":
          return !todo.completed && isToday(todo.dueAt);
        case "overdue":
          return !todo.completed && isOverdue(todo.dueAt);
        case "completed":
          return todo.completed;
        case "tag":
          return todo.tags.some((tag) => tag.id === filter.tagId);
        case "reminders":
          return false;
      }
    });
    return [...filtered].sort(sortTodos);
  }, [todos, filter]);

  const activeTag = filter.kind === "tag" ? tags.find((tag) => tag.id === filter.tagId) : undefined;
  const title = filter.kind === "tag" ? activeTag?.name ?? "标签" : FILTER_TITLES[filter.kind];

  useEffect(() => {
    if (filter.kind === "tag" && !tags.some((tag) => tag.id === filter.tagId)) {
      setFilter({ kind: "all" });
    }
  }, [filter, tags]);

  // 小怪兽点击“查看详情”：打开对应待办或提醒
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen<{ reminderId: number; todoId: number | null }>(
      "open-reminder-detail",
      (event) => {
        if (cancelled) return;
        const { reminderId, todoId } = event.payload;

        if (todoId !== null) {
          const todo = todos.find((item) => item.id === todoId);
          if (todo) {
            setEditor({ todo });
            return;
          }
        }

        const reminder = reminders.find((item) => item.id === reminderId);
        setFilter({ kind: "reminders" });
        if (reminder) setReminderEditor({ reminder });
      },
    ).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [todos, reminders]);

  async function handleQuickAdd(value: string) {
    try {
      await addTodo({ title: value });
    } catch {
      // 错误由 useTodos 存入 error，顶部错误条展示
    }
  }

  async function handleSave(input: TodoInput, reminderDraft: TodoReminderDraft | null) {
    if (editor?.todo) {
      const todoId = editor.todo.id;
      await editTodo(todoId, input);

      const linked = reminders.find((item) => item.todoId === todoId) ?? null;
      if (reminderDraft) {
        const payload: ReminderInput = {
          title: input.title,
          body: "别忘了完成这项待办",
          intervalMinutes: reminderDraft.intervalMinutes,
          style: reminderDraft.style,
          todoId,
          startAt: reminderDraft.startAt,
          endAt: reminderDraft.endAt,
        };
        if (linked) {
          await updateReminder(linked.id, payload);
        } else {
          await createReminder(payload);
        }
      } else if (linked) {
        await removeReminder(linked.id);
      }
    } else {
      const id = await addTodo(input);
      if (reminderDraft) {
        await createReminder({
          title: input.title,
          body: "别忘了完成这项待办",
          intervalMinutes: reminderDraft.intervalMinutes,
          style: reminderDraft.style,
          todoId: id,
          startAt: reminderDraft.startAt,
          endAt: reminderDraft.endAt,
        });
      }
    }
  }

  async function handleToggle(todo: Todo) {
    try {
      await toggleTodo(todo);
      // 完成时停用关联提醒，重新打开时恢复（时段已结束的提醒会被后端拒绝）
      await setTodoRemindersEnabled(todo.id, todo.completed);
    } catch {
      // 错误由 hooks 记录并显示
    }
  }

  function requestDeleteTodo(todo: Todo) {
    setConfirm({
      title: "删除待办",
      message: `确定删除「${todo.title}」吗？此操作无法撤销。`,
      confirmText: "删除",
      action: async () => {
        await removeRemindersForTodo(todo.id);
        await removeTodo(todo.id);
      },
    });
  }

  function requestDeleteTag(tag: Tag) {
    setConfirm({
      title: "删除标签",
      message: `确定删除标签「${tag.name}」吗？它会从所有待办中移除，待办本身不会被删除。`,
      confirmText: "删除",
      action: async () => {
        await removeTag(tag.id);
        if (filter.kind === "tag" && filter.tagId === tag.id) {
          setFilter({ kind: "all" });
        }
      },
    });
  }

  async function handleReminderSave(input: ReminderInput) {
    if (reminderEditor?.reminder) {
      await updateReminder(reminderEditor.reminder.id, input);
    } else {
      await createReminder(input);
    }
  }

  function requestDeleteReminder(reminder: Reminder) {
    setConfirm({
      title: "删除提醒",
      message: `确定删除提醒「${reminder.title}」吗？删除后将不再触发。`,
      confirmText: "删除",
      action: () => removeReminder(reminder.id),
    });
  }

  const empty =
    filter.kind === "tag"
      ? TAG_EMPTY
      : filter.kind === "reminders"
        ? { title: "", hint: "" }
        : EMPTY_COPY[filter.kind];

  const editingReminder = editor?.todo
    ? reminders.find((item) => item.todoId === editor.todo?.id) ?? null
    : null;

  return (
    <div className="app">
      <Sidebar
        filter={filter}
        tags={tags}
        counts={counts}
        onFilterChange={setFilter}
        onCreateTag={addTag}
        onDeleteTag={requestDeleteTag}
      />

      <main className="main">
        <div className="main-inner">
          {error && (
            <div className="error-banner" role="alert">
              <span>操作失败：{error}</span>
              <button
                type="button"
                onClick={() => {
                  void refresh();
                  void refreshReminders();
                }}
              >
                重试
              </button>
            </div>
          )}

          <header className="main-header">
            <div>
              <p className="eyebrow">{todayLabel()}</p>
              <h2>{title}</h2>
            </div>
            {isReminders ? (
              <button
                type="button"
                className="button primary"
                onClick={() => setReminderEditor({ reminder: null })}
              >
                <IconPlus width={16} height={16} />
                新建提醒
              </button>
            ) : (
              <button type="button" className="button primary" onClick={() => setEditor({ todo: null })}>
                <IconPlus width={16} height={16} />
                新建待办
              </button>
            )}
          </header>

          {isReminders ? (
            <RemindersView
              reminders={reminders}
              loading={remindersLoading}
              onCreate={() => setReminderEditor({ reminder: null })}
              onEdit={(reminder) => setReminderEditor({ reminder })}
              onToggle={(reminder) => {
                void setEnabled(reminder.id, !reminder.enabled).catch(() => {
                  // 错误已由 useReminders 记录并显示
                });
              }}
              onDelete={requestDeleteReminder}
            />
          ) : (
            <>
              <QuickAdd onAdd={handleQuickAdd} onOpenEditor={() => setEditor({ todo: null })} />

              <div className="list-meta">
                <span>{visibleTodos.length} 项</span>
                {counts.overdue > 0 && filter.kind !== "overdue" && (
                  <button
                    type="button"
                    className="meta-link"
                    onClick={() => setFilter({ kind: "overdue" })}
                  >
                    {counts.overdue} 项已过期
                  </button>
                )}
              </div>

              {loading ? (
                <div className="loading-state">
                  <span className="spinner" />
                  正在加载…
                </div>
              ) : (
                <TodoList
                  todos={visibleTodos}
                  emptyTitle={empty.title}
                  emptyHint={empty.hint}
                  onToggle={handleToggle}
                  onEdit={(todo) => setEditor({ todo })}
                  onDelete={requestDeleteTodo}
                />
              )}
            </>
          )}
        </div>
      </main>

      {editor && (
        <TodoEditor
          key={editor.todo?.id ?? "new"}
          todo={editor.todo}
          reminder={editingReminder}
          tags={tags}
          onClose={() => setEditor(null)}
          onSave={handleSave}
          onCreateTag={addTag}
        />
      )}

      {reminderEditor && (
        <ReminderEditor
          key={reminderEditor.reminder?.id ?? "new"}
          reminder={reminderEditor.reminder}
          onClose={() => setReminderEditor(null)}
          onSave={handleReminderSave}
        />
      )}

      {fired && <ReminderToast reminder={fired} onClose={clearFired} />}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmText={confirm.confirmText}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
