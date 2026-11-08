import { useEffect, useState } from "react";
import type { Priority, Tag, Todo, TodoInput } from "../types";
import { PRIORITY_LABEL } from "../types";
import { fromDatetimeLocal, toDatetimeLocal } from "../lib/date";
import { TagPicker } from "./TagPicker";
import { IconClose } from "./icons";

interface TodoEditorProps {
  todo: Todo | null;
  tags: Tag[];
  onClose: () => void;
  onSave: (input: TodoInput) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag | undefined>;
}

const PRIORITIES: Priority[] = [0, 1, 2];

export function TodoEditor({ todo, tags, onClose, onSave, onCreateTag }: TodoEditorProps) {
  const [title, setTitle] = useState(todo?.title ?? "");
  const [notes, setNotes] = useState(todo?.notes ?? "");
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? 1);
  const [dueLocal, setDueLocal] = useState(toDatetimeLocal(todo?.dueAt ?? null));
  const [tagIds, setTagIds] = useState<number[]>(todo?.tags.map((tag) => tag.id) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!value || saving) return;

    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: value,
        notes,
        priority,
        dueAt: fromDatetimeLocal(dueLocal),
        tagIds,
      });
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

          {error && <p className="form-error">保存失败：{error}</p>}

          <footer className="modal-footer">
            <button type="button" className="button ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="button primary" disabled={!title.trim() || saving}>
              {saving ? "保存中…" : todo ? "保存修改" : "创建待办"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
