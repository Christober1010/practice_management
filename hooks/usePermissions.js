"use client";

import { useMemo, useCallback } from "react";
import { legacyPermissionsForRole } from "@/lib/rbac-legacy";
import { normalizeNavViewKeys } from "@/lib/nav-view-unify";

/**
 * @param {object} user - aba_user shape: { role, permissions?: string[] }
 */
export function usePermissions(user) {
  const keys = useMemo(() => {
    const p = user?.permissions;
    if (Array.isArray(p) && p.length > 0) {
      return normalizeNavViewKeys(p);
    }
    return legacyPermissionsForRole(user?.role);
  }, [user]);

  const can = useCallback(
    (permKey) => {
      if (!permKey) return true;
      return keys.includes(permKey);
    },
    [keys]
  );

  const canAny = useCallback(
    (arr) => {
      if (!arr || !arr.length) return true;
      return arr.some((k) => keys.includes(k));
    },
    [keys]
  );

  return { can, canAny, keys };
}
