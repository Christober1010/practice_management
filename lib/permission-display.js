/**
 * Human-readable labels for rbac_permissions.perm_key when DB label is missing or raw.
 */

const ACTION_VERBS = {
  read: "View",
  write: "Create & Edit",
};

/** Overrides for keys where a generic read/write label is too vague */
const KEY_OVERRIDES = {
  "reports.write": "Export & manage reports",
  "master_data.read": "View data collection",
  "master_data.write": "Edit data collection",
  "manage_data.read": "View manage data",
  "manage_data.write": "Edit manage data",
  "launchpad.profile_submit": "Submit profile forms",
};

/** Title-case common action words in labels (DB seeds may use lowercase). */
function polishPermissionLabelCasing(s) {
  if (!s || typeof s !== "string") return s;
  return s
    .replace(/\bcreate\/edit\b/gi, "Create / Edit")
    .replace(/\bview\b/g, (w) => (w === "view" ? "View" : w))
    .replace(/\bedit\b/g, (w) => (w === "edit" ? "Edit" : w));
}

const GROUP_TITLES = {
  mahaverse_nav: "Navigation",
  mahaverse_view: "Screens & hubs",
  mahaverse_action: "Data access",
  launchpad: "Launchpad",
  general: "Other",
};

function titleCaseSegment(s) {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {string} key - e.g. clients.read, nav.clients
 * @returns {string}
 */
export function humanizePermissionKey(key) {
  if (!key || typeof key !== "string") return key || "";
  if (KEY_OVERRIDES[key]) return KEY_OVERRIDES[key];

  const parts = key.split(".");
  if (parts.length < 2) return titleCaseSegment(key);

  const [a, b, ...rest] = parts;
  if (a === "nav") return `${titleCaseSegment(b)} · Sidebar`;
  if (a === "view") return `${titleCaseSegment(b)} · Screen`;
  if (a === "launchpad") {
    const tail = rest.length ? [b, ...rest].join(".") : b;
    return `Launchpad · ${titleCaseSegment(tail)}`;
  }

  const last = parts[parts.length - 1];
  const verb = ACTION_VERBS[last];
  if (verb && parts.length === 2) {
    const resource = titleCaseSegment(parts[0]);
    return `${resource} · ${verb}`;
  }

  return parts.map(titleCaseSegment).join(" · ");
}

/**
 * @param {string} group - rbac_permissions.perm_group
 * @returns {string}
 */
export function friendlyPermissionGroupTitle(group) {
  if (!group) return GROUP_TITLES.general;
  const g = String(group).toLowerCase();
  if (GROUP_TITLES[g]) return GROUP_TITLES[g];
  return titleCaseSegment(group.replace(/_/g, " "));
}

/**
 * Prefer DB label when it looks curated; otherwise humanize the key.
 * @param {{ perm_key: string, label?: string }} row
 * @returns {string}
 */
export function permissionDisplayLabel(row) {
  const key = row?.perm_key || "";
  const raw = (row?.label || "").trim();
  const out =
    !raw || raw === key ? humanizePermissionKey(key) : raw;
  return polishPermissionLabelCasing(out);
}
