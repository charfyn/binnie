import "dotenv/config";

import { randomUUID } from "node:crypto";
import { createLocalAccountIssuer } from "@better-auth/core/db";
import { hashPassword } from "better-auth/crypto";
import {
  AccessAuditAction,
  AccessLevel,
  MembershipStatus,
  PrincipalStatus,
  PrincipalType,
  PrismaClient,
  UserAccountStatus,
} from "../src/generated/prisma/client";
import { generateTemporaryPassword, internalAuthIdentityEmail, TEMPORARY_PASSWORD_TTL_MS, validateUsername } from "../src/lib/account-identity";
import { createPostgresAdapter } from "../src/lib/database-adapter";

const WORKSPACE_ID = "workspace-binnie";
const credentialIssuer = createLocalAccountIssuer("credential");

function required(name: "DATABASE_URL" | "BINNIE_OWNER_PERSON_ID" | "BINNIE_OWNER_USERNAME") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. This command never infers an Owner from a name, email, or sidebar value.`);
  return value;
}

function explicitPasswordReset() {
  return process.env.BINNIE_OWNER_PASSWORD_RESET === "true";
}

async function main() {
  const connectionString = required("DATABASE_URL");
  const personId = required("BINNIE_OWNER_PERSON_ID");
  const username = required("BINNIE_OWNER_USERNAME");
  const usernameNormalized = validateUsername(username);
  if (!usernameNormalized) throw new Error("BINNIE_OWNER_USERNAME must use 3–30 letters, numbers, periods, or underscores.");
  const db = new PrismaClient({ adapter: createPostgresAdapter(connectionString) });
  try {
    const temporaryPassword = generateTemporaryPassword();
    const result = await db.$transaction(async (tx) => {
      const owner = await tx.principal.findUnique({
        where: { id: personId },
        include: {
          organizationMemberships: {
            where: { status: MembershipStatus.ACTIVE, accessLevel: AccessLevel.OWNER, organization: { workspaceId: WORKSPACE_ID } },
            select: { id: true },
          },
          userAccount: { include: { authUser: true } },
        },
      });
      if (!owner || owner.workspaceId !== WORKSPACE_ID || owner.type !== PrincipalType.PERSON || owner.status !== PrincipalStatus.ACTIVE || !owner.active) {
        throw new Error(`Configured Principal ${personId} is not an active Person in ${WORKSPACE_ID}. No records were changed.`);
      }
      if (!owner.organizationMemberships.length) throw new Error(`Configured Principal ${personId} does not have an active Owner membership. No records were changed.`);
      if (owner.userAccount && owner.userAccount.status !== UserAccountStatus.ACTIVE) throw new Error(`Configured Owner UserAccount is ${owner.userAccount.status}; bootstrap will not bypass account status.`);

      const usernameOwner = await tx.userAccount.findFirst({ where: { usernameNormalized }, select: { id: true, personId: true } });
      if (usernameOwner && usernameOwner.personId !== owner.id) throw new Error(`Username ${usernameNormalized} already belongs to another Binnie account. No records were changed.`);

      let accountId = owner.userAccount?.id;
      let authUserId = owner.userAccount?.authUserId;
      let requiresPasswordChange = owner.userAccount?.requiresPasswordChange || false;
      let accountCreated = false;
      if (!accountId || !authUserId) {
        authUserId = randomUUID();
        await tx.authUser.create({ data: { id: authUserId, name: owner.name, email: internalAuthIdentityEmail(authUserId), emailVerified: true } });
        const createdAccount = await tx.userAccount.create({
          data: {
            authUserId,
            personId: owner.id,
            username,
            usernameNormalized,
            status: UserAccountStatus.ACTIVE,
            requiresPasswordChange: true,
            temporaryPasswordExpiresAt: new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS),
          },
        });
        accountId = createdAccount.id;
        requiresPasswordChange = true;
        accountCreated = true;
      } else {
        await tx.userAccount.update({
          where: { id: accountId },
          data: { username, usernameNormalized },
        });
      }

      const credential = await tx.authAccount.findFirst({
        where: { userId: authUserId, providerId: "credential", issuer: credentialIssuer, accountId: authUserId },
      });
      const mustProvisionPassword = accountCreated || !credential || explicitPasswordReset();
      if (mustProvisionPassword) {
        const passwordHash = await hashPassword(temporaryPassword);
        if (credential) await tx.authAccount.update({ where: { id: credential.id }, data: { password: passwordHash } });
        else await tx.authAccount.create({ data: { id: randomUUID(), issuer: credentialIssuer, accountId: authUserId, providerId: "credential", userId: authUserId, password: passwordHash } });
        await tx.userAccount.update({ where: { id: accountId }, data: { requiresPasswordChange: true, temporaryPasswordExpiresAt: new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS), passwordChangedAt: null } });
        await tx.authSession.deleteMany({ where: { userId: authUserId } });
        requiresPasswordChange = true;
        await tx.accessAuditLog.create({ data: { actorPersonId: owner.id, targetPersonId: owner.id, action: AccessAuditAction.SESSIONS_REVOKED, metadata: { reason: "owner-bootstrap-password" } } });
      }
      await tx.accessAuditLog.create({
        data: {
          actorPersonId: owner.id,
          targetPersonId: owner.id,
          action: accountCreated ? AccessAuditAction.ACCOUNT_CREATED : (mustProvisionPassword ? AccessAuditAction.PASSWORD_RESET : AccessAuditAction.USERNAME_CHANGED),
          after: { username, requiresPasswordChange },
          metadata: { source: "auth:bootstrap-owner" },
        },
      });
      return { accountCreated, passwordProvisioned: mustProvisionPassword, accountId };
    });
    console.info(`Owner bootstrap complete for Principal ${personId}. UserAccount ${result.accountCreated ? "created" : "reused"} (${result.accountId}); username ${username}.`);
    if (result.passwordProvisioned) console.info(`Temporary Owner password (show once, then discard): ${temporaryPassword}`);
    else console.info("Existing password credential was preserved. Set BINNIE_OWNER_PASSWORD_RESET=true only when a deliberate temporary-password reset is needed.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Owner bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
