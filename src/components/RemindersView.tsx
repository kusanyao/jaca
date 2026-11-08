import type { Reminder } from "../types";
import { formatDue } from "../lib/date";
import { IconBell, IconPencil, IconPlus, IconTrash } from "./icons";

interface RemindersViewProps {
  reminders: Reminder[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (reminder: Reminder) => void;
  onToggle: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}

function formatInterval(minutes: number): string {
  if (minutes < 60) return `每 ${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `每 ${hours} 小时` : `每 ${hours} 小时 ${rest} 分钟`;
}

function nextFireAt(reminder: Reminder): number {
  return (reminder.lastFiredAt ?? reminder.createdAt) + reminder.intervalMinutes * 60_000;
}

function formatNextFire(reminder: Reminder): string {
  const next = nextFireAt(reminder);
  if (next <= Date.now()) return "即将提醒";
  return formatDue(new Date(next).toISOString());
}

export function RemindersView({
  reminders,
  loading,
  onCreate,
  onEdit,
  onToggle,
  onDelete,
}: RemindersViewProps) {
  if (loading) {
    return (
      <div className="loading-state">
        <span className="spinner" />
        正在加载…
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <IconBell width={26} height={26} />
        </span>
        <h3>还没有定时提醒</h3>
        <p>新建一个每 10 分钟提醒喝水的提醒，窗口隐藏到托盘后也会继续触发。</p>
        <button type="button" className="button primary empty-action" onClick={onCreate}>
          <IconPlus width={16} height={16} />
          新建提醒
        </button>
      </div>
    );
  }

  return (
    <div className="reminder-list">
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className={`reminder-card${reminder.enabled ? "" : " is-paused"}`}
        >
          <span className="reminder-icon">
            <IconBell width={19} height={19} />
          </span>

          <div className="reminder-main">
            <div className="reminder-heading">
              <span className="reminder-title">{reminder.title}</span>
              <span className="interval-chip">{formatInterval(reminder.intervalMinutes)}</span>
            </div>

            {reminder.body && <p className="reminder-body">{reminder.body}</p>}

            <div className="reminder-meta">
              <span className={`reminder-status${reminder.enabled ? " is-on" : ""}`}>
                {reminder.enabled ? "已启用" : "已暂停"}
              </span>
              {reminder.enabled && <span>下次提醒：{formatNextFire(reminder)}</span>}
              {reminder.lastFiredAt && (
                <span>上次提醒：{formatDue(new Date(reminder.lastFiredAt).toISOString())}</span>
              )}
            </div>
          </div>

          <div className="reminder-actions">
            <button
              type="button"
              className={`switch${reminder.enabled ? " is-on" : ""}`}
              role="switch"
              aria-checked={reminder.enabled}
              aria-label={reminder.enabled ? "暂停提醒" : "启用提醒"}
              onClick={() => onToggle(reminder)}
            >
              <span className="switch-thumb" />
            </button>
            <button type="button" className="icon-button" title="编辑" onClick={() => onEdit(reminder)}>
              <IconPencil width={16} height={16} />
            </button>
            <button
              type="button"
              className="icon-button danger"
              title="删除"
              onClick={() => onDelete(reminder)}
            >
              <IconTrash width={16} height={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
