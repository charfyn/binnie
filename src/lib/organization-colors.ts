/**
 * Organization colours are semantic identifiers, not presentation data stored
 * as CSS. The same key can be rendered appropriately by each Binnie theme.
 */
export const ORGANIZATION_COLOR_KEYS = [
  "lavender",
  "mint",
  "butter",
  "peach",
  "powderBlue",
  "sage",
  "rose",
  "sand",
] as const;

export type OrganizationColorKey = (typeof ORGANIZATION_COLOR_KEYS)[number];

type OrganizationColorStyles = {
  label: string;
  /** Theme scope that resolves the semantic key to CSS variables. */
  scope: string;
  card: string;
  listCard: string;
  icon: string;
  chip: string;
  dot: string;
  accent: string;
  swatch: string;
};

function organizationColorStyles(key: OrganizationColorKey, label: string): OrganizationColorStyles {
  const scope = `org-color-${key}`;
  return {
    label,
    scope,
    card: `${scope} binnie-organization-card`,
    listCard: `${scope} binnie-organization-list-card`,
    icon: `${scope} binnie-organization-icon`,
    chip: `${scope} binnie-organization-chip`,
    dot: `${scope} binnie-organization-dot`,
    accent: `${scope} binnie-organization-accent`,
    swatch: `${scope} binnie-organization-swatch`,
  };
}

/** Labels and semantic class hooks; theme-specific values live in globals.css. */
export const ORGANIZATION_COLOR_STYLES: Record<OrganizationColorKey, OrganizationColorStyles> = {
  lavender: organizationColorStyles("lavender", "Lavender"),
  mint: organizationColorStyles("mint", "Mint"),
  butter: organizationColorStyles("butter", "Butter"),
  peach: organizationColorStyles("peach", "Peach"),
  powderBlue: organizationColorStyles("powderBlue", "Powder Blue"),
  sage: organizationColorStyles("sage", "Sage"),
  rose: organizationColorStyles("rose", "Rose"),
  sand: organizationColorStyles("sand", "Sand"),
};

const namedDefaults: Record<string, OrganizationColorKey> = {
  "villa khayangan": "lavender",
  apotik: "mint",
  "curug cidulang": "butter",
  personal: "peach",
};

export function isOrganizationColorKey(value: unknown): value is OrganizationColorKey {
  return typeof value === "string" && ORGANIZATION_COLOR_KEYS.includes(value as OrganizationColorKey);
}

/** A stable fallback for new organizations that do not choose a colour. */
export function defaultOrganizationColorKey(name: string): OrganizationColorKey {
  const normalized = name.trim().toLocaleLowerCase();
  if (namedDefaults[normalized]) return namedDefaults[normalized];

  let hash = 5381;
  for (const character of normalized) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return ORGANIZATION_COLOR_KEYS[Math.abs(hash >>> 0) % ORGANIZATION_COLOR_KEYS.length];
}

export function getOrganizationColorStyles(colorKey?: string | null): OrganizationColorStyles {
  return ORGANIZATION_COLOR_STYLES[isOrganizationColorKey(colorKey) ? colorKey : "powderBlue"];
}
