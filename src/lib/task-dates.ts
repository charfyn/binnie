/**
 * Task dates are calendar values. Keep their validation deliberately stricter
 * than `Date.parse`, which will otherwise roll impossible values such as
 * February 31 into a later month.
 */
const DATE_PARTS = /^(\d{4})([-/])(\d{2})\2(\d{2})$/;

export function isValidTaskDate(value: string, separator?: "-" | "/") {
  const match = value.match(DATE_PARTS);
  if (!match || (separator && match[2] !== separator)) return false;
  const year = Number(match[1]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The only persisted representation for PostgreSQL DATE task fields. */
export function isValidTaskIsoDate(value: string) {
  return isValidTaskDate(value, "-");
}

/** Converts the Task Detail display format into canonical ISO storage format. */
export function taskDateInputToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!isValidTaskDate(trimmed, "/")) return undefined;
  return trimmed.replaceAll("/", "-");
}

/** Converts canonical ISO storage into the Task Detail display format. */
export function taskDateInputFromIso(value?: string | null) {
  return value && isValidTaskIsoDate(value) ? value.replaceAll("-", "/") : "";
}

export function taskDateInputError(value: string) {
  return value.trim() && !taskDateInputToIso(value)
    ? "Please enter a valid date in YYYY/MM/DD format."
    : undefined;
}

/** The task-model invariant shared by the action boundary and persistence. */
export function taskPlanningDatesError(planFor?: string | null, deadline?: string | null) {
  if (planFor && !isValidTaskIsoDate(planFor)) return "Please enter a valid date in YYYY/MM/DD format.";
  if (deadline && !isValidTaskIsoDate(deadline)) return "Please enter a valid date in YYYY/MM/DD format.";
  return planFor && deadline && planFor > deadline ? "Plan date cannot be after the deadline." : undefined;
}
