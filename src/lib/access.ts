import "server-only";

import { headers } from "next/headers";
import {
  AccessLevel,
  MembershipStatus,
  PrincipalStatus,
  UserAccountStatus,
} from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { authDiagnostic } from "@/lib/auth-diagnostics";
import { getDb } from "@/lib/db";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("BINNIE_AUTHENTICATION_REQUIRED");
  }
}

export class PasswordChangeRequiredError extends Error {
  constructor() {
    super("BINNIE_PASSWORD_CHANGE_REQUIRED");
  }
}

export class AuthorizationError extends Error {
  constructor(message = "BINNIE_FORBIDDEN") {
    super(message);
  }
}

export interface CurrentUserContext {
  authUserId: string;
  accountId: string;
  personId: string;
  workspaceId: string;
  displayName: string;
  username: string;
  contactEmail?: string;
  requiresPasswordChange: boolean;
  organizationMemberships: Array<{ organizationId: string; organizationName: string; accessLevel: AccessLevel | null }>;
  departmentMemberships: Array<{ departmentId: string; organizationId: string }>;
  departmentIds: string[];
  teamIds: string[];
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const account = await getDb().userAccount.findFirst({
    where: {
      authUserId: session.user.id,
      status: UserAccountStatus.ACTIVE,
      person: { status: PrincipalStatus.ACTIVE, active: true },
    },
    include: {
      person: {
        include: {
          organizationMemberships: {
            where: { status: MembershipStatus.ACTIVE },
            include: { organization: { select: { workspaceId: true, name: true } } },
          },
          departmentMemberships: { where: { status: MembershipStatus.ACTIVE }, include: { department: { select: { organizationId: true } } } },
          teamMemberships: { where: { status: MembershipStatus.ACTIVE }, select: { teamId: true } },
        },
      },
    },
  });
  if (!account) return null;

  // Better Auth owns the session. Binnie records the first successful request
  // for that session as the account's last login without creating a parallel
  // session or trusting any client-provided identity.
  const sessionCreatedAt = session.session?.createdAt ? new Date(session.session.createdAt) : null;
  if (sessionCreatedAt && (!account.lastLoginAt || account.lastLoginAt < sessionCreatedAt)) {
    await getDb().userAccount.update({ where: { id: account.id }, data: { lastLoginAt: sessionCreatedAt } });
  }

  const workspaceIds = new Set(account.person.organizationMemberships.map((membership) => membership.organization.workspaceId));
  if (workspaceIds.size !== 1) return null;
  const workspaceId = [...workspaceIds][0]!;
  const context = {
    authUserId: account.authUserId,
    accountId: account.id,
    personId: account.personId,
    workspaceId,
    displayName: account.person.name,
    username: account.username || account.usernameNormalized || "",
    contactEmail: account.person.email || undefined,
    requiresPasswordChange: account.requiresPasswordChange,
    organizationMemberships: account.person.organizationMemberships.map((membership) => ({
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      accessLevel: membership.accessLevel,
    })),
    departmentMemberships: account.person.departmentMemberships.map((membership) => ({
      departmentId: membership.departmentId,
      organizationId: membership.department.organizationId,
    })),
    departmentIds: account.person.departmentMemberships.map((membership) => membership.departmentId),
    teamIds: account.person.teamMemberships.map((membership) => membership.teamId),
  };
  authDiagnostic("UserAccount and Principal resolved", {
    authUserId: context.authUserId,
    personId: context.personId,
    username: context.username,
    workspaceId: context.workspaceId,
  });
  authDiagnostic("Owner authorization resolved", { personId: context.personId, isOwner: isWorkspaceOwner(context, workspaceId) });
  return context;
}

export async function requireCurrentUser(workspaceId?: string, options?: { allowPasswordChange?: boolean }) {
  const context = await getCurrentUserContext();
  if (!context) throw new AuthenticationRequiredError();
  if (workspaceId && context.workspaceId !== workspaceId) throw new AuthorizationError();
  if (context.requiresPasswordChange && !options?.allowPasswordChange) throw new PasswordChangeRequiredError();
  return context;
}

/** The only workspace-global Owner interpretation used anywhere in Binnie. */
export function isWorkspaceOwner(context: CurrentUserContext, workspaceId: string) {
  return context.workspaceId === workspaceId && context.organizationMemberships.some((membership) => membership.accessLevel === AccessLevel.OWNER);
}

export function accessLevelForOrganization(context: CurrentUserContext, organizationId: string) {
  return context.organizationMemberships.find((membership) => membership.organizationId === organizationId)?.accessLevel || null;
}

export function canAccessOrganization(context: CurrentUserContext, workspaceId: string, organizationId: string) {
  return isWorkspaceOwner(context, workspaceId) || accessLevelForOrganization(context, organizationId) !== null;
}

export function canManageOrganization(context: CurrentUserContext, workspaceId: string, organizationId: string) {
  if (isWorkspaceOwner(context, workspaceId)) return true;
  return accessLevelForOrganization(context, organizationId) === AccessLevel.ORGANIZATION_MANAGER;
}

export function canManageDepartment(context: CurrentUserContext, workspaceId: string, organizationId: string, departmentId?: string | null) {
  if (canManageOrganization(context, workspaceId, organizationId)) return true;
  return Boolean(
    departmentId
    && accessLevelForOrganization(context, organizationId) === AccessLevel.DEPARTMENT_HEAD
    && context.departmentIds.includes(departmentId),
  );
}

export function isViewer(context: CurrentUserContext, organizationId: string) {
  return accessLevelForOrganization(context, organizationId) === AccessLevel.VIEWER;
}

export function assertWorkspaceOwner(context: CurrentUserContext, workspaceId: string) {
  if (!isWorkspaceOwner(context, workspaceId)) throw new AuthorizationError();
}
