import "dotenv/config";

import {
  AssignmentRole,
  AssignmentSource,
  DependencyType,
  NextActionKind,
  PrincipalType,
  PrismaClient,
  TaskEventType,
  TaskPriority,
  TaskStatus,
  WorkspaceRole,
} from "../src/generated/prisma/client";
import { createPostgresAdapter } from "../src/lib/database-adapter";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed Binnie.");

const db = new PrismaClient({ adapter: createPostgresAdapter(connectionString) });

const workspaceId = "workspace-binnie";
const villaId = "org-villa-khayangan";
const apotikId = "org-apotik";
const personalId = "org-personal";

const departments = [
  ["dept-villa-system-development", villaId, "System Development", ["development", "dev", "system"]],
  ["dept-villa-operations", villaId, "Operations", ["ops", "operasional"]],
  ["dept-villa-marketing", villaId, "Marketing", ["marketing", "promo"]],
  ["dept-villa-finance", villaId, "Finance", ["finance", "budget", "accounting"]],
  ["dept-villa-hr", villaId, "HR", ["hr", "people"]],
  ["dept-villa-purchasing", villaId, "Purchasing", ["purchasing", "procurement"]],
  ["dept-villa-design", villaId, "Design", ["design", "creative"]],
  ["dept-villa-maintenance", villaId, "Maintenance", ["maintenance", "repair", "teknisi", "perbaikan"]],
  ["dept-apotik-operations", apotikId, "Operations", ["ops", "operasional", "pharmacy", "obat"]],
  ["dept-apotik-finance", apotikId, "Finance", ["finance", "budget"]],
] as const;

const principals = [
  ["person-charlotte", PrincipalType.PERSON, "Charlotte", "charlotte@binnie.local"],
  ["person-bu-desti", PrincipalType.PERSON, "Bu Desti", "desti@villakhayangan.com"],
  ["person-purchasing-manager", PrincipalType.PERSON, "Purchasing Manager", null],
  ["person-hr-manager", PrincipalType.PERSON, "HR Manager", null],
  ["team-marketing", PrincipalType.TEAM, "Marketing Team", null],
  ["team-design", PrincipalType.TEAM, "Design Team", null],
  ["team-finance", PrincipalType.TEAM, "Finance Team", null],
  ["team-purchasing", PrincipalType.TEAM, "Purchasing Team", null],
  ["team-hr", PrincipalType.TEAM, "HR Team", null],
  ["team-operations", PrincipalType.TEAM, "Operations Team", null],
  ["team-development", PrincipalType.TEAM, "Development Team", null],
  ["team-maintenance", PrincipalType.TEAM, "Maintenance Team", null],
] as const;

const memberships = [
  ["person-charlotte", villaId, "dept-villa-operations", WorkspaceRole.OWNER],
  ["person-bu-desti", villaId, "dept-villa-operations", WorkspaceRole.ORGANIZATION_MANAGER],
  ["person-purchasing-manager", villaId, "dept-villa-purchasing", WorkspaceRole.DEPARTMENT_MANAGER],
  ["person-hr-manager", villaId, "dept-villa-hr", WorkspaceRole.DEPARTMENT_MANAGER],
  ["team-marketing", villaId, "dept-villa-marketing", WorkspaceRole.EMPLOYEE],
  ["team-design", villaId, "dept-villa-design", WorkspaceRole.EMPLOYEE],
  ["team-finance", villaId, "dept-villa-finance", WorkspaceRole.EMPLOYEE],
  ["team-purchasing", villaId, "dept-villa-purchasing", WorkspaceRole.EMPLOYEE],
  ["team-hr", villaId, "dept-villa-hr", WorkspaceRole.EMPLOYEE],
  ["team-operations", villaId, "dept-villa-operations", WorkspaceRole.EMPLOYEE],
  ["team-development", villaId, "dept-villa-system-development", WorkspaceRole.EMPLOYEE],
  ["team-maintenance", villaId, "dept-villa-maintenance", WorkspaceRole.EMPLOYEE],
  ["team-operations", apotikId, "dept-apotik-operations", WorkspaceRole.EMPLOYEE],
  ["team-finance", apotikId, "dept-apotik-finance", WorkspaceRole.EMPLOYEE],
] as const;

async function seedTask(input: {
  id: string;
  title: string;
  organizationId: string;
  leadDepartmentId: string;
  projectId?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignees: Array<[string, AssignmentRole]>;
  involvedDepartmentIds: string[];
  nextActionPrincipalId?: string;
  nextActionDepartmentId?: string;
  nextActionKind: NextActionKind;
  startDate?: Date;
  targetDate?: Date;
  deadline?: Date;
  description?: string;
}) {
  await db.task.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      workspaceId,
      organizationId: input.organizationId,
      leadDepartmentId: input.leadDepartmentId,
      projectId: input.projectId,
      createdByPrincipalId: "person-charlotte",
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status,
      startDate: input.startDate,
      targetDate: input.targetDate,
      deadline: input.deadline,
      nextActionKind: input.nextActionKind,
      nextActionPrincipalId: input.nextActionPrincipalId,
      nextActionDepartmentId: input.nextActionDepartmentId,
      involvedDepartments: { create: input.involvedDepartmentIds.map((departmentId) => ({ departmentId })) },
      assignments: {
        create: input.assignees.map(([principalId, role]) => ({
          principalId,
          role,
          source: AssignmentSource.IMPORT,
          assignedByPrincipalId: "person-charlotte",
        })),
      },
      events: { create: { actorId: "person-charlotte", type: TaskEventType.CREATED, summary: "Created from the Binnie starter workspace" } },
    },
    // Starter records are create-only. Re-running seed must never overwrite
    // someone else's task edits, assignments, or status.
    update: {},
  });
}

/** Explicitly creates only missing starter records. It is never run by app
 * startup, schema migration, or a normal save. */
export async function seedDemoWorkspace() {
  await db.workspace.upsert({ where: { id: workspaceId }, create: { id: workspaceId, name: "Binnie" }, update: {} });
  await db.organization.upsert({ where: { workspaceId_name: { workspaceId, name: "Villa Khayangan" } }, create: { id: villaId, workspaceId, name: "Villa Khayangan", aliases: ["khayangan", "villa", "penginapan", "vk"] }, update: {} });
  await db.organization.upsert({ where: { workspaceId_name: { workspaceId, name: "Apotik" } }, create: { id: apotikId, workspaceId, name: "Apotik", aliases: ["apotik", "pharmacy", "obat"] }, update: {} });
  await db.organization.upsert({ where: { workspaceId_name: { workspaceId, name: "Personal" } }, create: { id: personalId, workspaceId, name: "Personal", aliases: ["personal", "myself"] }, update: {} });

  for (const [id, organizationId, name, aliases] of departments) {
    await db.department.upsert({ where: { organizationId_name: { organizationId, name } }, create: { id, organizationId, name, aliases: [...aliases] }, update: {} });
  }
  for (const [id, type, name, email] of principals) {
    await db.principal.upsert({ where: { workspaceId_name: { workspaceId, name } }, create: { id, workspaceId, type, name, email: email || undefined }, update: {} });
  }
  for (const [principalId, organizationId, departmentId, role] of memberships) {
    const exists = await db.principalMembership.findFirst({ where: { principalId, organizationId, departmentId } });
    if (!exists) await db.principalMembership.create({ data: { principalId, organizationId, departmentId, role } });
  }

  await db.project.upsert({ where: { organizationId_name: { organizationId: villaId, name: "Villa Website Revamp" } }, create: { id: "project-villa-website", workspaceId, organizationId: villaId, leadDepartmentId: "dept-villa-system-development", createdByPrincipalId: "person-charlotte", name: "Villa Website Revamp", targetDate: new Date("2026-09-30T00:00:00.000Z"), involvedDepartments: { create: [{ departmentId: "dept-villa-system-development" }, { departmentId: "dept-villa-marketing" }, { departmentId: "dept-villa-finance" }] }, members: { create: [{ principalId: "team-development", role: "OWNER" }, { principalId: "team-marketing", role: "MEMBER" }, { principalId: "team-finance", role: "MEMBER" }] }, milestones: { create: [{ title: "Pricing Approved", targetDate: new Date("2026-08-19T00:00:00.000Z") }, { title: "Website Ready", targetDate: new Date("2026-08-26T00:00:00.000Z") }] }, focusItems: { create: [{ text: "Mobile booking flow redesign", position: 0 }, { text: "Accommodation pricing section", position: 1 }] } }, update: {} });

  const aug16 = new Date("2026-08-16T00:00:00.000Z");
  await seedTask({
    id: "t21", title: "Finalize the August budget", organizationId: villaId, leadDepartmentId: "dept-villa-finance",
    priority: TaskPriority.MEDIUM, status: TaskStatus.READY,
    assignees: [["team-finance", AssignmentRole.PRIMARY_OWNER], ["team-marketing", AssignmentRole.COLLABORATOR], ["team-purchasing", AssignmentRole.COLLABORATOR]],
    involvedDepartmentIds: ["dept-villa-finance", "dept-villa-marketing", "dept-villa-purchasing"],
    nextActionKind: NextActionKind.PRINCIPAL, nextActionPrincipalId: "team-finance", startDate: new Date("2026-08-13T00:00:00.000Z"), targetDate: aug16, deadline: aug16,
    description: "Coordinate the August budget with Marketing, Finance, and Purchasing.",
  });
  await seedTask({
    id: "t15", title: "Confirm accommodation pricing", organizationId: villaId, leadDepartmentId: "dept-villa-finance", projectId: "project-villa-website",
    priority: TaskPriority.URGENT, status: TaskStatus.READY, assignees: [["team-finance", AssignmentRole.PRIMARY_OWNER]], involvedDepartmentIds: ["dept-villa-finance"],
    nextActionKind: NextActionKind.PRINCIPAL, nextActionPrincipalId: "team-finance", deadline: new Date("2026-08-19T00:00:00.000Z"),
  });
  await seedTask({
    id: "t16", title: "Prepare campaign concept", organizationId: villaId, leadDepartmentId: "dept-villa-marketing", projectId: "project-villa-website",
    priority: TaskPriority.HIGH, status: TaskStatus.READY, assignees: [["team-marketing", AssignmentRole.PRIMARY_OWNER]], involvedDepartmentIds: ["dept-villa-marketing"],
    nextActionKind: NextActionKind.PRINCIPAL, nextActionPrincipalId: "team-marketing", deadline: new Date("2026-08-20T00:00:00.000Z"),
  });
  await seedTask({
    id: "t19", title: "Publish final accommodation prices", organizationId: villaId, leadDepartmentId: "dept-villa-system-development", projectId: "project-villa-website",
    priority: TaskPriority.HIGH, status: TaskStatus.BLOCKED, assignees: [["team-development", AssignmentRole.PRIMARY_OWNER]], involvedDepartmentIds: ["dept-villa-system-development"],
    nextActionKind: NextActionKind.PRINCIPAL, nextActionPrincipalId: "team-finance", deadline: new Date("2026-08-23T00:00:00.000Z"),
  });
  await db.taskDependency.upsert({
    where: { id: "dependency-t19-t15" },
    create: { id: "dependency-t19-t15", taskId: "t19", prerequisiteTaskId: "t15", ownerDepartmentId: "dept-villa-finance", type: DependencyType.START_BLOCKER, label: "Confirm accommodation pricing" },
    update: {},
  });
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedDemoWorkspace().then(() => db.$disconnect()).catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
}
