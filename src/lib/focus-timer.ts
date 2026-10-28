export type PersistedTimerState = {
  elapsedSeconds: number;
  originalStartedAt: string;
  runningSince: string | null;
};

type FocusSessionNotes = {
  daymarkTimer?: PersistedTimerState;
  note?: string;
};

export function encodeFocusSessionNotes(state: PersistedTimerState, note = "") {
  return JSON.stringify({ daymarkTimer: state, note } satisfies FocusSessionNotes);
}

export function decodeFocusSessionNotes(notes: string): FocusSessionNotes | null {
  try {
    const parsed: unknown = JSON.parse(notes);
    if (typeof parsed !== "object" || parsed === null) return null;
    const timer = Reflect.get(parsed, "daymarkTimer");
    if (typeof timer !== "object" || timer === null) return null;
    const elapsedSeconds = Reflect.get(timer, "elapsedSeconds");
    const originalStartedAt = Reflect.get(timer, "originalStartedAt");
    const runningSince = Reflect.get(timer, "runningSince");
    if (
      typeof elapsedSeconds !== "number" ||
      !Number.isInteger(elapsedSeconds) ||
      elapsedSeconds < 0 ||
      typeof originalStartedAt !== "string" ||
      !(runningSince === null || typeof runningSince === "string")
    ) {
      return null;
    }
    return {
      daymarkTimer: { elapsedSeconds, originalStartedAt, runningSince },
      note: typeof Reflect.get(parsed, "note") === "string" ? Reflect.get(parsed, "note") : "",
    };
  } catch {
    return null;
  }
}
