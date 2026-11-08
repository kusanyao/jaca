import { useEffect, useState } from "react";
import type { Reminder, ReminderInput } from "../types";
import { IconBell, IconClose } from "./icons";

interface ReminderEditorProps {
  reminder: Reminder | null;
  onClose: () => void;
  onSave: (input: ReminderInput) => Promise<void>;
}

const PRESETS = [5, 10, 15, 30, 60];

export function ReminderEditor({ reminder, onClose, onSave }: ReminderEditorProps) {
  const [title, setTitle] = useState(reminder?.title ?? "喝水");
  const [body, setBody] = useState(reminder?.body ?? "起来活动一下，补充水分");
  const [interval, setIntervalMinutes] = useState(reminder?.intervalMinutes ?? 10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const intervalValid = Number.isInteger(interval) && interval >= 1 && interval <= 1440;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value || !intervalValid || saving) return;

    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: value,
        body,
        intervalMinutes: interval,
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
        aria-label={reminder ? "编辑提醒" : "新建提醒"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{reminder ? "编辑提醒" : "新建提醒"}</h2>
          <button type="button" className="icon-button" title="关闭" onClick={onClose}>
            <IconClose width={18} height={18} />
          </button>
        </header>

        <form className="editor-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">提醒内容</span>
            <input
              autoFocus
              value={title}
              maxLength={60}
              placeholder="例如：喝水"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">提醒说明</span>
            <textarea
              rows={2}
              value={body}
              maxLength={200}
              placeholder="通知里显示的补充文字（可选）"
              onChange={(event) => setBody(event.target.value)}
            />
          </label>

          <div className="field">
            <span className="field-label">提醒间隔</span>
            <div className="interval-presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`interval-preset${interval === preset ? " is-selected" : ""}`}
                  onClick={() => setIntervalMinutes(preset)}
                >
                  {preset < 60 ? `${preset} 分钟` : `${preset / 60} 小时`}
                </button>
              ))}
            </div>
            <div className="interval-custom">
              <span>每</span>
              <input
                type="number"
                min={1}
                max={1440}
                step={1}
                value={Number.isFinite(interval) ? interval : ""}
                onChange={(event) => setIntervalMinutes(event.target.valueAsNumber)}
                aria-label="自定义提醒间隔（分钟）"
              />
              <span>分钟提醒一次</span>
            </div>
            {!intervalValid && <p className="form-hint error">请输入 1 到 1440 之间的整数分钟数。</p>}
          </div>

          <p className="reminder-tip">
            <IconBell width={15} height={15} />
            提醒会在后台触发系统通知；关闭窗口后应用仍会驻留托盘，不会中断提醒。
          </p>

          {error && <p className="form-error">保存失败：{error}</p>}

          <footer className="modal-footer">
            <button type="button" className="button ghost" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={!title.trim() || !intervalValid || saving}
            >
              {saving ? "保存中…" : reminder ? "保存修改" : "创建提醒"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
