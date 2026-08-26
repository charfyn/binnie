"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addCanonicalTaskFile,
  addCanonicalTaskUpdateFile,
  addCanonicalChecklistItem,
  addCanonicalTaskDependency,
  addCanonicalTaskLink,
  addCanonicalProjectFocusItem,
  addCanonicalProjectLink,
  addCanonicalProjectFile,
  addCanonicalOrganizationLink,
  addCanonicalOrganizationFile,
  addCanonicalProjectMilestone,
  deleteCanonicalProjectFocusItem,
  deleteCanonicalProjectResource,
  deleteCanonicalOrganizationResource,
  updateCanonicalOrganizationVocabulary,
  updateCanonicalProjectMilestone,
  updateCanonicalProjectFocusItem,
  deleteCanonicalProjectMilestone,
  addCanonicalTaskUpdate,
  applyCanonicalWorkflowTemplate,
  archiveCanonicalWorkflowTemplate,
  claimCanonicalTask,
  createCanonicalSubtask,
  createCanonicalTask,
  createCanonicalWorkflowTemplate,
  updateCanonicalWorkflowTemplate,
  createCanonicalProject,
  deleteCanonicalProject,
  archiveCanonicalProject,
  createCanonicalOrganization,
  resetCanonicalDemoData,
  createCanonicalPrincipal,
  updateCanonicalProfile,
  updateCanonicalPrincipal,
  decideCanonicalReview,
  deleteCanonicalView,
  importLegacyTasks,
  mergeCanonicalTasks,
  archiveCanonicalTask,
  removeCanonicalTaskDependency,
  resolveCanonicalTaskDependency,
  resolveCanonicalInboxCapture,
  saveCanonicalView,
  saveCaptureForManualOrganization,
  setCanonicalTaskRecurrence,
  setCanonicalAssignments,
  setCanonicalNudgeState,
  setCanonicalProjectMembers,
  submitCanonicalTaskForReview,
  transitionCanonicalTask,
  splitCanonicalTask,
  toggleCanonicalChecklistItem,
  undoCapturedTasks,
  updateCanonicalTask,
} from "@/data/tasks";

const id = z.string().min(1).max(128);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const nextAction = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("principal"), principalId: id }),
  z.object({ kind: z.literal("department"), departmentId: id }),
  z.object({ kind: z.literal("external"), externalLabel: z.string().trim().min(1).max(240) }),
  z.object({ kind: z.literal("ready") }),
]);
const assignment = z.object({ principalId: id, role: z.enum(["primary_owner", "collaborator"]) });
const estimatedMinutes = z.number().int().min(1).max(10_080);
const dependency = z.object({
  type: z.enum(["start_blocker", "completion_blocker", "related"]),
  label: z.string().trim().min(1).max(500),
  prerequisiteTaskId: id.optional(),
  ownerPrincipalId: id.optional(),
  ownerDepartmentId: id.optional(),
});
const recurrence = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "months"]),
  interval: z.number().int().min(1).max(120).optional(),
  weekDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  monthDay: z.number().int().min(1).max(31).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: date.transform(value => value ?? undefined),
});
const projectMember = z.object({ principalId: id, role: z.enum(["owner", "member", "collaborator"]) });
const projectMilestone = z.object({ title: z.string().trim().min(1).max(500), targetDate: date.transform(value => value ?? undefined), ownerPrincipalId: id.optional() });
const templateTask = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(10_000).optional(),
  leadDepartmentId: id.optional(),
  defaultAssigneeId: id.optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  startOffsetDays: z.number().int().min(-365).max(3650).optional(),
  targetOffsetDays: z.number().int().min(-365).max(3650).optional(),
  deadlineOffsetDays: z.number().int().min(-365).max(3650).optional(),
  checklistItems: z.array(z.string().trim().min(1).max(500)).max(60).optional(),
  dependencies: z.array(z.object({ prerequisiteTaskIndex: z.number().int().min(0).max(59), type: z.enum(["start_blocker", "completion_blocker", "related"]), label: z.string().trim().min(1).max(500) })).max(30).optional(),
});

function invalid(message: string) {
  return { ok: false as const, code: "VALIDATION" as const, message };
}

function refreshWorkspace() {
  revalidatePath("/");
}

export async function createTaskAction(raw: unknown) {
  const parsed = z.object({
    workspaceId: id.optional(),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(10_000).optional(),
    organizationId: id.optional(),
    leadDepartmentId: id.optional(),
    projectId: id.optional(),
    involvedDepartmentIds: z.array(id).max(30).optional(),
    assignments: z.array(assignment).max(30).optional(),
    nextAction: nextAction.optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    startDate: date.transform((value) => value ?? undefined),
    targetDate: date.transform((value) => value ?? undefined),
    deadlineDate: date.transform((value) => value ?? undefined),
    followUpDate: date.transform((value) => value ?? undefined),
    estimatedMinutes: estimatedMinutes.optional(),
    dependencies: z.array(dependency).max(30).optional(),
    checklistItems: z.array(z.string().trim().min(1).max(500)).max(60).optional(),
    parentTaskId: id.optional(),
    sourceTaskId: id.optional(),
    recurrence: recurrence.optional(),
    originalCapture: z.string().max(20_000).optional(),
    legacyLocalId: z.string().max(160).optional(),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Some task details are incomplete or invalid.");
  const result = await createCanonicalTask(parsed.data);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function createProjectAction(raw: unknown) {
  const parsed = z.object({
    workspaceId: id.optional(),
    name: z.string().trim().min(1).max(500),
    organizationId: id,
    description: z.string().trim().max(10_000).optional(),
    leadDepartmentId: id.optional(),
    involvedDepartmentIds: z.array(id).max(30).optional(),
    members: z.array(projectMember).max(60).optional(),
    targetDate: date.transform(value => value ?? undefined),
    milestones: z.array(projectMilestone).max(12).optional(),
    focusItems: z.array(z.string().trim().min(1).max(500)).max(12).optional(),
    firstTask: z.object({
      title: z.string().trim().min(1).max(500),
      leadDepartmentId: id.optional(),
      assignments: z.array(assignment).max(30).optional(),
      targetDate: date.transform(value => value ?? undefined),
      deadlineDate: date.transform(value => value ?? undefined),
    }).optional(),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Project name and organization are required.");
  const result = await createCanonicalProject(parsed.data);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function deleteProjectAction(raw: unknown) {
  const parsed = z.object({ projectId: id, confirm: z.literal(true), workspaceId: id.optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Confirm permanent project deletion before continuing.");
  const result = await deleteCanonicalProject(parsed.data.projectId, parsed.data.workspaceId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function archiveProjectAction(raw: unknown) {
  const parsed = z.object({ projectId: id, workspaceId: id.optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid project to archive.");
  const result = await archiveCanonicalProject(parsed.data.projectId, parsed.data.workspaceId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function createOrganizationAction(raw: unknown) {
  const parsed = z.object({
    workspaceId: id.optional(),
    name: z.string().trim().min(1).max(240),
    description: z.string().trim().max(2_000).optional(),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Organization name is required.");
  const result = await createCanonicalOrganization(parsed.data);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function updateProfileAction(raw: unknown) {
  const parsed = z.object({
    workspaceId: id.optional(),
    displayName: z.string().trim().min(1).max(240),
    role: z.enum(["owner", "organization_manager", "department_manager", "employee"]),
    email: z.string().trim().email().max(320).or(z.literal("")).optional(),
    timezone: z.string().trim().min(1).max(120),
    dateFormat: z.string().trim().min(1).max(80),
    theme: z.enum(["soft", "clear", "dark"]),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Complete the required profile fields before saving.");
  const result = await updateCanonicalProfile({ ...parsed.data, email: parsed.data.email || undefined });
  if (result.ok) refreshWorkspace();
  return result;
}

export async function resetDemoDataAction(raw: unknown) {
  const parsed = z.object({ confirmation: z.literal("RESET DEMO DATA") }).safeParse(raw);
  if (!parsed.success) return invalid("Type RESET DEMO DATA to confirm.");
  const result = await resetCanonicalDemoData(parsed.data.confirmation);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function createWorkflowTemplateAction(raw: unknown) {
  const parsed = z.object({
    workspaceId: id.optional(),
    organizationId: id,
    name: z.string().trim().min(1).max(500),
    description: z.string().trim().max(10_000).optional(),
    leadDepartmentId: id.optional(),
    involvedDepartmentIds: z.array(id).max(30).optional(),
    tasks: z.array(templateTask).max(60).optional(),
    milestones: z.array(z.object({ title: z.string().trim().min(1).max(500), targetOffsetDays: z.number().int().min(-365).max(3650).optional(), ownerPrincipalId: id.optional() })).max(24).optional(),
    focusItems: z.array(z.string().trim().min(1).max(500)).max(24).optional(),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Add a template name and valid suggested work.");
  const result = await createCanonicalWorkflowTemplate(parsed.data);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function updateWorkflowTemplateAction(raw: unknown) {
  const parsed = z.object({
    templateId: id,
    workspaceId: id.optional(),
    organizationId: id,
    name: z.string().trim().min(1).max(500),
    description: z.string().trim().max(10_000).optional(),
    leadDepartmentId: id.optional(),
    involvedDepartmentIds: z.array(id).max(30).optional(),
    tasks: z.array(templateTask).max(60).optional(),
    milestones: z.array(z.object({ title: z.string().trim().min(1).max(500), targetOffsetDays: z.number().int().min(-365).max(3650).optional(), ownerPrincipalId: id.optional() })).max(24).optional(),
    focusItems: z.array(z.string().trim().min(1).max(500)).max(24).optional(),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Add a template name and valid suggested work.");
  const { templateId, ...input } = parsed.data;
  const result = await updateCanonicalWorkflowTemplate(templateId, input);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function applyWorkflowTemplateAction(raw: unknown) {
  const parsed = z.object({ workspaceId: id.optional(), templateId: id, name: z.string().trim().min(1).max(500), description: z.string().trim().max(10_000).optional(), targetDate: date.transform(value => value ?? undefined), startDate: date.transform(value => value ?? undefined) }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a template and project name.");
  const result = await applyCanonicalWorkflowTemplate(parsed.data);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function archiveWorkflowTemplateAction(raw: unknown) {
  const parsed = z.object({ workspaceId: id.optional(), templateId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid template.");
  const result = await archiveCanonicalWorkflowTemplate(parsed.data.templateId, parsed.data.workspaceId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function setNudgeStateAction(raw: unknown) {
  const parsed = z.object({ workspaceId: id.optional(), dedupKey: z.string().trim().min(1).max(300), taskId: id.optional(), disposition: z.enum(["dismissed", "snoozed", "restored"]), snoozedUntil: date.transform(value => value ?? undefined) }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid nudge action.");
  const result = await setCanonicalNudgeState(parsed.data);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function createPrincipalAction(raw: unknown) {
  const parsed = z.object({
    workspaceId: id.optional(), name: z.string().trim().min(1).max(240), type: z.enum(["person", "team"]), email: z.string().email().max(320).optional(),
    memberships: z.array(z.object({ organizationId: id.optional(), departmentId: id.optional(), role: z.enum(["owner", "organization_manager", "department_manager", "employee"]).optional() })).max(30).optional(),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Add a valid person or team.");
  const result = await createCanonicalPrincipal(parsed.data);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function updatePrincipalAction(raw: unknown) {
  const parsed = z.object({
    principalId: id, workspaceId: id.optional(), name: z.string().trim().min(1).max(240), type: z.enum(["person", "team"]), email: z.string().email().max(320).optional(),
    memberships: z.array(z.object({ organizationId: id.optional(), departmentId: id.optional(), role: z.enum(["owner", "organization_manager", "department_manager", "employee"]).optional() })).max(30).optional(),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Update this person or team with valid details.");
  const { principalId, ...input } = parsed.data;
  const result = await updateCanonicalPrincipal(principalId, input);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function addProjectMilestoneAction(raw: unknown) {
  const parsed = z.object({ projectId: id, milestone: projectMilestone }).safeParse(raw);
  if (!parsed.success) return invalid("Add a milestone name before saving.");
  const result = await addCanonicalProjectMilestone(parsed.data.projectId, parsed.data.milestone);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function updateProjectMilestoneAction(raw: unknown) {
  const parsed = z.object({ projectId: id, milestoneId: id, title: z.string().trim().min(1).max(500).optional(), targetDate: date, ownerPrincipalId: id.nullable().optional(), status: z.enum(["planned", "done"]).optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Update the milestone with valid details.");
  const result = await updateCanonicalProjectMilestone(parsed.data.projectId, parsed.data.milestoneId, parsed.data);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function deleteProjectMilestoneAction(raw: unknown) {
  const parsed = z.object({ projectId: id, milestoneId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid milestone.");
  const result = await deleteCanonicalProjectMilestone(parsed.data.projectId, parsed.data.milestoneId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function addProjectFocusItemAction(raw: unknown) {
  const parsed = z.object({ projectId: id, text: z.string().trim().min(1).max(500) }).safeParse(raw);
  if (!parsed.success) return invalid("Add a short focus item before saving.");
  const result = await addCanonicalProjectFocusItem(parsed.data.projectId, parsed.data.text);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function updateProjectFocusItemAction(raw: unknown) {
  const parsed = z.object({ projectId: id, focusItemId: id, text: z.string().trim().min(1).max(500) }).safeParse(raw);
  if (!parsed.success) return invalid("Add a short focus item before saving.");
  const result = await updateCanonicalProjectFocusItem(parsed.data.projectId, parsed.data.focusItemId, parsed.data.text);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function deleteProjectFocusItemAction(raw: unknown) {
  const parsed = z.object({ projectId: id, focusItemId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid focus item.");
  const result = await deleteCanonicalProjectFocusItem(parsed.data.projectId, parsed.data.focusItemId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function setProjectMembersAction(raw: unknown) {
  const parsed = z.object({ projectId: id, members: z.array(projectMember).max(60) }).safeParse(raw);
  if (!parsed.success) return invalid("Choose valid project people and teams.");
  const result = await setCanonicalProjectMembers(parsed.data.projectId, parsed.data.members);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function addProjectLinkAction(raw: unknown) {
  const parsed = z.object({ projectId: id, url: z.string().url().max(4_000), label: z.string().trim().max(500).optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Add a valid web link.");
  const result = await addCanonicalProjectLink(parsed.data.projectId, parsed.data.url, parsed.data.label);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function uploadProjectFileAction(formData: FormData) {
  const projectId = formData.get("projectId");
  const file = formData.get("file");
  if (typeof projectId !== "string" || !id.safeParse(projectId).success || !file || typeof file === "string" || typeof file.arrayBuffer !== "function") return invalid("Choose a valid project and file.");
  if (file.size > 5 * 1024 * 1024) return invalid("Files must be no larger than 5 MB.");
  const result = await addCanonicalProjectFile(projectId, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (result.ok) refreshWorkspace();
  return result;
}

export async function deleteProjectResourceAction(raw: unknown) {
  const parsed = z.object({ projectId: id, resourceId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid project resource.");
  const result = await deleteCanonicalProjectResource(parsed.data.projectId, parsed.data.resourceId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function addOrganizationLinkAction(raw: unknown) {
  const parsed = z.object({ organizationId: id, url: z.string().url().max(4_000), label: z.string().trim().max(500).optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Add a valid web link.");
  const result = await addCanonicalOrganizationLink(parsed.data.organizationId, parsed.data.url, parsed.data.label);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function uploadOrganizationFileAction(formData: FormData) {
  const organizationId = formData.get("organizationId");
  const file = formData.get("file");
  if (typeof organizationId !== "string" || !id.safeParse(organizationId).success || !file || typeof file === "string" || typeof file.arrayBuffer !== "function") return invalid("Choose a valid organization and file.");
  if (file.size > 5 * 1024 * 1024) return invalid("Files must be no larger than 5 MB.");
  const result = await addCanonicalOrganizationFile(organizationId, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (result.ok) refreshWorkspace();
  return result;
}

export async function deleteOrganizationResourceAction(raw: unknown) {
  const parsed = z.object({ organizationId: id, resourceId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid organization resource.");
  const result = await deleteCanonicalOrganizationResource(parsed.data.organizationId, parsed.data.resourceId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function updateOrganizationVocabularyAction(raw: unknown) {
  const parsed = z.object({ organizationId: id, aliases: z.array(z.string().trim().min(1).max(120)).max(40).optional(), departments: z.array(z.object({ departmentId: id, aliases: z.array(z.string().trim().min(1).max(120)).max(40) })).max(60).optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Use short, valid organization and department aliases.");
  const result = await updateCanonicalOrganizationVocabulary(parsed.data.organizationId, { aliases: parsed.data.aliases, departments: parsed.data.departments });
  if (result.ok) refreshWorkspace();
  return result;
}

export async function updateTaskAction(raw: unknown) {
  const parsed = z.object({
    taskId: id,
    expectedVersion: z.number().int().positive(),
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(10_000).nullable().optional(),
    organizationId: id.nullable().optional(),
    leadDepartmentId: id.nullable().optional(),
    projectId: id.nullable().optional(),
    involvedDepartmentIds: z.array(id).max(30).optional(),
    nextAction: nextAction.optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    startDate: date,
    targetDate: date,
    deadlineDate: date,
    followUpDate: date,
    estimatedMinutes: estimatedMinutes.nullable().optional(),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Some task details are incomplete or invalid.");
  const result = await updateCanonicalTask(parsed.data);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function archiveTaskAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive() }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid task to archive.");
  const result = await archiveCanonicalTask(parsed.data.taskId, parsed.data.expectedVersion);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function addTaskDependencyAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), dependency }).safeParse(raw);
  if (!parsed.success) return invalid("Add a valid dependency.");
  const result = await addCanonicalTaskDependency(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.dependency);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function resolveTaskDependencyAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), dependencyId: id, resolved: z.boolean() }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid dependency.");
  const result = await resolveCanonicalTaskDependency(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.dependencyId, parsed.data.resolved);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function removeTaskDependencyAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), dependencyId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid dependency.");
  const result = await removeCanonicalTaskDependency(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.dependencyId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function addChecklistItemAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), title: z.string().trim().min(1).max(500) }).safeParse(raw);
  if (!parsed.success) return invalid("Add a completion item before saving.");
  const result = await addCanonicalChecklistItem(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.title);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function toggleChecklistItemAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), itemId: id, completed: z.boolean() }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid completion item.");
  const result = await toggleCanonicalChecklistItem(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.itemId, parsed.data.completed);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function setTaskRecurrenceAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), recurrence: recurrence.optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid repeat schedule.");
  const result = await setCanonicalTaskRecurrence(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.recurrence);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function createSubtaskAction(raw: unknown) {
  const parsed = z.object({
    parentTaskId: id,
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(10_000).optional(),
    organizationId: id.optional(), leadDepartmentId: id.optional(), projectId: id.optional(), involvedDepartmentIds: z.array(id).max(30).optional(), assignments: z.array(assignment).max(30).optional(), nextAction: nextAction.optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional(), startDate: date.transform(value => value ?? undefined), targetDate: date.transform(value => value ?? undefined), deadlineDate: date.transform(value => value ?? undefined), followUpDate: date.transform(value => value ?? undefined), checklistItems: z.array(z.string().trim().min(1).max(500)).max(60).optional(),
  }).safeParse(raw);
  if (!parsed.success) return invalid("Add a valid subtask title.");
  const { parentTaskId, ...input } = parsed.data;
  const result = await createCanonicalSubtask(parentTaskId, input);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function mergeTasksAction(raw: unknown) {
  const parsed = z.object({ survivorId: id, expectedVersion: z.number().int().positive(), sourceTaskIds: z.array(id).min(1).max(20), title: z.string().trim().min(1).max(500).optional(), dateResolution: z.object({ startDate: z.enum(["survivor", "source", "clear"]).optional(), targetDate: z.enum(["survivor", "source", "clear"]).optional(), deadlineDate: z.enum(["survivor", "source", "clear"]).optional(), followUpDate: z.enum(["survivor", "source", "clear"]).optional() }).optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Choose work to merge.");
  const result = await mergeCanonicalTasks(parsed.data.survivorId, parsed.data.expectedVersion, parsed.data.sourceTaskIds, parsed.data.title, parsed.data.dateResolution);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function splitTaskAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), titles: z.array(z.string().trim().min(1).max(500)).min(2).max(12) }).safeParse(raw);
  if (!parsed.success) return invalid("Add at least two pieces of work to split.");
  const result = await splitCanonicalTask(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.titles);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function saveViewAction(raw: unknown) {
  const parsed = z.object({ name: z.string().trim().min(1).max(120), filters: z.record(z.string(), z.unknown()) }).safeParse(raw);
  if (!parsed.success) return invalid("Name the view and choose valid filters.");
  const result = await saveCanonicalView(parsed.data.name, parsed.data.filters);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function deleteViewAction(raw: unknown) {
  const parsed = z.object({ viewId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a saved view.");
  const result = await deleteCanonicalView(parsed.data.viewId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function saveInboxCaptureAction(raw: unknown) {
  const parsed = z.object({ rawText: z.string().trim().min(1).max(20_000) }).safeParse(raw);
  if (!parsed.success) return invalid("Write something for Binnie to keep.");
  const result = await saveCaptureForManualOrganization(parsed.data.rawText);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function resolveInboxCaptureAction(raw: unknown) {
  const parsed = z.object({ captureId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a saved Inbox item.");
  const result = await resolveCanonicalInboxCapture(parsed.data.captureId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function setTaskAssignmentsAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), assignments: z.array(assignment).max(30) }).safeParse(raw);
  if (!parsed.success) return invalid("Choose valid people or teams for this task.");
  const result = await setCanonicalAssignments(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.assignments);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function claimTaskAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), teamId: id.optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid team queue to claim.");
  const result = await claimCanonicalTask(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.teamId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function transitionTaskAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), status: z.enum(["ready", "in_progress", "waiting", "blocked", "review", "done"]), blocker: dependency.optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid work state.");
  const result = await transitionCanonicalTask(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.status, parsed.data.blocker);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function postTaskUpdateAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), text: z.string().trim().min(1).max(10_000) }).safeParse(raw);
  if (!parsed.success) return invalid("Write a short update before posting it.");
  const result = await addCanonicalTaskUpdate(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.text);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function addTaskLinkAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), url: z.string().url().max(4_000), label: z.string().trim().max(500).optional() }).safeParse(raw);
  if (!parsed.success) return invalid("Add a valid web link.");
  const result = await addCanonicalTaskLink(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.url, parsed.data.label);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function uploadTaskFileAction(formData: FormData) {
  const taskId = formData.get("taskId");
  const expectedVersion = Number(formData.get("expectedVersion"));
  const file = formData.get("file");
  if (typeof taskId !== "string" || !id.safeParse(taskId).success || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !file || typeof file === "string" || typeof file.arrayBuffer !== "function") return invalid("Choose a valid task and file.");
  if (file.size > 5 * 1024 * 1024) return invalid("Files must be no larger than 5 MB.");
  const result = await addCanonicalTaskFile(taskId, expectedVersion, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (result.ok) refreshWorkspace();
  return result;
}

export async function uploadTaskUpdateFileAction(formData: FormData) {
  const taskId = formData.get("taskId");
  const updateId = formData.get("updateId");
  const expectedVersion = Number(formData.get("expectedVersion"));
  const file = formData.get("file");
  if (typeof taskId !== "string" || !id.safeParse(taskId).success || typeof updateId !== "string" || !id.safeParse(updateId).success || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !file || typeof file === "string" || typeof file.arrayBuffer !== "function") return invalid("Choose a valid work update and file.");
  if (file.size > 5 * 1024 * 1024) return invalid("Files must be no larger than 5 MB.");
  const result = await addCanonicalTaskUpdateFile(taskId, updateId, expectedVersion, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (result.ok) refreshWorkspace();
  return result;
}

export async function submitTaskForReviewAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), reviewerId: id }).safeParse(raw);
  if (!parsed.success) return invalid("Choose a valid reviewer.");
  const result = await submitCanonicalTaskForReview(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.reviewerId);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function decideTaskReviewAction(raw: unknown) {
  const parsed = z.object({ taskId: id, expectedVersion: z.number().int().positive(), approve: z.boolean(), revisionNote: z.string().trim().max(10_000).optional() }).safeParse(raw);
  if (!parsed.success) return invalid("The review decision is invalid.");
  const result = await decideCanonicalReview(parsed.data.taskId, parsed.data.expectedVersion, parsed.data.approve, parsed.data.revisionNote);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function undoCaptureAction(raw: unknown) {
  const parsed = z.object({ taskIds: z.array(id).min(1).max(6) }).safeParse(raw);
  if (!parsed.success) return invalid("Binnie could not identify the captured work to undo.");
  const result = await undoCapturedTasks(parsed.data.taskIds);
  if (result.ok) refreshWorkspace();
  return result;
}

export async function importLocalTasksAction(raw: unknown) {
  const parsed = z.object({
    fingerprint: z.string().min(8).max(256),
    tasks: z.array(z.object({
      legacyLocalId: id,
      title: z.string().trim().min(1).max(500),
      description: z.string().trim().max(10_000).optional(),
      organizationId: id.optional(),
      leadDepartmentId: id.optional(),
      projectId: id.optional(),
      involvedDepartmentIds: z.array(id).max(30).optional(),
      assignments: z.array(assignment).max(30).optional(),
      nextAction: nextAction.optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      startDate: date.transform(value => value ?? undefined),
      targetDate: date.transform(value => value ?? undefined),
      deadlineDate: date.transform(value => value ?? undefined),
      followUpDate: date.transform(value => value ?? undefined),
      estimatedMinutes: estimatedMinutes.optional(),
      status: z.enum(["ready", "in_progress", "waiting", "blocked", "review", "done"]).optional(),
    })).max(500),
  }).safeParse(raw);
  if (!parsed.success) return invalid("The local tasks could not be imported safely.");
  const result = await importLegacyTasks(parsed.data.fingerprint, parsed.data.tasks);
  if (result.ok) refreshWorkspace();
  return result;
}
