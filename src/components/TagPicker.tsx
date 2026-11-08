import { useState } from "react";
import type { Tag } from "../types";
import { IconPlus } from "./icons";

interface TagPickerProps {
  tags: Tag[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onCreate: (name: string) => Promise<Tag | undefined>;
}

export function TagPicker({ tags, selectedIds, onChange, onCreate }: TagPickerProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  async function create() {
    const value = name.trim();
    if (!value || saving) return;

    setSaving(true);
    try {
      const tag = await onCreate(value);
      if (tag && !selectedIds.includes(tag.id)) {
        onChange([...selectedIds, tag.id]);
      }
      setName("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tag-picker">
      {tags.length > 0 && (
        <div className="tag-picker-list">
          {tags.map((tag) => {
            const selected = selectedIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className={`tag-option${selected ? " is-selected" : ""}`}
                style={{ "--tag-color": tag.color } as React.CSSProperties}
                onClick={() => toggle(tag.id)}
                aria-pressed={selected}
              >
                <span className="tag-dot" style={{ background: tag.color }} />
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="tag-picker-create">
        <input
          value={name}
          maxLength={20}
          placeholder="新建标签"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void create();
            }
          }}
        />
        <button
          type="button"
          className="icon-button small"
          title="新建标签"
          disabled={!name.trim() || saving}
          onClick={() => void create()}
        >
          <IconPlus width={15} height={15} />
        </button>
      </div>
    </div>
  );
}
