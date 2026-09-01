import "server-only";

import { randomUUID } from "node:crypto";
import { createLocalAccountIssuer } from "@better-auth/core/db";
import { AccessAuditAction, AccessLevel, InvitationStatus, MembershipStatus, PrincipalStatus, PrincipalType, UserAccountStatus, type Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { generateTemporaryPassword, internalAuthIdentityEmail, TEMPORARY_PASSWORD_TTL_MS, validateUsername } from "@/lib/account-identity";
import { isWorkspaceOwner, requireCurrentUser } from "@/lib/access";
import { getDb } from "@/lib/db";

const WORKSPACE_ID = "workspace-binnie";
const credentialIssuer = createLocalAccountIssuer("credential");

type ProvisionResult = { personId: string; accountId: string; username: string; temporaryPassword: string };

function failure(message: string) {
  return { ok: false as const, message };
}

function success(data: ProvisionResult) {
  return { ok: true as const, data };
}

async function passwordHash(password: string) {
  // This is Better Auth's configured password implementation—not custom
  // cryptography—so future Better Auth hash configuration remains respected.
  const context = await auth.$context;
  return context.password.hash(password);
}

async function audit(tx: Prisma.TransactionClient, input: {
  actorPersonId: string;
  targetPersonId: string;
  organizationId?: string;
  action: AccessAuditAction;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}) {
  await tx.accessAuditLog.create({ data: input });
}

async function assertProvisionTarget(tx: Prisma.TransactionClient, input: { personId: string; organizationId: string; accessLevel: AccessLevel; workspaceId: string }) {
  const person = await tx.principal.findFirst({
    where: { id: input.personId, workspaceId: input.workspaceId, type: PrincipalType.PERSON, active: true, status: PrincipalStatus.ACTIVE },
    include: { organizationMemberships: { where: { organizationId: input.organizationId } }, userAccount: true },
  });
  if (!person) throw new Error("PERSON_NOT_FOUND");
  if (person.userAccount) throw new Error("ACCOUNT_EXISTS");
  const membership = person.organizationMemberships[0];
  if (!membership || membership.status !== MembershipStatus.ACTIVE) throw new Error("MEMBERSHIP_NOT_FOUND");
  return { person, membership };
}

/** Owner-only direct provisioning. It creates exactly one UserAccount for the
 * existing Person, a Better Auth credential account with a hash, and no new
 * Person, organization, task, or project. */
export async function provisionBinnieAccount(input: {
  workspaceId?: string;
  personId: string;
  organizationId: string;
  accessLevel: AccessLevel;
  username: string;
  requestId?: string;
}) {
  const workspaceId = input.workspaceId || WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  const actorPersonId = actor.personId;
  if (!isWorkspaceOwner(actor, workspaceId)) return failure("Only an Owner can create a Binnie account.");
  const usernameNormalized = validateUsername(input.username);
  if (!usernameNormalized) return failure("Use 3–30 lowercase letters, numbers, periods, or underscores for the username.");
  const temporaryPassword = generateTemporaryPassword();
  const hash = await passwordHash(temporaryPassword);
  const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS);
  const db = getDb();

  try {
    const provisioned = await db.$transaction(async (tx) => {
      const { person, membership } = await assertProvisionTarget(tx, { ...input, workspaceId });
      const usernameConflict = await tx.userAccount.findFirst({ where: { usernameNormalized }, select: { id: true } });
      if (usernameConflict) throw new Error("USERNAME_TAKEN");

      const authUserId = randomUUID();
      const authUser = await tx.authUser.create({
        data: { id: authUserId, name: person.name, email: internalAuthIdentityEmail(authUserId), emailVerified: true },
      });
      const account = await tx.userAccount.create({
        data: {
          authUserId: authUser.id,
          personId: person.id,
          username: input.username.trim(),
          usernameNormalized,
          status: UserAccountStatus.ACTIVE,
          requiresPasswordChange: true,
          temporaryPasswordExpiresAt: expiresAt,
        },
      });
      await tx.authAccount.create({
        data: {
          id: randomUUID(),
          issuer: credentialIssuer,
          accountId: authUser.id,
          providerId: "credential",
          userId: authUser.id,
          password: hash,
        },
      });
      await tx.organizationMembership.update({ where: { id: membership.id }, data: { accessLevel: input.accessLevel, status: MembershipStatus.ACTIVE, removedAt: null } });
      if (input.requestId) {
        await tx.invitation.update({
          where: { id: input.requestId },
          data: {
            status: InvitationStatus.ACCEPTED,
            approvedAccessLevel: input.accessLevel,
            approvedUsername: input.username.trim(),
            approvedUsernameNormalized: usernameNormalized,
            approvedById: actorPersonId,
            acceptedAt: new Date(),
          },
        });
        await audit(tx, {
          actorPersonId,
          targetPersonId: person.id,
          organizationId: input.organizationId,
          action: AccessAuditAction.INVITATION_APPROVED,
          after: { username: input.username.trim(), accessLevel: input.accessLevel },
          metadata: { requestId: input.requestId },
        });
      }
      await audit(tx, {
        actorPersonId,
        targetPersonId: person.id,
        organizationId: input.organizationId,
        action: AccessAuditAction.ACCOUNT_CREATED,
        after: { username: input.username.trim(), accessLevel: input.accessLevel, requiresPasswordChange: true },
        metadata: input.requestId ? { requestId: input.requestId } : undefined,
      });
      return { personId: person.id, accountId: account.id };
    });
    return success({ ...provisioned, username: input.username.trim(), temporaryPassword });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ACCOUNT_PROVISION_FAILED";
    if (code === "PERSON_NOT_FOUND") return failure("Person not found.");
    if (code === "MEMBERSHIP_NOT_FOUND") return failure("That Person must have an active organization membership first.");
    if (code === "ACCOUNT_EXISTS") return failure("This Person already has a Binnie account.");
    if (code.includes("Unique constraint") || code === "USERNAME_TAKEN") return failure("That username is already in use.");
    throw error;
  }
}

export async function resetBinniePassword(input: { workspaceId?: string; personId: string }) {
  const workspaceId = input.workspaceId || WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  if (!isWorkspaceOwner(actor, workspaceId)) return failure("Only an Owner can reset Binnie passwords.");
  const temporaryPassword = generateTemporaryPassword();
  const hash = await passwordHash(temporaryPassword);
  const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS);
  const db = getDb();
  try {
    const account = await db.$transaction(async (tx) => {
      const target = await tx.userAccount.findFirst({
        where: { personId: input.personId, person: { workspaceId, type: PrincipalType.PERSON } },
        include: { person: { include: { organizationMemberships: { where: { status: MembershipStatus.ACTIVE } } } } },
      });
      if (!target) throw new Error("ACCOUNT_NOT_FOUND");
      const credential = await tx.authAccount.findFirst({ where: { userId: target.authUserId, issuer: credentialIssuer, accountId: target.authUserId, providerId: "credential" } });
      if (!credential) throw new Error("CREDENTIAL_NOT_FOUND");
      await tx.authAccount.update({ where: { id: credential.id }, data: { password: hash } });
      await tx.userAccount.update({ where: { id: target.id }, data: { requiresPasswordChange: true, temporaryPasswordExpiresAt: expiresAt, passwordChangedAt: null } });
      await tx.authSession.deleteMany({ where: { userId: target.authUserId } });
      await audit(tx, { actorPersonId: actor.personId, targetPersonId: input.personId, action: AccessAuditAction.SESSIONS_REVOKED, metadata: { reason: "owner-password-reset" } });
      await audit(tx, { actorPersonId: actor.personId, targetPersonId: input.personId, action: AccessAuditAction.PASSWORD_RESET, after: { requiresPasswordChange: true } });
      return target;
    });
    return { ok: true as const, data: { personId: account.personId, username: account.username || account.usernameNormalized || "", temporaryPassword } };
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") return failure("Binnie account not found.");
    if (error instanceof Error && error.message === "CREDENTIAL_NOT_FOUND") return failure("This account has no password credential yet. Bootstrap it first.");
    throw error;
  }
}

export async function changeOwnPassword(input: { workspaceId?: string; password: string }) {
  const workspaceId = input.workspaceId || WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId, { allowPasswordChange: true });
  if (input.password.length < 8 || input.password.length > 128) return failure("Use a password with at least 8 characters.");
  const hash = await passwordHash(input.password);
  const db = getDb();
  const updated = await db.$transaction(async (tx) => {
    const credential = await tx.authAccount.findFirst({ where: { userId: actor.authUserId, issuer: credentialIssuer, accountId: actor.authUserId, providerId: "credential" } });
    if (!credential) throw new Error("CREDENTIAL_NOT_FOUND");
    await tx.authAccount.update({ where: { id: credential.id }, data: { password: hash } });
    await tx.userAccount.update({ where: { id: actor.accountId }, data: { requiresPasswordChange: false, temporaryPasswordExpiresAt: null, passwordChangedAt: new Date() } });
    await audit(tx, { actorPersonId: actor.personId, targetPersonId: actor.personId, action: AccessAuditAction.PASSWORD_CHANGED });
    return actor.personId;
  });
  return { ok: true as const, data: { personId: updated } };
}

export async function changeBinnieUsername(input: { workspaceId?: string; personId: string; username: string }) {
  const workspaceId = input.workspaceId || WORKSPACE_ID;
  const actor = await requireCurrentUser(workspaceId);
  if (!isWorkspaceOwner(actor, workspaceId)) return failure("Only an Owner can change usernames.");
  const usernameNormalized = validateUsername(input.username);
  if (!usernameNormalized) return failure("Use 3–30 lowercase letters, numbers, periods, or underscores for the username.");
  try {
    await getDb().$transaction(async (tx) => {
      const account = await tx.userAccount.findFirst({ where: { personId: input.personId, person: { workspaceId } } });
      if (!account) throw new Error("ACCOUNT_NOT_FOUND");
      const duplicate = await tx.userAccount.findFirst({ where: { usernameNormalized, id: { not: account.id } }, select: { id: true } });
      if (duplicate) throw new Error("USERNAME_TAKEN");
      await tx.userAccount.update({ where: { id: account.id }, data: { username: input.username.trim(), usernameNormalized } });
      await audit(tx, { actorPersonId: actor.personId, targetPersonId: input.personId, action: AccessAuditAction.USERNAME_CHANGED, before: { username: account.username || account.usernameNormalized }, after: { username: input.username.trim() } });
    });
    return { ok: true as const, data: { personId: input.personId, username: input.username.trim() } };
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") return failure("Binnie account not found.");
    if (error instanceof Error && (error.message === "USERNAME_TAKEN" || error.message.includes("Unique constraint"))) return failure("That username is already in use.");
    throw error;
  }
}
