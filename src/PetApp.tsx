import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PetMonster } from "./components/PetMonster";

interface PetPayload {
  title: string;
  body: string;
  reminderId: number;
  todoId: number | null;
}

interface PetMessage extends PetPayload {
  key: number;
}

const AUTO_HIDE_MS = 15000;

export default function PetApp() {
  const [message, setMessage] = useState<PetMessage | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  async function dismiss() {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setMessage(null);
    try {
      await invoke("hide_pet");
    } catch (error) {
      console.error("隐藏小怪兽失败", error);
    }
  }

  async function openDetail() {
    if (!message) return;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    try {
      await invoke("open_reminder_detail", {
        reminderId: message.reminderId,
        todoId: message.todoId,
      });
    } catch (error) {
      console.error("打开详情失败", error);
    }
    setMessage(null);
  }

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen<PetPayload>("pet-remind", (event) => {
      if (cancelled) return;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      setMessage({ ...event.payload, key: Date.now() });
      hideTimer.current = window.setTimeout(() => {
        void dismiss();
      }, AUTO_HIDE_MS);
    })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch((error) => console.error("监听提醒失败", error));

    return () => {
      cancelled = true;
      unlisten?.();
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="pet-popup" key={message.key}>
      <div
        className="pet-bubble"
        role="button"
        tabIndex={0}
        onClick={() => void openDetail()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void openDetail();
          }
        }}
      >
        <button
          type="button"
          className="pet-close"
          title="关闭提醒"
          onClick={(event) => {
            event.stopPropagation();
            void dismiss();
          }}
        >
          ×
        </button>
        <strong>{message.title}</strong>
        {message.body && <p>{message.body}</p>}
        <span className="pet-detail-hint">点击查看详情</span>
      </div>

      <div
        className="pet-monster"
        role="button"
        tabIndex={0}
        title="查看详情"
        onClick={() => void openDetail()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void openDetail();
          }
        }}
      >
        <div className="pet-sway">
          <PetMonster />
        </div>
      </div>
    </div>
  );
}
