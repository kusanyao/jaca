import { useEffect, useState } from "react";
import type {
  Priority,
  Reminder,
  ReminderStyle,
  Tag,
  Todo,
  TodoInput,
  TodoReminderDraft,
} from "../types";
import { PRIORITY_LABEL } from "../types";
import {
  combineLocal,
  fromDatetimeLocal,
  toDateInput,
  toDatetimeLocal,
  toTimeInput,
} from "../lib/date";
import { TagPicker } from "./TagPicker";
import { IconClose } from "./icons";

interface TodoEditorProps {
  todo: Todo | null;
  reminder: Reminder | null;
  tags: Tag[];
  onClose: () => void;
  onSave: (input: TodoInput, reminder: TodoReminderDraft | null) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag | undefined>;
}

const PRIORITIES: Priority[] = [0, 1, 2];
const REMINDER_PRESETS = [5, 10, 15, 30, 60];

function initialDate(todo: Todo | null, reminder: Reminder | null): string {
  if (reminder?.startAt) return toDateInput(reminder.startAt);
  if (todo?.dueAt) return toDateInput(new Date(todo.dueAt).getTime());
  return toDateInput(Date.now());
}

function initialStart(reminder: Reminder | null): string {
  return reminder?.startAt ? toTimeInput(reminder.startAt) : "09:00";
}

function initialEnd(todo: Todo | null, reminder: Reminder | null): string {
  if (reminder?.endAt) return toTimeInput(reminder.endAt);
  if (todo?.dueAt) return toTimeInput(new Date(todo.dueAt).getTime());
  return "18:00";
}

export function TodoEditor({ todo, reminder, tags, onClose, onSave, onCreateTag }: TodoEditorProps) {
  const [title, setTitle] = useState(todo?.title ?? "");
  const [notes, setNotes] = useState(todo?.notes ?? "");
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? 1);
  const [dueLocal, setDueLocal] = useState(toDatetimeLocal(todo?.dueAt ?? null));
  const [tagIds, setTagIds] = useState<number[]>(todo?.tags.map((tag) => tag.id) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reminderEnabled, setReminderEnabled] = useState(reminder !== null);
  const [reminderDate, setReminderDate] = useState(initialDate(todo, reminder));
  const [reminderStart, setReminderStart] = useState(initialStart(reminder));
  const [reminderEnd, setReminderEnd] = useState(initialEnd(todo, reminder));
  const [reminderInterval, setReminderInterval] = useState(reminder?.intervalMinutes ?? 30);
  const [reminderStyle, setReminderStyle] = useState<ReminderStyle>(
    reminder?.style ?? "notification",
  );

  const startAt = combineLocal(reminderDate, reminderStart);
  const endAt = combineLocal(reminderDate, reminderEnd);
  const windowValid = startAt !== null && endAt !== null && endAt > startAt;
  const intervalValid =
    Number.isInteger(reminderInterval) && reminderInterval >= 1 && reminderInterval <= 1440;
  const reminderValid = !reminderEnabled || (windowValid && intervalValid);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value || saving || !reminderValid) return;

    setSaving(true);
    setError(null);
    try {
      const draft: TodoReminderDraft | null =
        reminderEnabled && startAt !== null && endAt !== null
          ? { startAt, endAt, intervalMinutes: reminderInterval, style: reminderStyle }
          : null;

      await onSave(
        {
          title: value,
          notes,
          priority,
          dueAt: fromDatetimeLocal(dueLocal),
          tagIds,
        },
        draft,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={todo ? "编辑待办" : "新建待办"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{todo ? "编辑待办" : "新建待办"}</h2>
          <button type="button" className="icon-button" title="关闭" onClick={onClose}>
            <IconClose width={18} height={18} />
          </button>
        </header>

        <form className="editor-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">标题</span>
            <input
              autoFocus
              value={title}
              maxLength={200}
              placeholder="要做什么？"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">备注</span>
            <textarea
              rows={3}
              value={notes}
              maxLength={2000}
              placeholder="补充说明、链接或背景信息（可选）"
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <div className="field">
            <span className="field-label">优先级</span>
            <div className="priority-select">
              {PRIORITIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`priority-option priority-${value}${priority === value ? " is-selected" : ""}`}
                  onClick={() => setPriority(value)}
                >
                  <span className="priority-dot" />
                  {PRIORITY_LABEL[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">截止时间</span>
            <div className="due-input-row">
              <input
                type="datetime-local"
                value={dueLocal}
                onChange={(event) => setDueLocal(event.target.value)}
              />
              {dueLocal && (
                <button type="button" className="text-button" onClick={() => setDueLocal("")}>
                  清除
                </button>
              )}
            </div>
          </div>

          <div className="field">
            <span className="field-label">标签</span>
            <TagPicker
              tags={tags}
              selectedIds={tagIds}
              onChange={setTagIds}
              onCreate={onCreateTag}
            />
          </div>

          <div className="field">
            <span className="field-label">提醒</span>
            <label className="reminder-toggle">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(event) => setReminderEnabled(event.target.checked)}
              />
              <span>为该待办设置定时提醒</span>
            </label>

            {reminderEnabled && (
              <div className="reminder-config">
                <div className="reminder-row">
                  <input
                    type="date"
                    value={reminderDate}
                    aria-label="提醒日期"
                    onChange={(event) => setReminderDate(event.target.value)}
                  />
                </div>

                <div className="reminder-times">
                  <label>
                    <span>开始</span>
                    <input
                      type="time"
                      value={reminderStart}
                      onChange={(event) => setReminderStart(event.target.value)}
                    />
                  </label>
                  <span className="time-separator">—</span>
                  <label>
                    <span>结束</span>
                    <input
                      type="time"
                      value={reminderEnd}
                      onChange={(event) => setReminderEnd(event.target.value)}
                    />
                  </label>
                </div>

                <div className="reminder-interval">
                  <span className="mini-label">间隔</span>
                  <div className="interval-presets">
                    {REMINDER_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`interval-preset${reminderInterval === preset ? " is-selected" : ""}`}
                        onClick={() => setReminderInterval(preset)}
                      >
                        {preset < 60 ? `${preset} 分钟` : `${preset / 60} 小时`}
                      </button>
                    ))}
                  </div>
                  <div className="interval-custom compact">
                    <span>每</span>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      step={1}
                      value={Number.isFinite(reminderInterval) ? reminderInterval : ""}
                      onChange={(event) => setReminderInterval(event.target.valueAsNumber)}
                      aria-label="自定义提醒间隔（分钟）"
                    />
                    <span>分钟</span>
                  </div>
                </div>

                <div className="reminder-style">
                  <span className="mini-label">方式</span>
                  <div className="style-select">
                    <button
                      type="button"
                      className={`style-option${reminderStyle === "notification" ? " is-selected" : ""}`}
                      onClick={() => setReminderStyle("notification")}
                    >
                      系统通知
                    </button>
                    <button
                      type="button"
                      className={`style-option${reminderStyle === "monster" ? " is-selected" : ""}`}
                      onClick={() => setReminderStyle("monster")}
                    >
                      桌面小怪兽
                    </button>
                  </div>
                </div>

                {reminderStyle === "monster" && (
                  <p className="form-hint">提醒时小怪兽从桌面右下角出现，点击可查看详情或关闭；不发声、不抢焦点。</p>
                )}

                {!windowValid && (
                  <p className="form-hint error">结束时间必须晚于开始时间。</p>
                )}
                {!intervalValid && (
                  <p className="form-hint error">间隔需在 1 到 1440 分钟之间。</p>
                )}
                {windowValid && intervalValid && (
                  <p className="form-hint">
                    仅在此时段内每 {reminderInterval} 分钟提醒；完成任务后自动停止。
                  </p>
                )}
              </div>
            )}
          </div>

          {error && <p className="form-error">保存失败：{error}</p>}

          <footer className="modal-footer">
            <button type="button" className="button ghost" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={!title.trim() || saving || !reminderValid}
            >
              {saving ? "保存中…" : todo ? "保存修改" : "创建待办"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
