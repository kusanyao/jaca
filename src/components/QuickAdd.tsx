import { useRef, useState } from "react";
import { IconNotes, IconPlus } from "./icons";

interface QuickAddProps {
  onAdd: (title: string) => Promise<unknown>;
  onOpenEditor: () => void;
}

export function QuickAdd({ onAdd, onOpenEditor }: QuickAddProps) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value || saving) return;

    setSaving(true);
    try {
      await onAdd(value);
      setTitle("");
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <span className="quick-add-plus">
        <IconPlus width={17} height={17} />
      </span>
      <input
        ref={inputRef}
        value={title}
        maxLength={200}
        placeholder="添加一项待办，按 Enter 保存"
        onChange={(event) => setTitle(event.target.value)}
        aria-label="新待办标题"
      />
      <button
        type="button"
        className="quick-add-detail"
        title="填写更多详情"
        onClick={onOpenEditor}
      >
        <IconNotes width={16} height={16} />
        详情
      </button>
      <button type="submit" className="quick-add-submit" disabled={!title.trim() || saving}>
        添加
      </button>
    </form>
  );
}
