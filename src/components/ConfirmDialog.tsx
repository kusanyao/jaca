import { useEffect, useState } from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = "确定",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onCancel();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <p className="confirm-message">{message}</p>
        <footer className="modal-footer">
          <button type="button" className="button ghost" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button type="button" className="button danger" onClick={confirm} disabled={busy}>
            {busy ? "处理中…" : confirmText}
          </button>
        </footer>
      </div>
    </div>
  );
}
