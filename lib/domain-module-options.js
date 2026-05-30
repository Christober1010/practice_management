/** Canonical module choices when creating a domain (parent module, not a separate UI entity). */
export const DOMAIN_MODULE_OPTIONS = [
  { key: "skill-acquisition", label: "Skill Acquisition", id: "skill-acquisition" },
  { key: "behaviour-reduction", label: "Behaviour Reduction", id: "behaviour-reduction" },
];

export const DEFAULT_DOMAIN_MODULE_KEY = "skill-acquisition";

function normalizeModuleName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/behaviou?r/g, "behavior");
}

export function getDomainModuleOptionByKey(key) {
  return DOMAIN_MODULE_OPTIONS.find((o) => o.key === key) || null;
}

/** Resolve API module id from canonical key + loaded modules list. */
export function resolveModuleIdForDomain(modules = [], moduleKey) {
  const option = getDomainModuleOptionByKey(moduleKey);
  if (!option) return null;

  const target = normalizeModuleName(option.label);
  const fromList = (modules || []).find((m) => {
    const n = normalizeModuleName(m.NAME || m.name);
    if (option.key === "skill-acquisition") {
      return n.includes("skill acquisition") || n === target;
    }
    if (option.key === "behaviour-reduction") {
      return (
        n.includes("behavior reduction") ||
        n.includes("behaviour reduction") ||
        n === target
      );
    }
    return n === target;
  });

  if (fromList) return String(fromList.id ?? fromList.ID ?? "");
  return option.id;
}

/** Merge API modules with canonical Skill Acquisition / Behaviour Reduction ids. */
export function mergeCanonicalDomainModules(modules = []) {
  const seen = new Set();
  const list = [];

  DOMAIN_MODULE_OPTIONS.forEach((o) => {
    const id = String(o.id);
    if (!seen.has(id)) {
      seen.add(id);
      list.push({ id, name: o.label });
    }
  });

  (modules || []).forEach((m) => {
    const id = String(m.id ?? m.ID ?? "").trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      list.push(m);
    }
  });

  return list;
}

/** Human-readable module label for lists (API modules + canonical ids). */
export function getDomainModuleLabel(modules = [], moduleId) {
  if (moduleId == null || moduleId === "") return "—";
  const id = String(moduleId).trim();
  if (!id) return "—";

  const merged = mergeCanonicalDomainModules(modules);
  const mod = merged.find((m) => String(m.id ?? m.ID).trim() === id);
  if (mod) {
    const name = mod.NAME || mod.name;
    if (name) return name;
  }

  const canonical = DOMAIN_MODULE_OPTIONS.find(
    (o) => o.id === id || o.key === id
  );
  if (canonical) return canonical.label;

  const normalizedId = normalizeModuleName(id);
  const byStoredName = DOMAIN_MODULE_OPTIONS.find(
    (o) => normalizeModuleName(o.label) === normalizedId
  );
  if (byStoredName) return byStoredName.label;

  return "—";
}

/** Infer canonical key from domain module id / name. */
export function inferDomainModuleKey(modules = [], moduleId) {
  if (!moduleId) return DEFAULT_DOMAIN_MODULE_KEY;
  const mod = (modules || []).find(
    (m) => String(m.id ?? m.ID) === String(moduleId)
  );
  const name = normalizeModuleName(mod?.NAME || mod?.name || "");
  if (name.includes("behavior") || name.includes("behaviour")) {
    return "behaviour-reduction";
  }
  if (name.includes("skill")) return "skill-acquisition";
  if (String(moduleId) === "behaviour-reduction") return "behaviour-reduction";
  if (String(moduleId) === "skill-acquisition") return "skill-acquisition";
  return DEFAULT_DOMAIN_MODULE_KEY;
}
