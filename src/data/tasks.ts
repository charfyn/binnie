import "server-only";

import {
  AssignmentRole,
  AssignmentSource,
  CaptureStatus,
  DependencyType,
  NextActionKind,
  ProjectMemberRole,
  ProjectStatus,
  ResourceScope,
  MilestoneStatus,
  RecurrenceFrequency,
  PrincipalType,
  PrincipalStatus,
  MembershipStatus,
  InvitationStatus,
  ReviewDecision,
  TaskEventType,
  TaskPriority,
  TaskStatus,
  WorkflowTemplateStatus,
  NudgeDisposition,
  type Prisma,
} from "@/generated/prisma/client";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  canManageDepartment,
  canManageOrganization,
  isViewer,
  isWorkspaceOwner,
  requireCurrentUser,
  type CurrentUserContext,
} from "@/lib/access";
import { getDb, hasDatabaseConfiguration } from "@/lib/db";
import { seedDemoWorkspace } from "../../prisma/seed";
import { calendarDateKey, nextOccurrenceDate, taskTransitionBlockReason } from "@/lib/work-rules";
import { defaultOrganizationColorKey, isOrganizationColorKey, type OrganizationColorKey } from "@/lib/organization-colors";
import { TASK_LIST_COLUMN_IDS } from "@/lib/task-list";
import type {
  ActionResult,
  DependencyTypeValue,
  DirectoryDTO,
  InboxCaptureDTO,
  NextActionKindValue,
  NudgeStateDTO,
  OrganizationDTO,
  ProjectDTO,
  SavedViewDTO,
  TaskAssignmentDTO,
  TaskDTO,
  TaskPriorityValue,
  TaskStatusValue,
  TaskScopeOptionDTO,
  TaskScopeResultDTO,
  TaskWorkspaceScope,
  UserProfileDTO,
  WorkflowTemplateDTO,
  WorkspaceSnapshotDTO,
} from "@/lib/work-types";

const DEFAULT_WORKSPACE_ID = "workspace-binnie";
const workspaceTimeZone = "Asia/Jakarta";

const taskInclude = {
  organization: true,
  leadDepartment: true,
  project: true,
  nextActionPrincipal: true,
  nextActionDepartment: true,
  involvedDepartments: { include: { department: true } },
  assignments: { include: { principal: { include: { teamScopes: { where: { status: "ACTIVE" }, select: { departmentId: true } } } }, assignedBy: { select: { id: true, name: true } } }, orderBy: [{ role: "asc" }, { assignedAt: "asc" }] },
  dependencies: {
    include: {
      prerequisiteTask: { select: { id: true, title: true, status: true } },
      ownerPrincipal: true,
      ownerDepartment: true,
    },
    orderBy: { createdAt: "asc" },
  },
  updates: {
    include: { author: true, resources: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  },
  resources: { orderBy: { createdAt: "desc" } },
  events: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 100 },
  reviewCycles: {
    include: { submittedBy: true, reviewer: true, reviewedBy: true },
    orderBy: { submittedAt: "desc" },
    take: 1,
  },
  checklistItems: { include: { completedBy: true }, orderBy: { position: "asc" } },
  subtasks: { select: { id: true, status: true, archivedAt: true, deletedAt: true } },
  recurrence: true,
  captureLinks: { include: { capture: { select: { rawText: true, status: true, undoExpiresAt: true } } }, take: 1 },
} satisfies Prisma.TaskInclude;

type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type ActorRecord = {
  id: string;
  workspaceId: string;
  name: string;
  username: string;
  email: string;
  context: CurrentUserContext;
  organizationMemberships: CurrentUserContext["organizationMemberships"];
  departmentMemberships: CurrentUserContext["departmentMemberships"];
  teamIds: string[];
};

const projectInclude = {
  organization: true,
  leadDepartment: true,
  involvedDepartments: { include: { department: true } },
  members: { include: { principal: true }, orderBy: [{ role: "asc" }, { addedAt: "asc" }] },
  milestones: { include: { owner: true }, orderBy: [{ targetDate: "asc" }, { createdAt: "asc" }] },
  focusItems: { orderBy: { position: "asc" } },
  resources: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.ProjectInclude;

type ProjectRecord = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

const workflowTemplateInclude = {
  organization: true,
  leadDepartment: true,
  involvedDepartments: { include: { department: true } },
  tasks: {
    include: {
      leadDepartment: true,
      defaultAssignee: true,
      checklistItems: { orderBy: { position: "asc" } },
      dependencies: { orderBy: { id: "asc" } },
    },
    orderBy: { position: "asc" },
  },
  milestones: { include: { owner: true }, orderBy: { position: "asc" } },
  focusItems: { orderBy: { position: "asc" } },
} satisfies Prisma.WorkflowTemplateInclude;

type WorkflowTemplateRecord = Prisma.WorkflowTemplateGetPayload<{ include: typeof workflowTemplateInclude }>;

export interface NextActionInput {
  kind: NextActionKindValue;
  principalId?: string;
  departmentId?: string;
  externalLabel?: string;
}

export interface AssignmentInput {
  principalId: string;
  role: "primary_owner" | "collaborator";
}

export interface DependencyInput {
  type: DependencyTypeValue;
  label: string;
  prerequisiteTaskId?: string;
  ownerPrincipalId?: string;
  ownerDepartmentId?: string;
}

export interface RecurrenceInput {
  frequency: "daily" | "weekly" | "monthly" | "months";
  interval?: number;
  weekDays?: number[];
  monthDay?: number;
  startDate: string;
  endDate?: string;
}

export interface CreatePrincipalInput {
  workspaceId?: string;
  name: string;
  type: "person" | "team";
  email?: string;
  memberships?: Array<{ organizationId?: string; departmentId?: string; role?: "owner" | "organization_manager" | "department_manager" | "employee" }>;
}

export interface UpdateCanonicalProfileInput {
  workspaceId?: string;
  displayName: string;
  timezone: string;
  dateFormat: string;
  theme: UserProfileDTO["theme"];
}

export interface CreateOrganizationInput {
  workspaceId?: string;
  name: string;
  description?: string;
  /** Optional approved visual identity; unset uses the deterministic default. */
  colorKey?: OrganizationColorKey;
}

export interface CreateTaskInput {
  workspaceId?: string;
  title: string;
  description?: string;
  organizationId?: string;
  leadDepartmentId?: string;
  projectId?: string;
  involvedDepartmentIds?: string[];
  assignments?: AssignmentInput[];
  nextAction?: NextActionInput;
  priority?: TaskPriorityValue;
  startDate?: string;
  targetDate?: string;
  deadlineDate?: string;
  followUpDate?: string;
  estimatedMinutes?: number;
  dependencies?: DependencyInput[];
  checklistItems?: string[];
  parentTaskId?: string;
  sourceTaskId?: string;
  recurrence?: RecurrenceInput;
  originalCapture?: string;
  legacyLocalId?: string;
  /** Internal import path; public captures always use SMART_INBOX. */
  assignmentSource?: AssignmentSource;
}

export interface UpdateTaskInput {
  taskId: string;
  expectedVersion: number;
  title?: string;
  description?: string | null;
  organizationId?: string | null;
  leadDepartmentId?: string | null;
  projectId?: string | null;
  involvedDepartmentIds?: string[];
  nextAction?: NextActionInput;
  priority?: TaskPriorityValue;
  startDate?: string | null;
  targetDate?: string | null;
  deadlineDate?: string | null;
  followUpDate?: string | null;
  estimatedMinutes?: number | null;
}

export interface LegacyTaskImportInput extends CreateTaskInput {
  legacyLocalId: string;
  status?: TaskStatusValue;
}

export interface ProjectMemberInput {
  principalId: string;
  role: "owner" | "member" | "collaborator";
}

export interface ProjectMilestoneInput {
  title: string;
  targetDate?: string;
  ownerPrincipalId?: string;
}

export interface CreateProjectInput {
  workspaceId?: string;
  name: string;
  organizationId: string;
  description?: string;
  leadDepartmentId?: string;
  involvedDepartmentIds?: string[];
  members?: ProjectMemberInput[];
  targetDate?: string;
  milestones?: ProjectMilestoneInput[];
  focusItems?: string[];
  firstTask?: {
    title: string;
    leadDepartmentId?: string;
    assignments?: AssignmentInput[];
    targetDate?: string;
    deadlineDate?: string;
  };
}

export interface WorkflowTemplateTaskInput {
  title: string;
  description?: string;
  leadDepartmentId?: string;
  defaultAssigneeId?: string;
  priority?: TaskPriorityValue;
  startOffsetDays?: number;
  targetOffsetDays?: number;
  deadlineOffsetDays?: number;
  checklistItems?: string[];
  dependencies?: Array<{ prerequisiteTaskIndex: number; type: DependencyTypeValue; label: string }>;
}

export interface CreateWorkflowTemplateInput {
  workspaceId?: string;
  organizationId: string;
  name: string;
  description?: string;
  leadDepartmentId?: string;
  involvedDepartmentIds?: string[];
  tasks?: WorkflowTemplateTaskInput[];
  milestones?: Array<{ title: string; targetOffsetDays?: number; ownerPrincipalId?: string }>;
  focusItems?: string[];
}

/** Editing a template replaces its suggested blueprint, never any projects
 * that were previously created from it. */
export interface UpdateWorkflowTemplateInput extends CreateWorkflowTemplateInput {
  workspaceId?: string;
}

export interface ApplyWorkflowTemplateInput {
  workspaceId?: string;
  templateId: string;
  name: string;
  description?: string;
  targetDate?: string;
  startDate?: string;
}

function dateOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function recurrenceValidationMessage(recurrence?: RecurrenceInput) {
  if (!recurrence) return undefined;
  if (!Number.isInteger(recurrence.interval || 1) || (recurrence.interval || 1) < 1) return "The repeat interval must be at least one.";
  if (recurrence.frequency === "weekly" && !recurrence.weekDays?.length) return "Choose at least one weekday for a weekly repeat.";
  if ((recurrence.frequency === "monthly" || recurrence.frequency === "months") && (!Number.isInteger(recurrence.monthDay) || !recurrence.monthDay || recurrence.monthDay < 1 || recurrence.monthDay > 31)) return "Choose a valid day of the month.";
  const start = dateOnly(recurrence.startDate);
  const end = dateOnly(recurrence.endDate);
  if (end && start && end < start) return "The repeat end date must be on or after the start date.";
  return undefined;
}

function toDateString(value?: Date | null) {
  // These fields are PostgreSQL DATE values. Preserve their calendar day with
  // the same normalizer the browser planners use; never reinterpret them as a
  // user's local timestamp.
  return value ? calendarDateKey(value) : undefined;
}

function workspaceToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: workspaceTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function asTaskStatus(value: TaskStatus): TaskStatusValue {
  return value.toLowerCase() as TaskStatusValue;
}

function asTaskPriority(value: TaskPriority): TaskPriorityValue {
  return value.toLowerCase() as TaskPriorityValue;
}

function asDependencyType(value: DependencyType): DependencyTypeValue {
  return value.toLowerCase() as DependencyTypeValue;
}

function asNextActionKind(value: NextActionKind): NextActionKindValue {
  return value.toLowerCase() as NextActionKindValue;
}

function asRecurrenceFrequency(value: RecurrenceFrequency): NonNullable<TaskDTO["recurrence"]>["frequency"] {
  return value.toLowerCase() as NonNullable<TaskDTO["recurrence"]>["frequency"];
}

function assignmentRole(value: AssignmentRole): "primary_owner" | "collaborator" {
  return value === AssignmentRole.PRIMARY_OWNER ? "primary_owner" : "collaborator";
}

function assignmentSource(value: AssignmentSource): TaskAssignmentDTO["source"] {
  return value.toLowerCase() as TaskAssignmentDTO["source"];
}

function directoryRole(accessLevel: import("@/generated/prisma/client").AccessLevel | null | undefined): DirectoryDTO["memberships"][number]["role"] {
  if (accessLevel === "OWNER") return "owner";
  if (accessLevel === "ORGANIZATION_MANAGER") return "organization_manager";
  if (accessLevel === "DEPARTMENT_HEAD") return "department_manager";
  return "employee";
}

function toDirectoryDTO(principal: Prisma.PrincipalGetPayload<{ include: {
  organizationMemberships: { include: { organization: true } };
  departmentMemberships: { include: { department: true } };
  teamScopes: { include: { organization: true; department: true } };
  userAccount: true;
} }>, includeContactEmail = false): DirectoryDTO {
  const organizationMemberships = principal.type === PrincipalType.TEAM
    ? principal.teamScopes.map((scope) => ({ organizationId: scope.organizationId, organization: scope.organization, departmentId: scope.departmentId, department: scope.department, accessLevel: null }))
    : principal.organizationMemberships.map((membership) => ({
      organizationId: membership.organizationId,
      organization: membership.organization,
      departmentId: principal.departmentMemberships.find((department) => department.department.organizationId === membership.organizationId)?.departmentId,
      department: principal.departmentMemberships.find((department) => department.department.organizationId === membership.organizationId)?.department,
      accessLevel: membership.accessLevel,
    }));
  return {
    id: principal.id,
    name: principal.name,
    type: principal.type === PrincipalType.PERSON ? "person" : "team",
    active: principal.active && principal.status === "ACTIVE",
    accountStatus: principal.userAccount?.status || "PERSON_ONLY",
    // Contact email is deliberately not part of the shared directory payload
    // for non-Owners. Access workflows use it only on the server.
    email: includeContactEmail ? principal.email || undefined : undefined,
    memberships: organizationMemberships.map(membership => ({
      organizationId: membership.organizationId,
      organization: membership.organization.name,
      departmentId: membership.departmentId || undefined,
      department: membership.department?.name,
      role: directoryRole(membership.accessLevel),
    })),
  };
}

function persistedTaskListColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((column): column is string => typeof column === "string" && taskListColumnIds.has(column)))];
}

const taskListColumnIds = new Set<string>(TASK_LIST_COLUMN_IDS);

function toProfileDTO(actor: ActorRecord, preference?: { timezone: string; dateFormat: string; theme: string; taskListColumns?: unknown; storageVersion: number } | null, pendingAccessRequestCount = 0): UserProfileDTO {
  const preferredMembership = actor.organizationMemberships.find(membership => membership.accessLevel === "OWNER")
    || actor.organizationMemberships.find(membership => membership.accessLevel === "ORGANIZATION_MANAGER")
    || actor.organizationMemberships.find(membership => membership.accessLevel === "DEPARTMENT_HEAD")
    || actor.organizationMemberships.find(membership => membership.accessLevel);
  const theme = preference?.theme === "clear" || preference?.theme === "dark" ? preference.theme : "soft";
  return {
    principalId: actor.id,
    displayName: actor.name,
    username: actor.username || undefined,
    role: directoryRole(preferredMembership?.accessLevel),
    email: actor.email,
    timezone: preference?.timezone || "Asia/Jakarta",
    dateFormat: preference?.dateFormat || "12 Aug 2026",
    theme,
    storageVersion: preference?.storageVersion || 0,
    teamIds: actor.teamIds,
    taskListColumns: persistedTaskListColumns(preference?.taskListColumns),
    accountStatus: "ACTIVE",
    workspaces: actor.organizationMemberships
      .filter((membership) => membership.accessLevel)
      .map((membership) => ({ organizationId: membership.organizationId, organization: membership.organizationName, accessLevel: membership.accessLevel! })),
    pendingAccessRequestCount,
  };
}

function readableNextAction(task: TaskRecord, actorId: string) {
  // READY is a workflow status, not a person or party.  Keeping this label
  // human and responsibility-specific prevents UI such as “Next action by:
  // Ready” when no next actor has actually been recorded.
  if (task.nextActionKind === NextActionKind.READY) return "Not assigned";
  if (task.nextActionKind === NextActionKind.EXTERNAL) return task.nextActionExternalLabel || "External";
  if (task.nextActionKind === NextActionKind.DEPARTMENT) return task.nextActionDepartment?.name || "Department";
  if (task.nextActionPrincipal?.id === actorId) return "me";
  return task.nextActionPrincipal?.name || "Unassigned";
}

function toResourceDTO(resource: TaskRecord["resources"][number]) {
  return {
    id: resource.id,
    label: resource.label,
    url: resource.url || (resource.content ? `/api/resources/${resource.id}` : undefined),
    fileName: resource.fileName || undefined,
    mimeType: resource.mimeType || undefined,
    byteSize: resource.byteSize || undefined,
    kind: resource.content || resource.fileName ? "file" as const : "link" as const,
  };
}

function toOrganizationDTO(organization: {
  id: string;
  name: string;
  description: string | null;
  colorKey: string;
  aliases: string[];
  departments: Array<{ id: string; name: string; aliases: string[]; teamScopes: Array<{ team: { id: string; type: PrincipalType } }> }>;
  resources: TaskRecord["resources"];
}): OrganizationDTO {
  return {
    id: organization.id,
    name: organization.name,
    description: organization.description || undefined,
    colorKey: isOrganizationColorKey(organization.colorKey) ? organization.colorKey : defaultOrganizationColorKey(organization.name),
    aliases: organization.aliases,
    departments: organization.departments.map((department) => ({
      id: department.id,
      name: department.name,
      aliases: department.aliases,
      teamId: department.teamScopes.find(({ team }) => team.type === PrincipalType.TEAM)?.team.id,
    })),
    resources: organization.resources.map(toResourceDTO),
  };
}

export function toTaskDTO(task: TaskRecord, actorId: string): TaskDTO {
  const dependencies = task.dependencies.map((dependency) => ({
    id: dependency.id,
    type: asDependencyType(dependency.type),
    label: dependency.label,
    prerequisiteTaskId: dependency.prerequisiteTaskId || undefined,
    ownerPrincipalId: dependency.ownerPrincipalId || undefined,
    ownerDepartmentId: dependency.ownerDepartmentId || undefined,
    owner: dependency.ownerPrincipal?.name || dependency.ownerDepartment?.name || undefined,
    resolvedAt: dependency.resolvedAt?.toISOString(),
  }));
  const assignments: TaskAssignmentDTO[] = task.assignments.map((assignment) => ({
    id: assignment.id,
    principalId: assignment.principalId,
    name: assignment.principal.name,
    type: assignment.principal.type === PrincipalType.PERSON ? "person" : "team",
    role: assignmentRole(assignment.role),
    source: assignmentSource(assignment.source),
    assignedAt: assignment.assignedAt.toISOString(),
    assignedByPrincipalId: assignment.assignedByPrincipalId || undefined,
    assignedBy: assignment.assignedBy?.name || undefined,
    claimedFromAssignmentId: assignment.claimedFromAssignmentId || undefined,
  }));
  const primaryOwner = assignments.find((assignment) => assignment.role === "primary_owner");
  const deadlineDate = toDateString(task.deadline);
  const followUpDate = toDateString(task.followUpDate);
  const today = workspaceToday();
  const isOpen = task.status !== TaskStatus.DONE && !task.archivedAt && !task.deletedAt;
  const startBlockedBy = dependencies.filter((dependency) => dependency.type === "start_blocker" && !dependency.resolvedAt);
  const completionBlockedBy = dependencies.filter((dependency) => dependency.type === "completion_blocker" && !dependency.resolvedAt);
  const latestReview = task.reviewCycles[0];
  const visibleSubtasks = task.subtasks.filter(subtask => !subtask.archivedAt && !subtask.deletedAt);

  return {
    id: task.id,
    version: task.version,
    title: task.title,
    description: task.description || undefined,
    workspaceId: task.workspaceId,
    organizationId: task.organizationId || undefined,
    org: task.organization?.name || "Uncategorized",
    leadDepartmentId: task.leadDepartmentId || undefined,
    area: task.leadDepartment?.name || "Unassigned",
    involvedDepartments: task.involvedDepartments.map(({ department }) => ({ id: department.id, name: department.name })),
    involvedAreas: task.involvedDepartments.map(({ department }) => department.name),
    projectId: task.projectId || undefined,
    project: task.project?.name || undefined,
    priority: asTaskPriority(task.priority),
    status: asTaskStatus(task.status),
    assignments,
    assigneeIds: assignments.map((assignment) => assignment.principalId),
    assignee: primaryOwner?.name || assignments[0]?.name,
    primaryOwner,
    createdByPrincipalId: task.createdByPrincipalId || undefined,
    nextActionKind: asNextActionKind(task.nextActionKind),
    nextActionBy: readableNextAction(task, actorId),
    nextActionPrincipalId: task.nextActionPrincipalId || undefined,
    nextActionDepartmentId: task.nextActionDepartmentId || undefined,
    nextActionExternalLabel: task.nextActionExternalLabel || undefined,
    startDate: toDateString(task.startDate),
    targetDate: toDateString(task.targetDate),
    deadlineDate,
    followUpDate,
    estimatedMinutes: task.estimatedMinutes ?? undefined,
    actualMinutes: task.actualMinutes ?? undefined,
    waitingSince: task.waitingSince?.toISOString(),
    completedAt: task.completedAt?.toISOString(),
    isOverdue: Boolean(isOpen && deadlineDate && deadlineDate < today),
    isFollowUpDue: Boolean(isOpen && followUpDate && followUpDate <= today),
    canStartNow: startBlockedBy.length === 0,
    completionBlockedBy,
    startBlockedBy,
    relatedWork: dependencies.filter((dependency) => dependency.type === "related"),
    updates: task.updates.map((update) => ({
      id: update.id,
      authorId: update.authorId,
      author: update.author.name,
      text: update.text,
      createdAt: update.createdAt.toISOString(),
      resources: update.resources.map((resource) => toResourceDTO(resource as TaskRecord["resources"][number])),
    })),
    resources: task.resources.map(toResourceDTO),
    activity: task.events.map((event) => ({
      id: event.id,
      type: event.type.toLowerCase(),
      actor: event.actor?.name || undefined,
      summary: event.summary,
      createdAt: event.createdAt.toISOString(),
    })),
    checklistItems: task.checklistItems.map(item => ({
      id: item.id,
      title: item.title,
      position: item.position,
      completedAt: item.completedAt?.toISOString(),
      completedBy: item.completedBy?.name || undefined,
    })),
    subtaskProgress: {
      total: visibleSubtasks.length,
      completed: visibleSubtasks.filter(subtask => subtask.status === TaskStatus.DONE).length,
    },
    parentTaskId: task.parentTaskId || undefined,
    sourceTaskId: task.sourceTaskId || undefined,
    mergedIntoTaskId: task.mergedIntoTaskId || undefined,
    recurrence: task.recurrence ? {
      id: task.recurrence.id,
      frequency: asRecurrenceFrequency(task.recurrence.frequency),
      interval: task.recurrence.interval,
      weekDays: task.recurrence.weekDays,
      monthDay: task.recurrence.monthDay || undefined,
      startDate: toDateString(task.recurrence.startDate)!,
      endDate: toDateString(task.recurrence.endDate),
      nextOccurrenceDate: toDateString(task.recurrence.nextOccurrenceDate),
      active: task.recurrence.active,
    } : undefined,
    review: latestReview ? {
      id: latestReview.id,
      submittedById: latestReview.submittedByPrincipalId,
      submittedBy: latestReview.submittedBy.name,
      submittedAt: latestReview.submittedAt.toISOString(),
      reviewerId: latestReview.reviewerPrincipalId || undefined,
      reviewer: latestReview.reviewer?.name || undefined,
      reviewedById: latestReview.reviewedByPrincipalId || undefined,
      reviewedBy: latestReview.reviewedBy?.name || undefined,
      reviewedAt: latestReview.reviewedAt?.toISOString(),
      decision: latestReview.decision === ReviewDecision.APPROVED ? "approved" : latestReview.decision === ReviewDecision.REVISION_REQUESTED ? "revision_requested" : undefined,
      revisionNote: latestReview.revisionNote || undefined,
    } : undefined,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    archivedAt: task.archivedAt?.toISOString(),
    originalCapture: task.captureLinks[0]?.capture.rawText,
  };
}

function projectMemberRole(value: ProjectMemberRole): ProjectDTO["members"][number]["role"] {
  return value.toLowerCase() as ProjectDTO["members"][number]["role"];
}

function projectStatus(value: ProjectStatus): ProjectDTO["status"] {
  return value.toLowerCase() as ProjectDTO["status"];
}

function toProjectDTO(project: ProjectRecord): ProjectDTO {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    organizationId: project.organizationId,
    organization: project.organization.name,
    name: project.name,
    description: project.description || undefined,
    leadDepartmentId: project.leadDepartmentId || undefined,
    leadArea: project.leadDepartment?.name || undefined,
    involvedDepartments: project.involvedDepartments.map(({ department }) => ({ id: department.id, name: department.name })),
    members: project.members.map(member => ({
      principalId: member.principalId,
      name: member.principal.name,
      type: member.principal.type === PrincipalType.PERSON ? "person" : "team",
      role: projectMemberRole(member.role),
    })),
    targetDate: toDateString(project.targetDate),
    status: projectStatus(project.status),
    milestones: project.milestones.map(milestone => ({
      id: milestone.id,
      title: milestone.title,
      targetDate: toDateString(milestone.targetDate),
      status: milestone.status === MilestoneStatus.DONE ? "done" : "planned",
      ownerPrincipalId: milestone.ownerPrincipalId || undefined,
      owner: milestone.owner?.name || undefined,
    })),
    focusItems: project.focusItems.map(item => ({ id: item.id, text: item.text, position: item.position })),
    resources: project.resources.map(resource => ({
      id: resource.id,
      label: resource.label,
      url: resource.url || (resource.content ? `/api/resources/${resource.id}` : undefined),
      fileName: resource.fileName || undefined,
      mimeType: resource.mimeType || undefined,
      byteSize: resource.byteSize || undefined,
      kind: resource.content || resource.fileName ? "file" as const : "link" as const,
    })),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function toWorkflowTemplateDTO(template: WorkflowTemplateRecord): WorkflowTemplateDTO {
  return {
    id: template.id,
    workspaceId: template.workspaceId,
    organizationId: template.organizationId,
    organization: template.organization.name,
    name: template.name,
    description: template.description || undefined,
    leadDepartmentId: template.leadDepartmentId || undefined,
    leadArea: template.leadDepartment?.name || undefined,
    involvedDepartments: template.involvedDepartments.map(({ department }) => ({ id: department.id, name: department.name })),
    tasks: template.tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description || undefined,
      leadDepartmentId: task.leadDepartmentId || undefined,
      area: task.leadDepartment?.name || undefined,
      defaultAssigneeId: task.defaultAssigneeId || undefined,
      defaultAssignee: task.defaultAssignee?.name || undefined,
      priority: asTaskPriority(task.priority),
      startOffsetDays: task.startOffsetDays ?? undefined,
      targetOffsetDays: task.targetOffsetDays ?? undefined,
      deadlineOffsetDays: task.deadlineOffsetDays ?? undefined,
      position: task.position,
      checklistItems: task.checklistItems.map(item => item.title),
      dependencies: task.dependencies.map(dependency => ({
        prerequisiteTemplateTaskId: dependency.prerequisiteTemplateTaskId,
        type: asDependencyType(dependency.type),
        label: dependency.label,
      })),
    })),
    milestones: template.milestones.map(milestone => ({
      id: milestone.id,
      title: milestone.title,
      targetOffsetDays: milestone.targetOffsetDays ?? undefined,
      ownerPrincipalId: milestone.ownerPrincipalId || undefined,
      owner: milestone.owner?.name || undefined,
      position: milestone.position,
    })),
    focusItems: template.focusItems.map(item => ({ id: item.id, text: item.text, position: item.position })),
    status: template.status === WorkflowTemplateStatus.ARCHIVED ? "archived" : "active",
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

async function resolveActor(workspaceId: string): Promise<ActorRecord> {
  const context = await requireCurrentUser(workspaceId);
  return {
    id: context.personId,
    workspaceId: context.workspaceId,
    name: context.displayName,
    username: context.username,
    email: context.contactEmail || "",
    context,
    organizationMemberships: context.organizationMemberships,
    departmentMemberships: context.departmentMemberships,
    teamIds: context.teamIds,
  };
}

function actorIsOwner(actor: ActorRecord) {
  return isWorkspaceOwner(actor.context, actor.workspaceId);
}

function actorManagesOrganization(actor: ActorRecord, organizationId?: string | null) {
  return Boolean(organizationId && canManageOrganization(actor.context, actor.workspaceId, organizationId));
}

function actorManagesDepartment(actor: ActorRecord, departmentId?: string | null) {
  const membership = departmentId ? actor.departmentMemberships.find((candidate) => candidate.departmentId === departmentId) : undefined;
  return Boolean(membership && canManageDepartment(actor.context, actor.workspaceId, membership.organizationId, membership.departmentId));
}

function actorDepartmentHeadIds(actor: ActorRecord) {
  const departmentHeadOrganizationIds = new Set(actor.organizationMemberships
    .filter((membership) => membership.accessLevel === "DEPARTMENT_HEAD")
    .map((membership) => membership.organizationId));
  return new Set(actor.departmentMemberships
    .filter((membership) => departmentHeadOrganizationIds.has(membership.organizationId))
    .map((membership) => membership.departmentId));
}

function canViewTask(actor: ActorRecord, task: TaskRecord) {
  if (actorIsOwner(actor) || actorManagesOrganization(actor, task.organizationId)) return true;
  if (task.organizationId && isViewer(actor.context, task.organizationId)) {
    return task.assignments.some((assignment) => assignment.principalId === actor.id || actor.teamIds.includes(assignment.principalId));
  }
  if (task.assignments.some((assignment) => assignment.principalId === actor.id || actor.teamIds.includes(assignment.principalId))) return true;
  if (task.createdByPrincipalId === actor.id || task.reviewCycles.some((review) => review.reviewerPrincipalId === actor.id)) return true;
  const memberDepartmentIds = actorDepartmentHeadIds(actor);
  return Boolean(
    (task.leadDepartmentId && memberDepartmentIds.has(task.leadDepartmentId)) ||
    task.involvedDepartments.some(({ departmentId }) => memberDepartmentIds.has(departmentId)) ||
    task.assignments.some(({ principal }) => principal.type === PrincipalType.TEAM && principal.teamScopes.some((membership) => membership.departmentId && memberDepartmentIds.has(membership.departmentId))),
  );
}

function canManageTask(actor: ActorRecord, task: TaskRecord) {
  if (task.organizationId && isViewer(actor.context, task.organizationId)) return false;
  if (actorIsOwner(actor) || actorManagesOrganization(actor, task.organizationId) || actorManagesDepartment(actor, task.leadDepartmentId)) return true;
  return task.assignments.some((assignment) => assignment.principalId === actor.id && assignment.role === AssignmentRole.PRIMARY_OWNER);
}

function canViewProject(actor: ActorRecord, project: ProjectRecord) {
  if (actorIsOwner(actor) || actorManagesOrganization(actor, project.organizationId)) return true;
  if (project.members.some(member => member.principalId === actor.id || actor.teamIds.includes(member.principalId))) return true;
  if (isViewer(actor.context, project.organizationId)) return false;
  const memberDepartmentIds = actorDepartmentHeadIds(actor);
  return Boolean(
    (project.leadDepartmentId && memberDepartmentIds.has(project.leadDepartmentId))
    || project.involvedDepartments.some(({ departmentId }) => memberDepartmentIds.has(departmentId)),
  );
}

function canManageProject(actor: ActorRecord, project: ProjectRecord) {
  if (isViewer(actor.context, project.organizationId)) return false;
  return actorIsOwner(actor)
    || actorManagesOrganization(actor, project.organizationId)
    || actorManagesDepartment(actor, project.leadDepartmentId)
    || project.members.some(member => member.principalId === actor.id && member.role === ProjectMemberRole.OWNER);
}

function managedOrganizationIds(actor: ActorRecord) {
  return actor.organizationMemberships
    .filter((membership) => membership.accessLevel === "ORGANIZATION_MANAGER")
    .map((membership) => membership.organizationId);
}

function taskVisibilityWhere(actor: ActorRecord, workspaceId: string): Prisma.TaskWhereInput {
  if (actorIsOwner(actor)) return { workspaceId, deletedAt: null };
  const managedOrganizations = managedOrganizationIds(actor);
  const departmentIds = [...actorDepartmentHeadIds(actor)];
  const visiblePrincipalIds = [actor.id, ...actor.teamIds];
  const branches: Prisma.TaskWhereInput[] = [
    { assignments: { some: { principalId: { in: visiblePrincipalIds } } } },
    { createdByPrincipalId: actor.id },
    { reviewCycles: { some: { reviewerPrincipalId: actor.id } } },
  ];
  if (managedOrganizations.length) branches.push({ organizationId: { in: managedOrganizations } });
  if (departmentIds.length) branches.push(
    { leadDepartmentId: { in: departmentIds } },
    { involvedDepartments: { some: { departmentId: { in: departmentIds } } } },
  );
  return { workspaceId, deletedAt: null, OR: branches };
}

function canBrowseTaskPeople(actor: ActorRecord) {
  return actorIsOwner(actor) || managedOrganizationIds(actor).length > 0 || actorDepartmentHeadIds(actor).size > 0;
}

/**
 * Responsibility is not visibility. This database predicate mirrors the
 * client-safe personal-work helper and intentionally does not use a person's
 * Team memberships. Team queues are browsed through the explicit Team scope.
 */
function personallyActionableTaskWhere(personId: string): Prisma.TaskWhereInput {
  return {
    OR: [
      { assignments: { some: { principalId: personId } } },
      { nextActionPrincipalId: personId },
      {
        status: TaskStatus.REVIEW,
        reviewCycles: { some: { reviewerPrincipalId: personId, reviewedAt: null } },
      },
      {
        dependencies: {
          some: {
            ownerPrincipalId: personId,
            resolvedAt: null,
            type: { in: [DependencyType.START_BLOCKER, DependencyType.COMPLETION_BLOCKER] },
          },
        },
      },
      // Captures without any assignment remain with their creator until work
      // is assigned or explicitly moved to another person's next action.
      {
        AND: [
          { createdByPrincipalId: personId },
          { assignments: { none: {} } },
          { OR: [{ nextActionPrincipalId: null }, { nextActionPrincipalId: personId }] },
          {
            OR: [
              { status: { not: TaskStatus.REVIEW } },
              { reviewCycles: { some: { reviewerPrincipalId: personId, reviewedAt: null } } },
            ],
          },
        ],
      },
    ],
  };
}

/** A Team is selected by its stable Principal ID, never by display text. */
function teamTaskWhere(teamId: string): Prisma.TaskWhereInput {
  const departmentTeamScope = { some: { teamId, status: MembershipStatus.ACTIVE } };
  return {
    OR: [
      { assignments: { some: { principalId: teamId } } },
      { nextActionPrincipalId: teamId },
      { dependencies: { some: { ownerPrincipalId: teamId, resolvedAt: null } } },
      { leadDepartment: { teamScopes: departmentTeamScope } },
      { involvedDepartments: { some: { department: { teamScopes: departmentTeamScope } } } },
    ],
  };
}

async function taskScopeOptions(actor: ActorRecord): Promise<{ people: TaskScopeOptionDTO[]; teams: TaskScopeOptionDTO[] }> {
  const db = getDb();
  const departmentIds = [...actorDepartmentHeadIds(actor)];
  const organizationIds = managedOrganizationIds(actor);
  const canBrowsePeople = canBrowseTaskPeople(actor);
  const peopleWhere: Prisma.PrincipalWhereInput = actorIsOwner(actor)
    ? { workspaceId: actor.workspaceId, type: PrincipalType.PERSON, active: true, status: PrincipalStatus.ACTIVE }
    : {
      workspaceId: actor.workspaceId,
      type: PrincipalType.PERSON,
      active: true,
      status: PrincipalStatus.ACTIVE,
      OR: [
        ...(organizationIds.length ? [{ organizationMemberships: { some: { status: MembershipStatus.ACTIVE, organizationId: { in: organizationIds } } } }] : []),
        ...(departmentIds.length ? [{ departmentMemberships: { some: { status: MembershipStatus.ACTIVE, departmentId: { in: departmentIds } } } }] : []),
      ],
    };
  const teamWhere: Prisma.PrincipalWhereInput = {
    workspaceId: actor.workspaceId,
    type: PrincipalType.TEAM,
    active: true,
    status: PrincipalStatus.ACTIVE,
    OR: [
      ...(actor.teamIds.length ? [{ id: { in: actor.teamIds } }] : []),
      ...(actorIsOwner(actor) ? [{ teamScopes: { some: { status: MembershipStatus.ACTIVE } } }] : []),
      ...(organizationIds.length ? [{ teamScopes: { some: { status: MembershipStatus.ACTIVE, organizationId: { in: organizationIds } } } }] : []),
      ...(departmentIds.length ? [{ teamScopes: { some: { status: MembershipStatus.ACTIVE, departmentId: { in: departmentIds } } } }] : []),
    ],
  };
  const [people, teams] = await Promise.all([
    canBrowsePeople
      ? db.principal.findMany({
        where: peopleWhere,
        select: {
          id: true,
          name: true,
          departmentMemberships: { where: { status: MembershipStatus.ACTIVE }, select: { department: { select: { name: true, organization: { select: { name: true } } } } }, take: 1 },
        },
        orderBy: { name: "asc" },
      })
      : Promise.resolve([]),
    db.principal.findMany({
      where: teamWhere,
      select: {
        id: true,
        name: true,
        teamScopes: { where: { status: MembershipStatus.ACTIVE }, select: { department: { select: { name: true } }, organization: { select: { name: true } } }, take: 1 },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    people: people.map((person) => ({
      id: person.id,
      name: person.name,
      subtitle: person.departmentMemberships[0] ? `${person.departmentMemberships[0].department.organization.name} · ${person.departmentMemberships[0].department.name}` : undefined,
    })),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      kind: "team" as const,
      subtitle: team.teamScopes[0] ? `${team.teamScopes[0].organization.name}${team.teamScopes[0].department ? ` · ${team.teamScopes[0].department.name}` : ""}` : undefined,
    })),
  };
}

/**
 * Fetches one permission-checked task page scope. The client never receives a
 * broad directory or an unscoped task list and then hides rows in React.
 */
export async function getCanonicalTaskScope(input: {
  workspaceId?: string;
  scope: TaskWorkspaceScope;
  personId?: string;
  teamId?: string;
}): Promise<ActionResult<TaskScopeResultDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  try {
    const db = getDb();
    const actor = await resolveActor(workspaceId);
    const options = await taskScopeOptions(actor);
    const allowedScopes: TaskWorkspaceScope[] = ["my"];
    if (options.teams.length) allowedScopes.push("team");
    if (canBrowseTaskPeople(actor)) allowedScopes.push("people");
    if (!allowedScopes.includes(input.scope)) return forbidden("You do not have permission to view that task scope.");

    let targetPersonId: string | undefined;
    let targetTeamId: string | undefined;
    if (input.scope === "people") {
      // Opening People should remain one click. If no selector value has been
      // established yet, safely use the first server-authorized directory row;
      // the response still contains only that scoped task set and never a
      // broad directory for the browser to filter.
      targetPersonId = input.personId || options.people[0]?.id;
      if (!targetPersonId || !options.people.some((person) => person.id === targetPersonId)) return forbidden("You do not have permission to view that person's work.");
    }
    if (input.scope === "team") {
      const selectedScope = options.teams.find((team) => team.id === (input.teamId || options.teams[0]?.id));
      if (!selectedScope) return forbidden("You do not have permission to view that team's work.");
      targetTeamId = selectedScope.id;
    }

    const scopeWhere = input.scope === "my"
      ? personallyActionableTaskWhere(actor.id)
      : targetPersonId
        ? personallyActionableTaskWhere(targetPersonId)
        : targetTeamId
          ? teamTaskWhere(targetTeamId)
          : {};

    const records = await db.task.findMany({
      where: { AND: [taskVisibilityWhere(actor, workspaceId), scopeWhere] },
      include: taskInclude,
      orderBy: { updatedAt: "desc" },
    });
    const visible = records.filter((task) => !task.archivedAt && canViewTask(actor, task));
    return {
      ok: true,
      data: {
        scope: input.scope,
        tasks: visible.map((task) => toTaskDTO(task, actor.id)),
        people: options.people,
        teams: options.teams,
        allowedScopes,
      },
    };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { ok: false, code: "UNAUTHORIZED", message: "Sign in to view tasks." };
    if (error instanceof AuthorizationError) return forbidden("You do not have permission to view that task scope.");
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Could not load tasks." };
  }
}

function projectVisibilityWhere(actor: ActorRecord, workspaceId: string): Prisma.ProjectWhereInput {
  if (actorIsOwner(actor)) return { workspaceId, status: { not: ProjectStatus.ARCHIVED } };
  const managedOrganizations = managedOrganizationIds(actor);
  const departmentIds = [...actorDepartmentHeadIds(actor)];
  const visiblePrincipalIds = [actor.id, ...actor.teamIds];
  const branches: Prisma.ProjectWhereInput[] = [
    { members: { some: { principalId: { in: visiblePrincipalIds } } } },
    { createdByPrincipalId: actor.id },
    // A person who can read a task must also receive that task's project
    // context. This stays in the database query rather than being inferred
    // after a broad project read.
    { tasks: { some: { assignments: { some: { principalId: { in: visiblePrincipalIds } } } } } },
    { tasks: { some: { createdByPrincipalId: actor.id } } },
    { tasks: { some: { reviewCycles: { some: { reviewerPrincipalId: actor.id } } } } },
  ];
  if (managedOrganizations.length) branches.push({ organizationId: { in: managedOrganizations } });
  if (departmentIds.length) branches.push(
    { leadDepartmentId: { in: departmentIds } },
    { involvedDepartments: { some: { departmentId: { in: departmentIds } } } },
  );
  return { workspaceId, status: { not: ProjectStatus.ARCHIVED }, OR: branches };
}

function forbidden<T>(message = "You do not have permission to change this task."): ActionResult<T> {
  return { ok: false, code: "FORBIDDEN", message };
}

function configuration<T>(): ActionResult<T> {
  return { ok: false, code: "CONFIGURATION", message: "Binnie needs DATABASE_URL before shared work can be saved." };
}

function asDbStatus(status: TaskStatusValue) {
  return status.toUpperCase() as TaskStatus;
}

function asDbPriority(priority: TaskPriorityValue) {
  return priority.toUpperCase() as TaskPriority;
}

function asDbDependencyType(type: DependencyTypeValue) {
  return type.toUpperCase() as DependencyType;
}

function asDbRecurrenceFrequency(frequency: RecurrenceInput["frequency"]) {
  return frequency.toUpperCase() as RecurrenceFrequency;
}

function nextActionData(input?: NextActionInput) {
  if (!input) return {};
  if (input.kind === "principal") return { nextActionKind: NextActionKind.PRINCIPAL, nextActionPrincipalId: input.principalId || null, nextActionDepartmentId: null, nextActionExternalLabel: null };
  if (input.kind === "department") return { nextActionKind: NextActionKind.DEPARTMENT, nextActionPrincipalId: null, nextActionDepartmentId: input.departmentId || null, nextActionExternalLabel: null };
  if (input.kind === "external") return { nextActionKind: NextActionKind.EXTERNAL, nextActionPrincipalId: null, nextActionDepartmentId: null, nextActionExternalLabel: input.externalLabel?.trim() || "External" };
  return { nextActionKind: NextActionKind.READY, nextActionPrincipalId: null, nextActionDepartmentId: null, nextActionExternalLabel: null };
}

/**
 * Foreign keys alone cannot express Binnie's workspace boundaries (for example,
 * a department belongs to an organization which belongs to a workspace). Keep
 * those checks at the data boundary so a client can never attach unrelated work
 * simply by guessing an ID.
 */
async function validateTaskReferences(
  db: ReturnType<typeof getDb>,
  input: {
    workspaceId: string;
    organizationId?: string | null;
    projectId?: string | null;
    departmentIds?: string[];
    principalIds?: string[];
    nextAction?: NextActionInput;
    dependencies?: DependencyInput[];
    taskId?: string;
  },
) {
  const departmentIds = [...new Set(input.departmentIds || [])];
  const principalIds = [...new Set([
    ...(input.principalIds || []),
    ...(input.nextAction?.kind === "principal" && input.nextAction.principalId ? [input.nextAction.principalId] : []),
    ...(input.dependencies || []).flatMap(dependency => dependency.ownerPrincipalId ? [dependency.ownerPrincipalId] : []),
  ])];
  const dependencyDepartmentIds = (input.dependencies || []).flatMap(dependency => dependency.ownerDepartmentId ? [dependency.ownerDepartmentId] : []);
  const allDepartmentIds = [...new Set([...departmentIds, ...dependencyDepartmentIds, ...(input.nextAction?.kind === "department" && input.nextAction.departmentId ? [input.nextAction.departmentId] : [])])];
  const [organization, project, departments, principals, prerequisites] = await Promise.all([
    input.organizationId ? db.organization.findFirst({ where: { id: input.organizationId, workspaceId: input.workspaceId } }) : Promise.resolve(undefined),
    input.projectId ? db.project.findFirst({ where: { id: input.projectId, organization: { workspaceId: input.workspaceId } } }) : Promise.resolve(undefined),
    allDepartmentIds.length ? db.department.findMany({ where: { id: { in: allDepartmentIds }, organization: { workspaceId: input.workspaceId } }, select: { id: true, organizationId: true } }) : Promise.resolve([]),
    principalIds.length ? db.principal.findMany({ where: { id: { in: principalIds }, workspaceId: input.workspaceId, active: true }, select: { id: true } }) : Promise.resolve([]),
    (input.dependencies || []).some(dependency => dependency.prerequisiteTaskId) ? db.task.findMany({ where: { id: { in: (input.dependencies || []).flatMap(dependency => dependency.prerequisiteTaskId ? [dependency.prerequisiteTaskId] : []) }, workspaceId: input.workspaceId, deletedAt: null }, select: { id: true } }) : Promise.resolve([]),
  ]);
  if (input.organizationId && !organization) return "Choose an organization in this workspace.";
  if (input.projectId && !project) return "Choose a project in this workspace.";
  if (project && input.organizationId && project.organizationId !== input.organizationId) return "The project belongs to a different organization.";
  if (departments.length !== allDepartmentIds.length) return "Choose departments in this workspace.";
  if (input.organizationId && departments.some(department => department.organizationId !== input.organizationId)) return "Every involved department must belong to the selected organization.";
  if (principals.length !== principalIds.length) return "Choose active people or teams in this workspace.";
  if (prerequisites.length !== (input.dependencies || []).filter(dependency => dependency.prerequisiteTaskId).length) return "A dependency must be an active task in this workspace.";
  if (input.taskId && (input.dependencies || []).some(dependency => dependency.prerequisiteTaskId === input.taskId)) return "A task cannot depend on itself.";
  return undefined;
}

async function defaultTeamAssignmentForDepartments(db: ReturnType<typeof getDb>, workspaceId: string, departmentIds: string[], assignments: AssignmentInput[]) {
  if (assignments.length || !departmentIds.length) return assignments;
  const memberships = await db.teamScope.findMany({
    where: { departmentId: { in: departmentIds }, status: MembershipStatus.ACTIVE, team: { workspaceId, active: true, type: PrincipalType.TEAM } },
    orderBy: { id: "asc" },
    select: { teamId: true, departmentId: true },
  });
  const leadTeam = memberships.find(membership => membership.departmentId === departmentIds[0]);
  const teams = Array.from(new Set(memberships.map(membership => membership.teamId)));
  return teams.map(principalId => ({ principalId, role: principalId === leadTeam?.teamId ? "primary_owner" as const : "collaborator" as const }));
}

async function taskById(taskId: string) {
  return getDb().task.findUnique({ where: { id: taskId }, include: taskInclude });
}

async function projectById(projectId: string) {
  return getDb().project.findUnique({ where: { id: projectId }, include: projectInclude });
}

async function workflowTemplateById(templateId: string) {
  return getDb().workflowTemplate.findUnique({ where: { id: templateId }, include: workflowTemplateInclude });
}

async function taskDtoById(taskId: string, actorId: string) {
  const task = await taskById(taskId);
  return task ? toTaskDTO(task, actorId) : undefined;
}

async function incrementRevision(tx: Prisma.TransactionClient, workspaceId: string) {
  return tx.workspace.update({ where: { id: workspaceId }, data: { revision: { increment: 1 } }, select: { revision: true } });
}

async function addEvent(tx: Prisma.TransactionClient, taskId: string, actorId: string, type: TaskEventType, summary: string, before?: Prisma.InputJsonValue, after?: Prisma.InputJsonValue) {
  await tx.taskEvent.create({ data: { taskId, actorId, type, summary, before, after } });
}

function taskEventForStatus(status: TaskStatus) {
  if (status === TaskStatus.WAITING) return TaskEventType.WAITING_MARKED;
  if (status === TaskStatus.BLOCKED) return TaskEventType.BLOCKED_MARKED;
  if (status === TaskStatus.DONE) return TaskEventType.COMPLETED;
  return TaskEventType.STATUS_CHANGED;
}

function statusLabel(status: TaskStatus) {
  return status.toLowerCase().replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function shiftDateByDays(value: Date | null, days: number) {
  return value ? addUtcDays(value, days) : null;
}

/** Keep every route to Done consistent: unblock downstream work and schedule one future recurring occurrence. */
async function applyCompletionEffects(tx: Prisma.TransactionClient, task: TaskRecord, actorId: string) {
  await tx.taskDependency.updateMany({ where: { prerequisiteTaskId: task.id, resolvedAt: null }, data: { resolvedAt: new Date() } });
  if (!task.recurrence?.active) return;
  const occurrenceDate = task.startDate || task.targetDate || task.deadline || new Date();
  const nextDate = nextOccurrenceDate(occurrenceDate, {
    frequency: asRecurrenceFrequency(task.recurrence.frequency),
    interval: task.recurrence.interval,
    weekDays: task.recurrence.weekDays,
    monthDay: task.recurrence.monthDay,
  });
  if (task.recurrence.endDate && nextDate > task.recurrence.endDate) {
    await tx.taskRecurrence.update({ where: { id: task.recurrence.id }, data: { active: false, nextOccurrenceDate: null } });
    return;
  }
  const shiftDays = Math.round((nextDate.getTime() - occurrenceDate.getTime()) / 86_400_000);
  const nextStartDate = shiftDateByDays(task.startDate, shiftDays) || nextDate;
  // Reopening a completed occurrence must not create a second copy of the next
  // one. The occurrence schedule is the source of truth, not the UI action.
  const existingNext = await tx.task.findFirst({ where: { recurrenceId: task.recurrenceId!, startDate: nextStartDate, deletedAt: null } });
  if (!existingNext) await tx.task.create({
    data: {
      workspaceId: task.workspaceId,
      organizationId: task.organizationId,
      leadDepartmentId: task.leadDepartmentId,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      sourceTaskId: task.sourceTaskId,
      recurrenceId: task.recurrenceId,
      createdByPrincipalId: actorId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: TaskStatus.READY,
      startDate: nextStartDate,
      targetDate: shiftDateByDays(task.targetDate, shiftDays),
      deadline: shiftDateByDays(task.deadline, shiftDays),
      followUpDate: shiftDateByDays(task.followUpDate, shiftDays),
      ...nextActionData({ kind: "ready" }),
      involvedDepartments: { create: task.involvedDepartments.map(item => ({ departmentId: item.departmentId })) },
      assignments: { create: task.assignments.map(assignment => ({ principalId: assignment.principalId, role: assignment.role, source: AssignmentSource.MANUAL, assignedByPrincipalId: actorId })) },
      checklistItems: { create: task.checklistItems.map(item => ({ title: item.title, position: item.position })) },
      events: { create: { actorId, type: TaskEventType.CREATED, summary: "Created next recurring occurrence" } },
    },
  });
  await tx.taskRecurrence.update({ where: { id: task.recurrence.id }, data: { nextOccurrenceDate: nextOccurrenceDate(nextDate, {
    frequency: asRecurrenceFrequency(task.recurrence.frequency),
    interval: task.recurrence.interval,
    weekDays: task.recurrence.weekDays,
    monthDay: task.recurrence.monthDay,
  }) } });
}

function normalizedTitle(value: string) {
  return value.toLocaleLowerCase().replace(/https?:\/\/\S+/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 2);
}

export function findDuplicateCandidates(title: string, tasks: TaskDTO[]) {
  const source = new Set(normalizedTitle(title));
  return tasks
    .filter((task) => task.status !== "done" && !task.archivedAt)
    .map((task) => {
      const candidate = new Set(normalizedTitle(task.title));
      const shared = [...source].filter((token) => candidate.has(token)).length;
      const score = source.size ? shared / source.size : 0;
      return { task, score };
    })
    .filter(({ score }) => score >= 0.6)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function normalizedImportTitle(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function legacyImportDuplicateKey(task: Pick<LegacyTaskImportInput, "title" | "organizationId" | "projectId" | "startDate" | "targetDate" | "deadlineDate" | "assignments">) {
  const effectiveDate = task.startDate || task.targetDate || task.deadlineDate || "";
  const assignees = (task.assignments || []).map(assignment => assignment.principalId).sort().join(",");
  return [normalizedImportTitle(task.title), task.organizationId || "", effectiveDate, task.projectId || "", assignees].join("|");
}

export async function getWorkspaceSnapshot(workspaceId = DEFAULT_WORKSPACE_ID): Promise<WorkspaceSnapshotDTO | null> {
  if (!hasDatabaseConfiguration()) return null;
  try {
    const db = getDb();
    const [workspace, actor] = await Promise.all([
      db.workspace.findUnique({ where: { id: workspaceId } }),
      resolveActor(workspaceId),
    ]);
    if (!workspace) return null;
    const [records, projects, savedViews, nudgeStates, inboxCaptures, preference, pendingAccessRequestCount] = await Promise.all([
      db.task.findMany({ where: taskVisibilityWhere(actor, workspaceId), include: taskInclude, orderBy: { updatedAt: "desc" } }),
      db.project.findMany({ where: projectVisibilityWhere(actor, workspaceId), include: projectInclude, orderBy: { updatedAt: "desc" } }),
      db.savedView.findMany({ where: { workspaceId, OR: [{ ownerId: null }, { ownerId: actor.id }] }, orderBy: { updatedAt: "desc" } }),
      db.workNudge.findMany({ where: { workspaceId, recipientId: actor.id }, select: { dedupKey: true, disposition: true, taskId: true, snoozedUntil: true } }),
      db.inboxCapture.findMany({
        where: { workspaceId, actorId: actor.id, status: { in: [CaptureStatus.NEEDS_ORGANIZATION, CaptureStatus.REVIEWING] } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.principalPreference.findUnique({ where: { principalId: actor.id } }),
      actorIsOwner(actor)
        ? db.invitation.count({ where: { organization: { workspaceId }, status: InvitationStatus.PENDING_OWNER_APPROVAL } })
        : Promise.resolve(0),
    ]);
    const visibleProjectIds = new Set(records.map(task => task.projectId).filter((projectId): projectId is string => Boolean(projectId)));
    const visibleOrganizationIds = new Set([
      ...records.map((task) => task.organizationId).filter((organizationId): organizationId is string => Boolean(organizationId)),
      ...projects.map((project) => project.organizationId),
      ...(actorIsOwner(actor) ? [] : managedOrganizationIds(actor)),
    ]);
    const visiblePrincipalIds = new Set([
      actor.id,
      ...actor.teamIds,
      ...records.flatMap((task) => task.assignments.map((assignment) => assignment.principalId)),
      ...projects.flatMap((project) => project.members.map((member) => member.principalId)),
    ]);
    const directoryWhere: Prisma.PrincipalWhereInput = actorIsOwner(actor)
      ? { workspaceId, active: true, status: PrincipalStatus.ACTIVE }
      : {
        workspaceId,
        active: true,
        status: PrincipalStatus.ACTIVE,
        OR: [
          { id: { in: [...visiblePrincipalIds] } },
          ...(managedOrganizationIds(actor).length ? [{ organizationMemberships: { some: { organizationId: { in: managedOrganizationIds(actor) }, status: MembershipStatus.ACTIVE } } }] : []),
          ...([...actorDepartmentHeadIds(actor)].length ? [{ departmentMemberships: { some: { departmentId: { in: [...actorDepartmentHeadIds(actor)] }, status: MembershipStatus.ACTIVE } } }] : []),
        ],
      };
    const [principals, organizations, workflowTemplates] = await Promise.all([
      db.principal.findMany({
        where: directoryWhere,
        include: {
          organizationMemberships: { where: { status: MembershipStatus.ACTIVE }, include: { organization: true } },
          departmentMemberships: { where: { status: MembershipStatus.ACTIVE }, include: { department: true } },
          teamScopes: { where: { status: MembershipStatus.ACTIVE }, include: { organization: true, department: true } },
          userAccount: true,
        },
        orderBy: { name: "asc" },
      }),
      db.organization.findMany({
        where: actorIsOwner(actor) ? { workspaceId } : { workspaceId, id: { in: [...visibleOrganizationIds] } },
        include: {
          departments: { include: { teamScopes: { where: { status: MembershipStatus.ACTIVE }, include: { team: { select: { id: true, type: true } } } } }, orderBy: { name: "asc" } },
          // Organization resources are intentionally Owner-only until an
          // explicit resource-level permission model exists. A manager of one
          // organization must never receive another organization's resources.
          resources: actorIsOwner(actor) ? { orderBy: { createdAt: "desc" } } : { where: { id: { in: [] } } },
        },
        orderBy: { name: "asc" },
      }),
      db.workflowTemplate.findMany({
        where: actorIsOwner(actor)
          ? { workspaceId, status: WorkflowTemplateStatus.ACTIVE }
          : {
            workspaceId,
            status: WorkflowTemplateStatus.ACTIVE,
            OR: [
              ...(managedOrganizationIds(actor).length ? [{ organizationId: { in: managedOrganizationIds(actor) } }] : []),
              ...([...actorDepartmentHeadIds(actor)].length ? [{ OR: [{ leadDepartmentId: { in: [...actorDepartmentHeadIds(actor)] } }, { involvedDepartments: { some: { departmentId: { in: [...actorDepartmentHeadIds(actor)] } } } }] }] : []),
            ],
          },
        include: workflowTemplateInclude,
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    const directory: DirectoryDTO[] = principals.map((principal) => toDirectoryDTO(principal, actorIsOwner(actor)));
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      revision: workspace.revision,
      actorId: actor.id,
      profile: toProfileDTO(actor, preference, pendingAccessRequestCount),
      tasks: records.map((task) => toTaskDTO(task, actor.id)),
      projects: projects.filter(project => canViewProject(actor, project) || visibleProjectIds.has(project.id)).map(toProjectDTO),
      directory,
      organizations: organizations.map(toOrganizationDTO),
      savedViews: savedViews.map((view): SavedViewDTO => ({ id: view.id, name: view.name, filters: view.filters as Record<string, unknown>, ownerId: view.ownerId || undefined })),
      workflowTemplates: workflowTemplates.map(toWorkflowTemplateDTO),
      nudgeStates: nudgeStates.map((state): NudgeStateDTO => ({
        dedupKey: state.dedupKey,
        disposition: state.disposition === NudgeDisposition.SNOOZED ? "snoozed" : "dismissed",
        taskId: state.taskId || undefined,
        snoozedUntil: state.snoozedUntil?.toISOString(),
      })),
      inboxCaptures: inboxCaptures.map((capture): InboxCaptureDTO => ({
        id: capture.id,
        rawText: capture.rawText,
        status: capture.status === CaptureStatus.REVIEWING ? "reviewing" : "needs_organization",
        createdAt: capture.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    if (error instanceof Error && ["BINNIE_DATABASE_NOT_CONFIGURED", "BINNIE_AUTHENTICATION_REQUIRED", "BINNIE_FORBIDDEN"].includes(error.message)) return null;
    throw error;
  }
}

export async function getWorkspaceRevision(workspaceId = DEFAULT_WORKSPACE_ID) {
  if (!hasDatabaseConfiguration()) return null;
  await requireCurrentUser(workspaceId);
  const workspace = await getDb().workspace.findUnique({ where: { id: workspaceId }, select: { revision: true } });
  return workspace?.revision ?? null;
}

export async function createCanonicalProject(input: CreateProjectInput): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const name = input.name.trim();
  if (!name) return { ok: false, code: "VALIDATION", message: "Project name is required." };
  try {
    const db = getDb();
    const actor = await resolveActor(workspaceId);
    const organization = await db.organization.findFirst({ where: { id: input.organizationId, workspaceId } });
    if (!organization) return { ok: false, code: "VALIDATION", message: "Organization is required." };
    if (!actorIsOwner(actor) && !actorManagesOrganization(actor, organization.id)) return forbidden();
    const departmentIds = [...new Set([input.leadDepartmentId, ...(input.involvedDepartmentIds || [])].filter((value): value is string => Boolean(value)))];
    const memberIds = (input.members || []).map(member => member.principalId);
    if ((input.members || []).filter(member => member.role === "owner").length > 1) return { ok: false, code: "VALIDATION", message: "Choose one project owner, or leave the owner open for now." };
    if (new Set(memberIds).size !== memberIds.length) return { ok: false, code: "VALIDATION", message: "Add each project person or team only once." };
    const [departments, principals] = await Promise.all([
      departmentIds.length ? db.department.findMany({ where: { id: { in: departmentIds }, organizationId: organization.id }, select: { id: true } }) : Promise.resolve([]),
      memberIds.length ? db.principal.findMany({ where: { id: { in: memberIds }, workspaceId, active: true }, select: { id: true } }) : Promise.resolve([]),
    ]);
    if (departments.length !== departmentIds.length) return { ok: false, code: "VALIDATION", message: "Choose areas within the selected organization." };
    if (principals.length !== memberIds.length) return { ok: false, code: "VALIDATION", message: "Choose people or teams already in Binnie." };
    const firstTask = input.firstTask?.title.trim() ? input.firstTask : undefined;
    if (firstTask?.leadDepartmentId && !departmentIds.includes(firstTask.leadDepartmentId)) return { ok: false, code: "VALIDATION", message: "The first task area must be involved in this project." };
    const firstTaskAssignments = firstTask?.assignments || [];
    if (firstTaskAssignments.filter(assignment => assignment.role === "primary_owner").length > 1) return { ok: false, code: "VALIDATION", message: "The first task needs one primary owner." };
    const firstTaskPrincipalIds = firstTaskAssignments.map(assignment => assignment.principalId);
    if (firstTaskPrincipalIds.length) {
      const assigned = await db.principal.count({ where: { id: { in: firstTaskPrincipalIds }, workspaceId, active: true } });
      if (assigned !== firstTaskPrincipalIds.length) return { ok: false, code: "VALIDATION", message: "Choose real people or teams for the first task." };
    }
    const revision = await db.$transaction(async tx => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          organizationId: organization.id,
          leadDepartmentId: input.leadDepartmentId || null,
          createdByPrincipalId: actor.id,
          name,
          description: input.description?.trim() || null,
          targetDate: dateOnly(input.targetDate),
          status: ProjectStatus.ACTIVE,
          involvedDepartments: { create: departmentIds.map(departmentId => ({ departmentId })) },
          members: { create: (input.members || []).map(member => ({ principalId: member.principalId, role: member.role === "owner" ? ProjectMemberRole.OWNER : member.role === "collaborator" ? ProjectMemberRole.COLLABORATOR : ProjectMemberRole.MEMBER })) },
          milestones: { create: (input.milestones || []).filter(milestone => milestone.title.trim()).map(milestone => ({ title: milestone.title.trim(), targetDate: dateOnly(milestone.targetDate), ownerPrincipalId: milestone.ownerPrincipalId || null })) },
          focusItems: { create: (input.focusItems || []).map(item => item.trim()).filter(Boolean).slice(0, 12).map((text, position) => ({ text, position })) },
          tasks: firstTask ? {
            create: {
              workspaceId,
              organizationId: organization.id,
              leadDepartmentId: firstTask.leadDepartmentId || input.leadDepartmentId || null,
              createdByPrincipalId: actor.id,
              title: firstTask.title.trim(),
              priority: TaskPriority.MEDIUM,
              status: TaskStatus.READY,
              targetDate: dateOnly(firstTask.targetDate),
              deadline: dateOnly(firstTask.deadlineDate),
              nextActionKind: firstTaskAssignments.find(assignment => assignment.role === "primary_owner") ? NextActionKind.PRINCIPAL : NextActionKind.READY,
              nextActionPrincipalId: firstTaskAssignments.find(assignment => assignment.role === "primary_owner")?.principalId || null,
              involvedDepartments: { create: [...new Set([firstTask.leadDepartmentId || input.leadDepartmentId, ...departmentIds].filter((value): value is string => Boolean(value)))].map(departmentId => ({ departmentId })) },
              assignments: { create: firstTaskAssignments.map(assignment => ({ principalId: assignment.principalId, role: assignment.role === "primary_owner" ? AssignmentRole.PRIMARY_OWNER : AssignmentRole.COLLABORATOR, source: AssignmentSource.MANUAL, assignedByPrincipalId: actor.id })) },
              events: { create: { actorId: actor.id, type: TaskEventType.CREATED, summary: "Created with project" } },
            },
          } : undefined,
        },
      });
      return { projectId: project.id, revision: (await incrementRevision(tx, workspaceId)).revision };
    });
    const project = await projectById(revision.projectId);
    return project ? { ok: true, data: toProjectDTO(project), revision: revision.revision } : { ok: false, code: "NOT_FOUND", message: "Project was created but could not be loaded." };
  } catch (error) {
    console.error("Failed to create canonical project", { workspaceId, organizationId: input.organizationId, name, error });
    if (error instanceof Error && error.message.includes("Unique constraint")) return { ok: false, code: "VALIDATION", message: "A project with this name already exists in this organization." };
    return { ok: false, code: "VALIDATION", message: "Couldn't create project. Please try again." };
  }
}

/**
 * Permanently removes a project from the shared workspace while deliberately
 * retaining its tasks. Tasks are detached before the project row is deleted so
 * their history, assignments, and dashboard counts stay intact.
 */
export async function deleteCanonicalProject(projectId: string, workspaceId = DEFAULT_WORKSPACE_ID): Promise<ActionResult<{ id: string; disassociatedTaskCount: number }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  try {
    const db = getDb();
    const project = await projectById(projectId);
    if (!project || project.workspaceId !== workspaceId) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
    const actor = await resolveActor(workspaceId);
    if (!canManageProject(actor, project)) return forbidden("You do not have permission to permanently delete this project.");

    const result = await db.$transaction(async tx => {
      const disassociatedTaskCount = await tx.task.count({ where: { workspaceId, projectId } });
      // The schema also protects this relationship with onDelete: SetNull. Do
      // it explicitly inside this transaction so the behavior is intentional
      // and task records never retain a stale project reference in transit.
      await tx.task.updateMany({ where: { workspaceId, projectId }, data: { projectId: null } });
      await tx.project.delete({ where: { id: projectId } });
      const revision = (await incrementRevision(tx, workspaceId)).revision;
      return { disassociatedTaskCount, revision };
    });
    return { ok: true, data: { id: projectId, disassociatedTaskCount: result.disassociatedTaskCount }, revision: result.revision };
  } catch (error) {
    console.error("Failed to permanently delete canonical project", { workspaceId, projectId, error });
    return { ok: false, code: "VALIDATION", message: "Couldn't delete project. Please try again." };
  }
}

export async function archiveCanonicalProject(projectId: string, workspaceId = DEFAULT_WORKSPACE_ID): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  try {
    const project = await projectById(projectId);
    if (!project || project.workspaceId !== workspaceId) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
    const actor = await resolveActor(workspaceId);
    if (!canManageProject(actor, project)) return forbidden("You do not have permission to archive this project.");
    const revision = await getDb().$transaction(async tx => {
      await tx.project.update({ where: { id: projectId }, data: { status: ProjectStatus.ARCHIVED } });
      return (await incrementRevision(tx, workspaceId)).revision;
    });
    return { ok: true, data: { id: projectId }, revision };
  } catch (error) {
    console.error("Failed to archive canonical project", { workspaceId, projectId, error });
    return { ok: false, code: "VALIDATION", message: "Couldn't archive project. Please try again." };
  }
}

function templateDependencyHasCycle(taskCount: number, dependencies: Array<{ taskIndex: number; prerequisiteTaskIndex: number }>) {
  const graph = Array.from({ length: taskCount }, () => [] as number[]);
  dependencies.forEach(dependency => graph[dependency.taskIndex]?.push(dependency.prerequisiteTaskIndex));
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const visit = (index: number): boolean => {
    if (visiting.has(index)) return true;
    if (visited.has(index)) return false;
    visiting.add(index);
    const cycle = graph[index].some(visit);
    visiting.delete(index);
    visited.add(index);
    return cycle;
  };
  return graph.some((_, index) => visit(index));
}

function offsetDate(anchor: Date, offset?: number) {
  if (offset === undefined || offset === null) return null;
  const date = new Date(anchor);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

function canManageWorkflowTemplate(actor: ActorRecord, template: WorkflowTemplateRecord) {
  return actorIsOwner(actor)
    || actorManagesOrganization(actor, template.organizationId)
    || actorManagesDepartment(actor, template.leadDepartmentId)
    || template.involvedDepartments.some(({ departmentId }) => actorManagesDepartment(actor, departmentId));
}

export async function createCanonicalWorkflowTemplate(input: CreateWorkflowTemplateInput): Promise<ActionResult<WorkflowTemplateDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const name = input.name.trim();
  if (!name) return { ok: false, code: "VALIDATION", message: "Template name is required." };
  if ((input.tasks || []).some(task => !task.title.trim())) return { ok: false, code: "VALIDATION", message: "Each suggested task needs a title." };
  if ((input.tasks || []).length > 60) return { ok: false, code: "VALIDATION", message: "Keep a template to 60 suggested tasks or fewer." };
  const dependencies = (input.tasks || []).flatMap((task, taskIndex) => (task.dependencies || []).map(dependency => ({ taskIndex, ...dependency })));
  if (dependencies.some(dependency => dependency.prerequisiteTaskIndex < 0 || dependency.prerequisiteTaskIndex >= (input.tasks || []).length || dependency.prerequisiteTaskIndex === dependency.taskIndex)) return { ok: false, code: "VALIDATION", message: "Each template dependency must point to another suggested task." };
  if (templateDependencyHasCycle((input.tasks || []).length, dependencies)) return { ok: false, code: "VALIDATION", message: "Template dependencies cannot form a cycle." };
  try {
    const db = getDb();
    const actor = await resolveActor(workspaceId);
    const organization = await db.organization.findFirst({ where: { id: input.organizationId, workspaceId } });
    if (!organization) return { ok: false, code: "VALIDATION", message: "Choose an organization for this template." };
    if (!actorIsOwner(actor) && !actorManagesOrganization(actor, organization.id)) return forbidden("You do not have permission to create a template here.");
    const departmentIds = [...new Set([input.leadDepartmentId, ...(input.involvedDepartmentIds || []), ...(input.tasks || []).map(task => task.leadDepartmentId)].filter((value): value is string => Boolean(value)))];
    const assigneeIds = [...new Set([...(input.tasks || []).map(task => task.defaultAssigneeId), ...(input.milestones || []).map(milestone => milestone.ownerPrincipalId)].filter((value): value is string => Boolean(value)))];
    const [departments, principals] = await Promise.all([
      departmentIds.length ? db.department.findMany({ where: { id: { in: departmentIds }, organizationId: organization.id }, select: { id: true } }) : Promise.resolve([]),
      assigneeIds.length ? db.principal.findMany({ where: { id: { in: assigneeIds }, workspaceId, active: true }, select: { id: true } }) : Promise.resolve([]),
    ]);
    if (departments.length !== departmentIds.length) return { ok: false, code: "VALIDATION", message: "Template areas must belong to its organization." };
    if (principals.length !== assigneeIds.length) return { ok: false, code: "VALIDATION", message: "Choose people or teams already in Binnie." };
    const created = await db.$transaction(async tx => {
      const template = await tx.workflowTemplate.create({
        data: {
          workspaceId,
          organizationId: organization.id,
          leadDepartmentId: input.leadDepartmentId || null,
          createdByPrincipalId: actor.id,
          name,
          description: input.description?.trim() || null,
          involvedDepartments: { create: departmentIds.map(departmentId => ({ departmentId })) },
          tasks: {
            create: (input.tasks || []).map((task, position) => ({
              title: task.title.trim(),
              description: task.description?.trim() || null,
              leadDepartmentId: task.leadDepartmentId || null,
              defaultAssigneeId: task.defaultAssigneeId || null,
              priority: asDbPriority(task.priority || "medium"),
              startOffsetDays: task.startOffsetDays ?? null,
              targetOffsetDays: task.targetOffsetDays ?? null,
              deadlineOffsetDays: task.deadlineOffsetDays ?? null,
              position,
              checklistItems: { create: (task.checklistItems || []).map(item => item.trim()).filter(Boolean).map((title, checklistPosition) => ({ title, position: checklistPosition })) },
            })),
          },
          milestones: { create: (input.milestones || []).filter(item => item.title.trim()).map((item, position) => ({ title: item.title.trim(), targetOffsetDays: item.targetOffsetDays ?? null, ownerPrincipalId: item.ownerPrincipalId || null, position })) },
          focusItems: { create: (input.focusItems || []).map(item => item.trim()).filter(Boolean).map((text, position) => ({ text, position })) },
        },
      });
      const templateTasks = await tx.workflowTemplateTask.findMany({ where: { templateId: template.id }, select: { id: true, position: true } });
      const taskIdAt = new Map(templateTasks.map(task => [task.position, task.id]));
      if (dependencies.length) {
        await tx.workflowTemplateDependency.createMany({ data: dependencies.map(dependency => ({
          taskId: taskIdAt.get(dependency.taskIndex)!,
          prerequisiteTemplateTaskId: taskIdAt.get(dependency.prerequisiteTaskIndex)!,
          type: asDbDependencyType(dependency.type),
          label: dependency.label.trim(),
        })) });
      }
      const revision = await incrementRevision(tx, workspaceId);
      return { templateId: template.id, revision: revision.revision };
    });
    const template = await workflowTemplateById(created.templateId);
    return template ? { ok: true, data: toWorkflowTemplateDTO(template), revision: created.revision } : { ok: false, code: "NOT_FOUND", message: "Template was created but could not be loaded." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { ok: false, code: "VALIDATION", message: "A template with this name already exists in this workspace." };
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Binnie could not save this template." };
  }
}

/**
 * Replace the reusable blueprint while leaving every already-created project
 * untouched. Templates are a starting point, not a live synchronization
 * mechanism, so this is intentionally a complete blueprint replacement.
 */
export async function updateCanonicalWorkflowTemplate(templateId: string, input: UpdateWorkflowTemplateInput): Promise<ActionResult<WorkflowTemplateDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const current = await workflowTemplateById(templateId);
  if (!current || current.workspaceId !== workspaceId) return { ok: false, code: "NOT_FOUND", message: "Template not found." };
  const actor = await resolveActor(workspaceId);
  if (!canManageWorkflowTemplate(actor, current)) return forbidden("You do not have permission to edit this template.");
  const name = input.name.trim();
  const tasks = input.tasks || [];
  if (!name) return { ok: false, code: "VALIDATION", message: "Template name is required." };
  if (tasks.some(task => !task.title.trim())) return { ok: false, code: "VALIDATION", message: "Each suggested task needs a title." };
  if (tasks.length > 60) return { ok: false, code: "VALIDATION", message: "Keep a template to 60 suggested tasks or fewer." };
  const dependencies = tasks.flatMap((task, taskIndex) => (task.dependencies || []).map(dependency => ({ taskIndex, ...dependency })));
  if (dependencies.some(dependency => dependency.prerequisiteTaskIndex < 0 || dependency.prerequisiteTaskIndex >= tasks.length || dependency.prerequisiteTaskIndex === dependency.taskIndex)) return { ok: false, code: "VALIDATION", message: "Each template dependency must point to another suggested task." };
  if (templateDependencyHasCycle(tasks.length, dependencies)) return { ok: false, code: "VALIDATION", message: "Template dependencies cannot form a cycle." };
  const db = getDb();
  const organization = await db.organization.findFirst({ where: { id: input.organizationId, workspaceId } });
  if (!organization) return { ok: false, code: "VALIDATION", message: "Choose an organization for this template." };
  if (!actorIsOwner(actor) && !actorManagesOrganization(actor, organization.id)) return forbidden("You do not have permission to move this template there.");
  const departmentIds = [...new Set([input.leadDepartmentId, ...(input.involvedDepartmentIds || []), ...tasks.map(task => task.leadDepartmentId)].filter((value): value is string => Boolean(value)))];
  const principalIds = [...new Set([...tasks.map(task => task.defaultAssigneeId), ...(input.milestones || []).map(milestone => milestone.ownerPrincipalId)].filter((value): value is string => Boolean(value)))];
  const [departments, principals] = await Promise.all([
    departmentIds.length ? db.department.findMany({ where: { id: { in: departmentIds }, organizationId: organization.id }, select: { id: true } }) : Promise.resolve([]),
    principalIds.length ? db.principal.findMany({ where: { id: { in: principalIds }, workspaceId, active: true }, select: { id: true } }) : Promise.resolve([]),
  ]);
  if (departments.length !== departmentIds.length) return { ok: false, code: "VALIDATION", message: "Template areas must belong to its organization." };
  if (principals.length !== principalIds.length) return { ok: false, code: "VALIDATION", message: "Choose people or teams already in Binnie." };
  try {
    const result = await db.$transaction(async tx => {
      await tx.workflowTemplate.update({
        where: { id: templateId },
        data: {
          organizationId: organization.id,
          leadDepartmentId: input.leadDepartmentId || null,
          name,
          description: input.description?.trim() || null,
          involvedDepartments: { deleteMany: {}, create: departmentIds.map(departmentId => ({ departmentId })) },
          tasks: {
            deleteMany: {},
            create: tasks.map((task, position) => ({
              title: task.title.trim(), description: task.description?.trim() || null,
              leadDepartmentId: task.leadDepartmentId || null, defaultAssigneeId: task.defaultAssigneeId || null,
              priority: asDbPriority(task.priority || "medium"), startOffsetDays: task.startOffsetDays ?? null,
              targetOffsetDays: task.targetOffsetDays ?? null, deadlineOffsetDays: task.deadlineOffsetDays ?? null, position,
              checklistItems: { create: (task.checklistItems || []).map(item => item.trim()).filter(Boolean).map((title, checklistPosition) => ({ title, position: checklistPosition })) },
            })),
          },
          milestones: { deleteMany: {}, create: (input.milestones || []).filter(item => item.title.trim()).map((item, position) => ({ title: item.title.trim(), targetOffsetDays: item.targetOffsetDays ?? null, ownerPrincipalId: item.ownerPrincipalId || null, position })) },
          focusItems: { deleteMany: {}, create: (input.focusItems || []).map(item => item.trim()).filter(Boolean).map((text, position) => ({ text, position })) },
        },
      });
      const templateTasks = await tx.workflowTemplateTask.findMany({ where: { templateId }, select: { id: true, position: true } });
      const taskIdAt = new Map(templateTasks.map(task => [task.position, task.id]));
      if (dependencies.length) await tx.workflowTemplateDependency.createMany({ data: dependencies.map(dependency => ({ taskId: taskIdAt.get(dependency.taskIndex)!, prerequisiteTemplateTaskId: taskIdAt.get(dependency.prerequisiteTaskIndex)!, type: asDbDependencyType(dependency.type), label: dependency.label.trim() })) });
      return (await incrementRevision(tx, workspaceId)).revision;
    });
    const template = await workflowTemplateById(templateId);
    return template ? { ok: true, data: toWorkflowTemplateDTO(template), revision: result } : { ok: false, code: "NOT_FOUND", message: "Template not found after saving." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { ok: false, code: "VALIDATION", message: "A template with this name already exists in this workspace." };
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Binnie could not save this template." };
  }
}

export async function archiveCanonicalWorkflowTemplate(templateId: string, workspaceId = DEFAULT_WORKSPACE_ID): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const template = await workflowTemplateById(templateId);
  if (!template || template.workspaceId !== workspaceId) return { ok: false, code: "NOT_FOUND", message: "Template not found." };
  const actor = await resolveActor(workspaceId);
  if (!canManageWorkflowTemplate(actor, template)) return forbidden("You do not have permission to archive this template.");
  const revision = await getDb().$transaction(async tx => {
    await tx.workflowTemplate.update({ where: { id: templateId }, data: { status: WorkflowTemplateStatus.ARCHIVED } });
    return (await incrementRevision(tx, workspaceId)).revision;
  });
  return { ok: true, data: { id: templateId }, revision };
}

export async function applyCanonicalWorkflowTemplate(input: ApplyWorkflowTemplateInput): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const name = input.name.trim();
  if (!name) return { ok: false, code: "VALIDATION", message: "Project name is required." };
  const template = await workflowTemplateById(input.templateId);
  if (!template || template.workspaceId !== workspaceId || template.status !== WorkflowTemplateStatus.ACTIVE) return { ok: false, code: "NOT_FOUND", message: "That active template is no longer available." };
  const actor = await resolveActor(workspaceId);
  if (!canManageWorkflowTemplate(actor, template)) return forbidden("You do not have permission to use this template.");
  const anchor = dateOnly(input.startDate) || new Date(`${workspaceToday()}T00:00:00.000Z`);
  try {
    const result = await getDb().$transaction(async tx => {
      const project = await tx.project.create({
        data: {
          workspaceId,
          organizationId: template.organizationId,
          leadDepartmentId: template.leadDepartmentId || null,
          sourceTemplateId: template.id,
          createdByPrincipalId: actor.id,
          name,
          description: input.description?.trim() || template.description || null,
          targetDate: dateOnly(input.targetDate),
          status: ProjectStatus.ACTIVE,
          involvedDepartments: { create: template.involvedDepartments.map(({ departmentId }) => ({ departmentId })) },
          members: { create: Array.from(new Set(template.tasks.map(task => task.defaultAssigneeId).filter((value): value is string => Boolean(value)))).map(principalId => ({ principalId, role: ProjectMemberRole.MEMBER })) },
          milestones: { create: template.milestones.map(milestone => ({ title: milestone.title, targetDate: offsetDate(anchor, milestone.targetOffsetDays ?? undefined), ownerPrincipalId: milestone.ownerPrincipalId || null })) },
          focusItems: { create: template.focusItems.map(item => ({ text: item.text, position: item.position })) },
        },
      });
      const templateTaskToTaskId = new Map<string, string>();
      for (const templateTask of template.tasks) {
        const task = await tx.task.create({
          data: {
            workspaceId,
            organizationId: template.organizationId,
            leadDepartmentId: templateTask.leadDepartmentId || template.leadDepartmentId || null,
            projectId: project.id,
            createdByPrincipalId: actor.id,
            title: templateTask.title,
            description: templateTask.description || null,
            status: TaskStatus.READY,
            priority: templateTask.priority,
            startDate: offsetDate(anchor, templateTask.startOffsetDays ?? undefined),
            targetDate: offsetDate(anchor, templateTask.targetOffsetDays ?? undefined),
            deadline: offsetDate(anchor, templateTask.deadlineOffsetDays ?? undefined),
            nextActionKind: templateTask.defaultAssigneeId ? NextActionKind.PRINCIPAL : NextActionKind.READY,
            nextActionPrincipalId: templateTask.defaultAssigneeId || null,
            involvedDepartments: { create: [...new Set([templateTask.leadDepartmentId, template.leadDepartmentId, ...template.involvedDepartments.map(({ departmentId }) => departmentId)].filter((value): value is string => Boolean(value)))].map(departmentId => ({ departmentId })) },
            assignments: templateTask.defaultAssigneeId ? { create: { principalId: templateTask.defaultAssigneeId, role: AssignmentRole.PRIMARY_OWNER, source: AssignmentSource.MANUAL, assignedByPrincipalId: actor.id } } : undefined,
            checklistItems: { create: templateTask.checklistItems.map(item => ({ title: item.title, position: item.position })) },
            events: { create: { actorId: actor.id, type: TaskEventType.CREATED, summary: `Created from ${template.name} template` } },
          },
        });
        templateTaskToTaskId.set(templateTask.id, task.id);
      }
      const dependencies = template.tasks.flatMap(templateTask => templateTask.dependencies.map(dependency => ({ templateTask, dependency })));
      if (dependencies.length) await tx.taskDependency.createMany({ data: dependencies.map(({ templateTask, dependency }) => ({
        taskId: templateTaskToTaskId.get(templateTask.id)!,
        prerequisiteTaskId: templateTaskToTaskId.get(dependency.prerequisiteTemplateTaskId)!,
        type: dependency.type,
        label: dependency.label,
      })) });
      const revision = await incrementRevision(tx, workspaceId);
      return { projectId: project.id, revision: revision.revision };
    });
    const project = await projectById(result.projectId);
    return project ? { ok: true, data: toProjectDTO(project), revision: result.revision } : { ok: false, code: "NOT_FOUND", message: "Project was created but could not be loaded." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { ok: false, code: "VALIDATION", message: "A project with this name already exists in this organization." };
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Binnie could not apply this template." };
  }
}

export async function setCanonicalNudgeState(input: { workspaceId?: string; dedupKey: string; taskId?: string; disposition: "dismissed" | "snoozed" | "restored"; snoozedUntil?: string }): Promise<ActionResult<{ dedupKey: string }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const dedupKey = input.dedupKey.trim();
  if (!dedupKey || dedupKey.length > 300) return { ok: false, code: "VALIDATION", message: "Choose a valid nudge." };
  const actor = await resolveActor(workspaceId);
  if (input.taskId) {
    const task = await taskById(input.taskId);
    if (!task || task.workspaceId !== workspaceId) return { ok: false, code: "NOT_FOUND", message: "The work behind this nudge no longer exists." };
    if (!canViewTask(actor, task)) return forbidden("You cannot change this nudge.");
  }
  const until = input.disposition === "snoozed" ? dateOnly(input.snoozedUntil) : null;
  if (input.disposition === "snoozed" && (!until || until <= new Date(`${workspaceToday()}T00:00:00.000Z`))) return { ok: false, code: "VALIDATION", message: "Choose a future date to snooze this nudge." };
  const revision = await getDb().$transaction(async tx => {
    if (input.disposition === "restored") {
      await tx.workNudge.deleteMany({ where: { workspaceId, recipientId: actor.id, dedupKey } });
    } else {
      await tx.workNudge.upsert({
        where: { workspaceId_recipientId_dedupKey: { workspaceId, recipientId: actor.id, dedupKey } },
        create: { workspaceId, recipientId: actor.id, taskId: input.taskId || null, dedupKey, disposition: input.disposition === "snoozed" ? NudgeDisposition.SNOOZED : NudgeDisposition.DISMISSED, snoozedUntil: until },
        update: { taskId: input.taskId || null, disposition: input.disposition === "snoozed" ? NudgeDisposition.SNOOZED : NudgeDisposition.DISMISSED, snoozedUntil: until },
      });
    }
    return (await incrementRevision(tx, workspaceId)).revision;
  });
  return { ok: true, data: { dedupKey }, revision };
}

export async function addCanonicalProjectMilestone(projectId: string, milestone: ProjectMilestoneInput): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const title = milestone.title.trim();
  if (!title) return { ok: false, code: "VALIDATION", message: "Milestone name is required." };
  const db = getDb();
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden();
  if (milestone.ownerPrincipalId) {
    const owner = await db.principal.findFirst({ where: { id: milestone.ownerPrincipalId, workspaceId: project.workspaceId, active: true } });
    if (!owner) return { ok: false, code: "VALIDATION", message: "Choose a real owner from this workspace." };
  }
  const revision = await db.$transaction(async tx => {
    await tx.projectMilestone.create({ data: { projectId, title, targetDate: dateOnly(milestone.targetDate), ownerPrincipalId: milestone.ownerPrincipalId || null } });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: toProjectDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after milestone." };
}

export async function updateCanonicalProjectMilestone(projectId: string, milestoneId: string, input: { title?: string; targetDate?: string | null; ownerPrincipalId?: string | null; status?: "planned" | "done" }): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden("You do not have permission to update this milestone.");
  if (!project.milestones.some(item => item.id === milestoneId)) return { ok: false, code: "NOT_FOUND", message: "Milestone not found." };
  const title = input.title === undefined ? undefined : input.title.trim();
  if (title !== undefined && !title) return { ok: false, code: "VALIDATION", message: "Milestone name is required." };
  if (input.ownerPrincipalId) {
    const owner = await db.principal.findFirst({ where: { id: input.ownerPrincipalId, workspaceId: project.workspaceId, active: true } });
    if (!owner) return { ok: false, code: "VALIDATION", message: "Choose a real owner from this workspace." };
  }
  const revision = await db.$transaction(async tx => {
    await tx.projectMilestone.update({ where: { id: milestoneId }, data: { title, targetDate: input.targetDate === undefined ? undefined : dateOnly(input.targetDate), ownerPrincipalId: input.ownerPrincipalId === undefined ? undefined : input.ownerPrincipalId, status: input.status === undefined ? undefined : input.status === "done" ? MilestoneStatus.DONE : MilestoneStatus.PLANNED } });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: toProjectDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after milestone update." };
}

export async function deleteCanonicalProjectMilestone(projectId: string, milestoneId: string): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden("You do not have permission to remove this milestone.");
  if (!project.milestones.some(item => item.id === milestoneId)) return { ok: false, code: "NOT_FOUND", message: "Milestone not found." };
  const revision = await db.$transaction(async tx => {
    await tx.projectMilestone.delete({ where: { id: milestoneId } });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: toProjectDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after milestone removal." };
}

export async function addCanonicalProjectFocusItem(projectId: string, text: string): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const value = text.trim();
  if (!value) return { ok: false, code: "VALIDATION", message: "Focus needs a short description." };
  const db = getDb();
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden();
  const revision = await db.$transaction(async tx => {
    const last = await tx.projectFocusItem.findFirst({ where: { projectId }, orderBy: { position: "desc" }, select: { position: true } });
    const position = (last?.position ?? -1) + 1;
    await tx.projectFocusItem.create({ data: { projectId, text: value.slice(0, 500), position } });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: toProjectDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after focus update." };
}

export async function updateCanonicalProjectFocusItem(projectId: string, focusItemId: string, text: string): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const value = text.trim();
  if (!value) return { ok: false, code: "VALIDATION", message: "Focus needs a short description." };
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden();
  if (!project.focusItems.some(item => item.id === focusItemId)) return { ok: false, code: "NOT_FOUND", message: "Focus item not found." };
  const revision = await getDb().$transaction(async tx => {
    await tx.projectFocusItem.update({ where: { id: focusItemId }, data: { text: value.slice(0, 500) } });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: toProjectDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after focus update." };
}

export async function deleteCanonicalProjectFocusItem(projectId: string, focusItemId: string): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden();
  if (!project.focusItems.some(item => item.id === focusItemId)) return { ok: false, code: "NOT_FOUND", message: "Focus item not found." };
  const revision = await getDb().$transaction(async tx => {
    await tx.projectFocusItem.delete({ where: { id: focusItemId } });
    const remaining = await tx.projectFocusItem.findMany({ where: { projectId }, orderBy: { position: "asc" }, select: { id: true } });
    for (const [position, item] of remaining.entries()) await tx.projectFocusItem.update({ where: { id: item.id }, data: { position } });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: toProjectDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after focus update." };
}

export async function setCanonicalProjectMembers(projectId: string, members: ProjectMemberInput[]): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden("You do not have permission to update this project's people.");
  const unique = new Map<string, ProjectMemberInput>();
  for (const member of members) unique.set(member.principalId, member);
  if (unique.size !== members.length) return { ok: false, code: "VALIDATION", message: "Add each person or team only once." };
  const principalIds = members.map(member => member.principalId);
  const valid = principalIds.length ? await getDb().principal.count({ where: { id: { in: principalIds }, workspaceId: project.workspaceId, active: true } }) : 0;
  if (valid !== principalIds.length) return { ok: false, code: "VALIDATION", message: "Choose active people or teams already in Binnie." };
  const revision = await getDb().$transaction(async tx => {
    await tx.projectMember.deleteMany({ where: { projectId } });
    if (members.length) await tx.projectMember.createMany({ data: members.map(member => ({ projectId, principalId: member.principalId, role: member.role === "owner" ? ProjectMemberRole.OWNER : member.role === "collaborator" ? ProjectMemberRole.COLLABORATOR : ProjectMemberRole.MEMBER })) });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: toProjectDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after updating members." };
}

function projectResourceDTO(project: ProjectRecord) {
  return toProjectDTO(project);
}

function parseResourceUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function addCanonicalProjectLink(projectId: string, url: string, label?: string): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const parsedUrl = parseResourceUrl(url);
  if (!parsedUrl) return { ok: false, code: "VALIDATION", message: "Only valid web links can be attached." };
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden("You do not have permission to add project resources.");
  const revision = await getDb().$transaction(async tx => {
    await tx.taskResource.create({ data: { scope: ResourceScope.PROJECT, projectId, label: label?.trim().slice(0, 500) || parsedUrl.hostname, url: parsedUrl.toString() } });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: projectResourceDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after attaching link." };
}

export async function addCanonicalProjectFile(projectId: string, file: { name: string; type: string; bytes: Uint8Array<ArrayBuffer> }): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  if (!file.name.trim() || file.bytes.byteLength > 5 * 1024 * 1024) return { ok: false, code: "VALIDATION", message: "Files must be named and no larger than 5 MB." };
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden("You do not have permission to add project resources.");
  const revision = await getDb().$transaction(async tx => {
    await tx.taskResource.create({ data: { scope: ResourceScope.PROJECT, projectId, label: file.name.trim().slice(0, 500), fileName: file.name.trim().slice(0, 500), mimeType: file.type.slice(0, 200) || "application/octet-stream", byteSize: file.bytes.byteLength, content: file.bytes } });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: projectResourceDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after attaching file." };
}

export async function deleteCanonicalProjectResource(projectId: string, resourceId: string): Promise<ActionResult<ProjectDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const project = await projectById(projectId);
  if (!project) return { ok: false, code: "NOT_FOUND", message: "Project not found." };
  const actor = await resolveActor(project.workspaceId);
  if (!canManageProject(actor, project)) return forbidden("You do not have permission to remove project resources.");
  const resource = await getDb().taskResource.findFirst({ where: { id: resourceId, projectId, scope: ResourceScope.PROJECT }, select: { id: true } });
  if (!resource) return { ok: false, code: "NOT_FOUND", message: "Project resource not found." };
  const revision = await getDb().$transaction(async tx => {
    await tx.taskResource.delete({ where: { id: resourceId } });
    return (await incrementRevision(tx, project.workspaceId)).revision;
  });
  const updated = await projectById(projectId);
  return updated ? { ok: true, data: projectResourceDTO(updated), revision } : { ok: false, code: "NOT_FOUND", message: "Project not found after removing resource." };
}

async function organizationForResource(organizationId: string) {
  return getDb().organization.findUnique({ where: { id: organizationId }, select: { id: true, workspaceId: true } });
}

export async function addCanonicalOrganizationLink(organizationId: string, url: string, label?: string): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const parsedUrl = parseResourceUrl(url);
  if (!parsedUrl) return { ok: false, code: "VALIDATION", message: "Only valid web links can be attached." };
  const organization = await organizationForResource(organizationId);
  if (!organization) return { ok: false, code: "NOT_FOUND", message: "Organization not found." };
  const actor = await resolveActor(organization.workspaceId);
  if (!actorIsOwner(actor) && !actorManagesOrganization(actor, organization.id)) return forbidden("You do not have permission to add organization resources.");
  const result = await getDb().$transaction(async tx => {
    const resource = await tx.taskResource.create({ data: { scope: ResourceScope.ORGANIZATION, organizationId, label: label?.trim().slice(0, 500) || parsedUrl.hostname, url: parsedUrl.toString() } });
    const revision = await incrementRevision(tx, organization.workspaceId);
    return { id: resource.id, revision: revision.revision };
  });
  return { ok: true, data: { id: result.id }, revision: result.revision };
}

export async function addCanonicalOrganizationFile(organizationId: string, file: { name: string; type: string; bytes: Uint8Array<ArrayBuffer> }): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  if (!file.name.trim() || file.bytes.byteLength > 5 * 1024 * 1024) return { ok: false, code: "VALIDATION", message: "Files must be named and no larger than 5 MB." };
  const organization = await organizationForResource(organizationId);
  if (!organization) return { ok: false, code: "NOT_FOUND", message: "Organization not found." };
  const actor = await resolveActor(organization.workspaceId);
  if (!actorIsOwner(actor) && !actorManagesOrganization(actor, organization.id)) return forbidden("You do not have permission to add organization resources.");
  const result = await getDb().$transaction(async tx => {
    const resource = await tx.taskResource.create({ data: { scope: ResourceScope.ORGANIZATION, organizationId, label: file.name.trim().slice(0, 500), fileName: file.name.trim().slice(0, 500), mimeType: file.type.slice(0, 200) || "application/octet-stream", byteSize: file.bytes.byteLength, content: file.bytes } });
    const revision = await incrementRevision(tx, organization.workspaceId);
    return { id: resource.id, revision: revision.revision };
  });
  return { ok: true, data: { id: result.id }, revision: result.revision };
}

export async function deleteCanonicalOrganizationResource(organizationId: string, resourceId: string): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const organization = await organizationForResource(organizationId);
  if (!organization) return { ok: false, code: "NOT_FOUND", message: "Organization not found." };
  const actor = await resolveActor(organization.workspaceId);
  if (!actorIsOwner(actor) && !actorManagesOrganization(actor, organization.id)) return forbidden("You do not have permission to remove organization resources.");
  const resource = await getDb().taskResource.findFirst({ where: { id: resourceId, organizationId, scope: ResourceScope.ORGANIZATION }, select: { id: true } });
  if (!resource) return { ok: false, code: "NOT_FOUND", message: "Organization resource not found." };
  const revision = await getDb().$transaction(async tx => {
    await tx.taskResource.delete({ where: { id: resourceId } });
    return (await incrementRevision(tx, organization.workspaceId)).revision;
  });
  return { ok: true, data: { id: resourceId }, revision };
}

/** Keep the vocabulary that Smart Inbox uses in the same canonical workspace
 * data as organizations and departments. */
export async function updateCanonicalOrganizationVocabulary(
  organizationId: string,
  input: { aliases?: string[]; departments?: Array<{ departmentId: string; aliases: string[] }>; colorKey?: OrganizationColorKey },
): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const organization = await getDb().organization.findUnique({ where: { id: organizationId }, include: { departments: { select: { id: true } } } });
  if (!organization) return { ok: false, code: "NOT_FOUND", message: "Organization not found." };
  const actor = await resolveActor(organization.workspaceId);
  if (!actorIsOwner(actor) && !actorManagesOrganization(actor, organizationId)) return forbidden("You do not have permission to update this organization's vocabulary.");
  const normalize = (aliases: string[]) => Array.from(new Set(aliases.map(alias => alias.trim().toLocaleLowerCase()).filter(Boolean))).slice(0, 40).map(alias => alias.slice(0, 120));
  if (input.colorKey !== undefined && !isOrganizationColorKey(input.colorKey)) return { ok: false, code: "VALIDATION", message: "Choose a Binnie organization color." };
  const departments = input.departments || [];
  if (new Set(departments.map(department => department.departmentId)).size !== departments.length || departments.some(department => !organization.departments.some(candidate => candidate.id === department.departmentId))) return { ok: false, code: "VALIDATION", message: "Choose departments in this organization." };
  const revision = await getDb().$transaction(async tx => {
    if (input.aliases !== undefined || input.colorKey !== undefined) await tx.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.aliases !== undefined ? { aliases: normalize(input.aliases) } : {}),
        ...(input.colorKey !== undefined ? { colorKey: input.colorKey } : {}),
      },
    });
    for (const department of departments) await tx.department.update({ where: { id: department.departmentId }, data: { aliases: normalize(department.aliases) } });
    return (await incrementRevision(tx, organization.workspaceId)).revision;
  });
  return { ok: true, data: { id: organizationId }, revision };
}

/** Persist personal preferences only. Access levels are never accepted from a
 * profile form; Owners manage them through the access workflow. */
export async function updateCanonicalProfile(input: UpdateCanonicalProfileInput): Promise<ActionResult<UserProfileDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, code: "VALIDATION", message: "Display name is required." };
  if (!input.timezone.trim() || !input.dateFormat.trim()) return { ok: false, code: "VALIDATION", message: "Choose valid profile preferences." };
  try {
    const db = getDb();
    const actor = await resolveActor(workspaceId);
    const result = await db.$transaction(async tx => {
      await tx.principal.update({
        where: { id: actor.id },
        // The auth identity's email is deliberately not mutated here. Email
        // changes require a separate verified-account flow.
        data: { name: displayName },
      });
      const preference = await tx.principalPreference.upsert({
        where: { principalId: actor.id },
        create: {
          principalId: actor.id,
          workspaceId,
          timezone: input.timezone.trim().slice(0, 120),
          dateFormat: input.dateFormat.trim().slice(0, 80),
          theme: input.theme,
          storageVersion: 1,
        },
        update: {
          timezone: input.timezone.trim().slice(0, 120),
          dateFormat: input.dateFormat.trim().slice(0, 80),
          theme: input.theme,
          storageVersion: 1,
        },
      });
      const revision = await incrementRevision(tx, workspaceId);
      return { profile: toProfileDTO({ ...actor, name: displayName }, preference), revision: revision.revision };
    });
    return { ok: true, data: result.profile, revision: result.revision };
  } catch (error) {
    console.error("Could not persist Binnie profile", error);
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Could not save profile changes." };
  }
}

/** Persist only the authenticated person's Tasks List column choices. */
export async function saveCanonicalTaskListColumns(columns: string[], workspaceId = DEFAULT_WORKSPACE_ID): Promise<ActionResult<{ taskListColumns: string[] }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const normalized = [...new Set(columns.filter((column) => taskListColumnIds.has(column)))];
  if (!normalized.includes("task")) normalized.unshift("task");
  try {
    const db = getDb();
    const actor = await resolveActor(workspaceId);
    await db.principalPreference.upsert({
      where: { principalId: actor.id },
      create: {
        principalId: actor.id,
        workspaceId,
        taskListColumns: normalized,
      },
      update: { taskListColumns: normalized },
    });
    return { ok: true, data: { taskListColumns: normalized } };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { ok: false, code: "UNAUTHORIZED", message: "Sign in to save task view preferences." };
    if (error instanceof AuthorizationError) return forbidden("You do not have permission to save task view preferences.");
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Could not save task view preferences." };
  }
}

export async function createCanonicalOrganization(input: CreateOrganizationInput): Promise<ActionResult<OrganizationDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const name = input.name.trim();
  if (!name) return { ok: false, code: "VALIDATION", message: "Organization name is required." };
  if (input.colorKey !== undefined && !isOrganizationColorKey(input.colorKey)) return { ok: false, code: "VALIDATION", message: "Choose a Binnie organization color." };
  try {
    const db = getDb();
    const actor = await resolveActor(workspaceId);
    if (!actorIsOwner(actor)) return forbidden("Only a workspace owner can add organizations.");
    const result = await db.$transaction(async tx => {
      const organization = await tx.organization.create({
        data: { workspaceId, name, description: input.description?.trim().slice(0, 2_000) || null, colorKey: input.colorKey || defaultOrganizationColorKey(name) },
        include: { departments: { include: { teamScopes: { include: { team: true } } } }, resources: true },
      });
      const revision = await incrementRevision(tx, workspaceId);
      return { organization, revision: revision.revision };
    });
    return { ok: true, data: toOrganizationDTO(result.organization), revision: result.revision };
  } catch (error) {
    console.error("Could not create Binnie organization", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) return { ok: false, code: "VALIDATION", message: "That organization already exists in Binnie." };
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Could not create organization." };
  }
}

/** The only intentional destructive path for a development demo workspace.
 * It is unavailable in production and must be explicitly confirmed by the
 * caller; normal startup, migrations, and seeds never remove user data. */
export async function resetCanonicalDemoData(confirmation: string, workspaceId = DEFAULT_WORKSPACE_ID): Promise<ActionResult<{ workspaceId: string }>> {
  if (process.env.NODE_ENV === "production") return forbidden("Demo data can only be reset in development.");
  if (confirmation !== "RESET DEMO DATA") return { ok: false, code: "VALIDATION", message: "Type RESET DEMO DATA to confirm." };
  if (!hasDatabaseConfiguration()) return configuration();
  try {
    const db = getDb();
    const actor = await resolveActor(workspaceId);
    if (!actorIsOwner(actor)) return forbidden("Only a workspace owner can reset demo data.");
    await db.workspace.delete({ where: { id: workspaceId } });
    await seedDemoWorkspace();
    return { ok: true, data: { workspaceId } };
  } catch (error) {
    console.error("Could not reset Binnie demo data", error);
    return { ok: false, code: "VALIDATION", message: "Couldn't reset demo data. Please check the server log." };
  }
}

export async function createCanonicalPrincipal(input: CreatePrincipalInput): Promise<ActionResult<DirectoryDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const name = input.name.trim();
  if (!name) return { ok: false, code: "VALIDATION", message: "A person or team needs a name." };
  const db = getDb();
  const actor = await resolveActor(workspaceId);
  const memberships = input.memberships || [];
  const organizationIds = [...new Set(memberships.flatMap(item => item.organizationId ? [item.organizationId] : []))];
  const departmentIds = [...new Set(memberships.flatMap(item => item.departmentId ? [item.departmentId] : []))];
  const [organizations, departments] = await Promise.all([
    organizationIds.length ? db.organization.findMany({ where: { id: { in: organizationIds }, workspaceId }, select: { id: true } }) : Promise.resolve([]),
    departmentIds.length ? db.department.findMany({ where: { id: { in: departmentIds }, organization: { workspaceId } }, select: { id: true, organizationId: true } }) : Promise.resolve([]),
  ]);
  if (organizations.length !== organizationIds.length || departments.length !== departmentIds.length || memberships.some(item => item.departmentId && item.organizationId && departments.find(department => department.id === item.departmentId)?.organizationId !== item.organizationId)) return { ok: false, code: "VALIDATION", message: "Choose organizations and departments in this workspace." };
  if (!actorIsOwner(actor) && memberships.some(item => item.organizationId && !actorManagesOrganization(actor, item.organizationId))) return forbidden("You do not have permission to add someone to that organization.");
  if (!actorIsOwner(actor) && !organizationIds.length) return forbidden("Choose an organization you manage before adding a person.");
  try {
    const result = await db.$transaction(async tx => {
      const isTeam = input.type === "team";
      const principal = await tx.principal.create({
        data: {
          workspaceId,
          name,
          type: isTeam ? PrincipalType.TEAM : PrincipalType.PERSON,
          email: input.email?.trim() || null,
          organizationMemberships: !isTeam && organizationIds.length ? { create: organizationIds.map(organizationId => ({ organizationId, accessLevel: null })) } : undefined,
          departmentMemberships: !isTeam && departmentIds.length ? { create: departmentIds.map(departmentId => ({ departmentId })) } : undefined,
          teamScopes: isTeam && memberships.length ? { create: memberships.filter(item => item.organizationId).map(item => ({ organizationId: item.organizationId!, departmentId: item.departmentId || null })) } : undefined,
        },
        include: {
          organizationMemberships: { include: { organization: true } },
          departmentMemberships: { include: { department: true } },
          teamScopes: { include: { organization: true, department: true } },
          userAccount: true,
        },
      });
      const revision = await incrementRevision(tx, workspaceId);
      return { principal, revision: revision.revision };
    });
    return { ok: true, data: toDirectoryDTO(result.principal), revision: result.revision };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { ok: false, code: "VALIDATION", message: "That person or team already exists in Binnie." };
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Could not add this person or team." };
  }
}

export async function updateCanonicalPrincipal(principalId: string, input: CreatePrincipalInput): Promise<ActionResult<DirectoryDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const db = getDb();
  const actor = await resolveActor(workspaceId);
  if (!actorIsOwner(actor)) return forbidden("Only a workspace owner can edit people and teams.");
  const existing = await db.principal.findFirst({ where: { id: principalId, workspaceId } });
  if (!existing) return { ok: false, code: "NOT_FOUND", message: "Person or team not found." };
  const name = input.name.trim();
  if (!name) return { ok: false, code: "VALIDATION", message: "A person or team needs a name." };
  const memberships = input.memberships || [];
  const organizationIds = [...new Set(memberships.flatMap(item => item.organizationId ? [item.organizationId] : []))];
  const departmentIds = [...new Set(memberships.flatMap(item => item.departmentId ? [item.departmentId] : []))];
  const [organizations, departments] = await Promise.all([
    organizationIds.length ? db.organization.findMany({ where: { id: { in: organizationIds }, workspaceId }, select: { id: true } }) : Promise.resolve([]),
    departmentIds.length ? db.department.findMany({ where: { id: { in: departmentIds }, organization: { workspaceId } }, select: { id: true, organizationId: true } }) : Promise.resolve([]),
  ]);
  if (organizations.length !== organizationIds.length || departments.length !== departmentIds.length || memberships.some(item => item.departmentId && item.organizationId && departments.find(department => department.id === item.departmentId)?.organizationId !== item.organizationId)) return { ok: false, code: "VALIDATION", message: "Choose organizations and departments in this workspace." };
  try {
    const result = await db.$transaction(async tx => {
      const isTeam = input.type === "team";
      await tx.principal.update({ where: { id: principalId }, data: { name, type: isTeam ? PrincipalType.TEAM : PrincipalType.PERSON, email: input.email?.trim() || null } });
      if (isTeam) {
        await tx.teamScope.updateMany({ where: { teamId: principalId, status: MembershipStatus.ACTIVE }, data: { status: MembershipStatus.REMOVED, removedAt: new Date() } });
        for (const membership of memberships.filter(item => item.organizationId)) {
          if (membership.departmentId) {
            await tx.teamScope.upsert({
              where: { teamId_organizationId_departmentId: { teamId: principalId, organizationId: membership.organizationId!, departmentId: membership.departmentId } },
              create: { teamId: principalId, organizationId: membership.organizationId!, departmentId: membership.departmentId },
              update: { status: MembershipStatus.ACTIVE, removedAt: null },
            });
          } else {
            const existingScope = await tx.teamScope.findFirst({ where: { teamId: principalId, organizationId: membership.organizationId!, departmentId: null } });
            if (existingScope) await tx.teamScope.update({ where: { id: existingScope.id }, data: { status: MembershipStatus.ACTIVE, removedAt: null } });
            else await tx.teamScope.create({ data: { teamId: principalId, organizationId: membership.organizationId!, departmentId: null } });
          }
        }
      } else {
        await tx.organizationMembership.updateMany({ where: { personId: principalId, status: MembershipStatus.ACTIVE, organizationId: { notIn: organizationIds } }, data: { status: MembershipStatus.REMOVED, removedAt: new Date(), accessLevel: null } });
        for (const organizationId of organizationIds) {
          await tx.organizationMembership.upsert({
            where: { personId_organizationId: { personId: principalId, organizationId } },
            create: { personId: principalId, organizationId, accessLevel: null },
            update: { status: MembershipStatus.ACTIVE, removedAt: null },
          });
        }
        await tx.departmentMembership.updateMany({ where: { personId: principalId, status: MembershipStatus.ACTIVE, departmentId: { notIn: departmentIds } }, data: { status: MembershipStatus.REMOVED, removedAt: new Date() } });
        for (const departmentId of departmentIds) {
          await tx.departmentMembership.upsert({
            where: { personId_departmentId: { personId: principalId, departmentId } },
            create: { personId: principalId, departmentId },
            update: { status: MembershipStatus.ACTIVE, removedAt: null },
          });
        }
      }
      const principal = await tx.principal.findUniqueOrThrow({
        where: { id: principalId },
        include: {
          organizationMemberships: { include: { organization: true } },
          departmentMemberships: { include: { department: true } },
          teamScopes: { include: { organization: true, department: true } },
          userAccount: true,
        },
      });
      const revision = await incrementRevision(tx, workspaceId);
      return { principal, revision: revision.revision };
    });
    return { ok: true, data: toDirectoryDTO(result.principal), revision: result.revision };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { ok: false, code: "VALIDATION", message: "That name is already in use in Binnie." };
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Could not update this person or team." };
  }
}

export async function createCanonicalTask(input: CreateTaskInput): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const title = input.title.trim();
  if (!title) return { ok: false, code: "VALIDATION", message: "A task needs a title." };
  try {
    const db = getDb();
    const actor = await resolveActor(workspaceId);
    const departmentIds = [...new Set([input.leadDepartmentId, ...(input.involvedDepartmentIds || [])].filter((value): value is string => Boolean(value)))];
    const referenceError = await validateTaskReferences(db, {
      workspaceId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      departmentIds,
      principalIds: (input.assignments || []).map(assignment => assignment.principalId),
      nextAction: input.nextAction,
      dependencies: input.dependencies,
    });
    if (referenceError) return { ok: false, code: "VALIDATION", message: referenceError };
    const linkedTaskIds = [input.parentTaskId, input.sourceTaskId].filter((value): value is string => Boolean(value));
    if (linkedTaskIds.length) {
      const linkedCount = await db.task.count({ where: { id: { in: linkedTaskIds }, workspaceId, deletedAt: null } });
      if (linkedCount !== new Set(linkedTaskIds).size) return { ok: false, code: "VALIDATION", message: "Choose existing work in this workspace." };
    }
    const recurrenceError = recurrenceValidationMessage(input.recurrence);
    if (recurrenceError) return { ok: false, code: "VALIDATION", message: recurrenceError };
    const organization = input.organizationId ? await db.organization.findFirst({ where: { id: input.organizationId, workspaceId } }) : undefined;
    if (organization && !actorIsOwner(actor) && !actorManagesOrganization(actor, organization.id)) return forbidden();
    if ((input.assignments || []).filter(assignment => assignment.role === "primary_owner").length > 1) return { ok: false, code: "VALIDATION", message: "Shared work needs one primary owner." };
    const assignments = await defaultTeamAssignmentForDepartments(db, workspaceId, departmentIds, input.assignments || []);
    const result = await db.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          workspaceId,
          organizationId: input.organizationId || null,
          leadDepartmentId: input.leadDepartmentId || null,
          projectId: input.projectId || null,
          parentTaskId: input.parentTaskId || null,
          sourceTaskId: input.sourceTaskId || null,
          createdByPrincipalId: actor.id,
          title,
          description: input.description?.trim() || null,
          priority: input.priority ? asDbPriority(input.priority) : TaskPriority.MEDIUM,
          status: TaskStatus.READY,
          startDate: dateOnly(input.startDate),
          targetDate: dateOnly(input.targetDate),
          deadline: dateOnly(input.deadlineDate),
          followUpDate: dateOnly(input.followUpDate),
          estimatedMinutes: input.estimatedMinutes ?? null,
          legacyLocalId: input.legacyLocalId || null,
          ...nextActionData(input.nextAction),
          involvedDepartments: {
            create: departmentIds.map((departmentId) => ({ departmentId })),
          },
          assignments: {
            create: assignments.map((assignment) => ({
              principalId: assignment.principalId,
              role: assignment.role === "primary_owner" ? AssignmentRole.PRIMARY_OWNER : AssignmentRole.COLLABORATOR,
              source: input.assignmentSource || AssignmentSource.SMART_INBOX,
              assignedByPrincipalId: actor.id,
            })),
          },
          dependencies: {
            create: (input.dependencies || []).map((dependency) => ({
              type: asDbDependencyType(dependency.type),
              label: dependency.label.trim(),
              prerequisiteTaskId: dependency.prerequisiteTaskId || null,
              ownerPrincipalId: dependency.ownerPrincipalId || null,
              ownerDepartmentId: dependency.ownerDepartmentId || null,
            })),
          },
          checklistItems: input.checklistItems?.length ? {
            create: input.checklistItems.filter(item => item.trim()).map((title, position) => ({ title: title.trim(), position })),
          } : undefined,
        },
      });
      if (input.recurrence) {
        const recurrence = await tx.taskRecurrence.create({ data: {
          workspaceId,
          frequency: asDbRecurrenceFrequency(input.recurrence.frequency),
          interval: input.recurrence.interval || 1,
          weekDays: input.recurrence.weekDays || [],
          monthDay: input.recurrence.monthDay || null,
          startDate: dateOnly(input.recurrence.startDate)!,
          endDate: dateOnly(input.recurrence.endDate),
          nextOccurrenceDate: dateOnly(input.recurrence.startDate),
        } });
        await tx.task.update({ where: { id: task.id }, data: { recurrenceId: recurrence.id } });
      }
      if (input.projectId && departmentIds.length) {
        await tx.projectInvolvedDepartment.createMany({
          data: departmentIds.map(departmentId => ({ projectId: input.projectId!, departmentId })),
          skipDuplicates: true,
        });
      }
      if (input.originalCapture?.trim()) {
        const capture = await tx.inboxCapture.create({
          data: {
            workspaceId,
            actorId: actor.id,
            rawText: input.originalCapture.trim(),
            status: CaptureStatus.CONFIRMED,
            confirmationKey: crypto.randomUUID(),
            undoExpiresAt: new Date(Date.now() + 10_000),
          },
        });
        await tx.captureTask.create({ data: { captureId: capture.id, taskId: task.id } });
      }
      await addEvent(tx, task.id, actor.id, TaskEventType.CREATED, "Created task");
      const revision = await incrementRevision(tx, workspaceId);
      return { taskId: task.id, revision: revision.revision };
    });
    const dto = await taskDtoById(result.taskId, actor.id);
    return dto ? { ok: true, data: dto, revision: result.revision } : { ok: false, code: "NOT_FOUND", message: "Task was created but could not be loaded." };
  } catch (error) {
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Could not create task." };
  }
}

export async function updateCanonicalTask(input: UpdateTaskInput): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  try {
    const db = getDb();
    const initial = await taskById(input.taskId);
    if (!initial) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
    const actor = await resolveActor(initial.workspaceId);
    if (!canManageTask(actor, initial)) return forbidden();
    if (initial.version !== input.expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere. Review the latest version before saving.", latest: toTaskDTO(initial, actor.id) };
    const resultingOrganizationId = input.organizationId === undefined ? initial.organizationId : input.organizationId;
    const resultingDepartmentIds = input.involvedDepartmentIds === undefined
      ? initial.involvedDepartments.map(({ departmentId }) => departmentId)
      : [...new Set([input.leadDepartmentId === undefined ? initial.leadDepartmentId : input.leadDepartmentId, ...input.involvedDepartmentIds].filter((value): value is string => Boolean(value)))];
    const referenceError = await validateTaskReferences(db, {
      workspaceId: initial.workspaceId,
      organizationId: resultingOrganizationId,
      projectId: input.projectId === undefined ? initial.projectId : input.projectId,
      departmentIds: resultingDepartmentIds,
      nextAction: input.nextAction,
    });
    if (referenceError) return { ok: false, code: "VALIDATION", message: referenceError };
    const changeEvents: Array<{ type: TaskEventType; summary: string; before?: Prisma.InputJsonValue; after?: Prisma.InputJsonValue }> = [];
    if (input.title !== undefined && input.title.trim() !== initial.title) changeEvents.push({ type: TaskEventType.TITLE_CHANGED, summary: `Changed title from “${initial.title}” to “${input.title.trim()}”`, before: { title: initial.title }, after: { title: input.title.trim() } });
    if (input.organizationId !== undefined && input.organizationId !== initial.organizationId) changeEvents.push({ type: TaskEventType.ORGANIZATION_CHANGED, summary: "Changed organization", before: { organizationId: initial.organizationId }, after: { organizationId: input.organizationId } });
    if (input.leadDepartmentId !== undefined && input.leadDepartmentId !== initial.leadDepartmentId) changeEvents.push({ type: TaskEventType.LEAD_DEPARTMENT_CHANGED, summary: "Changed lead area", before: { departmentId: initial.leadDepartmentId }, after: { departmentId: input.leadDepartmentId } });
    if (input.involvedDepartmentIds !== undefined) {
      const before = initial.involvedDepartments.map(item => item.departmentId).sort();
      const after = [...new Set([input.leadDepartmentId === undefined ? initial.leadDepartmentId : input.leadDepartmentId, ...input.involvedDepartmentIds].filter((value): value is string => Boolean(value)))].sort();
      if (before.join(",") !== after.join(",")) changeEvents.push({ type: TaskEventType.INVOLVED_DEPARTMENTS_CHANGED, summary: "Updated involved areas", before: { departmentIds: before }, after: { departmentIds: after } });
    }
    if (input.nextAction !== undefined) changeEvents.push({ type: TaskEventType.NEXT_ACTION_CHANGED, summary: "Changed next action", before: { nextAction: readableNextAction(initial, actor.id) }, after: { nextAction: JSON.parse(JSON.stringify(input.nextAction)) } });
    const dateChanges = [
      ["start date", input.startDate, toDateString(initial.startDate)],
      ["target date", input.targetDate, toDateString(initial.targetDate)],
      ["deadline", input.deadlineDate, toDateString(initial.deadline)],
      ["follow-up date", input.followUpDate, toDateString(initial.followUpDate)],
    ].filter(([, next, previous]) => next !== undefined && next !== previous) as Array<[string, string | null | undefined, string | undefined]>;
    for (const [label, next, previous] of dateChanges) changeEvents.push({ type: TaskEventType.DATES_CHANGED, summary: `Changed ${label} ${previous || "not set"} → ${next || "not set"}`, before: { value: previous || null }, after: { value: next || null } });
    if (input.description !== undefined && (input.description || null) !== (initial.description || null)) changeEvents.push({ type: TaskEventType.DATES_CHANGED, summary: "Updated task description" });
    if (input.priority !== undefined && asDbPriority(input.priority) !== initial.priority) changeEvents.push({ type: TaskEventType.DATES_CHANGED, summary: `Changed priority to ${input.priority}` });
    if (input.estimatedMinutes !== undefined && (input.estimatedMinutes ?? null) !== initial.estimatedMinutes) changeEvents.push({ type: TaskEventType.DATES_CHANGED, summary: input.estimatedMinutes ? `Set estimated effort to ${input.estimatedMinutes} minutes` : "Cleared estimated effort" });
    const result = await db.$transaction(async (tx) => {
      const departmentIds = input.involvedDepartmentIds
        ? [...new Set([input.leadDepartmentId === undefined ? initial.leadDepartmentId : input.leadDepartmentId, ...input.involvedDepartmentIds].filter(Boolean) as string[])]
        : undefined;
      const next = await tx.task.update({
        where: { id: initial.id },
        data: {
          title: input.title === undefined ? undefined : input.title.trim(),
          description: input.description === undefined ? undefined : input.description?.trim() || null,
          organizationId: input.organizationId === undefined ? undefined : input.organizationId,
          leadDepartmentId: input.leadDepartmentId === undefined ? undefined : input.leadDepartmentId,
          projectId: input.projectId === undefined ? undefined : input.projectId,
          priority: input.priority ? asDbPriority(input.priority) : undefined,
          startDate: input.startDate === undefined ? undefined : dateOnly(input.startDate),
          targetDate: input.targetDate === undefined ? undefined : dateOnly(input.targetDate),
          deadline: input.deadlineDate === undefined ? undefined : dateOnly(input.deadlineDate),
          followUpDate: input.followUpDate === undefined ? undefined : dateOnly(input.followUpDate),
          estimatedMinutes: input.estimatedMinutes === undefined ? undefined : input.estimatedMinutes,
          ...nextActionData(input.nextAction),
          version: { increment: 1 },
          involvedDepartments: departmentIds ? { deleteMany: {}, create: departmentIds.map((departmentId) => ({ departmentId })) } : undefined,
        },
      });
      if (changeEvents.length) {
        for (const event of changeEvents) await addEvent(tx, next.id, actor.id, event.type, event.summary, event.before, event.after);
      }
      const revision = await incrementRevision(tx, initial.workspaceId);
      return revision.revision;
    });
    const dto = await taskDtoById(initial.id, actor.id);
    return dto ? { ok: true, data: dto, revision: result } : { ok: false, code: "NOT_FOUND", message: "Task not found after update." };
  } catch (error) {
    return { ok: false, code: "VALIDATION", message: error instanceof Error ? error.message : "Could not update task." };
  }
}

export async function setCanonicalAssignments(taskId: string, expectedVersion: number, assignments: AssignmentInput[]): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  if (assignments.filter((assignment) => assignment.role === "primary_owner").length > 1) return { ok: false, code: "VALIDATION", message: "Shared work needs one primary owner." };
  const principalIds = assignments.map((assignment) => assignment.principalId);
  if (new Set(principalIds).size !== principalIds.length) return { ok: false, code: "VALIDATION", message: "Add each person or team only once." };
  const validPrincipals = await db.principal.count({ where: { workspaceId: task.workspaceId, active: true, id: { in: principalIds } } });
  if (validPrincipals !== principalIds.length) return { ok: false, code: "VALIDATION", message: "One or more assignees are not active in this workspace." };
  const existingAssignments = new Map(task.assignments.map((assignment) => [assignment.principalId, assignment]));
  const removedPrincipalIds = task.assignments.map((assignment) => assignment.principalId).filter((principalId) => !principalIds.includes(principalId));
  const addedAssignments = assignments.filter((assignment) => !existingAssignments.has(assignment.principalId));
  const retainedAssignments = assignments.filter((assignment) => existingAssignments.has(assignment.principalId));
  const revision = await db.$transaction(async (tx) => {
    if (removedPrincipalIds.length) await tx.taskAssignment.deleteMany({ where: { taskId, principalId: { in: removedPrincipalIds } } });
    for (const assignment of addedAssignments) {
      await tx.taskAssignment.create({
        data: {
          taskId,
          principalId: assignment.principalId,
          role: assignment.role === "primary_owner" ? AssignmentRole.PRIMARY_OWNER : AssignmentRole.COLLABORATOR,
          source: AssignmentSource.MANUAL,
          assignedByPrincipalId: actor.id,
        },
      });
    }
    for (const assignment of retainedAssignments) {
      await tx.taskAssignment.update({
        where: { taskId_principalId: { taskId, principalId: assignment.principalId } },
        data: { role: assignment.role === "primary_owner" ? AssignmentRole.PRIMARY_OWNER : AssignmentRole.COLLABORATOR },
      });
    }
    const primaryOwner = assignments.find((assignment) => assignment.role === "primary_owner");
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 }, ...(task.nextActionPrincipalId && !assignments.some((assignment) => assignment.principalId === task.nextActionPrincipalId) ? nextActionData(primaryOwner ? { kind: "principal", principalId: primaryOwner.principalId } : { kind: "ready" }) : {}) } });
    await addEvent(
      tx,
      taskId,
      actor.id,
      TaskEventType.ASSIGNED,
      assignments.length ? "Updated task assignees" : "Cleared task assignees",
      { assignments: task.assignments.map((assignment) => ({ principalId: assignment.principalId, role: assignmentRole(assignment.role) })) },
      { assignments: assignments.map((assignment) => ({ principalId: assignment.principalId, role: assignment.role })) },
    );
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after assignment." };
}

export async function claimCanonicalTask(taskId: string, expectedVersion: number, teamId?: string): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const queueAssignment = task.assignments.find((assignment) => assignment.principal.type === PrincipalType.TEAM && (!teamId || assignment.principalId === teamId));
  if (!queueAssignment) return { ok: false, code: "VALIDATION", message: "Choose an assigned team queue to claim." };
  const belongsToTeam = actor.teamIds.includes(queueAssignment.principalId);
  if (!canManageTask(actor, task) && !belongsToTeam) return forbidden("You can only claim work from a team you belong to.");
  const revision = await db.$transaction(async (tx) => {
    await tx.taskAssignment.updateMany({ where: { taskId, role: AssignmentRole.PRIMARY_OWNER }, data: { role: AssignmentRole.COLLABORATOR } });
    await tx.taskAssignment.upsert({
      where: { taskId_principalId: { taskId, principalId: actor.id } },
      create: { taskId, principalId: actor.id, role: AssignmentRole.PRIMARY_OWNER, source: AssignmentSource.CLAIM, assignedByPrincipalId: actor.id, claimedFromAssignmentId: queueAssignment.id },
      update: { role: AssignmentRole.PRIMARY_OWNER, source: AssignmentSource.CLAIM, assignedByPrincipalId: actor.id, claimedFromAssignmentId: queueAssignment.id },
    });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 }, ...nextActionData({ kind: "principal", principalId: actor.id }) } });
    await addEvent(tx, taskId, actor.id, TaskEventType.CLAIMED, `${actor.name} claimed task from ${queueAssignment.principal.name}`);
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after claim." };
}

export async function transitionCanonicalTask(taskId: string, expectedVersion: number, status: TaskStatusValue, blocker?: DependencyInput): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const dbStatus = asDbStatus(status);
  const unresolvedStartBlockers = task.dependencies.filter((dependency) => dependency.type === DependencyType.START_BLOCKER && !dependency.resolvedAt);
  const unresolvedCompletionBlockers = task.dependencies.filter((dependency) => dependency.type === DependencyType.COMPLETION_BLOCKER && !dependency.resolvedAt);
  const transitionBlockReason = taskTransitionBlockReason({ targetStatus: status, unresolvedStartBlockers: unresolvedStartBlockers.length, unresolvedCompletionBlockers: unresolvedCompletionBlockers.length });
  if (transitionBlockReason) return { ok: false, code: "DEPENDENCY", message: transitionBlockReason };
  // Waiting is only meaningful when Binnie knows who (or what) is expected to
  // move next.  Rejecting an unassigned transition prevents another
  // “Next action by: Ready” record from entering the canonical task store.
  if (dbStatus === TaskStatus.WAITING && task.nextActionKind === NextActionKind.READY) {
    return { ok: false, code: "VALIDATION", message: "Set Next Action By before marking this task as Waiting." };
  }
  const revision = await db.$transaction(async (tx) => {
    if (dbStatus === TaskStatus.BLOCKED && blocker) {
      await tx.taskDependency.create({ data: { taskId, type: DependencyType.START_BLOCKER, label: blocker.label.trim() || "A dependency", prerequisiteTaskId: blocker.prerequisiteTaskId || null, ownerPrincipalId: blocker.ownerPrincipalId || null, ownerDepartmentId: blocker.ownerDepartmentId || null } });
    }
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: dbStatus,
        waitingSince: dbStatus === TaskStatus.WAITING ? new Date() : null,
        completedAt: dbStatus === TaskStatus.DONE ? new Date() : null,
        version: { increment: 1 },
        ...((dbStatus === TaskStatus.DONE || dbStatus === TaskStatus.READY) ? nextActionData({ kind: "ready" }) : {}),
      },
    });
    await addEvent(tx, taskId, actor.id, taskEventForStatus(dbStatus), dbStatus === TaskStatus.BLOCKED ? "Marked blocked by a real dependency" : `Moved to ${statusLabel(dbStatus)}`);
    if (dbStatus === TaskStatus.DONE) await applyCompletionEffects(tx, task, actor.id);
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after status change." };
}

export async function addCanonicalTaskUpdate(taskId: string, expectedVersion: number, text: string): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canViewTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const message = text.trim();
  if (!message) return { ok: false, code: "VALIDATION", message: "Write an update before posting it." };
  const revision = await db.$transaction(async (tx) => {
    await tx.taskUpdate.create({ data: { taskId, authorId: actor.id, text: message } });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.UPDATE_POSTED, "Posted an update");
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after posting update." };
}

export async function addCanonicalTaskLink(taskId: string, expectedVersion: number, url: string, label?: string): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, code: "VALIDATION", message: "Add a valid link." };
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) return { ok: false, code: "VALIDATION", message: "Only web links can be attached." };
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canViewTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const revision = await db.$transaction(async (tx) => {
    await tx.taskResource.create({ data: { scope: "TASK", taskId, label: label?.trim().slice(0, 500) || parsedUrl.hostname, url: parsedUrl.toString() } });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.UPDATE_POSTED, "Attached a link");
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after attaching link." };
}

export async function addCanonicalTaskFile(taskId: string, expectedVersion: number, file: { name: string; type: string; bytes: Uint8Array<ArrayBuffer> }): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  if (!file.name.trim() || file.bytes.byteLength > 5 * 1024 * 1024) return { ok: false, code: "VALIDATION", message: "Files must be named and no larger than 5 MB." };
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canViewTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const revision = await db.$transaction(async (tx) => {
    await tx.taskResource.create({ data: { scope: "TASK", taskId, label: file.name.trim().slice(0, 500), fileName: file.name.trim().slice(0, 500), mimeType: file.type.slice(0, 200) || "application/octet-stream", byteSize: file.bytes.byteLength, content: file.bytes } });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.UPDATE_POSTED, "Attached a file");
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after attaching file." };
}

/** Attach supporting evidence to a specific progress update without changing its status. */
export async function addCanonicalTaskUpdateFile(taskId: string, updateId: string, expectedVersion: number, file: { name: string; type: string; bytes: Uint8Array<ArrayBuffer> }): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  if (!file.name.trim() || file.bytes.byteLength > 5 * 1024 * 1024) return { ok: false, code: "VALIDATION", message: "Files must be named and no larger than 5 MB." };
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canViewTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere. Review the latest version before attaching a file.", latest: toTaskDTO(task, actor.id) };
  const update = task.updates.find(candidate => candidate.id === updateId);
  if (!update) return { ok: false, code: "NOT_FOUND", message: "Work update not found on this task." };
  if (update.authorId !== actor.id && !canManageTask(actor, task)) return forbidden("Only the update author or an authorized manager can attach a file here.");
  const revision = await db.$transaction(async tx => {
    await tx.taskResource.create({
      data: {
        scope: ResourceScope.TASK,
        taskId,
        updateId,
        label: file.name.trim().slice(0, 500),
        fileName: file.name.trim().slice(0, 500),
        mimeType: file.type.slice(0, 200) || "application/octet-stream",
        byteSize: file.bytes.byteLength,
        content: file.bytes,
      },
    });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.UPDATE_POSTED, "Attached a file to a work update");
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after attaching update file." };
}

export async function archiveCanonicalTask(taskId: string, expectedVersion: number): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const revision = await getDb().$transaction(async tx => {
    await tx.task.update({ where: { id: taskId }, data: { archivedAt: new Date(), version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.ARCHIVED, "Archived task");
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after archiving." };
}

export async function addCanonicalTaskDependency(taskId: string, expectedVersion: number, dependency: DependencyInput): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const referenceError = await validateTaskReferences(db, { workspaceId: task.workspaceId, dependencies: [dependency], taskId });
  if (referenceError) return { ok: false, code: "VALIDATION", message: referenceError };
  const revision = await db.$transaction(async tx => {
    await tx.taskDependency.create({ data: { taskId, type: asDbDependencyType(dependency.type), label: dependency.label.trim(), prerequisiteTaskId: dependency.prerequisiteTaskId || null, ownerPrincipalId: dependency.ownerPrincipalId || null, ownerDepartmentId: dependency.ownerDepartmentId || null } });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.DEPENDENCY_CHANGED, `Added ${dependency.type.replace("_", " ")} — ${dependency.label.trim()}`);
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after adding dependency." };
}

export async function resolveCanonicalTaskDependency(taskId: string, expectedVersion: number, dependencyId: string, resolved: boolean): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  if (!task.dependencies.some(dependency => dependency.id === dependencyId)) return { ok: false, code: "NOT_FOUND", message: "Dependency not found on this task." };
  const revision = await db.$transaction(async tx => {
    await tx.taskDependency.update({ where: { id: dependencyId }, data: { resolvedAt: resolved ? new Date() : null } });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.DEPENDENCY_CHANGED, resolved ? "Resolved a dependency" : "Reopened a dependency");
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after changing dependency." };
}

export async function removeCanonicalTaskDependency(taskId: string, expectedVersion: number, dependencyId: string): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  if (!task.dependencies.some(dependency => dependency.id === dependencyId)) return { ok: false, code: "NOT_FOUND", message: "Dependency not found on this task." };
  const revision = await db.$transaction(async tx => {
    await tx.taskDependency.delete({ where: { id: dependencyId } });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.DEPENDENCY_CHANGED, "Removed a dependency");
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after removing dependency." };
}

export async function addCanonicalChecklistItem(taskId: string, expectedVersion: number, title: string): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const itemTitle = title.trim();
  if (!itemTitle) return { ok: false, code: "VALIDATION", message: "Add a completion item first." };
  const revision = await db.$transaction(async tx => {
    await tx.taskChecklistItem.create({ data: { taskId, title: itemTitle, position: task.checklistItems.length } });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.UPDATE_POSTED, `Added completion item — ${itemTitle}`);
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after adding completion item." };
}

export async function toggleCanonicalChecklistItem(taskId: string, expectedVersion: number, itemId: string, completed: boolean): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const item = task.checklistItems.find(candidate => candidate.id === itemId);
  if (!item) return { ok: false, code: "NOT_FOUND", message: "Completion item not found." };
  const revision = await db.$transaction(async tx => {
    await tx.taskChecklistItem.update({ where: { id: itemId }, data: completed ? { completedAt: new Date(), completedByPrincipalId: actor.id } : { completedAt: null, completedByPrincipalId: null } });
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.UPDATE_POSTED, `${completed ? "Completed" : "Reopened"} completion item — ${item.title}`);
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after updating completion item." };
}

export async function setCanonicalTaskRecurrence(taskId: string, expectedVersion: number, recurrence?: RecurrenceInput): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const recurrenceError = recurrenceValidationMessage(recurrence);
  if (recurrenceError) return { ok: false, code: "VALIDATION", message: recurrenceError };
  const revision = await db.$transaction(async tx => {
    if (recurrence) {
      const recurrenceData = { frequency: asDbRecurrenceFrequency(recurrence.frequency), interval: recurrence.interval || 1, weekDays: recurrence.weekDays || [], monthDay: recurrence.monthDay || null, startDate: dateOnly(recurrence.startDate)!, endDate: dateOnly(recurrence.endDate), nextOccurrenceDate: dateOnly(recurrence.startDate), active: true };
      if (task.recurrenceId) await tx.taskRecurrence.update({ where: { id: task.recurrenceId }, data: recurrenceData });
      else {
        const record = await tx.taskRecurrence.create({ data: { workspaceId: task.workspaceId, ...recurrenceData } });
        await tx.task.update({ where: { id: taskId }, data: { recurrenceId: record.id } });
      }
    } else if (task.recurrenceId) {
      await tx.taskRecurrence.update({ where: { id: task.recurrenceId }, data: { active: false, nextOccurrenceDate: null } });
    }
    await tx.task.update({ where: { id: taskId }, data: { version: { increment: 1 } } });
    await addEvent(tx, taskId, actor.id, TaskEventType.UPDATE_POSTED, recurrence ? "Updated recurring schedule" : "Stopped recurring schedule");
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after updating recurrence." };
}

export async function createCanonicalSubtask(parentTaskId: string, input: Omit<CreateTaskInput, "parentTaskId" | "workspaceId">): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const parent = await taskById(parentTaskId);
  if (!parent) return { ok: false, code: "NOT_FOUND", message: "Parent task not found." };
  const actor = await resolveActor(parent.workspaceId);
  if (!canManageTask(actor, parent)) return forbidden();
  const result = await createCanonicalTask({
    ...input,
    workspaceId: parent.workspaceId,
    parentTaskId,
    organizationId: input.organizationId || parent.organizationId || undefined,
    projectId: input.projectId || parent.projectId || undefined,
    leadDepartmentId: input.leadDepartmentId || parent.leadDepartmentId || undefined,
    involvedDepartmentIds: input.involvedDepartmentIds || parent.involvedDepartments.map(item => item.departmentId),
    assignmentSource: AssignmentSource.MANUAL,
  });
  if (!result.ok) return result;
  await getDb().$transaction(async tx => {
    await addEvent(tx, parentTaskId, actor.id, TaskEventType.UPDATE_POSTED, `Added subtask — ${result.data.title}`);
    await incrementRevision(tx, parent.workspaceId);
  });
  return result;
}

export async function mergeCanonicalTasks(
  survivorId: string,
  expectedVersion: number,
  sourceTaskIds: string[],
  title?: string,
  dateResolution?: { startDate?: "survivor" | "source" | "clear"; targetDate?: "survivor" | "source" | "clear"; deadlineDate?: "survivor" | "source" | "clear"; followUpDate?: "survivor" | "source" | "clear" },
): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const survivor = await taskById(survivorId);
  if (!survivor) return { ok: false, code: "NOT_FOUND", message: "Choose the task that should remain." };
  const actor = await resolveActor(survivor.workspaceId);
  if (!canManageTask(actor, survivor)) return forbidden();
  if (survivor.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(survivor, actor.id) };
  const uniqueSources = [...new Set(sourceTaskIds.filter(id => id !== survivorId))];
  if (!uniqueSources.length) return { ok: false, code: "VALIDATION", message: "Choose at least one other task to merge." };
  const sources = await db.task.findMany({ where: { id: { in: uniqueSources }, workspaceId: survivor.workspaceId, archivedAt: null, deletedAt: null }, include: taskInclude });
  if (sources.length !== uniqueSources.length || sources.some(source => !canManageTask(actor, source))) return forbidden("You can only merge active work you are allowed to manage.");
  const preferredSource = uniqueSources.map(id => sources.find(source => source.id === id)).find((source): source is typeof sources[number] => Boolean(source)) || survivor;
  const resolvedDates = dateResolution ? {
    startDate: dateResolution.startDate === "source" ? preferredSource.startDate : dateResolution.startDate === "clear" ? null : survivor.startDate,
    targetDate: dateResolution.targetDate === "source" ? preferredSource.targetDate : dateResolution.targetDate === "clear" ? null : survivor.targetDate,
    deadline: dateResolution.deadlineDate === "source" ? preferredSource.deadline : dateResolution.deadlineDate === "clear" ? null : survivor.deadline,
    followUpDate: dateResolution.followUpDate === "source" ? preferredSource.followUpDate : dateResolution.followUpDate === "clear" ? null : survivor.followUpDate,
  } : {};
  const revision = await db.$transaction(async tx => {
    const assignmentData = sources.flatMap(source => source.assignments.map(assignment => ({ taskId: survivorId, principalId: assignment.principalId, role: assignment.role, source: AssignmentSource.MANUAL, assignedByPrincipalId: actor.id })));
    const departmentData = sources.flatMap(source => source.involvedDepartments.map(item => ({ taskId: survivorId, departmentId: item.departmentId })));
    if (assignmentData.length) await tx.taskAssignment.createMany({ data: assignmentData, skipDuplicates: true });
    if (departmentData.length) await tx.taskInvolvedDepartment.createMany({ data: departmentData, skipDuplicates: true });
    await tx.taskResource.updateMany({ where: { taskId: { in: uniqueSources } }, data: { taskId: survivorId } });
    await tx.taskUpdate.updateMany({ where: { taskId: { in: uniqueSources } }, data: { taskId: survivorId } });
    await tx.taskDependency.updateMany({ where: { taskId: { in: uniqueSources }, prerequisiteTaskId: { not: survivorId } }, data: { taskId: survivorId } });
    // A task that depended on a merged source now depends on the surviving task.
    // Dependencies owned by the survivor itself would become self-dependencies,
    // so they are no longer meaningful and must be removed.
    await tx.taskDependency.deleteMany({ where: { taskId: survivorId, prerequisiteTaskId: { in: uniqueSources } } });
    await tx.taskDependency.updateMany({ where: { taskId: { not: survivorId }, prerequisiteTaskId: { in: uniqueSources } }, data: { prerequisiteTaskId: survivorId } });
    const combinedDescription = [survivor.description, ...sources.map(source => source.description)].filter((value): value is string => Boolean(value?.trim())).join("\n\n");
    await tx.task.update({ where: { id: survivorId }, data: { title: title?.trim() || survivor.title, description: combinedDescription || null, ...resolvedDates, version: { increment: 1 } } });
    await tx.task.updateMany({ where: { id: { in: uniqueSources } }, data: { archivedAt: new Date(), mergedIntoTaskId: survivorId, version: { increment: 1 } } });
    for (const source of sources) await addEvent(tx, source.id, actor.id, TaskEventType.ARCHIVED, `Merged into “${title?.trim() || survivor.title}”`);
    await addEvent(tx, survivorId, actor.id, TaskEventType.UPDATE_POSTED, `Merged ${sources.length} task${sources.length === 1 ? "" : "s"} into this task`);
    return (await incrementRevision(tx, survivor.workspaceId)).revision;
  });
  const dto = await taskDtoById(survivorId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after merging." };
}

export async function splitCanonicalTask(taskId: string, expectedVersion: number, titles: string[]): Promise<ActionResult<TaskDTO[]>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const original = await taskById(taskId);
  if (!original) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(original.workspaceId);
  if (!canManageTask(actor, original)) return forbidden();
  if (original.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere." };
  const pieces = titles.map(title => title.trim()).filter(Boolean).slice(0, 12);
  if (pieces.length < 2) return { ok: false, code: "VALIDATION", message: "Add at least two distinct pieces of work." };
  const created = await db.$transaction(async tx => {
    const createdTasks = [];
    for (const title of pieces) {
      const task = await tx.task.create({ data: {
        workspaceId: original.workspaceId, organizationId: original.organizationId, leadDepartmentId: original.leadDepartmentId, projectId: original.projectId, sourceTaskId: original.id, createdByPrincipalId: actor.id,
        title, description: original.description, priority: original.priority, status: TaskStatus.READY, startDate: original.startDate, targetDate: original.targetDate, deadline: original.deadline, followUpDate: original.followUpDate,
        ...nextActionData({ kind: "ready" }),
        involvedDepartments: { create: original.involvedDepartments.map(item => ({ departmentId: item.departmentId })) },
        assignments: { create: original.assignments.map(assignment => ({ principalId: assignment.principalId, role: assignment.role, source: AssignmentSource.MANUAL, assignedByPrincipalId: actor.id })) },
        events: { create: { actorId: actor.id, type: TaskEventType.CREATED, summary: `Created by splitting “${original.title}”` } },
      } });
      createdTasks.push(task);
    }
    await tx.task.update({ where: { id: original.id }, data: { archivedAt: new Date(), version: { increment: 1 } } });
    await addEvent(tx, original.id, actor.id, TaskEventType.ARCHIVED, `Split into ${pieces.length} tasks`);
    const revision = await incrementRevision(tx, original.workspaceId);
    return { ids: createdTasks.map(task => task.id), revision: revision.revision };
  });
  const dtos = (await Promise.all(created.ids.map(id => taskDtoById(id, actor.id)))).filter((task): task is TaskDTO => Boolean(task));
  return { ok: true, data: dtos, revision: created.revision };
}

export async function saveCanonicalView(name: string, filters: Record<string, unknown>, workspaceId = DEFAULT_WORKSPACE_ID): Promise<ActionResult<SavedViewDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const actor = await resolveActor(workspaceId);
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, code: "VALIDATION", message: "Name this view before saving it." };
  const record = await db.savedView.upsert({ where: { workspaceId_name: { workspaceId, name: cleanName } }, create: { workspaceId, ownerId: actor.id, name: cleanName, filters: filters as Prisma.InputJsonValue }, update: { ownerId: actor.id, filters: filters as Prisma.InputJsonValue } });
  const revision = await db.$transaction(tx => incrementRevision(tx, workspaceId));
  return { ok: true, data: { id: record.id, name: record.name, filters: record.filters as Record<string, unknown>, ownerId: record.ownerId || undefined }, revision: revision.revision };
}

export async function deleteCanonicalView(viewId: string, workspaceId = DEFAULT_WORKSPACE_ID): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const actor = await resolveActor(workspaceId);
  const view = await db.savedView.findFirst({ where: { id: viewId, workspaceId } });
  if (!view) return { ok: false, code: "NOT_FOUND", message: "Saved view not found." };
  if (view.ownerId && view.ownerId !== actor.id && !actorIsOwner(actor)) return forbidden("Only the view owner can remove this saved view.");
  await db.$transaction(async tx => { await tx.savedView.delete({ where: { id: viewId } }); await incrementRevision(tx, workspaceId); });
  return { ok: true, data: { id: viewId } };
}

export async function saveCaptureForManualOrganization(rawText: string, workspaceId = DEFAULT_WORKSPACE_ID): Promise<ActionResult<{ capture: InboxCaptureDTO }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const text = rawText.trim();
  if (!text) return { ok: false, code: "VALIDATION", message: "Write something for Binnie to keep." };
  const db = getDb();
  const actor = await resolveActor(workspaceId);
  const result = await db.$transaction(async tx => {
    const capture = await tx.inboxCapture.create({ data: { workspaceId, actorId: actor.id, rawText: text, status: CaptureStatus.NEEDS_ORGANIZATION } });
    const revision = await incrementRevision(tx, workspaceId);
    return { capture, revision: revision.revision };
  });
  return {
    ok: true,
    data: {
      capture: {
        id: result.capture.id,
        rawText: result.capture.rawText,
        status: "needs_organization",
        createdAt: result.capture.createdAt.toISOString(),
      },
    },
    revision: result.revision,
  };
}

/** Marks a retained raw thought as handled only after the user has organized it. */
export async function resolveCanonicalInboxCapture(captureId: string, workspaceId = DEFAULT_WORKSPACE_ID): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const actor = await resolveActor(workspaceId);
  const capture = await db.inboxCapture.findFirst({ where: { id: captureId, workspaceId } });
  if (!capture) return { ok: false, code: "NOT_FOUND", message: "Saved Inbox item not found." };
  if (capture.actorId !== actor.id && !actorIsOwner(actor)) return forbidden("Only the person who saved this Inbox item can mark it organized.");
  const revision = await db.$transaction(async tx => {
    await tx.inboxCapture.update({ where: { id: captureId }, data: { status: CaptureStatus.CONFIRMED } });
    return (await incrementRevision(tx, workspaceId)).revision;
  });
  return { ok: true, data: { id: captureId }, revision };
}

export async function getAuthorizedTaskResource(resourceId: string) {
  if (!hasDatabaseConfiguration()) return undefined;
  const resource = await getDb().taskResource.findUnique({
    where: { id: resourceId },
    include: {
      task: { include: taskInclude },
      project: { include: projectInclude },
      organization: { select: { id: true, workspaceId: true } },
    },
  });
  if (!resource?.content) return undefined;
  if (resource.task) {
    const actor = await resolveActor(resource.task.workspaceId);
    return canViewTask(actor, resource.task) ? resource : undefined;
  }
  if (resource.project) {
    const actor = await resolveActor(resource.project.workspaceId);
    return canViewProject(actor, resource.project) ? resource : undefined;
  }
  if (resource.organization) {
    const actor = await resolveActor(resource.organization.workspaceId);
    return actorIsOwner(actor) || actorManagesOrganization(actor, resource.organization.id) ? resource : undefined;
  }
  return undefined;
}

export async function submitCanonicalTaskForReview(taskId: string, expectedVersion: number, reviewerId: string): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (!canManageTask(actor, task)) return forbidden();
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  if (task.status !== TaskStatus.IN_PROGRESS) return { ok: false, code: "VALIDATION", message: "Only work in progress can be submitted for review." };
  const reviewer = await db.principal.findFirst({ where: { id: reviewerId, workspaceId: task.workspaceId, active: true } });
  if (!reviewer) return { ok: false, code: "VALIDATION", message: "Choose a real reviewer from this workspace." };
  const revision = await db.$transaction(async (tx) => {
    await tx.taskReviewCycle.create({ data: { taskId, submittedByPrincipalId: actor.id, reviewerPrincipalId: reviewer.id } });
    await tx.task.update({ where: { id: taskId }, data: { status: TaskStatus.REVIEW, version: { increment: 1 }, ...nextActionData({ kind: "principal", principalId: reviewer.id }) } });
    await addEvent(tx, taskId, actor.id, TaskEventType.REVIEW_SUBMITTED, `Submitted for review to ${reviewer.name}`);
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after submission." };
}

export async function decideCanonicalReview(taskId: string, expectedVersion: number, approve: boolean, revisionNote?: string): Promise<ActionResult<TaskDTO>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const task = await taskById(taskId);
  if (!task) return { ok: false, code: "NOT_FOUND", message: "Task not found." };
  const actor = await resolveActor(task.workspaceId);
  if (task.version !== expectedVersion) return { ok: false, code: "CONFLICT", message: "This task changed elsewhere.", latest: toTaskDTO(task, actor.id) };
  const review = task.reviewCycles[0];
  if (!review || task.status !== TaskStatus.REVIEW) return { ok: false, code: "VALIDATION", message: "This task is not waiting for review." };
  if (review.reviewerPrincipalId !== actor.id && !canManageTask(actor, task)) return forbidden("Only the selected reviewer or an authorized manager can decide this review.");
  if (!approve && !revisionNote?.trim()) return { ok: false, code: "VALIDATION", message: "Explain what needs revision before sending work back." };
  if (approve && task.dependencies.some((dependency) => dependency.type === DependencyType.COMPLETION_BLOCKER && !dependency.resolvedAt)) return { ok: false, code: "DEPENDENCY", message: "Final approval is waiting on a completion dependency." };
  const revision = await db.$transaction(async (tx) => {
    await tx.taskReviewCycle.update({ where: { id: review.id }, data: { reviewedByPrincipalId: actor.id, reviewedAt: new Date(), decision: approve ? ReviewDecision.APPROVED : ReviewDecision.REVISION_REQUESTED, revisionNote: approve ? null : revisionNote!.trim() } });
    const owner = task.assignments.find((assignment) => assignment.role === AssignmentRole.PRIMARY_OWNER);
    await tx.task.update({
      where: { id: taskId },
      data: approve
        ? { status: TaskStatus.DONE, completedAt: new Date(), version: { increment: 1 }, ...nextActionData({ kind: "ready" }) }
        : { status: TaskStatus.IN_PROGRESS, version: { increment: 1 }, ...nextActionData(owner ? { kind: "principal", principalId: owner.principalId } : { kind: "ready" }) },
    });
    if (approve) await applyCompletionEffects(tx, task, actor.id);
    await addEvent(tx, taskId, actor.id, approve ? TaskEventType.REVIEW_APPROVED : TaskEventType.REVISION_REQUESTED, approve ? "Approved review and completed task" : "Requested revision", undefined, approve ? undefined : { revisionNote: revisionNote!.trim() });
    return (await incrementRevision(tx, task.workspaceId)).revision;
  });
  const dto = await taskDtoById(taskId, actor.id);
  return dto ? { ok: true, data: dto, revision } : { ok: false, code: "NOT_FOUND", message: "Task not found after review decision." };
}

export async function undoCapturedTasks(taskIds: string[]): Promise<ActionResult<{ deletedTaskIds: string[] }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  if (!taskIds.length) return { ok: false, code: "VALIDATION", message: "There is nothing to undo." };
  const db = getDb();
  const tasks = await db.task.findMany({ where: { id: { in: taskIds }, deletedAt: null }, include: taskInclude });
  if (tasks.length !== taskIds.length) return { ok: false, code: "NOT_FOUND", message: "One or more new tasks no longer exist." };
  const actor = await resolveActor(tasks[0].workspaceId);
  if (tasks.some((task) => task.workspaceId !== actor.workspaceId || task.createdByPrincipalId !== actor.id)) return forbidden("Only the person who captured this work can undo it.");
  const now = new Date();
  const unsafeTask = tasks.find((task) => {
    const capture = task.captureLinks[0]?.capture;
    const changedAfterCapture = task.events.some((event) => event.type !== TaskEventType.CREATED);
    return !capture || capture.status !== CaptureStatus.CONFIRMED || !capture.undoExpiresAt || capture.undoExpiresAt <= now || changedAfterCapture;
  });
  if (unsafeTask) return { ok: false, code: "CONFLICT", message: "This work has changed or the undo window has expired, so Binnie kept it safely." };
  const revision = await db.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { id: { in: taskIds } }, data: { deletedAt: now, version: { increment: 1 } } });
    await tx.inboxCapture.updateMany({ where: { id: { in: tasks.map((task) => task.captureLinks[0]!.captureId) } }, data: { status: CaptureStatus.UNDONE } });
    await tx.taskEvent.createMany({ data: taskIds.map((taskId) => ({ taskId, actorId: actor.id, type: TaskEventType.ARCHIVED, summary: "Undid Smart Inbox capture" })) });
    return (await incrementRevision(tx, actor.workspaceId)).revision;
  });
  return { ok: true, data: { deletedTaskIds: taskIds }, revision };
}

/** Explicit, idempotent migration path for the prototype's browser-only task store. */
export async function importLegacyTasks(fingerprint: string, tasks: LegacyTaskImportInput[]): Promise<ActionResult<{ importedCount: number; skippedDuplicateCount?: number }>> {
  if (!hasDatabaseConfiguration()) return configuration();
  const db = getDb();
  const workspaceId = DEFAULT_WORKSPACE_ID;
  const existingImport = await db.legacyImport.findUnique({ where: { workspaceId_fingerprint: { workspaceId, fingerprint } } });
  if (existingImport) return { ok: true, data: { importedCount: existingImport.importedCount } };
  const actor = await resolveActor(workspaceId);
  if (!actorIsOwner(actor)) return forbidden("Only a workspace owner can import browser-local tasks.");
  const existingTasks = await db.task.findMany({
    where: { workspaceId, deletedAt: null },
    select: {
      legacyLocalId: true,
      title: true,
      organizationId: true,
      projectId: true,
      startDate: true,
      targetDate: true,
      deadline: true,
      assignments: { select: { principalId: true } },
    },
  });
  const importedLegacyIds = new Set(existingTasks.map(task => task.legacyLocalId).filter((id): id is string => Boolean(id)));
  const duplicateKeys = new Set(existingTasks.map(task => legacyImportDuplicateKey({
    title: task.title,
    organizationId: task.organizationId || undefined,
    projectId: task.projectId || undefined,
    startDate: toDateString(task.startDate),
    targetDate: toDateString(task.targetDate),
    deadlineDate: toDateString(task.deadline),
    assignments: task.assignments.map(assignment => ({ principalId: assignment.principalId, role: "collaborator" as const })),
  })));
  let importedCount = 0;
  let skippedDuplicateCount = 0;
  for (const task of tasks) {
    if (importedLegacyIds.has(task.legacyLocalId)) continue;
    const duplicateKey = legacyImportDuplicateKey(task);
    if (duplicateKeys.has(duplicateKey)) {
      skippedDuplicateCount += 1;
      continue;
    }
    const created = await createCanonicalTask({ ...task, workspaceId, legacyLocalId: task.legacyLocalId, originalCapture: undefined, assignmentSource: AssignmentSource.IMPORT });
    if (!created.ok) return created;
    importedCount += 1;
    importedLegacyIds.add(task.legacyLocalId);
    duplicateKeys.add(duplicateKey);
    const importedStatus = task.status;
    if (importedStatus && importedStatus !== "ready" && importedStatus !== "review") {
      const moved = await transitionCanonicalTask(created.data.id, created.data.version, importedStatus);
      if (!moved.ok) return moved;
    }
  }
  const revision = await db.$transaction(async (tx) => {
    await tx.legacyImport.create({ data: { workspaceId, fingerprint, importedCount } });
    return (await incrementRevision(tx, workspaceId)).revision;
  });
  return { ok: true, data: { importedCount, skippedDuplicateCount }, revision };
}
