import type { Task } from "@/lib/types";

const IST_OFFSET_MINUTES = 330;

export function getIstDayBounds(date: string) {
  const start = new Date(`${date}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function istDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function taskBelongsToDay(task: Pick<Task, "dueDate" | "completedAt">, date: string) {
  return task.dueDate === date || (task.completedAt !== null && istDateKey(task.completedAt) === date);
}

export function formatIstDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
    ...options,
  }).format(typeof value === "string" ? new Date(value) : value);
}
