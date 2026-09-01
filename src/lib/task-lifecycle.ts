export type TaskLifecycleStatus = "ready" | "in_progress" | "waiting" | "blocked" | "review" | "done";

/** Done remains readable history. Archive is an intentional later filing step. */
export function canArchiveTask(status: TaskLifecycleStatus, archived = false) {
  return status === "done" && !archived;
}

/** A shared server/client-safe message for the lifecycle boundary. */
export function taskArchiveValidationMessage(status: TaskLifecycleStatus, archived = false) {
  if (archived) return "This task is already archived.";
  if (!canArchiveTask(status, archived)) return "Only completed tasks can be archived.";
  return undefined;
}
