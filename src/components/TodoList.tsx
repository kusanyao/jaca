import type { Todo } from "../types";
import { TodoItem } from "./TodoItem";
import { IconCheckCircle } from "./icons";

interface TodoListProps {
  todos: Todo[];
  emptyTitle: string;
  emptyHint: string;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

export function TodoList({ todos, emptyTitle, emptyHint, onToggle, onEdit, onDelete }: TodoListProps) {
  if (todos.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <IconCheckCircle width={26} height={26} />
        </span>
        <h3>{emptyTitle}</h3>
        <p>{emptyHint}</p>
      </div>
    );
  }

  const open = todos.filter((todo) => !todo.completed);
  const done = todos.filter((todo) => todo.completed);

  return (
    <ul className="todo-list">
      {open.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
      {open.length > 0 && done.length > 0 && (
        <li className="list-divider">
          <span>已完成 · {done.length}</span>
        </li>
      )}
      {done.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
