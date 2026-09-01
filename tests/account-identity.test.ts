import assert from "node:assert/strict";
import test from "node:test";
import { generateTemporaryPassword, normalizeUsername, validateUsername } from "../src/lib/account-identity.ts";

test("usernames normalize case-insensitively and reject unsafe credentials", () => {
  assert.equal(normalizeUsername("  Bu.Desti  "), "bu.desti");
  assert.equal(validateUsername("  Bu.Desti  "), "bu.desti");
  assert.equal(validateUsername("ab"), null);
  assert.equal(validateUsername("bu desti"), null);
  assert.equal(validateUsername("bu/desti"), null);
});

test("temporary credentials are high-entropy printable values", () => {
  const password = generateTemporaryPassword();
  assert.match(password, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(password, generateTemporaryPassword());
});
