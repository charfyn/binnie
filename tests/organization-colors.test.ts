import assert from "node:assert/strict";
import test from "node:test";
import { defaultOrganizationColorKey, getOrganizationColorStyles, ORGANIZATION_COLOR_KEYS } from "../src/lib/organization-colors.ts";

test("known Binnie organizations retain their semantic color identity", () => {
  assert.equal(defaultOrganizationColorKey("Villa Khayangan"), "lavender");
  assert.equal(defaultOrganizationColorKey("Apotik"), "mint");
  assert.equal(defaultOrganizationColorKey("Curug Cidulang"), "butter");
  assert.equal(defaultOrganizationColorKey("Personal"), "peach");
});

test("new organization defaults are deterministic and resolve to safe theme tokens", () => {
  const first = defaultOrganizationColorKey("New Operations Workspace");
  assert.equal(defaultOrganizationColorKey("New Operations Workspace"), first);
  assert.match(getOrganizationColorStyles(first).label, /.+/);
  assert.equal(getOrganizationColorStyles("untrusted-css-value").label, "Powder Blue");
});

test("the organization picker exposes only the curated Binnie palette", () => {
  assert.deepEqual(ORGANIZATION_COLOR_KEYS, ["lavender", "mint", "butter", "peach", "powderBlue", "sage", "rose", "sand"]);
  ORGANIZATION_COLOR_KEYS.forEach(key => assert.match(getOrganizationColorStyles(key).scope, new RegExp(`org-color-${key}`)));
});
