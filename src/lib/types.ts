export type TaskStatus =
  | "backlog"
  | "planned"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type Priority = "low" | "medium" | "high" | "critical";

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  estimateMinutes: number;
  createdAt: string;
  completedAt: string | null;
  archivedAt?: string | null;
};

export type FocusSession = {
  id: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

export type ActiveTimer = {
  id?: string;
  taskId: string | null;
  startedAt: string;
  elapsedSeconds: number;
  runningSince?: string | null;
};

export type LifeData = {
  tasks: Task[];
  sessions: FocusSession[];
  journal: Record<string, string>;
  activeTimer: ActiveTimer | null;
};

export const EMPTY_LIFE_DATA: LifeData = {
  tasks: [],
  sessions: [],
  journal: {},
  activeTimer: null,
};
