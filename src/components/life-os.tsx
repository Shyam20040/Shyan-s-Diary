"use client";

import {
  Activity,
  AlarmClock,
  Archive,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  Flag,
  FolderKanban,
  Goal,
  LayoutDashboard,
  ListFilter,
  ListTodo,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Moon,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";
import { istDateKey, taskBelongsToDay } from "@/lib/dates";
import { jsPDF } from "jspdf";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import {
  EMPTY_LIFE_DATA,
  type FocusSession,
  type LifeData,
  type Priority,
  type Task,
  type TaskStatus,
} from "@/lib/types";
import WorkspaceFeatures from "@/components/workspace-features";

type Section =
  | "dashboard"
  | "tasks"
  | "goals"
  | "focus"
  | "calendar"
  | "journal"
  | "blog"
  | "knowledge"
  | "ai"
  | "reports"
  | "settings";

type Toast = { message: string; tone: "success" | "error" };

const STORAGE_KEY = "life-os-data-v1";
const navItems: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tasks", label: "My tasks", icon: ListTodo },
  { id: "goals", label: "Goals & projects", icon: Goal },
  { id: "focus", label: "Focus timer", icon: Timer },
  { id: "calendar", label: "Calendar & history", icon: CalendarDays },
  { id: "journal", label: "Daily journal", icon: BookOpen },
  { id: "blog", label: "Blog studio", icon: FileText },
  { id: "knowledge", label: "Knowledge", icon: FolderKanban },
  { id: "ai", label: "AI studio", icon: Sparkles },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

const statusNames: Record<TaskStatus, string> = {
  backlog: "Backlog",
  planned: "Planned",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

const priorityNames: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const todayKey = () => {
  return dateKey(new Date());
};

function dateKey(value: string | Date) {
  return istDateKey(value);
}

function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours ? `${hours}h ` : ""}${minutes}m`;
}

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function isTaskToday(task: Task, date: string) {
  return taskBelongsToDay(task, date);
}

function taskRelatesToDate(task: Task, date: string) {
  return taskBelongsToDay(task, date);
}

function readLocalData(): LifeData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_LIFE_DATA;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("tasks" in parsed) ||
      !Array.isArray(parsed.tasks)
    ) {
      throw new Error("Saved workspace data has an unexpected format.");
    }

    return {
      tasks: parsed.tasks as Task[],
      sessions: Array.isArray(Reflect.get(parsed, "sessions"))
        ? (Reflect.get(parsed, "sessions") as FocusSession[])
        : [],
      journal:
        typeof Reflect.get(parsed, "journal") === "object" &&
        Reflect.get(parsed, "journal") !== null
          ? (Reflect.get(parsed, "journal") as Record<string, string>)
          : {},
      activeTimer:
        typeof Reflect.get(parsed, "activeTimer") === "object"
          ? Reflect.get(parsed, "activeTimer")
          : null,
    };
  } catch (error) {
    console.error("Could not read local workspace data:", error);
    return EMPTY_LIFE_DATA;
  }
}

function TaskRow({
  task,
  onComplete,
  onArchive,
  onEdit,
  onStart,
}: {
  task: Task;
  onComplete: (task: Task) => void;
  onArchive?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onStart: (task: Task) => void;
}) {
  return (
    <article className="task-row">
      <button
        aria-label={task.status === "completed" ? "Mark incomplete" : "Complete task"}
        className={`task-check ${task.status === "completed" ? "is-done" : ""}`}
        onClick={() => onComplete(task)}
        type="button"
      >
        {task.status === "completed" && <Check size={14} />}
      </button>
      <div className="task-copy">
        <p className={task.status === "completed" ? "task-title completed-title" : "task-title"}>
          {task.title}
        </p>
        <div className="task-meta">
          <span className={`priority-dot priority-${task.priority}`} />
          <span>{priorityNames[task.priority]}</span>
          <span className="meta-divider" />
          <span>{formatDueDate(task.dueDate)}</span>
        </div>
      </div>
      <button
        aria-label={`Start focus on ${task.title}`}
        className="icon-button row-action"
        onClick={() => onStart(task)}
        title="Start focus"
        type="button"
      >
        <Timer size={16} />
      </button>
      {onEdit && (
        <button
          aria-label={`Edit ${task.title}`}
          className="icon-button row-action"
          onClick={() => onEdit(task)}
          title="Edit task"
          type="button"
        >
          <Pencil size={15} />
        </button>
      )}
      {onArchive && (
        <button
          aria-label={`Archive ${task.title}`}
          className="icon-button row-action"
          onClick={() => onArchive(task)}
          title="Archive task"
          type="button"
        >
          <Archive size={16} />
        </button>
      )}
    </article>
  );
}

export default function LifeOS() {
  const [section, setSection] = useState<Section>("dashboard");
  const [data, setData] = useState<LifeData>(EMPTY_LIFE_DATA);
  const [today, setToday] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [cloudMode, setCloudMode] = useState(false);
  const [cloudChecked, setCloudChecked] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [localDataAvailable, setLocalDataAvailable] = useState(false);
  const [importingLocalData, setImportingLocalData] = useState(false);
  const [now, setNow] = useState(new Date(0));
  const [toast, setToast] = useState<Toast | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | TaskStatus>("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [themeReady, setThemeReady] = useState(false);
  const [journalDraft, setJournalDraft] = useState("");
  const [journalSaved, setJournalSaved] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("medium");
  const [newTaskEstimate, setNewTaskEstimate] = useState(30);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  const flash = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    let active = true;
    const initializeTimer = window.setTimeout(() => {
      if (!active) return;
      const localData = readLocalData();
      try {
        setLocalDataAvailable(
          window.localStorage.getItem("life-os-import-complete-v1") !== "true" &&
          (localData.tasks.length > 0 || localData.sessions.length > 0 || Object.keys(localData.journal).length > 0 || localData.activeTimer !== null),
        );
      } catch (error) {
        console.error("Could not check for local workspace data:", error);
      }
      const currentDate = todayKey();
      setToday(currentDate);
      setData(EMPTY_LIFE_DATA);
      setJournalDraft("");
      setSelectedDate(currentDate);
      setNewTaskDueDate(currentDate);
      setNow(new Date());
      setHydrated(true);
      void (async () => {
        try {
          const [taskResponse, personalResponse] = await Promise.all([
            fetch("/api/tasks", { cache: "no-store" }),
            fetch("/api/personal-data", { cache: "no-store" }),
          ]);
          if (!taskResponse.ok || !personalResponse.ok) throw new Error("Could not load your workspace. Check the database setup and retry.");
          const taskResult: { tasks: Task[] } = await taskResponse.json();
          const personalResult: {
            sessions: FocusSession[];
            journal: Record<string, string>;
            activeTimer: LifeData["activeTimer"];
          } = await personalResponse.json();
          if (!active) return;
          setData({
            tasks: taskResult.tasks,
            sessions: personalResult.sessions,
            journal: personalResult.journal,
            activeTimer: personalResult.activeTimer,
          });
          setJournalDraft(personalResult.journal[currentDate] ?? "");
          setCloudMode(true);
          setCloudError("");
        } catch (error: unknown) {
          if (active) setCloudError(error instanceof Error ? error.message : "Could not connect to your private workspace.");
        } finally {
          if (active) setCloudChecked(true);
        }
      })();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(initializeTimer);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!cloudMode) return;
    let active = true;
    const reload = async () => {
      try {
        const [taskResponse, personalResponse] = await Promise.all([
          fetch("/api/tasks", { cache: "no-store" }),
          fetch("/api/personal-data", { cache: "no-store" }),
        ]);
        if (!taskResponse.ok || !personalResponse.ok) throw new Error("Workspace refresh failed.");
        const taskResult: { tasks: Task[] } = await taskResponse.json();
        const personalResult: {
          sessions: FocusSession[];
          journal: Record<string, string>;
          activeTimer: LifeData["activeTimer"];
        } = await personalResponse.json();
        if (!active) return;
        setData({
          tasks: taskResult.tasks,
          sessions: personalResult.sessions,
          journal: personalResult.journal,
          activeTimer: personalResult.activeTimer,
        });
        setJournalDraft((current) => current === "" ? personalResult.journal[selectedDate] ?? "" : current);
      } catch (error) {
        if (active) console.error("Could not refresh realtime workspace data:", error);
      }
    };

    const reloadWhenVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const interval = window.setInterval(reloadWhenVisible, 20_000);
    window.addEventListener("focus", reloadWhenVisible);
    document.addEventListener("visibilitychange", reloadWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", reloadWhenVisible);
      document.removeEventListener("visibilitychange", reloadWhenVisible);
    };
  }, [cloudMode, selectedDate]);

  useEffect(() => {
    if (
      !hydrated ||
      !cloudMode ||
      !selectedDate ||
      (data.journal[selectedDate] ?? "") === journalDraft
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetch("/api/journal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, body: journalDraft }),
      }).then(async (response) => {
        if (!response.ok) {
          const result: { error?: string } = await response.json().catch(() => ({}));
          throw new Error(result.error ?? "Could not save journal entry.");
        }
      }).catch((error: unknown) => {
        flash(error instanceof Error ? error.message : "Could not save journal entry.", "error");
      });
      setData((current) => ({
        ...current,
        journal: { ...current.journal, [selectedDate]: journalDraft },
      }));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [cloudMode, data.journal, flash, hydrated, journalDraft, selectedDate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        setDarkMode(window.localStorage.getItem("life-os-theme") !== "light");
      } catch (error) {
        console.error("Could not read theme preference:", error);
      } finally {
        setThemeReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    try {
      window.localStorage.setItem("life-os-theme", darkMode ? "dark" : "light");
    } catch (error) {
      console.error("Could not persist theme preference:", error);
    }
  }, [darkMode, themeReady]);

  const todayTasks = useMemo(
    () => data.tasks.filter((task) => isTaskToday(task, today)),
    [data.tasks, today],
  );
  const completedToday = todayTasks.filter((task) => task.status === "completed").length;
  const plannedToday = todayTasks.filter((task) => task.status !== "cancelled").length;
  const todayOutstanding = todayTasks.filter((task) => !task.archivedAt && !["completed", "cancelled"].includes(task.status));
  const completionRate = plannedToday ? Math.round((completedToday / plannedToday) * 100) : 0;
  const focusTodaySeconds = data.sessions
    .filter((session) => dateKey(session.startedAt) === today)
    .reduce((total, session) => total + session.durationSeconds, 0);
  const activeTimerSeconds = data.activeTimer
    ? data.activeTimer.elapsedSeconds +
      (data.activeTimer.runningSince
        ? Math.max(0, Math.floor((now.getTime() - new Date(data.activeTimer.runningSince).getTime()) / 1000))
        : data.activeTimer.runningSince === null
          ? 0
          : Math.max(0, Math.floor((now.getTime() - new Date(data.activeTimer.startedAt).getTime()) / 1000)))
    : 0;
  const timerPaused = Boolean(data.activeTimer && data.activeTimer.runningSince === null);
  const activeTask = data.tasks.find((task) => task.id === data.activeTimer?.taskId);
  const outstanding = data.tasks
    .filter((task) => !task.archivedAt && !["completed", "cancelled"].includes(task.status))
    .sort((a, b) => {
      const rank: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return rank[a.priority] - rank[b.priority];
    });
  const visibleTasks = data.tasks.filter((task) => {
    const matchesQuery = task.title.toLowerCase().includes(taskSearch.toLowerCase());
    const matchesFilter = taskFilter === "all" || task.status === taskFilter;
    const showCancelled = taskFilter === "cancelled";
    return matchesQuery && matchesFilter && (showCancelled || (task.status !== "cancelled" && !task.archivedAt));
  });

  const editingTask = data.tasks.find((task) => task.id === editingTaskId);

  const openNewTask = useCallback(() => {
    setEditingTaskId(null);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskDueDate(today);
    setNewTaskPriority("medium");
    setNewTaskEstimate(30);
    setShowTaskForm(true);
  }, [today]);

  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowCommandPalette(true);
        return;
      }
      if (event.key === "Escape") {
        setShowCommandPalette(false);
        return;
      }
      const target = event.target;
      if (
        event.key.toLowerCase() === "n" &&
        !event.ctrlKey && !event.metaKey && !event.altKey &&
        !(target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select")))
      ) {
        event.preventDefault();
        openNewTask();
      }
    };
    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [openNewTask]);

  function openEditTask(task: Task) {
    setEditingTaskId(task.id);
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description);
    setNewTaskDueDate(task.dueDate ?? "");
    setNewTaskPriority(task.priority);
    setNewTaskEstimate(task.estimateMinutes);
    setShowTaskForm(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cloudMode) {
      flash("Your private workspace is unavailable. Retry the connection before saving.", "error");
      return;
    }
    const title = newTaskTitle.trim();
    if (!title) return;

    const input = {
      title,
      description: newTaskDescription.trim(),
      status: "planned" as const,
      priority: newTaskPriority,
      dueDate: newTaskDueDate || null,
      estimateMinutes: newTaskEstimate,
    };

    if (editingTask && cloudMode) {
      try {
        const response = await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const result: { task?: Task; error?: string } = await response.json();
        const savedTask = result.task;
        if (!response.ok || !savedTask) throw new Error(result.error ?? "Could not update task.");
        setData((current) => ({
          ...current,
          tasks: current.tasks.map((task) => task.id === savedTask.id ? savedTask : task),
        }));
      } catch (error) {
        flash(error instanceof Error ? error.message : "Could not update task.", "error");
        return;
      }
    } else if (editingTask) {
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((task) => task.id === editingTask.id ? { ...task, ...input } : task),
      }));
    } else if (cloudMode) {
      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const result: { task?: Task; error?: string } = await response.json();
        const savedTask = result.task;
        if (!response.ok || !savedTask) throw new Error(result.error ?? "Could not save task.");
        setData((current) => ({ ...current, tasks: [savedTask, ...current.tasks] }));
      } catch (error) {
        flash(error instanceof Error ? error.message : "Could not save task.", "error");
        return;
      }
    } else {
      const task: Task = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      setData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    }

    setNewTaskTitle("");
    setEditingTaskId(null);
    setShowTaskForm(false);
    flash(editingTask ? "Task updated." : "Task added to your plan.");
  }

  async function changeTaskStatus(task: Task, status: TaskStatus) {
    if (!cloudMode) {
      flash("Your private workspace is unavailable. Retry the connection before updating tasks.", "error");
      return;
    }
    const updated: Task = {
      ...task,
      status,
      completedAt: status === "completed" ? new Date().toISOString() : null,
    };
    if (cloudMode) {
      try {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const result: { task?: Task; error?: string } = await response.json();
        if (!response.ok || !result.task) throw new Error(result.error ?? "Could not update task.");
      } catch (error) {
        flash(error instanceof Error ? error.message : "Could not update task.", "error");
        return;
      }
    }
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === task.id ? updated : item),
    }));
    flash(status === "completed" ? "Nice work — task completed." : "Task status updated.");
  }

  async function archiveTask(task: Task) {
    if (!cloudMode) {
      flash("Your private workspace is unavailable. Retry the connection before archiving tasks.", "error");
      return;
    }
    if (!window.confirm(`Archive “${task.title}”? It will be removed from active views.`)) return;
    if (cloudMode) {
      try {
        const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
        const result: { error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not archive task.");
      } catch (error) {
        flash(error instanceof Error ? error.message : "Could not archive task.", "error");
        return;
      }
    }
    setData((current) => ({
      ...current,
      tasks: cloudMode
        ? current.tasks.filter((item) => item.id !== task.id)
        : current.tasks.map((item) => item.id === task.id ? { ...item, archivedAt: new Date().toISOString() } : item),
    }));
    flash("Task archived.");
  }

  const startTimer = useCallback(async (task?: Task) => {
    if (data.activeTimer) {
      flash("A focus session is already running. Stop it before starting another.", "error");
      setSection("focus");
      return;
    }
    if (!cloudMode) {
      flash("Your private workspace is unavailable. Retry the connection before starting focus.", "error");
      return;
    }
    try {
      const response = await fetch("/api/focus-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task?.id ?? (activeTaskId || null) }),
      });
      const result: { activeTimer?: LifeData["activeTimer"]; error?: string } = await response.json();
      if (!response.ok || !result.activeTimer) throw new Error(result.error ?? "Could not start the focus session.");
      setData((current) => ({ ...current, activeTimer: result.activeTimer ?? null }));
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not start the focus session.", "error");
      return;
    }
    setSection("focus");
    flash("Focus session started.");
  }, [activeTaskId, cloudMode, data.activeTimer, flash]);

  async function stopTimer() {
    const timer = data.activeTimer;
    if (!timer || !timer.id) return;
    const durationSeconds = timer.elapsedSeconds + (
      timer.runningSince
        ? Math.max(0, Math.floor((Date.now() - new Date(timer.runningSince).getTime()) / 1000))
        : timer.runningSince === null
          ? 0
          : Math.max(0, Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000))
    );
    try {
      const response = await fetch(`/api/focus-sessions/${timer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const result: { session?: FocusSession | null; error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not stop the focus session.");
      setData((current) => ({
        ...current,
        sessions: result.session ? [result.session, ...current.sessions] : current.sessions,
        activeTimer: null,
      }));
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not stop the focus session.", "error");
      return;
    }
    if (durationSeconds < 1) return;
    flash(`Focus session saved · ${durationLabel(durationSeconds)}.`);
  }

  async function pauseTimer() {
    const timer = data.activeTimer;
    if (!timer?.id || timer.runningSince === null) return;
    const elapsedSinceResume = Math.max(
      0,
      Math.floor((Date.now() - new Date(timer.runningSince ?? timer.startedAt).getTime()) / 1000),
    );
    try {
      const response = await fetch(`/api/focus-sessions/${timer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      const result: { elapsedSeconds?: number; error?: string } = await response.json();
      if (!response.ok || result.elapsedSeconds === undefined) throw new Error(result.error ?? "Could not pause the focus session.");
      setData((current) => current.activeTimer ? {
        ...current,
        activeTimer: { ...current.activeTimer, elapsedSeconds: result.elapsedSeconds ?? 0, runningSince: null },
      } : current);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not pause the focus session.", "error");
      return;
    }
    flash(`Focus paused at ${durationLabel(timer.elapsedSeconds + elapsedSinceResume)}.`);
  }

  async function resumeTimer() {
    const timer = data.activeTimer;
    if (!timer?.id || timer.runningSince !== null) return;
    try {
      const response = await fetch(`/api/focus-sessions/${timer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      const result: { runningSince?: string; error?: string } = await response.json();
      if (!response.ok || !result.runningSince) throw new Error(result.error ?? "Could not resume the focus session.");
      setData((current) => current.activeTimer ? {
        ...current,
        activeTimer: { ...current.activeTimer, runningSince: result.runningSince },
      } : current);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not resume the focus session.", "error");
      return;
    }
    flash("Focus session resumed.");
  }

  async function saveJournal() {
    try {
      const response = await fetch("/api/journal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, body: journalDraft }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save your journal entry.");
      setData((current) => ({ ...current, journal: { ...current.journal, [selectedDate]: journalDraft } }));
      setJournalSaved(true);
      window.setTimeout(() => setJournalSaved(false), 2000);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not save your journal entry.", "error");
    }
  }

  function changeSelectedDate(date: string) {
    if (selectedDate && (data.journal[selectedDate] ?? "") !== journalDraft) {
      void fetch("/api/journal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, body: journalDraft }),
      }).catch((error: unknown) => console.error("Could not persist the previous journal date:", error));
      setData((current) => ({
        ...current,
        journal: { ...current.journal, [selectedDate]: journalDraft },
      }));
    }
    setSelectedDate(date);
    setJournalDraft(data.journal[date] ?? "");
    setJournalSaved(false);
  }

  function changeJournalDraft(text: string) {
    setJournalDraft(text);
    setJournalSaved(false);
  }

  async function importLocalData() {
    if (!localDataAvailable || importingLocalData) return;
    const localData = readLocalData();
    const total = localData.tasks.length + localData.sessions.length + Object.keys(localData.journal).length;
    const activeTimerMessage = localData.activeTimer ? " and one active timer" : "";
    if (!window.confirm(`Import up to ${total} local tasks, focus sessions, and journal entries${activeTimerMessage} into your private Supabase account? Existing cloud records will not be overwritten.`)) return;
    setImportingLocalData(true);
    try {
      const response = await fetch("/api/personal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: localData.tasks,
          sessions: localData.sessions,
          journal: localData.journal,
          activeTimer: localData.activeTimer,
        }),
      });
      const result: { imported?: { tasks: number; sessions: number; journalEntries: number; activeTimer: boolean }; error?: string } = await response.json();
      if (!response.ok || !result.imported) throw new Error(result.error ?? "Could not import local workspace data.");
      window.localStorage.setItem("life-os-import-complete-v1", "true");
      setLocalDataAvailable(false);
      const [taskResponse, personalResponse] = await Promise.all([fetch("/api/tasks"), fetch("/api/personal-data")]);
      if (!taskResponse.ok || !personalResponse.ok) throw new Error("Data was imported, but the workspace could not refresh. Reload to see the imported records.");
      const taskResult: { tasks: Task[] } = await taskResponse.json();
      const personalResult: {
        sessions: FocusSession[];
        journal: Record<string, string>;
        activeTimer: LifeData["activeTimer"];
      } = await personalResponse.json();
      setData({
        tasks: taskResult.tasks,
        sessions: personalResult.sessions,
        journal: personalResult.journal,
        activeTimer: personalResult.activeTimer,
      });
      setJournalDraft(personalResult.journal[selectedDate] ?? "");
      flash(`Imported ${result.imported.tasks} tasks, ${result.imported.sessions} focus sessions, and ${result.imported.journalEntries} journal entries${result.imported.activeTimer ? ", including the active timer" : ""}.`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import local workspace data.", "error");
    } finally {
      setImportingLocalData(false);
    }
  }

  async function downloadReport() {
    if (cloudMode) {
      try {
        const response = await fetch("/api/jobs/daily-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: selectedDate }),
        });
        const result: { error?: string; status?: string; downloadUrl?: string; aiIssue?: string | null } = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not generate the server report.");
        if (result.status === "processing") {
          flash("A report for this date is already being generated.", "error");
          return;
        }
        if (!result.downloadUrl) throw new Error("The report was generated without a download URL.");
        const fileResponse = await fetch(result.downloadUrl);
        if (!fileResponse.ok) throw new Error("Could not download the generated report.");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(await fileResponse.blob());
        link.download = `life-report-${selectedDate}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
        flash(result.aiIssue
          ? "PDF downloaded with deterministic metrics; Gemini analysis was unavailable."
          : "Your private daily report is ready.");
      } catch (error) {
        flash(error instanceof Error ? error.message : "Could not generate the server report.", "error");
      }
      return;
    }

    const reportTasks = data.tasks.filter((task) => taskRelatesToDate(task, selectedDate));
    const reportSessions = data.sessions.filter((session) => dateKey(session.startedAt) === selectedDate);
    const totalFocus = reportSessions.reduce((total, session) => total + session.durationSeconds, 0);
    const completed = reportTasks.filter((task) => task.status === "completed").length;
    const planned = reportTasks.filter((task) => task.status !== "cancelled").length;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    let y = 22;
    pdf.setFillColor(24, 37, 67);
    pdf.rect(0, 0, 210, 45, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.text("LIFE MANAGEMENT OS  /  DAILY REPORT", 17, 16);
    pdf.setFontSize(22);
    pdf.text(new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata",
    }), 17, 31);
    pdf.setTextColor(35, 44, 64);
    pdf.setFontSize(11);
    y = 60;
    const lines = [
      `Planned tasks: ${planned}`,
      `Completed tasks: ${completed}`,
      `Completion rate: ${planned ? `${Math.round((completed / planned) * 100)}%` : "No tasks planned"}`,
      `Recorded focus time: ${durationLabel(totalFocus)}`,
      "",
      "TASKS",
      ...(reportTasks.length
        ? reportTasks.map((task) => `• ${task.title} — ${statusNames[task.status]} (${priorityNames[task.priority]})`)
        : ["No tasks recorded for this date."]),
      "",
      "FOCUS SESSIONS",
      ...(reportSessions.length
        ? reportSessions.map((session) => {
            const taskName = data.tasks.find((task) => task.id === session.taskId)?.title ?? "Unassigned focus";
            return `• ${taskName} — ${durationLabel(session.durationSeconds)}`;
          })
        : ["No focus sessions recorded for this date."]),
      "",
      "JOURNAL",
      data.journal[selectedDate]?.trim() || "No journal entry recorded for this date.",
      "",
      "Data note: This report summarizes records saved in this workspace; it does not infer missing activity.",
    ];
    for (const line of lines) {
      const wrapped = pdf.splitTextToSize(line, 174) as string[];
      if (y + wrapped.length * 6 > 280) {
        pdf.addPage();
        y = 20;
      }
      if (line === "TASKS" || line === "FOCUS SESSIONS" || line === "JOURNAL") {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(58, 76, 118);
      } else {
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(35, 44, 64);
      }
      pdf.text(wrapped, 17, y);
      y += wrapped.length * 6 + 2;
    }
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(9);
      pdf.setTextColor(130, 137, 151);
      pdf.text(`${page} / ${pageCount}`, 193, 287, { align: "right" });
    }
    pdf.save(`life-report-${selectedDate}.pdf`);
    flash("Your data-backed PDF report is ready.");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `life-os-backup-${today}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    flash("Workspace backup downloaded.");
  }

  const heading = navItems.find((item) => item.id === section)?.label ?? "Settings";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <a aria-label="Life OS home" className="brand" href="#" onClick={(event) => {
          event.preventDefault();
          setSection("dashboard");
        }}>
          <div className="brand-mark"><span /></div>
          <span className="brand-text">day<span>mark</span></span>
          <span className="brand-version">PERSONAL OS</span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={section === id ? "page" : undefined}
              className={`nav-item ${section === id ? "nav-active" : ""}`}
              key={id}
              onClick={() => {
                setSection(id);
                setMobileNavOpen(false);
              }}
              type="button"
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "tasks" && outstanding.length > 0 && (
                <span className="nav-count">{outstanding.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-insight">
            <div className="insight-icon"><Sparkles size={16} /></div>
            <p className="insight-title">A little, often.</p>
            <p className="insight-copy">Steady progress beats the perfect plan.</p>
          </div>
          <button
            className={`nav-item ${section === "settings" ? "nav-active" : ""}`}
            onClick={() => setSection("settings")}
            type="button"
          >
            <Settings size={18} strokeWidth={1.8} />
            <span>Settings</span>
          </button>
          <div className="profile-chip">
            <div className="avatar"><span>S</span><img alt="Profile" onError={(event) => { event.currentTarget.style.display = "none"; }} src="/assets/profile.png" /></div>
            <div className="profile-copy"><b>My workspace</b><span>Personal workspace</span></div>
            <MoreHorizontal size={18} className="profile-more" />
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button aria-label="Close navigation" className="mobile-backdrop" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} type="button"><Menu size={19} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><b>{heading}</b></div>
          <div className="topbar-actions">
            <div className={`sync-pill ${cloudMode ? "sync-cloud" : ""}`}>
              <span className="sync-dot" />
              {cloudMode ? "Private database" : cloudError ? "Sync needs attention" : "This device"}
            </div>
            <button className="icon-button" aria-label="Toggle color theme" onClick={() => setDarkMode((value) => !value)} type="button">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" aria-label="Notifications" onClick={() => flash("You’re all caught up.")} type="button"><Bell size={18} /></button>
            <div className="top-avatar"><span>S</span><img alt="Profile" onError={(event) => { event.currentTarget.style.display = "none"; }} src="/assets/profile.png" /></div>
          </div>
        </header>

        <div className="page-content">
          {cloudError && (
            <div className="notice notice-warning">
              <CircleHelp size={17} />
              <span>{cloudError}</span>
              <button aria-label="Dismiss message" className="notice-close" onClick={() => setCloudError("")} type="button"><X size={15} /></button>
            </div>
          )}
          {cloudChecked && !cloudMode && (
            <div className="notice notice-info">
              <ShieldCheck size={17} />
              <span>Your private workspace could not be loaded. {cloudError || "Check the connection and try again."}</span>
              <button className="secondary-button" onClick={() => window.location.reload()} type="button">Retry</button>
            </div>
          )}

          {section === "dashboard" && (
            <Dashboard
              activeTask={activeTask}
              activeTimerActive={data.activeTimer !== null}
              activeTimerPaused={timerPaused}
              activeTimerSeconds={activeTimerSeconds}
              completedToday={completedToday}
              completionRate={completionRate}
              data={data}
              focusTodaySeconds={focusTodaySeconds}
              now={now}
              onAddTask={openNewTask}
              onComplete={(task) => void changeTaskStatus(task, task.status === "completed" ? "planned" : "completed")}
              onOpenSection={setSection}
              onPauseTimer={pauseTimer}
              onResumeTimer={resumeTimer}
              onStartTimer={startTimer}
              onStopTimer={stopTimer}
              outstanding={outstanding}
              todayOutstanding={todayOutstanding}
              plannedToday={plannedToday}
              today={today}
            />
          )}
          {section === "tasks" && (
            <section className="section-page">
              <PageHeading eyebrow="PLAN WITH INTENTION" title="My tasks" subtitle="Keep your next steps visible and your priorities clear." action={
                <button className="primary-button" onClick={openNewTask} type="button"><Plus size={16} /> New task</button>
              } />
              <div className="task-toolbar">
                <div className="search-field"><Search size={16} /><input aria-label="Search tasks" onChange={(event) => setTaskSearch(event.target.value)} placeholder="Search your tasks" value={taskSearch} /></div>
                <div className="filter-field"><ListFilter size={16} /><select aria-label="Filter tasks by status" onChange={(event) => setTaskFilter(event.target.value as "all" | TaskStatus)} value={taskFilter}><option value="all">All statuses</option>{Object.entries(statusNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select><ChevronDown size={14} /></div>
                <span className="task-count">{visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}</span>
              </div>
              <div className="task-list-card">
                {visibleTasks.length ? visibleTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    onArchive={(item) => void archiveTask(item)}
                    onComplete={(item) => void changeTaskStatus(item, item.status === "completed" ? "planned" : "completed")}
                    onEdit={openEditTask}
                    onStart={(item) => startTimer(item)}
                    task={task}
                  />
                )) : <EmptyState icon={ListTodo} title={taskSearch ? "No matching tasks" : "A clear page is a good place to start"} copy={taskSearch ? "Try a different search or status filter." : "Add a task when you’re ready. Your plans will appear here."} action={!taskSearch ? <button className="text-button" onClick={openNewTask} type="button"><Plus size={15} /> Create your first task</button> : undefined} />}
              </div>
            </section>
          )}
          {section === "focus" && (
            <FocusPage
              activeTask={activeTask}
              activeTimerPaused={timerPaused}
              activeTimerSeconds={activeTimerSeconds}
              data={data}
              onSelectTask={setActiveTaskId}
              onPause={pauseTimer}
              onResume={resumeTimer}
              onStart={() => startTimer()}
              onStop={stopTimer}
              selectedTaskId={activeTaskId}
            />
          )}
          {section === "journal" && (
            <JournalPage
              date={selectedDate}
              onDateChange={changeSelectedDate}
              onSave={saveJournal}
              onTextChange={changeJournalDraft}
              saved={journalSaved || Boolean(journalDraft.trim() && data.journal[selectedDate] === journalDraft)}
              text={journalDraft}
            />
          )}
          {section === "calendar" && (
            <HistoryPage
              data={data}
              date={selectedDate}
              onDateChange={changeSelectedDate}
              onOpenJournal={() => setSection("journal")}
            />
          )}
          {section === "reports" && (
            <ReportsPage
              cloudMode={cloudMode}
              data={data}
              date={selectedDate}
              onDateChange={changeSelectedDate}
              onDownload={() => void downloadReport()}
            />
          )}
          {(["goals", "blog", "knowledge", "ai"] as Section[]).includes(section) && (
            <WorkspaceFeatures
              cloudChecked={cloudChecked}
              cloudMode={cloudMode}
              key={section}
              section={section as "goals" | "blog" | "knowledge" | "ai"}
            />
          )}
          {section === "settings" && (
            <SettingsPage
              cloudMode={cloudMode}
              importingLocalData={importingLocalData}
              localDataAvailable={localDataAvailable}
              onExport={exportData}
              onImportLocalData={() => void importLocalData()}
            />
          )}
        </div>
      </main>

      {showTaskForm && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowTaskForm(false);
        }}>
          <form className="task-modal" onSubmit={(event) => void saveTask(event)}>
            <div className="modal-heading"><div><p className="eyebrow">A STEP FORWARD</p><h2>{editingTask ? "Edit task" : "Create a task"}</h2></div><button aria-label="Close dialog" className="icon-button" onClick={() => setShowTaskForm(false)} type="button"><X size={18} /></button></div>
            <label className="field-label" htmlFor="task-title">Task name</label>
            <input autoFocus id="task-title" maxLength={180} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="What would you like to get done?" required value={newTaskTitle} />
            <label className="field-label" htmlFor="task-description">Details <span className="muted">(optional)</span></label>
            <textarea className="task-description-input" id="task-description" maxLength={4000} onChange={(event) => setNewTaskDescription(event.target.value)} placeholder="Add a little context…" value={newTaskDescription} />
            <div className="form-grid">
              <div><label className="field-label" htmlFor="task-due">Due date</label><input id="task-due" onChange={(event) => setNewTaskDueDate(event.target.value)} type="date" value={newTaskDueDate} /></div>
              <div><label className="field-label" htmlFor="task-priority">Priority</label><select id="task-priority" onChange={(event) => setNewTaskPriority(event.target.value as Priority)} value={newTaskPriority}>{Object.entries(priorityNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div>
            </div>
            <label className="field-label" htmlFor="task-estimate">Estimated time · minutes</label>
            <input id="task-estimate" max="100000" min="0" onChange={(event) => setNewTaskEstimate(Number(event.target.value))} type="number" value={newTaskEstimate} />
            <div className="modal-actions"><button className="secondary-button" onClick={() => setShowTaskForm(false)} type="button">Cancel</button><button className="primary-button" disabled={!newTaskTitle.trim()} type="submit">{editingTask ? <Check size={16} /> : <Plus size={16} />}{editingTask ? "Save changes" : "Add task"}</button></div>
          </form>
        </div>
      )}
      {toast && <div className={`toast toast-${toast.tone}`} role="status">{toast.tone === "success" ? <CheckCircle2 size={17} /> : <CircleHelp size={17} />}{toast.message}</div>}
    </div>
  );
}

function Dashboard({
  activeTask,
  activeTimerActive,
  activeTimerPaused,
  activeTimerSeconds,
  completedToday,
  completionRate,
  data,
  focusTodaySeconds,
  now,
  onAddTask,
  onComplete,
  onOpenSection,
  onPauseTimer,
  onResumeTimer,
  onStartTimer,
  onStopTimer,
  outstanding,
  todayOutstanding,
  plannedToday,
  today,
}: {
  activeTask: Task | undefined;
  activeTimerActive: boolean;
  activeTimerPaused: boolean;
  activeTimerSeconds: number;
  completedToday: number;
  completionRate: number;
  data: LifeData;
  focusTodaySeconds: number;
  now: Date;
  onAddTask: () => void;
  onComplete: (task: Task) => void;
  onOpenSection: (section: Section) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onStartTimer: (task?: Task) => void;
  onStopTimer: () => void;
  outstanding: Task[];
  todayOutstanding: Task[];
  plannedToday: number;
  today: string;
}) {
  const dayGreeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const todaysJournal = data.journal[today]?.trim();
  const urgent = outstanding.filter((task) => task.priority === "critical" || task.priority === "high");

  return (
    <section className="dashboard-page">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">YOUR DAY, IN FOCUS</p>
          <h1>{dayGreeting}, Shyam<span className="greeting-period">.</span></h1>
          <p className="welcome-subtitle">{now.getTime() === 0 ? <span className="loading-time">Loading local time…</span> : <><span>{now.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kolkata", year: "numeric" })}</span><span className="date-dot">·</span><span className="live-time">{now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST</span></>}</p>
        </div>
        <div className="welcome-actions"><button className="secondary-button" onClick={() => onOpenSection("journal")} type="button"><MessageSquareText size={16} /> Quick note</button><button className="primary-button" onClick={onAddTask} type="button"><Plus size={16} /> Add a task</button></div>
      </div>

      <div className="stat-grid">
        <MetricCard icon={ListTodo} label="Planned today" value={String(plannedToday)} detail={`${completedToday} completed`} tone="blue" />
        <MetricCard icon={Activity} label="Completion" value={`${completionRate}%`} detail={plannedToday ? "Of today’s planned tasks" : "No tasks scheduled yet"} tone="violet" />
        <MetricCard icon={Clock3} label="Focus time" value={durationLabel(focusTodaySeconds)} detail="Recorded today" tone="green" />
        <MetricCard icon={Flag} label="High priority" value={String(urgent.length)} detail="Tasks to keep in view" tone="amber" />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main-column">
          <section className="surface-card today-card">
            <div className="card-heading"><div><p className="eyebrow">MAKE TODAY COUNT</p><h2>Today’s plan</h2></div><button className="subtle-link" onClick={() => onOpenSection("tasks")} type="button">See all <ArrowRight size={14} /></button></div>
            {todayOutstanding.slice(0, 4).length ? (
              <div className="task-list-compact">
                {todayOutstanding.slice(0, 4).map((task) => <TaskRow key={task.id} onComplete={onComplete} onStart={() => onStartTimer(task)} task={task} />)}
              </div>
            ) : (
              <EmptyState icon={CheckCircle2} title="Nothing demanding your attention" copy="Add a task whenever something important comes to mind." action={<button className="text-button" onClick={onAddTask} type="button"><Plus size={15} /> Add a task</button>} />
            )}
            {todayOutstanding.length > 4 && <button className="view-more" onClick={() => onOpenSection("tasks")} type="button">View {todayOutstanding.length - 4} more tasks <ArrowRight size={14} /></button>}
          </section>
          <section className="surface-card focus-card">
            <div className="focus-card-top"><div><p className="eyebrow">PROTECT YOUR ATTENTION</p><h2>{activeTask ? "Focus in progress" : "Make a little space"}</h2></div><div className="focus-orbit"><div className="focus-orbit-inner"><Timer size={19} /></div></div></div>
            <div className="focus-card-bottom">
              <div><p className="focus-task-name">{activeTask ? activeTask.title : "One thing at a time."}</p><p className="muted small-copy">{activeTask ? "Stay with this task for as long as it needs." : "A short, intentional session can change your day."}</p></div>
              {activeTimerActive ? <div className="timer-actions">{activeTimerPaused ? <button className="secondary-button" onClick={onResumeTimer} type="button"><Play size={14} /> Resume</button> : <button className="secondary-button" onClick={onPauseTimer} type="button"><Pause size={14} /> Pause</button>}<button className="stop-button" onClick={onStopTimer} type="button"><span className="stop-square" /> Stop · {durationLabel(activeTimerSeconds)}</button></div> : <button className="primary-button" onClick={() => onStartTimer()} type="button"><Timer size={16} /> Start focus</button>}
            </div>
          </section>
        </div>
        <div className="dashboard-side-column">
          <section className="surface-card progress-card">
            <div className="card-heading"><div><p className="eyebrow">A STEADY RHYTHM</p><h2>Today’s progress</h2></div><span className="tiny-date">TODAY</span></div>
            <div className="progress-ring-row"><div className="progress-ring" style={{ "--progress": `${completionRate}%` } as CSSProperties}><div className="progress-ring-center"><b>{completionRate}%</b><span>done</span></div></div><div><b className="progress-count">{completedToday}<span> / {plannedToday}</span></b><p className="muted small-copy">tasks completed</p></div></div>
            <div className="progress-divider" />
            <div className="mini-stat"><span><Clock3 size={15} /> Focus recorded</span><b>{durationLabel(focusTodaySeconds)}</b></div>
            <div className="mini-stat"><span><AlarmClock size={15} /> In a session</span><b>{activeTimerSeconds > 0 ? durationLabel(activeTimerSeconds) : "Not yet"}</b></div>
          </section>
          <section className="surface-card journal-card">
            <div className="journal-heading"><div className="journal-icon"><BookOpen size={17} /></div><span>DAILY JOURNAL</span><ArrowUpRight size={15} className="journal-arrow" /></div>
            <h3>{todaysJournal ? "You’ve captured a thought." : "Leave yourself a note."}</h3>
            <p>{todaysJournal ? todaysJournal.slice(0, 100) : "A small reflection helps tomorrow start with a little more clarity."}</p>
            <button className="journal-link" onClick={() => onOpenSection("journal")} type="button">{todaysJournal ? "Continue writing" : "Open your journal"} <ArrowRight size={14} /></button>
          </section>
          <section className="quote-card"><Sparkles size={16} /><p>Progress is a practice, not a performance.</p><span>YOUR WORKSPACE, YOUR PACE</span></section>
        </div>
      </div>
      {data.sessions.length > 0 && <p className="data-footnote"><ShieldCheck size={13} /> Insights are calculated from your saved records. Missing data is never treated as inactivity.</p>}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "violet" | "green" | "amber";
}) {
  return (
    <article className="metric-card surface-card">
      <div className={`metric-icon metric-${tone}`}><Icon size={17} strokeWidth={1.9} /></div>
      <p className="metric-label">{label}</p>
      <b className="metric-value">{value}</b>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

function PageHeading({ eyebrow, title, subtitle, action }: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}

function EmptyState({ icon: Icon, title, copy, action }: {
  icon: LucideIcon;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={20} /></div><h3>{title}</h3><p>{copy}</p>{action}</div>;
}

function FocusPage({
  activeTask,
  activeTimerPaused,
  activeTimerSeconds,
  data,
  onSelectTask,
  onPause,
  onResume,
  onStart,
  onStop,
  selectedTaskId,
}: {
  activeTask: Task | undefined;
  activeTimerPaused: boolean;
  activeTimerSeconds: number;
  data: LifeData;
  onSelectTask: (id: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStart: () => void;
  onStop: () => void;
  selectedTaskId: string;
}) {
  const sessionTotal = data.sessions.reduce((total, session) => total + session.durationSeconds, 0);
  return (
    <section className="section-page">
      <PageHeading eyebrow="BE PRESENT WITH ONE THING" title="Focus timer" subtitle="A persistent, timestamp-based timer that keeps running across refreshes." />
      <div className="focus-layout">
        <div className={`focus-session surface-card ${data.activeTimer ? "focus-session-running" : ""}`}>
          <div className="focus-session-label"><span className="sync-dot" />{data.activeTimer ? activeTimerPaused ? "SESSION PAUSED" : "SESSION IN PROGRESS" : "READY WHEN YOU ARE"}</div>
          <div className="timer-display">{String(Math.floor(activeTimerSeconds / 3600)).padStart(2, "0")}<span>:</span>{String(Math.floor((activeTimerSeconds % 3600) / 60)).padStart(2, "0")}<span>:</span>{String(activeTimerSeconds % 60).padStart(2, "0")}</div>
          <p className="focus-task-display">{activeTask?.title ?? "Choose a task, or focus freely"}</p>
          {!data.activeTimer && <select aria-label="Associate focus with a task" className="focus-task-select" onChange={(event) => onSelectTask(event.target.value)} value={selectedTaskId}><option value="">Focus without a task</option>{data.tasks.filter((task) => task.status !== "completed").map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>}
          {data.activeTimer ? <div className="timer-actions">{activeTimerPaused ? <button className="secondary-button" onClick={onResume} type="button"><Play size={14} /> Resume</button> : <button className="secondary-button" onClick={onPause} type="button"><Pause size={14} /> Pause</button>}<button className="stop-button large-stop" onClick={onStop} type="button"><span className="stop-square" /> Stop and save</button></div> : <button className="primary-button focus-start-button" onClick={() => onStart()} type="button"><Timer size={17} /> Start focus session</button>}
          <p className="timer-note"><ShieldCheck size={14} /> Your timestamp-based timer syncs across your devices.</p>
        </div>
        <div className="surface-card session-history">
          <div className="card-heading"><div><p className="eyebrow">YOUR RECORD</p><h2>Recent sessions</h2></div><span className="session-total">{durationLabel(sessionTotal)} total</span></div>
          {data.sessions.length ? data.sessions.slice(0, 8).map((session) => {
            const task = data.tasks.find((item) => item.id === session.taskId);
            return <div className="session-row" key={session.id}><div className="session-row-icon"><Clock3 size={16} /></div><div className="session-row-copy"><b>{task?.title ?? "Unassigned focus"}</b><span>{new Date(session.startedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })} · {new Date(session.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span></div><strong>{durationLabel(session.durationSeconds)}</strong></div>;
          }) : <EmptyState icon={Clock3} title="No sessions yet" copy="Your completed focus sessions will show up here." />}
        </div>
      </div>
    </section>
  );
}

function JournalPage({ date, onDateChange, onSave, onTextChange, saved, text }: {
  date: string;
  onDateChange: (date: string) => void;
  onSave: () => void;
  onTextChange: (text: string) => void;
  saved: boolean;
  text: string;
}) {
  return (
    <section className="section-page journal-page">
      <PageHeading eyebrow="A SPACE TO REFLECT" title="Daily journal" subtitle="Your entries are saved to Supabase and sync across your devices." action={<input aria-label="Journal date" className="date-input" onChange={(event) => onDateChange(event.target.value)} type="date" value={date} />} />
      <div className="journal-editor surface-card">
        <div className="journal-prompt"><BookOpen size={18} /><div><b>Take a moment for yourself.</b><span>What felt meaningful today? What might you carry into tomorrow?</span></div></div>
        <textarea aria-label="Journal entry" onChange={(event) => onTextChange(event.target.value)} placeholder={"A few honest words are enough…\n\nWhat went well?\nWhat felt difficult?\nWhat do you want to remember?"} value={text} />
        <div className="journal-editor-footer"><span>{text.trim() ? `${text.trim().split(/\s+/).length} words` : "A note for your future self"}</span><button className="primary-button" disabled={!text.trim()} onClick={onSave} type="button">{saved ? <Check size={16} /> : <BookOpen size={16} />}{saved ? "Saved" : "Save reflection"}</button></div>
      </div>
      <div className="privacy-note"><LockKeyhole size={15} /><span>Personal workspace. Anyone with the app URL can access these records.</span></div>
    </section>
  );
}

function HistoryPage({ data, date, onDateChange, onOpenJournal }: {
  data: LifeData;
  date: string;
  onDateChange: (date: string) => void;
  onOpenJournal: () => void;
}) {
  const tasks = data.tasks.filter((task) => taskRelatesToDate(task, date));
  const sessions = data.sessions.filter((session) => dateKey(session.startedAt) === date);
  const journal = data.journal[date];
  return (
    <section className="section-page">
      <PageHeading eyebrow="LOOK BACK WITH CLARITY" title="Calendar & history" subtitle="Browse the records you’ve saved for any day." action={<input aria-label="Select history date" className="date-input" onChange={(event) => onDateChange(event.target.value)} type="date" value={date} />} />
      <div className="history-overview">
        <div className="history-date-card surface-card"><p className="eyebrow">SELECTED DAY</p><h2>{new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kolkata" })}</h2><p>{tasks.length} planned tasks · {sessions.length} focus sessions</p></div>
        <div className="history-date-card surface-card"><p className="eyebrow">FOCUS TIME</p><h2>{durationLabel(sessions.reduce((total, session) => total + session.durationSeconds, 0))}</h2><p>From saved time sessions</p></div>
      </div>
      <div className="history-columns">
        <div className="surface-card history-card"><div className="card-heading"><div><p className="eyebrow">WHAT WAS PLANNED</p><h2>Tasks</h2></div></div>{tasks.length ? tasks.map((task) => <div className="history-row" key={task.id}><span className={`priority-dot priority-${task.priority}`} /><b>{task.title}</b><span className={`status-chip status-${task.status}`}>{statusNames[task.status]}</span></div>) : <EmptyState icon={ListTodo} title="No task records" copy="There were no tasks scheduled for this date." />}</div>
        <div className="surface-card history-card"><div className="card-heading"><div><p className="eyebrow">WHAT YOU NOTED</p><h2>Reflection</h2></div><button className="subtle-link" onClick={onOpenJournal} type="button">Open journal <ArrowRight size={14} /></button></div>{journal?.trim() ? <p className="history-journal">{journal}</p> : <EmptyState icon={BookOpen} title="No journal entry" copy="No reflection was saved for this day." />}</div>
      </div>
      <p className="data-footnote"><ShieldCheck size={13} /> No activity was inferred for days without records.</p>
    </section>
  );
}

function ReportsPage({ cloudMode, data, date, onDateChange, onDownload }: {
  cloudMode: boolean;
  data: LifeData;
  date: string;
  onDateChange: (date: string) => void;
  onDownload: () => void;
}) {
  const tasks = data.tasks.filter((task) => taskRelatesToDate(task, date));
  const sessions = data.sessions.filter((session) => dateKey(session.startedAt) === date);
  return (
    <section className="section-page">
      <PageHeading eyebrow="YOUR RECORD, BEAUTIFULLY SUMMARIZED" title="Daily reports" subtitle="Generate a clear PDF from your actual saved activity." action={<input aria-label="Report date" className="date-input" onChange={(event) => onDateChange(event.target.value)} type="date" value={date} />} />
      <div className="report-card surface-card">
        <div className="report-cover"><div className="report-cover-brand"><div className="report-brand-mark"><span /></div><span>DAYMARK · DAILY REPORT</span></div><div className="report-cover-date">{new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kolkata", year: "numeric" })}</div><div className="report-cover-foot"><span>PRIVATE WORKSPACE</span><span>01</span></div></div>
        <div className="report-details"><div className="report-preview-heading"><div><p className="eyebrow">REPORT PREVIEW</p><h2>Your day, in perspective.</h2><p>Built from {tasks.length} task {tasks.length === 1 ? "record" : "records"} and {sessions.length} focus {sessions.length === 1 ? "session" : "sessions"} saved for this date.</p></div><button className="primary-button" onClick={onDownload} type="button"><Download size={16} /> Download PDF</button></div><div className="report-section-grid"><div><span>PLANNED</span><b>{tasks.filter((task) => task.status !== "cancelled").length}</b></div><div><span>COMPLETED</span><b>{tasks.filter((task) => task.status === "completed").length}</b></div><div><span>FOCUS SESSIONS</span><b>{sessions.length}</b></div><div><span>REFLECTION</span><b>{data.journal[date]?.trim() ? "Saved" : "—"}</b></div></div><p className="report-disclaimer"><ShieldCheck size={14} /> This report uses saved workspace records only. {cloudMode ? "Server reports currently read Supabase records; this release keeps journal entries and focus sessions on this device." : "Local PDF generation includes this device’s saved timer and journal records."}</p></div>
      </div>
    </section>
  );
}

function SettingsPage({
  cloudMode,
  importingLocalData,
  localDataAvailable,
  onExport,
  onImportLocalData,
}: {
  cloudMode: boolean;
  importingLocalData: boolean;
  localDataAvailable: boolean;
  onExport: () => void;
  onImportLocalData: () => void;
}) {
  return (
    <section className="section-page">
      <PageHeading eyebrow="MAKE THIS SPACE YOURS" title="Settings" subtitle="Privacy, preferences, and the connections behind your workspace." />
      <div className="settings-stack">
        <div className="surface-card settings-card"><div className="settings-icon"><ShieldCheck size={18} /></div><div className="settings-copy"><h2>Personal workspace</h2><p>This app has no login or access control. Anyone with the deployed URL can access its data; keep the URL private for personal use.</p><span className="settings-value">No login · personal use</span></div></div>
        <div className="surface-card settings-card"><div className="settings-icon"><FolderKanban size={18} /></div><div className="settings-copy"><h2>Data storage</h2><p>{cloudMode ? "Tasks, journal entries, and timestamped focus sessions are stored in Supabase and sync across your devices." : "The Supabase database is not currently connected."}</p><span className="settings-value">{cloudMode ? "Supabase · cloud database" : "Connection unavailable"}</span></div><span className="settings-badge">{cloudMode ? "CONNECTED" : "OFFLINE"}</span></div>
        {localDataAvailable && <div className="surface-card settings-card"><div className="settings-icon"><Download size={18} /></div><div className="settings-copy"><h2>Import my local data</h2><p>After confirmation, copy this browser’s tasks, focus sessions, and journal entries to Supabase. Existing cloud rows are never overwritten, and local data remains on this device.</p></div><button className="secondary-button" disabled={!cloudMode || importingLocalData} onClick={onImportLocalData} type="button">{importingLocalData ? "Importing…" : "Import my local data"}</button></div>}
        <div className="surface-card settings-card"><div className="settings-icon"><AlarmClock size={18} /></div><div className="settings-copy"><h2>Daily report schedule</h2><p>Daily reports are scheduled by Netlify for 10:00 PM Asia/Kolkata.</p><span className="settings-value">Asia/Kolkata · 22:00</span></div><span className="settings-badge">NETLIFY</span></div>
        <div className="surface-card settings-card"><div className="settings-icon"><Download size={18} /></div><div className="settings-copy"><h2>Export your data</h2><p>Download a JSON backup of the currently loaded tasks, cloud focus sessions, journal entries, and active timer state.</p></div><button className="secondary-button" onClick={onExport} type="button"><Download size={15} /> Export JSON</button></div>
      </div>
    </section>
  );
}
