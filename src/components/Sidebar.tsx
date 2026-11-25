import { useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import type { Filter, Tag } from "../types";
import {
  IconAlert,
  IconBell,
  IconCheckCircle,
  IconInbox,
  IconPlus,
  IconSun,
  IconTag,
} from "./icons";

export interface Counts {
  all: number;
  today: number;
  overdue: number;
  completed: number;
  reminders: number;
  byTag: Record<number, number>;
}

interface SidebarProps {
  filter: Filter;
  tags: Tag[];
  counts: Counts;
  onFilterChange: (filter: Filter) => void;
  onCreateTag: (name: string) => Promise<Tag | undefined>;
  onDeleteTag: (tag: Tag) => void;
}

const NAV_ITEMS = [
  { kind: "all", label: "全部任务", icon: IconInbox, countKey: "all" },
  { kind: "today", label: "今天", icon: IconSun, countKey: "today" },
  { kind: "overdue", label: "已过期", icon: IconAlert, countKey: "overdue" },
  { kind: "completed", label: "已完成", icon: IconCheckCircle, countKey: "completed" },
  { kind: "reminders", label: "定时提醒", icon: IconBell, countKey: "reminders" },
] as const;

export function Sidebar({ filter, tags, counts, onFilterChange, onCreateTag, onDeleteTag }: SidebarProps) {
  const [addingTag, setAddingTag] = useState(false);
  const [tagName, setTagName] = useState("");
  const [saving, setSaving] = useState(false);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [autostartBusy, setAutostartBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isEnabled()
      .then((value) => {
        if (!cancelled) setAutostart(value);
      })
      .catch(() => {
        if (!cancelled) setAutostart(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleAutostart() {
    if (autostart === null || autostartBusy) return;
    setAutostartBusy(true);
    try {
      if (autostart) {
        await disable();
        setAutostart(false);
      } else {
        await enable();
        setAutostart(true);
      }
    } catch {
      // 系统策略禁止时保持原状态
    } finally {
      setAutostartBusy(false);
    }
  }

  async function submitTag() {
    const name = tagName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const tag = await onCreateTag(name);
      if (tag) onFilterChange({ kind: "tag", tagId: tag.id });
      setTagName("");
      setAddingTag(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">J</div>
        <div className="brand-text">
          <h1>工作助理</h1>
          <p>Jaca</p>
        </div>
      </div>

      <nav className="nav" aria-label="任务筛选">
        {NAV_ITEMS.map(({ kind, label, icon: Icon, countKey }) => {
          const active = filter.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              className={`nav-item${active ? " is-active" : ""}`}
              onClick={() => onFilterChange({ kind })}
            >
              <span className="nav-icon">
                <Icon />
              </span>
              <span className="nav-label">{label}</span>
              {counts[countKey] > 0 && <span className="nav-count">{counts[countKey]}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-section">
        <div className="section-heading">
          <span>
            <IconTag width={15} height={15} /> 标签
          </span>
          <button
            type="button"
            className="icon-button small"
            title="新建标签"
            onClick={() => setAddingTag((value) => !value)}
          >
            <IconPlus width={15} height={15} />
          </button>
        </div>

        {addingTag && (
          <form
            className="tag-create"
            onSubmit={(event) => {
              event.preventDefault();
              void submitTag();
            }}
          >
            <input
              autoFocus
              value={tagName}
              maxLength={20}
              placeholder="标签名称"
              onChange={(event) => setTagName(event.target.value)}
              onBlur={() => {
                if (!tagName.trim()) setAddingTag(false);
              }}
            />
            <button type="submit" disabled={!tagName.trim() || saving}>
              添加
            </button>
          </form>
        )}

        {tags.length === 0 && !addingTag && <p className="sidebar-empty">还没有标签，创建标签来归类工作。</p>}

        {tags.map((tag) => {
          const active = filter.kind === "tag" && filter.tagId === tag.id;
          return (
            <div
              key={tag.id}
              className={`nav-item tag-item${active ? " is-active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onFilterChange({ kind: "tag", tagId: tag.id })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onFilterChange({ kind: "tag", tagId: tag.id });
                }
              }}
            >
              <span className="tag-dot" style={{ background: tag.color }} />
              <span className="nav-label">{tag.name}</span>
              {counts.byTag[tag.id] > 0 && <span className="nav-count">{counts.byTag[tag.id]}</span>}
              <button
                type="button"
                className="tag-delete"
                title={`删除标签「${tag.name}」`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteTag(tag);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          role="switch"
          aria-checked={autostart === true}
          className="autostart-toggle"
          disabled={autostart === null || autostartBusy}
          onClick={() => void toggleAutostart()}
        >
          <span className={`autostart-switch${autostart ? " is-on" : ""}`} aria-hidden="true" />
          <span>开机自动启动</span>
        </button>
        <div>数据保存在本机 · v0.2.0</div>
      </div>
    </aside>
  );
}
