export type TaskDetailStatus = "ready" | "in_progress" | "waiting" | "blocked" | "review" | "done";
export type TaskDetailPriority = "low" | "medium" | "high" | "urgent";

/** Priority is intentionally independent from workflow and planning state. */
export function getTaskDetailPriorityLabel(priority: TaskDetailPriority) {
  return ({ low: "Low", medium: "Normal", high: "High", urgent: "Urgent" } as const)[priority];
}

export type TaskDetailPrimaryAction = "claim" | "start" | "complete" | "approve" | "continue" | "update_waiting" | undefined;

export type TaskDetailActionContext = {
  status: TaskDetailStatus;
  isServerTask: boolean;
  currentUserIsAssignee: boolean;
  /** @deprecated Waiting context only; it never grants operational ownership. */
  currentUserHasNextAction: boolean;
  currentUserIsReviewer: boolean;
  hasTeamAssignment: boolean;
  hasPersonalAssignment: boolean;
  isWaiting: boolean;
};

/**
 * Chooses the one first action for a task drawer without granting authority.
 * The server remains responsible for authorizing and applying every mutation.
 */
export function getTaskDetailPrimaryAction(context: TaskDetailActionContext): TaskDetailPrimaryAction {
  // Done is a completed historical state, not an action prompt. Opening a
  // Done task only opens its drawer; it must never fall through to Start or
  // Complete actions.
  if (context.status === "done") return undefined;

  // A legacy next-action label is monitoring context only. The current
  // responsibility (or an active review) is what gives a person work to do.
  const currentUserCanMove = context.currentUserIsAssignee ||
    (context.status === "review" && context.currentUserIsReviewer);
  const unclaimedTeamTask = context.isServerTask && context.hasTeamAssignment && !context.hasPersonalAssignment &&
    !context.currentUserIsAssignee;

  if (unclaimedTeamTask) return "claim";
  if (context.status === "review" && currentUserCanMove) return "approve";
  if (context.status === "ready" && currentUserCanMove) return "start";
  if (context.status === "in_progress" && currentUserCanMove) return "complete";
  if (context.isWaiting || context.status === "waiting" || context.status === "blocked") {
    if (currentUserCanMove) return "update_waiting";
  }
  return undefined;
}

export type TaskDetailSecondaryContext = {
  targetDate?: string;
  followUpDate?: string;
  responseDue?: string;
  estimatedMinutes?: number;
  involvedAreaCount?: number;
  contributorCount?: number;
  dependencyCount?: number;
  checklistCount?: number;
  subtaskCount?: number;
  recurring?: boolean;
  linkCount?: number;
  fileCount?: number;
  hasOriginalCapture?: boolean;
  activityCount?: number;
};

/** Whether a calm task needs more than its everyday execution fields. */
export function hasTaskDetailSecondaryContext(context: TaskDetailSecondaryContext) {
  return Boolean(
    context.targetDate || context.followUpDate || context.responseDue || context.estimatedMinutes ||
    context.involvedAreaCount || context.contributorCount || context.dependencyCount ||
    context.checklistCount || context.subtaskCount || context.recurring || context.linkCount ||
    context.fileCount || context.hasOriginalCapture || context.activityCount,
  );
}
