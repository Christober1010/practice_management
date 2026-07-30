"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { getMahaverseAuthHeaders } from "@/lib/api-auth";
import {
  buildPermissionModules,
  buildPresetDraft,
  filterClientsWriteForAdminMatrix,
  filterPermissionModules,
  mahaverseHasGranularClientPerms,
} from "@/lib/permission-modules";
import { unifyNavViewPairsForAdminUi, rowPermKeys } from "@/lib/nav-view-unify";
import { rbacPermUsesTriState } from "@/lib/rbac-scope-ui";
import PermissionModule from "@/components/admin/permissions/permission-module";
import PermissionSummary from "@/components/admin/permissions/permission-summary";
import { notifyMahaversePermissionsRefresh } from "@/lib/mahaverse-permissions-events";
import { getLaunchpadApiOrigin } from "@/lib/launchpad/api";
import { Loader2, Save, Search } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_BASE_URL || "";

function authHeaders(scope) {
  if (typeof window === "undefined") return {};
  if (scope === "launchpad") {
    const t = localStorage.getItem("auth_token");
    if (!t) return {};
    return { Authorization: `Bearer ${t}`, "X-Auth-Token": t };
  }
  return getMahaverseAuthHeaders();
}

function grantsToBaselineMap(matrix, roleName) {
  const granted = new Set((matrix?.grants && matrix.grants[roleName]) || []);
  const scopes = (matrix?.grant_scopes && matrix.grant_scopes[roleName]) || {};
  const map = {};
  for (const p of matrix?.permissions || []) {
    const pk = p.perm_key;
    if (rbacPermUsesTriState(pk)) {
      map[pk] = granted.has(pk) ? scopes[pk] || "all" : "off";
    } else {
      map[pk] = granted.has(pk);
    }
  }
  return map;
}

function draftToSavePayload(draftRow, permissions) {
  /** @type {{ perm_key: string, access_scope: string }[]} */
  const grant_entries = [];
  for (const p of permissions || []) {
    const pk = p.perm_key;
    const v = draftRow[pk];
    if (v === true) {
      grant_entries.push({ perm_key: pk, access_scope: "all" });
    } else if (v === "self" || v === "all") {
      grant_entries.push({ perm_key: pk, access_scope: v });
    }
  }
  const permission_keys = grant_entries.map((e) => e.perm_key);
  return { grant_entries, permission_keys };
}

function countEnabledInDraft(draftRow, permissions) {
  let n = 0;
  for (const p of permissions || []) {
    const v = draftRow[p.perm_key];
    if (v === true || v === "self" || v === "all") n++;
  }
  return n;
}

export default function RoleAccessView() {
  const launchpadApiOrigin = useMemo(() => getLaunchpadApiOrigin(), []);

  const rbacUrl = useCallback(
    (path, scopeArg) => {
      if (scopeArg === "launchpad") {
        const base = launchpadApiOrigin.replace(/\/$/, "");
        return `${base}/backend/${path}`;
      }
      return `${API_BASE.replace(/\/$/, "")}/${path}`;
    },
    [launchpadApiOrigin]
  );

  const [scope, setScope] = useState("mahaverse");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState(null);
  const [draft, setDraft] = useState({});
  const [selectedRole, setSelectedRole] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [hasLpToken, setHasLpToken] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openModules, setOpenModules] = useState([]);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [presetSelectKey, setPresetSelectKey] = useState(0);
  const [cloneSelectKey, setCloneSelectKey] = useState(0);

  useEffect(() => {
    setHasLpToken(typeof window !== "undefined" && !!localStorage.getItem("auth_token"));
  }, [scope]);

  const load = useCallback(async () => {
    if (!API_BASE && scope === "mahaverse") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = `${rbacUrl("rbac-matrix.php", scope)}?scope=${encodeURIComponent(scope)}`;
      const res =
        scope === "launchpad"
          ? await fetch(url, { headers: authHeaders(scope) })
          : await mahaverseFetch(
              `/rbac-matrix.php?scope=${encodeURIComponent(scope)}`,
            );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load matrix");
      }
      setMatrix(data);
      const nextDraft = {};
      const scopesByRole = data.grant_scopes || {};
      for (const role of data.roles || []) {
        nextDraft[role] = {};
        const granted = (data.grants && data.grants[role]) || [];
        const scMap = scopesByRole[role] || {};
        for (const pk of granted) {
          nextDraft[role][pk] = rbacPermUsesTriState(pk)
            ? scMap[pk] || "all"
            : true;
        }
        for (const p of data.permissions || []) {
          if (nextDraft[role][p.perm_key] === undefined) {
            nextDraft[role][p.perm_key] = rbacPermUsesTriState(p.perm_key)
              ? "off"
              : false;
          }
        }
      }
      setDraft(nextDraft);
      if (data.roles && data.roles.length) {
        setSelectedRole((prev) => (prev && data.roles.includes(prev) ? prev : data.roles[0]));
      }
      const displayRows = filterClientsWriteForAdminMatrix(
        unifyNavViewPairsForAdminUi(data.permissions || [], scope)
      );
      const mods = buildPermissionModules(displayRows, scope);
      setOpenModules(mods.map((m) => m.id));
      setLastSavedAt(new Date());
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Could not load role matrix");
      setMatrix(null);
    } finally {
      setLoading(false);
    }
  }, [scope, rbacUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const roles = matrix?.roles || [];
  const role = selectedRole || roles[0];

  const displayRows = useMemo(
    () =>
      filterClientsWriteForAdminMatrix(
        unifyNavViewPairsForAdminUi(matrix?.permissions || [], scope)
      ),
    [matrix?.permissions, scope]
  );

  const allModules = useMemo(
    () => buildPermissionModules(displayRows, scope),
    [displayRows, scope]
  );

  const filteredModules = useMemo(
    () => filterPermissionModules(allModules, searchQuery),
    [allModules, searchQuery]
  );

  useEffect(() => {
    if (!searchQuery.trim()) return;
    setOpenModules(filteredModules.map((m) => m.id));
  }, [searchQuery, filteredModules]);

  useEffect(() => {
    if (!role || !allModules.length) return;
    if (searchQuery.trim()) return;
    setOpenModules(allModules.map((m) => m.id));
  }, [role, allModules, searchQuery]);

  const baselineMap = useMemo(
    () => (matrix && role ? grantsToBaselineMap(matrix, role) : {}),
    [matrix, role]
  );

  const enabledMap = useMemo(() => draft[role] || {}, [draft, role]);

  const isDirty = useMemo(() => {
    if (!matrix?.permissions?.length || !role) return false;
    for (const p of matrix.permissions) {
      const cur = draft[role]?.[p.perm_key];
      const base = baselineMap[p.perm_key];
      if (cur !== base) return true;
    }
    return false;
  }, [matrix, role, draft, baselineMap]);

  const totalEnabled = useMemo(() => {
    if (!matrix?.permissions) return 0;
    return matrix.permissions.filter((p) => {
      const v = enabledMap[p.perm_key];
      return v === true || v === "self" || v === "all";
    }).length;
  }, [matrix?.permissions, enabledMap]);

  const modulesWithEnabled = useMemo(() => {
    const rowFullyEnabled = (row) =>
      rowPermKeys(row).length > 0 &&
      rowPermKeys(row).every((k) => {
        const v = enabledMap[k];
        if (rbacPermUsesTriState(k)) {
          return v === "self" || v === "all";
        }
        return !!v;
      });
    const list = [];
    for (const mod of allModules) {
      const rowsEnabled = mod.items.filter((row) => rowFullyEnabled(row)).length;
      if (rowsEnabled > 0) list.push({ title: mod.title, count: rowsEnabled });
    }
    return list;
  }, [allModules, enabledMap]);

  const onSetKeys = useCallback((keys, checkedOrScope) => {
    setDraft((prev) => {
      const r = { ...(prev[role] || {}) };
      for (const k of keys) {
        if (
          typeof checkedOrScope === "string" &&
          (checkedOrScope === "off" ||
            checkedOrScope === "self" ||
            checkedOrScope === "all")
        ) {
          r[k] = checkedOrScope;
        } else {
          r[k] = !!checkedOrScope;
        }
      }
      return { ...prev, [role]: r };
    });
  }, [role]);

  const selectAllInModule = useCallback(
    (moduleId) => {
      const mod = allModules.find((m) => m.id === moduleId);
      if (!mod) return;
      setDraft((prev) => {
        const r = { ...(prev[role] || {}) };
        for (const row of mod.items) {
          for (const k of rowPermKeys(row)) {
            r[k] = rbacPermUsesTriState(k) ? "all" : true;
          }
        }
        if (moduleId === "clients" && mahaverseHasGranularClientPerms(matrix?.permissions)) {
          r.clients.write = false;
        }
        return { ...prev, [role]: r };
      });
    },
    [allModules, matrix?.permissions, role]
  );

  const clearModule = useCallback(
    (moduleId) => {
      const mod = allModules.find((m) => m.id === moduleId);
      if (!mod) return;
      setDraft((prev) => {
        const r = { ...(prev[role] || {}) };
        for (const row of mod.items) {
          for (const k of rowPermKeys(row)) {
            r[k] = rbacPermUsesTriState(k) ? "off" : false;
          }
        }
        if (moduleId === "clients" && mahaverseHasGranularClientPerms(matrix?.permissions)) {
          r.clients.write = false;
        }
        return { ...prev, [role]: r };
      });
    },
    [allModules, matrix?.permissions, role]
  );

  const expandAll = () => setOpenModules(filteredModules.map((m) => m.id));
  const collapseAll = () => setOpenModules([]);

  const applyPreset = (preset) => {
    if (!matrix?.permissions || !preset) return;
    const next = buildPresetDraft(matrix.permissions, preset);
    setDraft((prev) => ({ ...prev, [role]: { ...next } }));
    setPresetSelectKey((k) => k + 1);
    toast.success(
      preset === "full"
        ? "Preset: full access"
        : preset === "clear"
          ? "Preset: cleared"
          : "Preset: read-oriented"
    );
  };

  const copyFromRole = (sourceRole) => {
    if (!sourceRole || sourceRole === role) return;
    const src = draft[sourceRole];
    if (!src) return;
    setDraft((prev) => ({ ...prev, [role]: { ...src } }));
    setCloneSelectKey((k) => k + 1);
    toast.success(`Copied permissions from ${sourceRole}`);
  };

  const runSave = async (roleToSave) => {
    const { grant_entries, permission_keys } = draftToSavePayload(
      draft[roleToSave] || {},
      matrix?.permissions || []
    );
    setSaving(true);
    try {
      const payload = {
        role: roleToSave,
        scope,
        permission_keys,
        grant_entries,
      };
      const res =
        scope === "launchpad"
          ? await fetch(rbacUrl("rbac-save-role.php", scope), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...authHeaders(scope),
              },
              body: JSON.stringify(payload),
            })
          : await mahaverseFetch("/rbac-save-role.php", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Save failed");
      }
      toast.success(`Saved permissions for ${roleToSave}`);
      setLastSavedAt(new Date());
      notifyMahaversePermissionsRefresh();
      await load();
    } catch (e) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
      setPendingSave(null);
    }
  };

  const requestSave = (roleToSave) => {
    const enabledCount = countEnabledInDraft(
      draft[roleToSave] || {},
      matrix?.permissions || []
    );
    const isAdminDowngrade =
      roleToSave === "admin" &&
      scope === "mahaverse" &&
      enabledCount < ((matrix?.permissions || []).length * 0.5);
    if (isAdminDowngrade) {
      setPendingSave(roleToSave);
      setConfirmOpen(true);
      return;
    }
    runSave(roleToSave);
  };

  if (!API_BASE) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Set <code className="font-mono">NEXT_PUBLIC_BASE_URL</code> to use Role Access.
      </div>
    );
  }

  if (loading && !matrix) {
    return (
      <div className="flex items-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading permissions…
      </div>
    );
  }

  if (!matrix || !matrix.permissions?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Role access</CardTitle>
          <CardDescription>
            Run SQL migrations (<code className="text-xs">migration/shared/20260729_222552_create_rbac_tables.sql</code> or Launchpad equivalent), then reload.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const lastSavedLabel = lastSavedAt
    ? `Last loaded or saved: ${lastSavedAt.toLocaleString()}`
    : null;

  const otherRoles = roles.filter((r) => r !== role);

  return (
    <div className="space-y-0 pb-10">
      <div className="sticky top-0 z-30 -mx-4 border-b border-slate-200/80 bg-background/95 px-4 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Role permissions</h1>
              {isDirty ? (
                <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900">
                  Unsaved changes
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">
                  Up to date
                </Badge>
              )}
            </div>
            <p className="max-w-2xl text-sm text-slate-600">
              Grant access by module. After save, the app reloads your permissions from the server (full page refresh or
              automatic sync). You do not need to sign out unless the sync fails.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Product</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mahaverse">Mahaverse</SelectItem>
                  <SelectItem value="launchpad">Launchpad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Role</Label>
              <Select value={role} onValueChange={setSelectedRole}>
                <SelectTrigger className="h-9 w-[160px] capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="h-9 gap-2 bg-teal-600 hover:bg-teal-700"
              onClick={() => requestSave(role)}
              disabled={saving || !role || !isDirty}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search permissions…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9"
              aria-label="Search permissions"
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={expandAll}>
            Expand all
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={collapseAll}>
            Collapse all
          </Button>
          <Select key={`preset-${presetSelectKey}`} onValueChange={(v) => applyPreset(v)}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Apply preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full access</SelectItem>
              <SelectItem value="read_oriented">Read-oriented</SelectItem>
              <SelectItem value="clear">Clear all</SelectItem>
            </SelectContent>
          </Select>
          {otherRoles.length > 0 ? (
            <Select key={`clone-${cloneSelectKey}`} onValueChange={(v) => copyFromRole(v)}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Clone from role" />
              </SelectTrigger>
              <SelectContent>
                {otherRoles.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          {scope === "launchpad" && !hasLpToken && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Launchpad matrix requires a Launchpad admin token. Log in from the main page or open Launchpad and sign in.
            </p>
          )}

          {filteredModules.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No matches</CardTitle>
                <CardDescription>Try a different search term.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Accordion
              type="multiple"
              value={openModules}
              onValueChange={setOpenModules}
              className="space-y-3"
            >
              {filteredModules.map((mod) => (
                <PermissionModule
                  key={mod.id}
                  moduleId={mod.id}
                  title={mod.title}
                  items={mod.items}
                  enabledMap={enabledMap}
                  baselineMap={baselineMap}
                  onSetKeys={onSetKeys}
                  onSelectAll={selectAllInModule}
                  onClearAll={clearModule}
                  disabled={saving}
                />
              ))}
            </Accordion>
          )}
        </div>

        <PermissionSummary
          className="w-full shrink-0 lg:w-80"
          totalEnabled={totalEnabled}
          totalPermissions={matrix.permissions.length}
          modulesWithEnabled={modulesWithEnabled}
          dirty={isDirty}
          lastSavedLabel={lastSavedLabel}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reduce admin access?</AlertDialogTitle>
            <AlertDialogDescription>
              You are removing a large number of permissions from the admin role. Confirm this is intentional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingSave && runSave(pendingSave)}>
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
