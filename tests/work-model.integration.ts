import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import {
  AssignmentRole,
  AssignmentSource,
  DependencyType,
  NextActionKind,
  NudgeDisposition,
  PrincipalType,
  ProjectStatus,
  ResourceScope,
  ReviewDecision,
  TaskPriority,
  TaskStatus,
  WorkflowTemplateStatus,
  WorkspaceRole,
  PrismaClient,
} from "../src/generated/prisma/client";
import { createPostgresAdapter } from "../src/lib/database-adapter";

async function main() {
  const connectionString = process.env.TEST_DATABASE_URL
    || (process.env.BINNIE_ACCEPTANCE_DATABASE === "connected" ? process.env.DATABASE_URL : undefined);
  if (!connectionString) {
    console.error("TEST_DATABASE_URL is required for database-backed acceptance checks. Set BINNIE_ACCEPTANCE_DATABASE=connected only for an isolated, self-cleaning acceptance workspace.");
    process.exitCode = 1;
    return;
  }
  const db = new PrismaClient({ adapter: createPostgresAdapter(connectionString) });
  const workspaceId = `acceptance-${randomUUID()}`;
  // A prior interrupted acceptance run may leave only test-namespaced rows.
  // Review and update authors are intentionally retained in normal product
  // data, so remove those dependent rows explicitly before deleting an
  // isolated test workspace.
  async function removeAcceptanceWorkspace(id: string) {
    await db.taskReviewCycle.deleteMany({ where: { task: { workspaceId: id } } });
    await db.taskUpdate.deleteMany({ where: { task: { workspaceId: id } } });
    await db.workspace.deleteMany({ where: { id } });
  }
  try {
    await db.taskReviewCycle.deleteMany({ where: { task: { workspaceId: { startsWith: "acceptance-" } } } });
    await db.taskUpdate.deleteMany({ where: { task: { workspaceId: { startsWith: "acceptance-" } } } });
    await db.workspace.deleteMany({ where: { id: { startsWith: "acceptance-" } } });
    const workspace = await db.workspace.create({ data: { id: workspaceId, name: "Binnie Acceptance" } });
    const organization = await db.organization.create({ data: { workspaceId: workspace.id, name: "Acceptance Org", aliases: ["acceptance"] } });
    const [marketing, finance] = await Promise.all([
      db.department.create({ data: { organizationId: organization.id, name: "Marketing" } }),
      db.department.create({ data: { organizationId: organization.id, name: "Finance" } }),
    ]);
    const [owner, marketingTeam, financeTeam] = await Promise.all([
      db.principal.create({ data: { workspaceId, type: PrincipalType.PERSON, name: "Acceptance Owner", memberships: { create: { organizationId: organization.id, role: WorkspaceRole.OWNER } } } }),
      db.principal.create({ data: { workspaceId, type: PrincipalType.TEAM, name: "Marketing Team", memberships: { create: { organizationId: organization.id, departmentId: marketing.id } } } }),
      db.principal.create({ data: { workspaceId, type: PrincipalType.TEAM, name: "Finance Team", memberships: { create: { organizationId: organization.id, departmentId: finance.id } } } }),
    ]);

    const pricing = await db.task.create({
      data: {
        workspaceId, organizationId: organization.id, leadDepartmentId: finance.id, createdByPrincipalId: owner.id,
        title: "Confirm pricing", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, estimatedMinutes: 30, nextActionKind: NextActionKind.PRINCIPAL, nextActionPrincipalId: financeTeam.id,
        involvedDepartments: { create: [{ departmentId: finance.id }, { departmentId: marketing.id }] },
        assignments: { create: [{ principalId: financeTeam.id, role: AssignmentRole.PRIMARY_OWNER, source: AssignmentSource.MANUAL, assignedByPrincipalId: owner.id }, { principalId: marketingTeam.id, role: AssignmentRole.COLLABORATOR, source: AssignmentSource.MANUAL, assignedByPrincipalId: owner.id }] },
      }, include: { assignments: true, involvedDepartments: true },
    });
    assert.equal(pricing.assignments.length, 2, "one task has multiple assignees");
    assert.equal(pricing.involvedDepartments.length, 2, "one task is visible across departments");
    assert.equal(pricing.estimatedMinutes, 30, "optional task effort persists as canonical minutes");

    const publication = await db.task.create({ data: { workspaceId, organizationId: organization.id, leadDepartmentId: marketing.id, createdByPrincipalId: owner.id, title: "Publish pricing", status: TaskStatus.READY, priority: TaskPriority.MEDIUM, dependencies: { create: { prerequisiteTaskId: pricing.id, type: DependencyType.COMPLETION_BLOCKER, label: "Final pricing required" } } } });
    const dependency = await db.taskDependency.findFirstOrThrow({ where: { taskId: publication.id } });
    assert.equal(dependency.type, DependencyType.COMPLETION_BLOCKER, "completion dependency is distinct from start blocker");
    const related = await db.taskDependency.create({ data: { taskId: publication.id, prerequisiteTaskId: pricing.id, type: DependencyType.RELATED, label: "Same launch" } });
    assert.equal(related.type, DependencyType.RELATED, "related work remains separate from blocking dependencies");

    const lifecycle = await db.task.create({
      data: {
        workspaceId, organizationId: organization.id, leadDepartmentId: marketing.id, projectId: undefined, createdByPrincipalId: owner.id,
        title: "Prepare launch pack", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.MEDIUM,
        startDate: new Date("2026-08-17"), targetDate: new Date("2026-08-20"), deadline: new Date("2026-08-21"), followUpDate: new Date("2026-08-19"),
        nextActionKind: NextActionKind.PRINCIPAL, nextActionPrincipalId: marketingTeam.id,
        assignments: { create: { principalId: marketingTeam.id, role: AssignmentRole.PRIMARY_OWNER, source: AssignmentSource.MANUAL, assignedByPrincipalId: owner.id } },
        checklistItems: { create: [{ title: "Artwork approved", position: 0 }, { title: "Copy confirmed", position: 1 }] },
        updates: { create: { authorId: owner.id, text: "First draft is ready.", resources: { create: { scope: ResourceScope.TASK, label: "draft.pdf", fileName: "draft.pdf", mimeType: "application/pdf", content: new Uint8Array([1, 2, 3]) } } } },
      },
      include: { checklistItems: true, updates: { include: { resources: true } } },
    });
    assert.equal(lifecycle.checklistItems.length, 2, "completion criteria are persisted per task");
    assert.equal(lifecycle.updates[0]?.resources.length, 1, "updates can carry an optional attachment without changing status");
    const review = await db.taskReviewCycle.create({ data: { taskId: lifecycle.id, submittedByPrincipalId: owner.id, reviewerPrincipalId: financeTeam.id, reviewedByPrincipalId: financeTeam.id, reviewedAt: new Date(), decision: ReviewDecision.REVISION_REQUESTED, revisionNote: "Please confirm final figures." } });
    assert.equal(review.decision, ReviewDecision.REVISION_REQUESTED, "review decisions retain their revision note and audit fields");
    const recurrence = await db.taskRecurrence.create({ data: { workspaceId, frequency: "MONTHLY", interval: 1, monthDay: 30, startDate: new Date("2026-08-30"), nextOccurrenceDate: new Date("2026-09-30") } });
    await db.task.update({ where: { id: lifecycle.id }, data: { recurrenceId: recurrence.id } });
    assert.equal((await db.task.findUniqueOrThrow({ where: { id: lifecycle.id } })).recurrenceId, recurrence.id, "recurrence lives in a separate canonical record");

    const template = await db.workflowTemplate.create({
      data: {
        workspaceId, organizationId: organization.id, leadDepartmentId: marketing.id, createdByPrincipalId: owner.id, name: "Promotion launch", status: WorkflowTemplateStatus.ACTIVE,
        involvedDepartments: { create: [{ departmentId: marketing.id }, { departmentId: finance.id }] },
        tasks: { create: [{ title: "Create artwork", position: 0, leadDepartmentId: marketing.id, defaultAssigneeId: marketingTeam.id }, { title: "Approve budget", position: 1, leadDepartmentId: finance.id, defaultAssigneeId: financeTeam.id }] },
      }, include: { tasks: { orderBy: { position: "asc" } } },
    });
    await db.workflowTemplateDependency.create({ data: { taskId: template.tasks[1].id, prerequisiteTemplateTaskId: template.tasks[0].id, type: DependencyType.COMPLETION_BLOCKER, label: "Artwork ready" } });
    assert.equal(await db.workflowTemplateDependency.count({ where: { taskId: template.tasks[1].id } }), 1, "template keeps dependency blueprint canonically");

    const project = await db.project.create({ data: {
      workspaceId, organizationId: organization.id, sourceTemplateId: template.id, createdByPrincipalId: owner.id, name: "September promotion", status: ProjectStatus.ACTIVE,
      leadDepartmentId: marketing.id,
      involvedDepartments: { create: [{ departmentId: marketing.id }, { departmentId: finance.id }] },
      members: { create: [{ principalId: marketingTeam.id, role: "OWNER" }, { principalId: financeTeam.id, role: "COLLABORATOR" }] },
      milestones: { create: { title: "Campaign ready", targetDate: new Date("2026-08-26") } },
      focusItems: { create: [{ text: "Artwork and pricing", position: 0 }, { text: "Launch calendar", position: 1 }] },
      resources: { create: [{ scope: ResourceScope.PROJECT, label: "Project brief", url: "https://example.com/brief" }, { scope: ResourceScope.PROJECT, label: "brief.pdf", fileName: "brief.pdf", mimeType: "application/pdf", content: new Uint8Array([4, 5]) }] },
    } });
    assert.equal(project.sourceTemplateId, template.id, "project records its workflow template source");
    const projectWithContext = await db.project.findUniqueOrThrow({ where: { id: project.id }, include: { members: true, milestones: true, focusItems: { orderBy: { position: "asc" } }, resources: true, involvedDepartments: true } });
    assert.equal(projectWithContext.members.length, 2, "project people and teams are canonical membership records");
    assert.equal(projectWithContext.involvedDepartments.length, 2, "cross-department project visibility is persisted");
    assert.equal(projectWithContext.milestones.length, 1, "project milestones belong to the project");
    assert.deepEqual(projectWithContext.focusItems.map(item => item.text), ["Artwork and pricing", "Launch calendar"], "current focus stays separate from tasks");
    assert.equal(projectWithContext.resources.length, 2, "project links and files are stored as scoped resources");
    const organizationResource = await db.taskResource.create({ data: { scope: ResourceScope.ORGANIZATION, organizationId: organization.id, label: "Brand guide", url: "https://example.com/brand-guide" } });
    assert.equal(organizationResource.scope, ResourceScope.ORGANIZATION, "organization-wide resources remain distinct from task and project resources");
    const subtask = await db.task.create({ data: { workspaceId, organizationId: organization.id, projectId: project.id, parentTaskId: lifecycle.id, createdByPrincipalId: owner.id, title: "Confirm print format", status: TaskStatus.DONE, priority: TaskPriority.LOW } });
    assert.equal((await db.task.findUniqueOrThrow({ where: { id: subtask.id } })).parentTaskId, lifecycle.id, "subtasks preserve their parent task instead of becoming duplicates");
    const nudge = await db.workNudge.upsert({ where: { workspaceId_recipientId_dedupKey: { workspaceId, recipientId: owner.id, dedupKey: `blocker:${pricing.id}` } }, create: { workspaceId, recipientId: owner.id, taskId: pricing.id, dedupKey: `blocker:${pricing.id}`, disposition: NudgeDisposition.SNOOZED, snoozedUntil: new Date(Date.now() + 86_400_000) }, update: { disposition: NudgeDisposition.SNOOZED } });
    assert.equal(nudge.disposition, NudgeDisposition.SNOOZED, "nudge preference persists against a real task");
    console.log("Database-backed work model acceptance checks passed.");
  } finally {
    await removeAcceptanceWorkspace(workspaceId);
    await db.$disconnect();
  }
}

void main();
