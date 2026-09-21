"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileText, RefreshCw, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { getMahaverseAuthHeaders } from "@/lib/api-auth";
import { sortClientsByName } from "@/lib/sort-clients";
import Cms1500Preview from "./cms1500-preview";
import ClaimWarningList from "./claim-warning-list";
import { createMergedCms1500PdfBlob, downloadMergedCms1500Pdf } from "@/lib/cms1500-pdf";
import { usePermissions } from "@/hooks/usePermissions";
import { PERM } from "@/lib/rbac-permission-keys";
import {
  OFFICE_ALLY_SFTP_MAX_DAYS,
  dosBoundsFromSessions,
  officeAllySftpDateRangeCheck,
} from "@/lib/officeally-sftp-guards";
import { authorizationBillingCodeMatches } from "@/lib/authorization-billing-code";

function formatDateOnly(iso) {
  if (!iso) return "N/A";
  const d = new Date(String(iso).replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 10);
}

function toSafeArray(v) {
  return Array.isArray(v) ? v : [];
}

function readJsonSafe(response) {
  return response.text().then((text) => {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  });
}

/** Only explicit claim_status counts (Ready to Bill / submitted). */
function normalizeClaimStatus(session) {
  const explicit = String(
    session?.claim_status || session?.claims_status || session?.billing_status || ""
  )
    .trim()
    .toLowerCase();
  if (explicit.includes("submitted")) return "claims_submitted";
  if (explicit.includes("ready")) return "ready_to_bill";
  return "other";
}

function positiveInsuranceId(raw) {
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapAuthInsuranceToClientPk(authInsuranceId, client) {
  if (authInsuranceId == null || authInsuranceId === "") return "";
  const raw = authInsuranceId;
  const byPk = toSafeArray(client.insurances).find(
    (ins) => String(ins.insurance_id) === String(raw)
  );
  if (byPk) {
    const pk = positiveInsuranceId(byPk.insurance_id);
    return pk != null ? String(pk) : "";
  }
  const idx = Number.parseInt(String(raw), 10);
  if (Number.isFinite(idx) && idx >= 0 && client.insurances?.[idx]) {
    const pk = positiveInsuranceId(client.insurances[idx].insurance_id);
    return pk != null ? String(pk) : "";
  }
  const asPk = positiveInsuranceId(raw);
  return asPk != null ? String(asPk) : "";
}

function resolveInsuranceIdForSession(session, clients, overrideInsuranceId) {
  const override = positiveInsuranceId(overrideInsuranceId);
  if (override != null) {
    return String(override);
  }
  const client = clients.find(
    (c) => String(c.client_id) === String(session?.client_id)
  );
  if (!client) return "";

  const authId = session?.auth_id;
  if (authId != null && authId !== "") {
    const auth = toSafeArray(client.authorizations).find(
      (a) =>
        String(a.auth_id ?? a.id ?? "") === String(authId) ||
        String(a.id ?? "") === String(authId)
    );
    const fromAuth = mapAuthInsuranceToClientPk(auth?.insurance_id, client);
    if (fromAuth) return fromAuth;
  }

  const authCode = String(session?.auth_code || "").trim();
  if (authCode) {
    const auth = toSafeArray(client.authorizations).find((a) =>
      authorizationBillingCodeMatches(a, authCode)
    );
    const fromCode = mapAuthInsuranceToClientPk(auth?.insurance_id, client);
    if (fromCode) return fromCode;
  }

  const first = toSafeArray(client.insurances)[0];
  const firstPk = positiveInsuranceId(first?.insurance_id);
  return firstPk != null ? String(firstPk) : "";
}

function claimStatusLabel(statusKey) {
  if (statusKey === "ready_to_bill") return "Ready to Bill";
  if (statusKey === "claims_submitted") return "Claim Submitted";
  return "N/A";
}

function authorizationNumberFromSession(session) {
  const explicit = String(session?.authorization_number || "").trim();
  if (explicit) return explicit;
  const raw = String(session?.auth_code || "").trim();
  const labeled = raw.match(/\s-\s([^-]+)-\d{2}\/\d{2}\/\d{4}/);
  if (labeled?.[1] && labeled[1] !== "—") return labeled[1].trim();
  const suffix = raw.match(/^([^-]+)-\d{2}\/\d{2}\/\d{4}/);
  if (suffix?.[1] && suffix[1] !== "—") return suffix[1].trim();
  return raw || "N/A";
}

function claimGroupKey(session) {
  const client = String(session?.client_id ?? "").trim();
  const dos = formatDateOnly(session?.start_utc);
  const auth = authorizationNumberFromSession(session).toUpperCase();
  return `${client}|${dos}|${auth}`;
}

function sessionProcedureCode(session) {
  const service = String(session?.service_code || session?.service_code_with_modifiers || "");
  const fromService = service.match(/\d{5}/);
  if (fromService) return fromService[0];
  const fromAuth = String(session?.auth_code || "").match(/\d{5}/);
  return fromAuth ? fromAuth[0] : service || session?.auth_code || "N/A";
}

function sessionBillableUnits(session) {
  const hours = session?.scheduled_hours ?? session?.rendered_hours;
  if (hours == null || hours === "") return "";
  const n = Number(hours);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 4 * 100) / 100);
}

function groupSessionsByClaim(sessions) {
  const map = new Map();
  for (const session of sessions) {
    const key = claimGroupKey(session);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(session);
  }
  return [...map.entries()].map(([key, rows]) => {
    const sorted = [...rows].sort(
      (a, b) => Number(a.session_id) - Number(b.session_id)
    );
    const claimIds = [
      ...new Set(
        sorted.map((s) => String(s.claim_id || "").trim()).filter(Boolean)
      ),
    ];
    return {
      key,
      sessions: sorted,
      sessionIds: sorted.map((s) => String(s.session_id)),
      claimId: claimIds[0] || "N/A",
      dos: formatDateOnly(sorted[0]?.start_utc),
      clientId: sorted[0]?.client_id,
      clientName:
        sorted[0]?.clientName ||
        (sorted[0]?.client_id ? `Client ${sorted[0].client_id}` : "N/A"),
      authNumber: authorizationNumberFromSession(sorted[0]),
    };
  });
}

function sessionsForSelectedClaimGroups(sessions, selectedIds) {
  const selected = new Set((selectedIds || []).map(String));
  const keys = new Set();
  for (const session of sessions) {
    if (selected.has(String(session.session_id))) {
      keys.add(claimGroupKey(session));
    }
  }
  return sessions.filter((session) => keys.has(claimGroupKey(session)));
}

const CLIENT_FILTER_ALL = "__all__";

function defaultDosRange() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (OFFICE_ALLY_SFTP_MAX_DAYS - 1));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export default function ClaimsView({ userRole }) {
  const { can } = usePermissions(userRole ?? {});
  const canSftp = can(PERM.BILLING_SFTP);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const defaults = useMemo(() => defaultDosRange(), []);
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [submittingOfficeAlly, setSubmittingOfficeAlly] = useState(false);
  const [officeAllyStatus, setOfficeAllyStatus] = useState(null);
  const [officeAllyConfig, setOfficeAllyConfig] = useState(null);
  const [testingOfficeAlly, setTestingOfficeAlly] = useState(false);
  const [error, setError] = useState("");

  const [selectedClientId, setSelectedClientId] = useState(CLIENT_FILTER_ALL);
  const [selectedInsuranceId, setSelectedInsuranceId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  /** @type {null | Array<{ sessionId: string, label: string, payload: unknown, warnings: string[] }>} */
  const [previewEntries, setPreviewEntries] = useState(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [serviceCodeFilter, setServiceCodeFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState(defaults.from);
  const [toDateFilter, setToDateFilter] = useState(defaults.to);
  const [expandedClaimKeys, setExpandedClaimKeys] = useState(() => new Set());

  const selectedSessionsRows = useMemo(
    () =>
      sessions.filter((s) => selectedSessionIds.includes(String(s.session_id))),
    [sessions, selectedSessionIds]
  );

  const filterClient = useMemo(
    () =>
      selectedClientId && selectedClientId !== CLIENT_FILTER_ALL
        ? clients.find((c) => String(c.client_id) === String(selectedClientId))
        : null,
    [clients, selectedClientId]
  );

  const insuranceOptions = useMemo(
    () => toSafeArray(filterClient?.insurances),
    [filterClient]
  );

  const selectedInsuranceLabel = useMemo(() => {
    const selectedInsurance = insuranceOptions.find(
      (ins) => String(ins.insurance_id) === String(selectedInsuranceId)
    );
    if (!selectedInsurance) return "N/A";
    return (
      selectedInsurance.insurance_plan_name ||
      selectedInsurance.insurance_provider ||
      `Insurance ${selectedInsurance.insurance_id}`
    );
  }, [insuranceOptions, selectedInsuranceId]);

  function sessionInsuranceLabel(session) {
    const insId = resolveInsuranceIdForSession(session, clients, "");
    if (!insId) return "—";
    const client = clients.find((c) => String(c.client_id) === String(session.client_id));
    const ins = toSafeArray(client?.insurances).find(
      (row) => String(row.insurance_id) === String(insId)
    );
    if (!ins) return `Insurance ${insId}`;
    return (
      ins.insurance_plan_name ||
      ins.insurance_provider ||
      `Insurance ${ins.insurance_id}`
    );
  }
  const filteredSessions = useMemo(() => {
    const serviceQuery = serviceCodeFilter.trim().toLowerCase();
    return sessions.filter((session) => {
      const serviceCode = String(
        session.auth_code || session.service_code || session.service_code_with_modifiers || ""
      ).toLowerCase();
      if (serviceQuery && !serviceCode.includes(serviceQuery)) return false;

      const dos = formatDateOnly(session.start_utc);
      if (fromDateFilter && dos < fromDateFilter) return false;
      if (toDateFilter && dos > toDateFilter) return false;

      const normalized = normalizeClaimStatus(session);
      if (normalized !== "ready_to_bill") return false;
      return true;
    });
  }, [sessions, serviceCodeFilter, fromDateFilter, toDateFilter]);

  const filteredSessionIds = useMemo(
    () => filteredSessions.map((s) => String(s.session_id)),
    [filteredSessions]
  );

  const filteredClaimGroups = useMemo(
    () => groupSessionsByClaim(filteredSessions),
    [filteredSessions]
  );

  const selectAllCheckboxState = useMemo(() => {
    if (filteredSessionIds.length === 0) return { all: false, some: false };
    const selected = new Set(selectedSessionIds);
    let n = 0;
    for (const id of filteredSessionIds) {
      if (selected.has(id)) n += 1;
    }
    return {
      all: n === filteredSessionIds.length,
      some: n > 0 && n < filteredSessionIds.length,
    };
  }, [filteredSessionIds, selectedSessionIds]);

  const previewClaims = useMemo(() => {
    if (!previewEntries?.length) return [];
    const url = previewPdfUrl || "";
    return previewEntries.map((e) => ({
      sessionId: e.sessionId,
      label: e.label,
      warnings: e.warnings,
      pdfPreviewUrl: url,
      clientId: e.clientId,
      locationId: e.locationId || selectedLocationId,
      serviceCode: e.serviceCode,
      payload: e.payload,
    }));
  }, [previewEntries, previewPdfUrl, selectedLocationId]);

  const resolveOfficeAllyWarningContext = (warning) => {
    const sidMatch = String(warning || "").match(/Session\s+#?(\d+)/i);
    const sid = sidMatch?.[1];
    const row = sid
      ? sessions.find((s) => String(s.session_id) === String(sid))
      : selectedSessionIds.length === 1
        ? sessions.find((s) => String(s.session_id) === String(selectedSessionIds[0]))
        : null;
    return {
      sessionId: sid || row?.session_id || selectedSessionIds[0] || "",
      clientId: row?.client_id || "",
      locationId: selectedLocationId || "",
      serviceCode:
        row?.service_code ||
        row?.service_code_with_modifiers ||
        row?.auth_code ||
        "",
    };
  };

  const fetchBootstrapData = async () => {
    setLoading(true);
    setError("");
    try {
      const [clientsResp, locationsRespPrimary] = await Promise.all([
        mahaverseFetch('/get-clients.php', {
          headers: getMahaverseAuthHeaders(),
        }),
        // Locations endpoint usually does not require auth; avoid custom auth headers
        // so older server CORS policies (without X-Auth-Token) still pass preflight.
        mahaverseFetch('/locations.php'),
      ]);

      const clientsJson = await readJsonSafe(clientsResp);
      let locationsResp = locationsRespPrimary;
      let locationsJson = await readJsonSafe(locationsRespPrimary);

      // Compatibility fallback for environments that still expose location.php.
      if (
        (!locationsResp.ok || !locationsJson?.success) &&
        (locationsResp.status === 404 || String(locationsJson?.message || "").includes("404"))
      ) {
        const fallbackResp = await mahaverseFetch('/location.php');
        const fallbackJson = await readJsonSafe(fallbackResp);
        locationsResp = fallbackResp;
        locationsJson = fallbackJson;
      }

      if (!clientsResp.ok || !clientsJson?.success) {
        throw new Error(clientsJson?.message || "Failed to load clients");
      }
      if (!locationsResp.ok || !locationsJson?.success) {
        throw new Error(locationsJson?.message || "Failed to load locations");
      }

      setClients(sortClientsByName(toSafeArray(clientsJson.clients)));
      setLocations(toSafeArray(locationsJson.data));

      try {
        const oaResp = await mahaverseFetch("/officeally-connection-test.php", {
          headers: getMahaverseAuthHeaders(),
        });
        const oaJson = await readJsonSafe(oaResp);
        if (oaResp.ok && oaJson?.success) {
          setOfficeAllyConfig(oaJson.config || null);
        }
      } catch {
        setOfficeAllyConfig(null);
      }
    } catch (err) {
      console.error("Claims bootstrap load failed", err);
      setError(err.message || "Failed to load claims setup data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBootstrapData();
  }, [baseUrl]);

  useEffect(() => {
    if (!fromDateFilter || !toDateFilter) {
      setSessions([]);
      setSelectedSessionIds([]);
      return;
    }

    const loadSessions = async () => {
      setSessionsLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({
          start_date: fromDateFilter,
          end_date: toDateFilter,
        });
        if (selectedClientId && selectedClientId !== CLIENT_FILTER_ALL) {
          qs.set("client_id", String(selectedClientId));
        }
        const resp = await mahaverseFetch(`/add-session.php?${qs.toString()}`, {
          headers: getMahaverseAuthHeaders(),
        });
        const json = await resp.json();
        if (!resp.ok || !Array.isArray(json)) {
          throw new Error(
            json?.error || json?.message || "Failed to load sessions"
          );
        }
        const activeSessions = json.filter(
          (row) => String(row.status || row.STATUS || "").toLowerCase() !== "cancelled"
        );
        setSessions(
          activeSessions.filter((row) => normalizeClaimStatus(row) === "ready_to_bill")
        );
      } catch (err) {
        console.error("Claims sessions load failed", err);
        setError(err.message || "Failed to load sessions.");
      } finally {
        setSessionsLoading(false);
      }
    };

    loadSessions();
  }, [baseUrl, fromDateFilter, toDateFilter, selectedClientId]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    const run = async () => {
      if (!previewEntries?.length) {
        setPreviewPdfUrl("");
        return;
      }

      try {
        const blob = await createMergedCms1500PdfBlob(previewEntries.map((e) => e.payload));
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        objectUrls.push(u);
        setPreviewPdfUrl(u);
      } catch (err) {
        console.error("CMS-1500 PDF preview build failed", err);
        if (!cancelled) {
          setPreviewPdfUrl("");
          setError(err.message || "Failed to build CMS-1500 PDF preview.");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewEntries]);

  useEffect(() => {
    const visibleIds = new Set(filteredSessions.map((s) => String(s.session_id)));
    setSelectedSessionIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [filteredSessions]);

  const onClientChange = (clientId) => {
    setSelectedClientId(clientId);
    setSelectedInsuranceId("");
    setSelectedSessionIds([]);
    setPreviewEntries(null);
  };

  useEffect(() => {
    if (
      selectedInsuranceId &&
      insuranceOptions.length > 0 &&
      !insuranceOptions.some((ins) => String(ins.insurance_id) === String(selectedInsuranceId))
    ) {
      setSelectedInsuranceId("");
    }
  }, [insuranceOptions, selectedInsuranceId]);

  const onInsuranceChange = (insuranceId) => {
    setSelectedInsuranceId(insuranceId);
    setPreviewEntries(null);
  };

  const onLocationChange = (locationId) => {
    setSelectedLocationId(locationId);
    setPreviewEntries(null);
  };

  const toggleSelectAllFiltered = () => {
    setPreviewEntries(null);
    setSelectedSessionIds((prev) => {
      const filterSet = new Set(filteredSessionIds);
      const allSelected =
        filteredSessionIds.length > 0 &&
        filteredSessionIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !filterSet.has(id));
      }
      const next = new Set(prev);
      for (const id of filteredSessionIds) {
        next.add(id);
      }
      return [...next];
    });
  };

  const toggleClaimGroup = (group, checked) => {
    setPreviewEntries(null);
    const groupIds = group.sessionIds.map(String);
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of groupIds) next.add(id);
      } else {
        for (const id of groupIds) next.delete(id);
      }
      return [...next];
    });
  };

  const toggleClaimExpanded = (key) => {
    setExpandedClaimKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canGenerate =
    Boolean(selectedLocationId) &&
    selectedSessionIds.length > 0 &&
    selectedSessionsRows.length > 0 &&
    selectedSessionsRows.every((row) => normalizeClaimStatus(row) === "ready_to_bill");

  const filterSftpRange = useMemo(
    () => officeAllySftpDateRangeCheck(fromDateFilter, toDateFilter),
    [fromDateFilter, toDateFilter]
  );

  const selectedSftpRange = useMemo(() => {
    const bounds = dosBoundsFromSessions(selectedSessionsRows);
    if (!bounds) {
      return { ok: true, days: 0, message: "" };
    }
    return officeAllySftpDateRangeCheck(bounds.from, bounds.to);
  }, [selectedSessionsRows]);

  const sftpBlockedReason = useMemo(() => {
    if (!canSftp) {
      return "You do not have permission to submit claims via Office Ally SFTP.";
    }
    if (!filterSftpRange.ok) return filterSftpRange.message;
    if (!selectedSftpRange.ok) return selectedSftpRange.message;
    return "";
  }, [canSftp, filterSftpRange, selectedSftpRange]);

  const canSubmitOfficeAlly = canGenerate && canSftp && !sftpBlockedReason;

  const handleGeneratePreview = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError("");
    setPreviewEntries(null);
    try {
      const groupedRows = sessionsForSelectedClaimGroups(
        filteredSessions,
        selectedSessionIds
      );
      const groups = groupSessionsByClaim(groupedRows);
      if (groups.length === 0) {
        throw new Error("No Ready to Bill claims in the current selection.");
      }
      const selectedSet = new Set(groupedRows.map((s) => String(s.session_id)));
      setSelectedSessionIds((prev) => {
        const next = new Set(prev);
        for (const id of selectedSet) next.add(id);
        return [...next];
      });

      const results = await Promise.all(
        groups.map(async (group) => {
          const row = group.sessions[0];
          if (!row) {
            throw new Error(`Claim ${group.claimId} has no sessions`);
          }
          const clientId = String(row.client_id ?? "").trim();
          if (!clientId) {
            throw new Error(`Claim ${group.claimId} has no client`);
          }
          const insuranceId = resolveInsuranceIdForSession(
            row,
            clients,
            selectedInsuranceId
          );
          const insurancePk = positiveInsuranceId(insuranceId);
          if (!insurancePk) {
            throw new Error(
              `Claim ${group.claimId}: no insurance found (link authorization on the client or pick an insurance override)`
            );
          }
          const sessionIds = group.sessions.map((s) => s.session_id);
          const resp = await mahaverseFetch("/claims-cms1500-preview.php", {
            method: "POST",
            headers: getMahaverseAuthHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({
              client_id: clientId,
              insurance_id: insurancePk,
              location_id: selectedLocationId,
              session_ids: sessionIds,
            }),
          });
          const json = await readJsonSafe(resp);
          if (!resp.ok || !json?.success) {
            throw new Error(
              json?.message || `Failed to generate CMS-1500 for claim ${group.claimId}`
            );
          }
          return { group, json };
        })
      );

      const entries = results.map(({ group, json }) => {
        const row = group.sessions[0];
        const account =
          String(json?.payload?.patient_account_number || "").trim() ||
          group.claimId;
        const lineCodes = toSafeArray(json?.payload?.lines)
          .map((line) => line?.procedure_code)
          .filter(Boolean)
          .join(", ");
        return {
          sessionId: String(row?.session_id || group.sessionIds[0]),
          label: `${account} · ${group.dos} · ${group.sessions.length} line(s)`,
          payload: json.payload,
          warnings: toSafeArray(json.warnings),
          clientId: row?.client_id || "",
          locationId: selectedLocationId || "",
          serviceCode:
            lineCodes ||
            row?.service_code ||
            row?.service_code_with_modifiers ||
            row?.auth_code ||
            "",
          unifiedSessionIds: group.sessionIds,
          unifiedClaimId: account,
        };
      });

      setSessions((prev) =>
        prev.map((session) => {
          const sid = String(session.session_id);
          const match = entries.find((e) => e.unifiedSessionIds.includes(sid));
          return match ? { ...session, claim_id: match.unifiedClaimId } : session;
        })
      );
      setPreviewEntries(entries);
    } catch (err) {
      console.error("CMS-1500 preview failed", err);
      setError(err.message || "Failed to generate CMS-1500 preview.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!previewEntries?.length) return;
    setDownloading(true);
    try {
      const payloads = previewEntries.map((e) => e.payload);
      const primary =
        previewEntries.length === 1
          ? previewEntries[0].label
          : `${previewEntries.length}_forms`;
      const clientTag =
        new Set(selectedSessionsRows.map((r) => String(r.client_id))).size === 1
          ? String(selectedSessionsRows[0]?.client_id ?? "claim")
          : "multi-client";
      await downloadMergedCms1500Pdf(payloads, `cms1500-${primary}-${clientTag}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleTestOfficeAlly = async () => {
    if (!canSftp) {
      setError("You do not have permission to test Office Ally SFTP.");
      return;
    }
    setTestingOfficeAlly(true);
    setError("");
    setOfficeAllyStatus(null);
    try {
      const resp = await mahaverseFetch("/officeally-connection-test.php?connect=1", {
        headers: getMahaverseAuthHeaders(),
      });
      const json = await readJsonSafe(resp);
      if (!resp.ok || !json?.success) {
        throw new Error(json?.message || "Office Ally connection test failed");
      }
      setOfficeAllyConfig(json.config || officeAllyConfig);
      setOfficeAllyStatus({
        success: true,
        message: `Connected to ${json.connection?.host || "Office Ally"}:${json.connection?.port || 22} (${json.connection?.remote_dir || "inbound"})`,
      });
    } catch (err) {
      console.error("Office Ally connection test failed", err);
      setError(err.message || "Failed to connect to Office Ally SFTP.");
    } finally {
      setTestingOfficeAlly(false);
    }
  };

  const handleSubmitOfficeAlly = async () => {
    if (!canSubmitOfficeAlly) {
      if (sftpBlockedReason) setError(sftpBlockedReason);
      return;
    }
    setSubmittingOfficeAlly(true);
    setError("");
    setOfficeAllyStatus(null);
    try {
      const sessionRows = new Map(sessions.map((s) => [String(s.session_id), s]));
      // Prefer explicit override; otherwise resolve from the first selected session
      // so Auto mode still sends a valid insurance_id to the submit endpoint.
      let insurancePayload = positiveInsuranceId(selectedInsuranceId);
      if (insurancePayload == null && selectedSessionIds.length > 0) {
        const firstRow = sessionRows.get(String(selectedSessionIds[0]));
        insurancePayload = positiveInsuranceId(
          resolveInsuranceIdForSession(firstRow, clients, "")
        );
      }
      const resp = await mahaverseFetch("/officeally-submit-claims.php", {
        method: "POST",
        headers: getMahaverseAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          location_id: selectedLocationId,
          ...(insurancePayload != null ? { insurance_id: insurancePayload } : {}),
          session_ids: sessionsForSelectedClaimGroups(
            filteredSessions,
            selectedSessionIds
          ).map((row) => Number.parseInt(String(row.session_id), 10) || row.session_id),
        }),
      });
      const json = await readJsonSafe(resp);
      if (!resp.ok || !json?.success) {
        throw new Error(json?.message || "Office Ally submission failed");
      }
      setOfficeAllyStatus(json);
      await fetchBootstrapData();
    } catch (err) {
      console.error("Office Ally submit failed", err);
      setError(err.message || "Failed to submit claims to Office Ally.");
    } finally {
      setSubmittingOfficeAlly(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Claims</h2>
          <p className="text-slate-600 mt-1">
            Ready to Bill claims grouped by date of service, client, and authorization
            number — one CMS-1500 per claim, with sessions as service lines
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={fetchBootstrapData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh data
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Claim inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-slate-600">DOS from</p>
              <Input
                type="date"
                value={fromDateFilter}
                onChange={(e) => {
                  setFromDateFilter(e.target.value);
                  setPreviewEntries(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">DOS to</p>
              <Input
                type="date"
                value={toDateFilter}
                onChange={(e) => {
                  setToDateFilter(e.target.value);
                  setPreviewEntries(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Client (optional)</p>
              <Select value={selectedClientId} onValueChange={onClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All clients in range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CLIENT_FILTER_ALL}>All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem
                      key={client.client_id}
                      value={String(client.client_id)}
                    >
                      {[client.first_name, client.last_name].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Claim status</p>
              <div className="flex h-10 items-center rounded-md border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-800">
                Ready to Bill only
              </div>
            </div>
          </div>

          {!filterSftpRange.ok && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {filterSftpRange.message}
              <span className="mt-1 block text-amber-800">
                CMS-1500 preview still works; Office Ally SFTP submit is blocked until the
                range is {OFFICE_ALLY_SFTP_MAX_DAYS} days or less.
              </span>
            </div>
          )}
          {filterSftpRange.ok &&
            !selectedSftpRange.ok &&
            selectedSessionIds.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {selectedSftpRange.message}
              </div>
            )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Insurance override (optional)</p>
              <Select
                value={selectedInsuranceId || "__auto__"}
                onValueChange={(v) => onInsuranceChange(v === "__auto__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      filterClient
                        ? "Auto from session authorization"
                        : "Auto per session, or filter by client to override"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Auto (from session authorization)</SelectItem>
                  {insuranceOptions.map((ins) => (
                    <SelectItem
                      key={String(ins.insurance_id)}
                      value={String(ins.insurance_id)}
                    >
                      {ins.insurance_plan_name ||
                        ins.insurance_provider ||
                        `Insurance ${ins.insurance_id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Billing location</p>
              <Select value={selectedLocationId} onValueChange={onLocationChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={String(location.id)}>
                      {location.location_name || location.facility_name || location.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Service code</p>
              <Input
                value={serviceCodeFilter}
                onChange={(e) => setServiceCodeFilter(e.target.value)}
                placeholder="Search by auth/service code"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Claims for billing</p>
              <div className="flex gap-2">
                <Badge variant="outline">{filteredClaimGroups.length} claims</Badge>
                <Badge variant="outline">{filteredSessions.length} lines</Badge>
                <Badge variant="outline">{selectedSessionIds.length} selected</Badge>
              </div>
            </div>
            <div className="border rounded-lg max-h-72 overflow-auto">
              {!fromDateFilter || !toDateFilter ? (
                <div className="p-4 text-sm text-slate-500">
                  Set DOS from and to dates to load sessions.
                </div>
              ) : sessionsLoading ? (
                <div className="p-4 text-sm text-slate-500">Loading sessions...</div>
              ) : filteredSessions.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">
                  No Ready to Bill sessions in this date range
                  {selectedClientId !== CLIENT_FILTER_ALL ? " for this client" : ""}.
                </div>
              ) : (
                <div className="divide-y">
                  <div className="grid grid-cols-10 gap-2 p-2 text-[11px] font-semibold text-slate-600 bg-slate-100">
                    <div className="flex flex-col items-center justify-center gap-0.5 min-w-0">
                      <Checkbox
                        aria-label="Select all claims shown in the table"
                        title="Select all shown"
                        disabled={filteredSessionIds.length === 0}
                        checked={
                          selectAllCheckboxState.all
                            ? true
                            : selectAllCheckboxState.some
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={() => toggleSelectAllFiltered()}
                      />
                      <span className="font-normal text-[10px] text-slate-500 leading-tight text-center">
                        All
                      </span>
                    </div>
                    <div>Claim ID</div>
                    <div>Client Name</div>
                    <div>DOS</div>
                    <div>Insurance Name</div>
                    <div>Auth Number</div>
                    <div>Lines</div>
                    <div>Supervising Provider</div>
                    <div>Rendering Provider</div>
                    <div>Claim Status</div>
                  </div>
                  {filteredClaimGroups.map((group) => {
                    const selectedCount = group.sessionIds.filter((id) =>
                      selectedSessionIds.includes(id)
                    ).length;
                    const checked =
                      selectedCount === group.sessionIds.length
                        ? true
                        : selectedCount > 0
                          ? "indeterminate"
                          : false;
                    const expanded = expandedClaimKeys.has(group.key);
                    const first = group.sessions[0];
                    const claimStatus = normalizeClaimStatus(first);
                    const uniqueRendering = [
                      ...new Set(
                        group.sessions
                          .map((s) => String(s.provider_name || "").trim())
                          .filter(Boolean)
                      ),
                    ];
                    const uniqueSupervising = [
                      ...new Set(
                        group.sessions
                          .map((s) => String(s.supervising_provider_name || "").trim())
                          .filter(Boolean)
                      ),
                    ];
                    return (
                      <div key={group.key}>
                        <div className="grid grid-cols-10 gap-2 p-2 text-xs hover:bg-slate-50">
                          <div className="flex items-center justify-center gap-1">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleClaimGroup(group, Boolean(value))
                              }
                              aria-label={`Select claim ${group.claimId}`}
                            />
                            <button
                              type="button"
                              className="rounded p-0.5 text-slate-500 hover:bg-slate-200"
                              aria-label={expanded ? "Collapse service lines" : "Expand service lines"}
                              onClick={() => toggleClaimExpanded(group.key)}
                            >
                              {expanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="font-medium text-slate-800">{group.claimId}</div>
                          <div className="font-medium text-slate-800">{group.clientName}</div>
                          <div>{group.dos}</div>
                          <div>{sessionInsuranceLabel(first)}</div>
                          <div>{group.authNumber}</div>
                          <div>{group.sessions.length}</div>
                          <div>
                            {uniqueSupervising.length === 0
                              ? "N/A"
                              : uniqueSupervising.length === 1
                                ? uniqueSupervising[0]
                                : `${uniqueSupervising.length} providers`}
                          </div>
                          <div>
                            {uniqueRendering.length === 0
                              ? "N/A"
                              : uniqueRendering.length === 1
                                ? uniqueRendering[0]
                                : `${uniqueRendering.length} providers`}
                          </div>
                          <div>{claimStatusLabel(claimStatus)}</div>
                        </div>
                        {expanded
                          ? group.sessions.map((session) => (
                              <div
                                key={session.session_id}
                                className="grid grid-cols-10 gap-2 border-t border-slate-100 bg-slate-50/80 p-2 text-[11px] text-slate-700"
                              >
                                <div />
                                <div className="text-slate-500">Line</div>
                                <div className="col-span-2">
                                  {sessionProcedureCode(session)}
                                  {sessionBillableUnits(session)
                                    ? ` · ${sessionBillableUnits(session)} units`
                                    : ""}
                                </div>
                                <div className="col-span-2">
                                  {session.auth_code || session.service_code || "N/A"}
                                </div>
                                <div />
                                <div>{session.supervising_provider_name || "N/A"}</div>
                                <div>{session.provider_name || "N/A"}</div>
                                <div>{claimStatusLabel(normalizeClaimStatus(session))}</div>
                              </div>
                            ))
                          : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={handleGeneratePreview}
              disabled={!canGenerate || generating}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              {generating ? "Generating..." : "Generate CMS-1500 Preview"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={!previewEntries?.length || downloading}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {downloading
                ? "Preparing PDF..."
                : previewEntries?.length > 1
                  ? `Download combined PDF (${previewEntries.length} forms)`
                  : "Download PDF"}
            </Button>
            {canSftp ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSubmitOfficeAlly}
                  disabled={!canSubmitOfficeAlly || submittingOfficeAlly}
                  title={sftpBlockedReason || undefined}
                  className="border-teal-300 text-teal-800 hover:bg-teal-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {submittingOfficeAlly
                    ? "Uploading to Office Ally..."
                    : "Submit to Office Ally (SFTP)"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleTestOfficeAlly}
                  disabled={testingOfficeAlly}
                >
                  {testingOfficeAlly
                    ? "Testing Office Ally..."
                    : "Test Office Ally connection"}
                </Button>
              </>
            ) : null}
          </div>

          {canSftp && sftpBlockedReason && (
            <p className="text-xs text-amber-800">{sftpBlockedReason}</p>
          )}
          {!canSftp && (
            <p className="text-xs text-slate-500">
              Office Ally SFTP submit requires the Billing: Office Ally SFTP permission
              (Admin → Role permissions).
            </p>
          )}

          {canSftp && officeAllyConfig && (
            <p className="text-xs text-slate-500">
              Office Ally: {officeAllyConfig.enabled ? "enabled" : "disabled"}
              {officeAllyConfig.configured ? ", credentials present" : ", waiting on .env credentials"}
              {officeAllyConfig.sftp_host ? ` · ${officeAllyConfig.sftp_host}` : ""}
              {officeAllyConfig.environment ? ` (${officeAllyConfig.environment})` : ""}
            </p>
          )}

          {officeAllyStatus?.success && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
              {officeAllyStatus.message || (
                <>
                  Uploaded <span className="font-medium">{officeAllyStatus.filename}</span>
                  {officeAllyStatus.remote_path ? ` to ${officeAllyStatus.remote_path}` : ""}
                  {officeAllyStatus.session_ids?.length
                    ? ` (${officeAllyStatus.session_ids.length} session(s) marked Claim Submitted)`
                    : ""}
                </>
              )}
              {officeAllyStatus.warnings?.length > 0 && (
                <>
                  <p className="mt-2 text-xs text-slate-600">
                    Click a warning to open where you can fix it (new tab).
                  </p>
                  <ClaimWarningList
                    warnings={officeAllyStatus.warnings}
                    itemClassName="text-amber-900"
                    resolveContext={resolveOfficeAllyWarningContext}
                  />
                </>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Cms1500Preview claims={previewClaims} />
    </div>
  );
}
