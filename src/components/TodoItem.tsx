import type { Todo } from "../types";
import { PRIORITY_LABEL } from "../types";
import { formatDue, isOverdue } from "../lib/date";
import { IconCalendar, IconCheck, IconPencil, IconTrash } from "./icons";

interface TodoItemProps {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

export function TodoItem({ todo, onToggle, onEdit, onDelete }: TodoItemProps) {
  const overdue = isOverdue(todo.dueAt) && !todo.completed;

  return (
    <li className={`todo-item priority-${todo.priority}${todo.completed ? " is-done" : ""}`}>
      <button
        type="button"
        className={`todo-checkbox${todo.completed ? " is-checked" : ""}`}
        aria-label={todo.completed ? "标记为未完成" : "标记为完成"}
        aria-pressed={todo.completed}
        onClick={() => onToggle(todo)}
      >
        {todo.completed && <IconCheck width={13} height={13} />}
      </button>

      <div className="todo-main" onClick={() => onEdit(todo)}>
        <div className="todo-heading">
          <span className="todo-title">{todo.title}</span>
          <span className={`priority-badge priority-${todo.priority}`}>{PRIORITY_LABEL[todo.priority]}</span>
        </div>

        {todo.notes && <p className="todo-notes">{todo.notes}</p>}

        {(todo.dueAt || todo.tags.length > 0) && (
          <div className="todo-meta">
            {todo.dueAt && (
              <span className={`due-chip${overdue ? " is-overdue" : ""}`}>
                <IconCalendar width={13} height={13} />
                {formatDue(todo.dueAt)}
              </span>
            )}
            {todo.tags.map((tag) => (
              <span
                key={tag.id}
                className="tag-chip"
                style={{ "--tag-color": tag.color } as React.CSSProperties}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="todo-actions">
        <button type="button" className="icon-button" title="编辑" onClick={() => onEdit(todo)}>
          <IconPencil width={16} height={16} />
        </button>
        <button
          type="button"
          className="icon-button danger"
          title="删除"
          onClick={() => onDelete(todo)}
        >
          <IconTrash width={16} height={16} />
        </button>
      </div>
    </li>
  );
}
