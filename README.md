
  # Binnie

  Less to remember. More room to think.

  Binnie is a calm AI-powered work companion for tasks, reminders, delegated work, and everything else taking up mental space.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Multi-user access setup

Create an untracked `.env` file, configure PostgreSQL and Better Auth, then run
`npx prisma migrate deploy`. Migrations are additive; do not run
  `prisma migrate reset` or reseed an existing Binnie workspace.

  For the first Owner, set `BINNIE_OWNER_PERSON_ID` to the stable existing
  Person ID and `BINNIE_OWNER_USERNAME` to the intended username (for this
  workspace, `charlotte`).
  Then run:

  ```sh
  npm run auth:bootstrap-owner
  ```

  This command is idempotent. It validates that exact active Person has an
  active Owner membership, then creates or reuses exactly one Better Auth user
  and one active `UserAccount` linked to that Person. On first provision it
  prints a secure, one-time temporary password; sign in as `charlotte`, then
  choose a permanent password. It never creates a Person, workspace,
  organization, task, project, or invitation. A repeated run preserves the
  password unless `BINNIE_OWNER_PASSWORD_RESET=true` is explicitly set.
  All later account management is available from `/people/access`.

  Binnie reads these server-only environment variables: `DATABASE_URL`,
  `BETTER_AUTH_URL` (or legacy `NEXTAUTH_URL`), `BETTER_AUTH_SECRET` (or legacy
  `NEXTAUTH_SECRET`), `BINNIE_MULTI_USER_AUTH_ENABLED`,
  `BINNIE_OWNER_PERSON_ID`, `BINNIE_OWNER_USERNAME`, and optionally
  `BINNIE_OWNER_PASSWORD_RESET`. Resend is not required to authenticate.

  Production sign-in remains intentionally disabled until the rollout gate is
  complete. Set `BINNIE_MULTI_USER_AUTH_ENABLED=true` only after the Owner
  bootstrap, scoped-read, authorization, invitation, and migration checks pass.

  Binnie has no public registration. Owners create accounts directly with a
  temporary password; Organization Managers request an account and an Owner
  approves it. Better Auth stores only credential hashes and signed sessions.
