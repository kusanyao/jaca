export type Priority = 0 | 1 | 2;

export const PRIORITY_LABEL: Record<Priority, string> = {
  0: "低",
  1: "中",
  2: "高",
};

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Todo {
  id: number;
  title: string;
  notes: string;
  priority: Priority;
  dueAt: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export interface TodoInput {
  title: string;
  notes?: string;
  priority?: Priority;
  dueAt?: string | null;
  tagIds?: number[];
}

export type ReminderStyle = "notification" | "monster";

export interface Reminder {
  id: number;
  title: string;
  body: string;
  intervalMinutes: number;
  enabled: boolean;
  style: ReminderStyle;
  todoId: number | null;
  startAt: number | null;
  endAt: number | null;
  lastFiredAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReminderInput {
  title: string;
  body: string;
  intervalMinutes: number;
  style?: ReminderStyle;
  todoId?: number | null;
  startAt?: number | null;
  endAt?: number | null;
}

export interface TodoReminderDraft {
  startAt: number;
  endAt: number;
  intervalMinutes: number;
  style: ReminderStyle;
}

export type Filter =
  | { kind: "all" }
  | { kind: "today" }
  | { kind: "overdue" }
  | { kind: "completed" }
  | { kind: "tag"; tagId: number }
  | { kind: "reminders" };
