function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return isSameDay(new Date(iso), new Date());
}

export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

/** 任务列表里的截止时间展示：今天 14:30 / 明天 09:00 / 11月8日 18:00 */
export function formatDue(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (isSameDay(date, now)) return `今天 ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(date, tomorrow)) return `明天 ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `昨天 ${time}`;

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/** ISO 字符串 → <input type="datetime-local"> 需要的本地时间格式 */
export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> 的值 → UTC ISO 字符串 */
export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** 毫秒时间戳 → <input type="date"> 的本地日期 */
export function toDateInput(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 毫秒时间戳 → <input type="time"> 的本地时间 */
export function toTimeInput(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 本地日期 + 时间 → 毫秒时间戳 */
export function combineLocal(date: string, time: string): number | null {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.getTime();
}

/** 提醒时段展示：11月13日 周五 17:00–21:00 */
export function formatWindow(startAt: number, endAt: number): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const year = start.getFullYear() === new Date().getFullYear() ? "" : `${start.getFullYear()}年`;
  return `${year}${start.getMonth() + 1}月${start.getDate()}日 ${weekdays[start.getDay()]} ${pad(start.getHours())}:${pad(start.getMinutes())}–${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

export function todayLabel(): string {
  const now = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`;
}
