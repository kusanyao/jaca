import { useEffect } from "react";
import type { Reminder } from "../types";
import { IconBell, IconClose } from "./icons";

interface ReminderToastProps {
  reminder: Reminder;
  onClose: () => void;
}

export function ReminderToast({ reminder, onClose }: ReminderToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 12000);
    return () => window.clearTimeout(timer);
  }, [reminder, onClose]);

  return (
    <div className="reminder-toast" role="status" aria-live="polite">
      <span className="reminder-toast-icon">
        <IconBell width={18} height={18} />
      </span>
      <div className="reminder-toast-main">
        <strong>{reminder.title}</strong>
        {reminder.body && <p>{reminder.body}</p>}
      </div>
      <button type="button" className="icon-button small" title="关闭提醒" onClick={onClose}>
        <IconClose width={15} height={15} />
      </button>
    </div>
  );
}
