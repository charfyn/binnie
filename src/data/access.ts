import "server-only";

import {
  AccessAuditAction,
  AccessLevel,
  InvitationStatus,
  MembershipStatus,
  PrincipalStatus,
  PrincipalType,
  UserAccountStatus,
  type Prisma,
} from "@/generated/prisma/client";
import {
  AuthorizationError,
  canManageOrganization,
  isWorkspaceOwner,
  requireCurrentUser,
} from "@/lib/access";
import { provisionBinnieAccount } from "@/lib/account-provisioning";
import { validateUsername } from "@/lib/account-identity";
import { getDb } from "@/lib/db";

const DEFAULT_WORKSPACE_ID = "workspace-binnie";

type Result<T> = { ok: true; data: T } | { ok: false; code: "VALIDATION" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT"; message: string };
type AccessTransaction = Prisma.TransactionClient;

function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

function fail<T>(code: Extract<Result<T>, { ok: false }>['code'], message: string): Result<T> {
  return { ok: false, code, message };
}

async function audit(tx: AccessTransaction, input: {
  actorPersonId?: string | null;
  targetPersonId?: string | null;
  organizationId?: string | null;
  action: AccessAuditAction;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}) {
  await tx.accessAuditLog.create({ data: input });
}

function workspaceOwnerMembershipWhere(workspaceId: string): Prisma.OrganizationMembershipWhereInput {
  return {
    status: MembershipStatus.ACTIVE,
    accessLevel: AccessLevel.OWNER,
    organization: { workspaceId },
    person: {
      status: PrincipalStatus.ACTIVE,
      active: true,
      userAccount: { is: { status: UserAccountStatus.ACTIVE } },
    },
  };
}

async function assertNotLastActiveOwner(tx: AccessTransaction, workspaceId: string, personId: string) {
  const targetIsOwner = await tx.organizationMembership.findFirst({
    where: { ...workspaceOwnerMembershipWhere(workspaceId), personId },
    select: { id: true },
  });
  if (!targetIsOwner) return;
  const ownerRows = await tx.organizationMembership.findMany({
    where: workspaceOwnerMembershipWhere(workspaceId),
    select: { personId: true },
  });
  if (new Set(ownerRows.map((row) => row.personId)).size <= 1) {
    throw new AuthorizationError("BINNIE_LAST_ACTIVE_OWNER");
  }
}

export interface CreateDirectoryPersonInput {
  workspaceId?: string;
  name: string;
  contactEmail?: string;
  jobTitle?: string;
  phone?: string;
  notes?: string;
  organizationId: string;
  departmentIds?: string[];
  teamIds?: string[];
}

export async function createDirectoryPerson(input: CreateDirectoryPersonInput): Promise<Result<{ personId: string }>> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  const name = input.name.trim();
  if (!name) return fail("VALIDATION", "A person needs a name.");
  if (!canManageOrganization(actor, workspaceId, input.organizationId)) return fail("FORBIDDEN", "You do not have permission to add people to that organization.");

  const db = getDb();
  const [organization, departments, teams] = await Promise.all([
    db.organization.findFirst({ where: { id: input.organizationId, workspaceId }, select: { id: true } }),
    db.department.findMany({ where: { id: { in: [...new Set(input.departmentIds || [])] }, organizationId: input.organizationId }, select: { id: true } }),
    db.principal.findMany({ where: { id: { in: [...new Set(input.teamIds || [])] }, workspaceId, type: PrincipalType.TEAM, teamScopes: { some: { organizationId: input.organizationId, status: MembershipStatus.ACTIVE } } }, select: { id: true } }),
  ]);
  if (!organization || departments.length !== new Set(input.departmentIds || []).size || teams.length !== new Set(input.teamIds || []).size) {
    return fail("VALIDATION", "Choose departments and teams within the selected organization.");
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const person = await tx.principal.create({
        data: {
          workspaceId,
          type: PrincipalType.PERSON,
          name,
          email: input.contactEmail?.trim() || null,
          jobTitle: input.jobTitle?.trim() || null,
          phone: input.phone?.trim() || null,
          notes: input.notes?.trim() || null,
          status: PrincipalStatus.ACTIVE,
          active: true,
          organizationMemberships: { create: { organizationId: input.organizationId, accessLevel: null } },
          departmentMemberships: { create: departments.map((department) => ({ departmentId: department.id })) },
          teamMemberships: { create: teams.map((team) => ({ teamId: team.id })) },
        },
      });
      await audit(tx, { actorPersonId: actor.personId, targetPersonId: person.id, organizationId: input.organizationId, action: AccessAuditAction.PERSON_CREATED });
      return person;
    });
    return ok({ personId: created.id });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return fail("CONFLICT", "That person already exists in this workspace.");
    throw error;
  }
}

export async function requestBinnieAccess(input: {
  workspaceId?: string;
  personId: string;
  organizationId: string;
  requestedAccessLevel: AccessLevel;
  requestedUsername: string;
}): Promise<Result<{ invitationId: string; status: InvitationStatus }>> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  const isOwner = isWorkspaceOwner(actor, workspaceId);
  if (!canManageOrganization(actor, workspaceId, input.organizationId)) return fail("FORBIDDEN", "You do not have permission to request access for that organization.");
  if (isOwner) return fail("VALIDATION", "Owners create Binnie accounts directly instead of requesting approval.");
  if (input.requestedAccessLevel === AccessLevel.OWNER || input.requestedAccessLevel === AccessLevel.ORGANIZATION_MANAGER) return fail("FORBIDDEN", "Managers cannot request Owner or Organization Manager access.");
  const requestedUsernameNormalized = validateUsername(input.requestedUsername);
  if (!requestedUsernameNormalized) return fail("VALIDATION", "Use 3–30 lowercase letters, numbers, periods, or underscores for the username.");

  const db = getDb();
  const person = await db.principal.findFirst({
    where: { id: input.personId, workspaceId, type: PrincipalType.PERSON, status: PrincipalStatus.ACTIVE, active: true },
    include: { organizationMemberships: { where: { organizationId: input.organizationId } }, userAccount: true },
  });
  if (!person) return fail("NOT_FOUND", "Person not found.");
  const organization = await db.organization.findFirst({ where: { id: input.organizationId, workspaceId }, select: { id: true } });
  if (!organization) return fail("NOT_FOUND", "Organization not found.");

  const existingMembership = person.organizationMemberships[0];
  if (!existingMembership || existingMembership.status !== MembershipStatus.ACTIVE) return fail("VALIDATION", "This Person must have an active organization membership first.");
  if (person.userAccount) return fail("CONFLICT", "This Person already has a Binnie account.");
  const usernameTaken = await db.userAccount.findFirst({ where: { usernameNormalized: requestedUsernameNormalized }, select: { id: true } });
  if (usernameTaken) return fail("CONFLICT", "That username is already in use.");
  const outstanding = await db.invitation.findFirst({
    where: {
      personId: person.id,
      organizationId: input.organizationId,
      status: InvitationStatus.PENDING_OWNER_APPROVAL,
    },
    select: { id: true, status: true },
  });
  if (outstanding) return fail("CONFLICT", "An Owner review is already pending for this person.");

  const invitation = await db.$transaction(async (tx) => {
    const created = await tx.invitation.create({
      data: {
        personId: person.id,
        organizationId: input.organizationId,
        emailNormalized: null,
        requestedUsername: input.requestedUsername.trim(),
        requestedUsernameNormalized,
        requestedAccessLevel: input.requestedAccessLevel,
        requestedById: actor.personId,
        status: InvitationStatus.PENDING_OWNER_APPROVAL,
      },
    });
    await audit(tx, {
      actorPersonId: actor.personId,
      targetPersonId: person.id,
      organizationId: input.organizationId,
      action: AccessAuditAction.ACCESS_REQUESTED,
      metadata: { invitationId: created.id, requestedAccessLevel: input.requestedAccessLevel },
    });
    return created;
  });
  return ok({ invitationId: invitation.id, status: InvitationStatus.PENDING_OWNER_APPROVAL });
}

export async function createBinnieAccount(input: { workspaceId?: string; personId: string; organizationId: string; accessLevel: AccessLevel; username: string }): Promise<Result<{ personId: string; username: string; temporaryPassword: string }>> {
  const provisioned = await provisionBinnieAccount(input);
  if (!provisioned.ok) return fail("VALIDATION", provisioned.message);
  return ok({ personId: provisioned.data.personId, username: provisioned.data.username, temporaryPassword: provisioned.data.temporaryPassword });
}

export async function approveInvitation(input: { workspaceId?: string; invitationId: string; approvedAccessLevel: AccessLevel; approvedUsername: string }): Promise<Result<{ invitationId: string; username: string; temporaryPassword: string }>> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  if (!isWorkspaceOwner(actor, workspaceId)) return fail("FORBIDDEN", "Only an Owner can approve access requests.");
  if (input.approvedAccessLevel === AccessLevel.OWNER) return fail("FORBIDDEN", "Create or change an Owner through the dedicated Owner-management flow.");
  const request = await getDb().invitation.findFirst({ where: { id: input.invitationId, organization: { workspaceId }, status: InvitationStatus.PENDING_OWNER_APPROVAL } });
  if (!request) return fail("NOT_FOUND", "Access request not found or no longer pending.");
  const provisioned = await provisionBinnieAccount({
    workspaceId,
    personId: request.personId,
    organizationId: request.organizationId,
    accessLevel: input.approvedAccessLevel,
    username: input.approvedUsername,
    requestId: request.id,
  });
  if (!provisioned.ok) return fail("VALIDATION", provisioned.message);
  return ok({ invitationId: request.id, username: provisioned.data.username, temporaryPassword: provisioned.data.temporaryPassword });
}

export async function rejectInvitation(input: { workspaceId?: string; invitationId: string; reason?: string }): Promise<Result<{ invitationId: string }>> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  if (!isWorkspaceOwner(actor, workspaceId)) return fail("FORBIDDEN", "Only an Owner can reject access requests.");
  const invitation = await getDb().$transaction(async (tx) => {
    const current = await tx.invitation.findFirst({ where: { id: input.invitationId, organization: { workspaceId } } });
    if (!current) throw new Error("INVITATION_NOT_FOUND");
    if (current.status !== InvitationStatus.PENDING_OWNER_APPROVAL) throw new Error("INVITATION_NOT_PENDING");
    const updated = await tx.invitation.update({
      where: { id: current.id },
      data: { status: InvitationStatus.REJECTED, rejectedAt: new Date(), rejectedById: actor.personId, rejectionReason: input.reason?.trim() || null },
    });
    await audit(tx, {
      actorPersonId: actor.personId,
      targetPersonId: updated.personId,
      organizationId: updated.organizationId,
      action: AccessAuditAction.INVITATION_REJECTED,
      metadata: { invitationId: updated.id, reason: updated.rejectionReason },
    });
    return updated;
  }).catch((error) => {
    if (error instanceof Error && error.message === "INVITATION_NOT_FOUND") return null;
    throw error;
  });
  return invitation ? ok({ invitationId: invitation.id }) : fail("NOT_FOUND", "Access request not found.");
}

export async function cancelInvitation(input: { workspaceId?: string; invitationId: string }): Promise<Result<{ invitationId: string }>> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  const db = getDb();
  const invitation = await db.$transaction(async (tx) => {
    const current = await tx.invitation.findFirst({ where: { id: input.invitationId, organization: { workspaceId } } });
    if (!current) throw new Error("INVITATION_NOT_FOUND");
    if (!canManageOrganization(actor, workspaceId, current.organizationId)) throw new AuthorizationError();
    if (!isWorkspaceOwner(actor, workspaceId) && current.requestedById !== actor.personId) throw new AuthorizationError();
    const cancellableStatuses: InvitationStatus[] = [InvitationStatus.PENDING_OWNER_APPROVAL];
    if (!cancellableStatuses.includes(current.status)) throw new Error("INVITATION_NOT_CANCELLABLE");
    const updated = await tx.invitation.update({
      where: { id: current.id },
      data: { status: InvitationStatus.CANCELLED, cancelledAt: new Date() },
    });
    await audit(tx, { actorPersonId: actor.personId, targetPersonId: updated.personId, organizationId: updated.organizationId, action: AccessAuditAction.INVITATION_CANCELLED, metadata: { invitationId: updated.id } });
    return updated;
  }).catch((error) => {
    if (error instanceof Error && error.message === "INVITATION_NOT_FOUND") return null;
    throw error;
  });
  return invitation ? ok({ invitationId: invitation.id }) : fail("NOT_FOUND", "Access request not found.");
}

export async function suspendUserAccount(input: { workspaceId?: string; personId: string; suspend: boolean }): Promise<Result<{ personId: string }>> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  if (!isWorkspaceOwner(actor, workspaceId)) return fail("FORBIDDEN", "Only an Owner can suspend Binnie access.");
  try {
    await getDb().$transaction(async (tx) => {
      const account = await tx.userAccount.findFirst({ where: { personId: input.personId, person: { workspaceId } } });
      if (!account) throw new Error("ACCOUNT_NOT_FOUND");
      if (input.suspend) await assertNotLastActiveOwner(tx, workspaceId, input.personId);
      await tx.userAccount.update({
        where: { id: account.id },
        data: input.suspend
          ? { status: UserAccountStatus.SUSPENDED, suspendedAt: new Date() }
          : { status: UserAccountStatus.ACTIVE, suspendedAt: null, accessRemovedAt: null },
      });
      if (input.suspend) {
        await tx.authSession.deleteMany({ where: { userId: account.authUserId } });
        await audit(tx, { actorPersonId: actor.personId, targetPersonId: input.personId, action: AccessAuditAction.SESSIONS_REVOKED });
      }
      await audit(tx, {
        actorPersonId: actor.personId,
        targetPersonId: input.personId,
        action: input.suspend ? AccessAuditAction.ACCOUNT_SUSPENDED : AccessAuditAction.ACCOUNT_REACTIVATED,
      });
    });
    return ok({ personId: input.personId });
  } catch (error) {
    if (error instanceof Error && error.message === "BINNIE_LAST_ACTIVE_OWNER") return fail("CONFLICT", "Binnie must retain at least one active Owner.");
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") return fail("NOT_FOUND", "Binnie account not found.");
    throw error;
  }
}

export async function removeBinnieAccess(input: { workspaceId?: string; personId: string }): Promise<Result<{ personId: string }>> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  if (!isWorkspaceOwner(actor, workspaceId)) return fail("FORBIDDEN", "Only an Owner can remove Binnie access.");
  try {
    await getDb().$transaction(async (tx) => {
      const account = await tx.userAccount.findFirst({ where: { personId: input.personId, person: { workspaceId } } });
      if (!account) throw new Error("ACCOUNT_NOT_FOUND");
      await assertNotLastActiveOwner(tx, workspaceId, input.personId);
      await tx.userAccount.update({ where: { id: account.id }, data: { status: UserAccountStatus.ACCESS_REMOVED, accessRemovedAt: new Date() } });
      await tx.authSession.deleteMany({ where: { userId: account.authUserId } });
      await audit(tx, { actorPersonId: actor.personId, targetPersonId: input.personId, action: AccessAuditAction.SESSIONS_REVOKED });
      await audit(tx, { actorPersonId: actor.personId, targetPersonId: input.personId, action: AccessAuditAction.ACCESS_REMOVED });
    });
    return ok({ personId: input.personId });
  } catch (error) {
    if (error instanceof Error && error.message === "BINNIE_LAST_ACTIVE_OWNER") return fail("CONFLICT", "Binnie must retain at least one active Owner.");
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") return fail("NOT_FOUND", "Binnie account not found.");
    throw error;
  }
}

export async function removeOrganizationMembership(input: { workspaceId?: string; personId: string; organizationId: string }): Promise<Result<{ personId: string }>> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  if (!canManageOrganization(actor, workspaceId, input.organizationId)) return fail("FORBIDDEN", "You do not have permission to remove this organization affiliation.");
  try {
    await getDb().$transaction(async (tx) => {
      const targetMembership = await tx.organizationMembership.findFirst({ where: { personId: input.personId, organizationId: input.organizationId, status: MembershipStatus.ACTIVE }, select: { id: true, accessLevel: true } });
      if (!targetMembership) throw new Error("MEMBERSHIP_NOT_FOUND");
      const targetOwner = await tx.organizationMembership.findFirst({ where: { ...workspaceOwnerMembershipWhere(workspaceId), personId: input.personId }, select: { id: true } });
      if (targetOwner && !isWorkspaceOwner(actor, workspaceId)) throw new AuthorizationError();
      if (!isWorkspaceOwner(actor, workspaceId) && targetMembership.accessLevel && targetMembership.accessLevel !== AccessLevel.MEMBER) throw new AuthorizationError("BINNIE_MANAGER_CANNOT_MANAGE_ELEVATED_ACCESS");
      await assertNotLastActiveOwner(tx, workspaceId, input.personId);
      const membership = await tx.organizationMembership.updateMany({
        where: { personId: input.personId, organizationId: input.organizationId, status: MembershipStatus.ACTIVE },
        data: { status: MembershipStatus.REMOVED, removedAt: new Date(), accessLevel: null },
      });
      if (membership.count !== 1) throw new Error("MEMBERSHIP_NOT_FOUND");
      await audit(tx, { actorPersonId: actor.personId, targetPersonId: input.personId, organizationId: input.organizationId, action: AccessAuditAction.ORGANIZATION_MEMBERSHIP_REMOVED });
    });
    return ok({ personId: input.personId });
  } catch (error) {
    if (error instanceof AuthorizationError) return fail("FORBIDDEN", "Managers cannot remove an Owner or elevated access.");
    if (error instanceof Error && error.message === "BINNIE_LAST_ACTIVE_OWNER") return fail("CONFLICT", "Binnie must retain at least one active Owner.");
    if (error instanceof Error && error.message === "MEMBERSHIP_NOT_FOUND") return fail("NOT_FOUND", "Organization membership not found.");
    throw error;
  }
}

export async function updateOrganizationAccess(input: { workspaceId?: string; personId: string; organizationId: string; accessLevel: AccessLevel }): Promise<Result<{ personId: string }>> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  if (!isWorkspaceOwner(actor, workspaceId)) return fail("FORBIDDEN", "Only an Owner can change access levels.");
  try {
    await getDb().$transaction(async (tx) => {
      const membership = await tx.organizationMembership.findFirst({ where: { personId: input.personId, organizationId: input.organizationId, organization: { workspaceId } } });
      if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");
      if (membership.accessLevel === AccessLevel.OWNER && input.accessLevel !== AccessLevel.OWNER) await assertNotLastActiveOwner(tx, workspaceId, input.personId);
      await tx.organizationMembership.update({ where: { id: membership.id }, data: { accessLevel: input.accessLevel, status: MembershipStatus.ACTIVE, removedAt: null } });
      await audit(tx, {
        actorPersonId: actor.personId,
        targetPersonId: input.personId,
        organizationId: input.organizationId,
        action: AccessAuditAction.ACCESS_LEVEL_CHANGED,
        before: { accessLevel: membership.accessLevel },
        after: { accessLevel: input.accessLevel },
      });
    });
    return ok({ personId: input.personId });
  } catch (error) {
    if (error instanceof Error && error.message === "BINNIE_LAST_ACTIVE_OWNER") return fail("CONFLICT", "Binnie must retain at least one active Owner.");
    if (error instanceof Error && error.message === "MEMBERSHIP_NOT_FOUND") return fail("NOT_FOUND", "Organization membership not found.");
    throw error;
  }
}

export type AccessConsoleData = {
  currentPersonId: string;
  isOwner: boolean;
  managedOrganizationIds: string[];
  organizations: Array<{
    id: string;
    name: string;
    departments: Array<{ id: string; name: string }>;
    teams: Array<{ id: string; name: string; departmentId?: string }>;
    peopleCount: number;
    activeUserCount: number;
    pendingInvitationCount: number;
    pendingApprovalCount: number;
  }>;
  people: Array<{
    id: string;
    name: string;
    jobTitle?: string;
    contactEmail?: string;
    accountStatus: "PERSON_ONLY" | UserAccountStatus;
    username?: string;
    requiresPasswordChange?: boolean;
    accessRequestStatus?: InvitationStatus;
    memberships: Array<{ organizationId: string; organizationName: string; accessLevel?: AccessLevel; status: MembershipStatus; departments: Array<{ id: string; name: string }>; teams: Array<{ id: string; name: string }> }>;
  }>;
  invitations: Array<{
    id: string;
    personId: string;
    personName: string;
    organizationId: string;
    organizationName: string;
    requestedAccessLevel: AccessLevel;
    requestedUsername?: string;
    approvedAccessLevel?: AccessLevel;
    approvedUsername?: string;
    status: InvitationStatus;
    requestedByName: string;
    rejectionReason?: string;
    createdAt: string;
    expiresAt?: string;
  }>;
  audit: Array<{ id: string; action: AccessAuditAction; actor?: string; target?: string; organization?: string; createdAt: string }>;
};

/**
 * Server-scoped access-management read model. It intentionally never relies on
 * React to hide directory rows: an Organization Manager receives only people
 * and requests in organizations they manage; only a workspace Owner receives
 * the whole directory, contact emails, and audit history.
 */
export async function getAccessConsole(workspaceId = DEFAULT_WORKSPACE_ID): Promise<AccessConsoleData> {
  const actor = await requireCurrentUser(workspaceId);
  const owner = isWorkspaceOwner(actor, workspaceId);
  const managedOrganizationIds = owner
    ? actor.organizationMemberships.map((membership) => membership.organizationId)
    : actor.organizationMemberships
      .filter((membership) => membership.accessLevel === AccessLevel.ORGANIZATION_MANAGER)
      .map((membership) => membership.organizationId);
  const organizationIds = [...new Set(managedOrganizationIds)];
  if (!owner && !organizationIds.length) throw new AuthorizationError();
  const db = getDb();
  const activeInvitationStatuses = [InvitationStatus.PENDING_OWNER_APPROVAL];

  const [organizations, people, invitations, auditRows] = await Promise.all([
    db.organization.findMany({
      where: { workspaceId, id: { in: organizationIds } },
      include: {
        departments: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        teamScopes: {
          where: { status: MembershipStatus.ACTIVE },
          select: { departmentId: true, team: { select: { id: true, name: true, active: true, status: true } } },
        },
        accessMemberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: { personId: true, person: { select: { userAccount: { select: { status: true } } } } },
        },
        invitations: { where: { status: { in: activeInvitationStatuses } }, select: { status: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.principal.findMany({
      where: {
        workspaceId,
        type: PrincipalType.PERSON,
        status: PrincipalStatus.ACTIVE,
        active: true,
        organizationMemberships: { some: { organizationId: { in: organizationIds }, status: MembershipStatus.ACTIVE } },
      },
      include: {
        userAccount: { select: { status: true, username: true, usernameNormalized: true, requiresPasswordChange: true } },
        invitationPerson: {
          where: { organizationId: { in: organizationIds }, status: { in: activeInvitationStatuses } },
          select: { status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        organizationMemberships: {
          where: { organizationId: { in: organizationIds }, status: MembershipStatus.ACTIVE },
          include: { organization: { select: { id: true, name: true } } },
        },
        departmentMemberships: {
          where: { status: MembershipStatus.ACTIVE, department: { organizationId: { in: organizationIds } } },
          include: { department: { select: { id: true, name: true, organizationId: true } } },
        },
        teamMemberships: {
          where: { status: MembershipStatus.ACTIVE },
          include: { team: { select: { id: true, name: true, teamScopes: { where: { status: MembershipStatus.ACTIVE, organizationId: { in: organizationIds } }, select: { organizationId: true } } } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.invitation.findMany({
      where: owner
        ? { organization: { workspaceId }, organizationId: { in: organizationIds } }
        : { organizationId: { in: organizationIds }, requestedById: actor.personId },
      include: {
        person: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        requestedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    owner
      ? db.accessAuditLog.findMany({
        where: { organization: { workspaceId } },
        include: { actor: { select: { name: true } }, target: { select: { name: true } }, organization: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
      : Promise.resolve([]),
  ]);

  return {
    currentPersonId: actor.personId,
    isOwner: owner,
    managedOrganizationIds: organizationIds,
    organizations: organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      departments: organization.departments,
      teams: organization.teamScopes
        .filter((scope) => scope.team.active && scope.team.status === PrincipalStatus.ACTIVE)
        .map((scope) => ({ id: scope.team.id, name: scope.team.name, departmentId: scope.departmentId || undefined })),
      peopleCount: new Set(organization.accessMemberships.map((membership) => membership.personId)).size,
      activeUserCount: new Set(
        organization.accessMemberships
          .filter((membership) => membership.person.userAccount?.status === UserAccountStatus.ACTIVE)
          .map((membership) => membership.personId),
      ).size,
      pendingInvitationCount: 0,
      pendingApprovalCount: organization.invitations.filter((invitation) => invitation.status === InvitationStatus.PENDING_OWNER_APPROVAL).length,
    })),
    people: people.map((person) => ({
      id: person.id,
      name: person.name,
      jobTitle: person.jobTitle || undefined,
      contactEmail: owner ? person.email || undefined : undefined,
      accountStatus: person.userAccount?.status || "PERSON_ONLY",
      username: person.userAccount?.username || person.userAccount?.usernameNormalized || undefined,
      requiresPasswordChange: person.userAccount?.requiresPasswordChange || undefined,
      accessRequestStatus: person.invitationPerson[0]?.status,
      memberships: person.organizationMemberships.map((membership) => ({
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        accessLevel: membership.accessLevel || undefined,
        status: membership.status,
        departments: person.departmentMemberships
          .filter((department) => department.department.organizationId === membership.organizationId)
          .map((department) => ({ id: department.department.id, name: department.department.name })),
        teams: person.teamMemberships
          .filter((teamMembership) => teamMembership.team.teamScopes.some((scope) => scope.organizationId === membership.organizationId))
          .map((teamMembership) => ({ id: teamMembership.team.id, name: teamMembership.team.name })),
      })),
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      personId: invitation.person.id,
      personName: invitation.person.name,
      organizationId: invitation.organization.id,
      organizationName: invitation.organization.name,
      requestedAccessLevel: invitation.requestedAccessLevel,
      requestedUsername: invitation.requestedUsername || invitation.requestedUsernameNormalized || undefined,
      approvedAccessLevel: invitation.approvedAccessLevel || undefined,
      approvedUsername: invitation.approvedUsername || invitation.approvedUsernameNormalized || undefined,
      status: invitation.status,
      requestedByName: invitation.requestedBy.name,
      rejectionReason: invitation.rejectionReason || undefined,
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt?.toISOString(),
    })),
    audit: auditRows.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor?.name,
      target: row.target?.name,
      organization: row.organization?.name,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
