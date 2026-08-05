"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { usePermissions } from "@/hooks/usePermissions";
import { PERM } from "@/lib/rbac-permission-keys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Car,
  Eye,
  Plus,
  RotateCw,
  Search,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatTime12hFromUTC } from "@/lib/time-utils";
import { localYmd } from "@/lib/session-notes-date";
import { enrichMileageWithGoogle, normalizeMileageAddress } from "@/lib/mileage-google-distance";

const CLAIM_STATUSES = ["all", "submitted", "approved", "void", "draft"];

const HOME_COMMUTE_DEDUCTIBLE_MILES = 30;

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatMileageTimeRange(startUtc, endUtc, timeZone = browserTimezone()) {
  if (!startUtc) return null;
  const start = formatTime12hFromUTC(String(startUtc), timeZone);
  if (!start) return null;
  if (!endUtc) return start;
  const end = formatTime12hFromUTC(String(endUtc), timeZone);
  return end ? `${start} – ${end}` : start;
}

/** User's local calendar date (not UTC) as YYYY-MM-DD. */
function todayIso() {
  return localYmd();
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function billableMiles(gross, homeLeg, excluded) {
  const g = Number(gross) || 0;
  if (excluded || g <= 0) return 0;
  if (homeLeg) return Math.round(Math.max(0, g - HOME_COMMUTE_DEDUCTIBLE_MILES) * 100) / 100;
  return Math.round(g * 100) / 100;
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  // Number(null) === 0 → Null Island; never coerce null/undefined.
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return null;
  }
  const a = Number(lat1);
  const b = Number(lng1);
  const c = Number(lat2);
  const d = Number(lng2);
  if (![a, b, c, d].every((n) => Number.isFinite(n))) {
    return null;
  }
  const isZero = (lat, lng) => Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6;
  if (isZero(a, b) || isZero(c, d)) {
    return null;
  }
  const R = 3958.8;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(c - a);
  const dLng = toRad(d - b);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function stopByKey(stops, key) {
  return stops.find((s) => s.stop_key === key || s.id === key);
}

function isHomeKey(key) {
  return String(key || "").startsWith("home:");
}

/** Collapse consecutive client sessions at the same place. */
function collapseClientStops(stops) {
  const home = stops.find((s) => s.is_home);
  const clients = stops.filter((s) => !s.is_home);
  const collapsed = [];
  for (const s of clients) {
    const prev = collapsed[collapsed.length - 1];
    if (!prev) {
      collapsed.push(s);
      continue;
    }
    const sameAddr =
      prev.address &&
      s.address &&
      String(prev.address).trim().toLowerCase() === String(s.address).trim().toLowerCase();
    const sameCoords =
      prev.lat != null &&
      prev.lng != null &&
      s.lat != null &&
      s.lng != null &&
      Math.abs(Number(prev.lat) - Number(s.lat)) < 1e-5 &&
      Math.abs(Number(prev.lng) - Number(s.lng)) < 1e-5;
    if (sameAddr || sameCoords) continue;
    collapsed.push(s);
  }
  return home ? [home, ...collapsed] : collapsed;
}

function buildAutoLegs(stops) {
  const ordered = collapseClientStops(stops);
  const home = ordered.find((s) => s.is_home);
  const clients = ordered.filter((s) => !s.is_home);
  const legs = [];
  if (home && clients[0]) {
    legs.push({
      from_stop_key: home.stop_key,
      to_stop_key: clients[0].stop_key,
      excluded: false,
      is_home_leg: true,
    });
  }
  for (let i = 0; i < clients.length - 1; i++) {
    legs.push({
      from_stop_key: clients[i].stop_key,
      to_stop_key: clients[i + 1].stop_key,
      excluded: false,
      is_home_leg: false,
    });
  }
  if (home && clients.length) {
    legs.push({
      from_stop_key: clients[clients.length - 1].stop_key,
      to_stop_key: home.stop_key,
      excluded: false,
      is_home_leg: true,
    });
  }
  return legs;
}

function enrichLeg(leg, stops, rate) {
  const from = stopByKey(stops, leg.from_stop_key);
  const to = stopByKey(stops, leg.to_stop_key);
  const homeLeg =
    !!leg.is_home_leg || isHomeKey(leg.from_stop_key) || isHomeKey(leg.to_stop_key);
  const excluded = !!leg.excluded;
  const fromLat = from?.lat ?? leg.from_lat;
  const fromLng = from?.lng ?? leg.from_lng;
  const toLat = to?.lat ?? leg.to_lat;
  const toLng = to?.lng ?? leg.to_lng;
  const computed = haversineMiles(fromLat, fromLng, toLat, toLng);
  let miles;
  let distanceMode = leg.distance_mode || null;
  if (leg.miles_override != null && leg.miles_override !== "") {
    miles = Number(leg.miles_override);
    distanceMode = "override";
  } else if (leg.miles != null && leg.miles !== "" && Number.isFinite(Number(leg.miles))) {
    miles = Number(leg.miles);
  } else if (computed != null) {
    miles = computed;
    distanceMode = distanceMode || "straight";
  } else {
    miles = 0;
    if (!distanceMode) distanceMode = "unknown";
  }
  if (!Number.isFinite(miles) || miles < 0) miles = 0;
  // Guard: Null Island / bad geocode (Chicago↔0,0 ≈ 6100 mi)
  if (miles > 500 && distanceMode !== "override") {
    miles = 0;
    distanceMode = "invalid";
  }
  miles = Math.round(miles * 100) / 100;
  const billable = billableMiles(miles, homeLeg, excluded);
  const cost = Math.round(billable * rate * 100) / 100;
  return {
    ...leg,
    from_label: leg.from_label || from?.label || leg.from_stop_key,
    to_label: leg.to_label || to?.label || leg.to_stop_key,
    from_address: leg.from_address || from?.address || "",
    to_address: leg.to_address || to?.address || "",
    from_session_id: leg.from_session_id ?? from?.session_id ?? null,
    to_session_id: leg.to_session_id ?? to?.session_id ?? null,
    from_lat: fromLat ?? null,
    from_lng: fromLng ?? null,
    to_lat: toLat ?? null,
    to_lng: toLng ?? null,
    excluded,
    is_home_leg: homeLeg,
    miles,
    billable_miles: billable,
    home_deductible_miles: homeLeg ? HOME_COMMUTE_DEDUCTIBLE_MILES : 0,
    cost,
    distance_mode: distanceMode,
  };
}

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-800 border-transparent";
  if (s === "void") return "bg-slate-200 text-slate-700 border-transparent";
  if (s === "draft") return "bg-amber-100 text-amber-900 border-transparent";
  return "bg-teal-100 text-teal-800 border-transparent";
}

function paymentStatusBadgeClass(status) {
  const s = String(status || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "paid") return "bg-emerald-100 text-emerald-800 border-transparent";
  return "bg-amber-100 text-amber-900 border-transparent";
}

function paymentStatusLabel(status) {
  const s = String(status || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "paid") return "Paid";
  return "Pending Payment";
}

const PAYMENT_STATUSES = [
  { value: "pending_payment", label: "Pending Payment" },
  { value: "paid", label: "Paid" },
];

export default function MileageView({ userRole = null }) {
  const { can } = usePermissions(userRole);
  // Mileage Self/All grants submit; don't require legacy reports.write (export/manage).
  const canWrite = can(PERM.REPORTS_WRITE) || can(PERM.VIEW_REPORTS_MILEAGE);
  const isAdmin = String(userRole?.role || "").toLowerCase() === "admin";

  const [mode, setMode] = useState("list"); // list | capture | detail
  const [access, setAccess] = useState({
    scope: isAdmin ? "all" : "self",
    self_provider_id: null,
    can_manage_all: isAdmin,
  });
  const canManageAll = !!access.can_manage_all || isAdmin;

  const [claims, setClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailClaim, setDetailClaim] = useState(null);
  const [payDate, setPayDate] = useState("");
  const [checkNumber, setCheckNumber] = useState("");

  const [rate, setRate] = useState(0.45);
  const [date, setDate] = useState(todayIso);
  const [providers, setProviders] = useState([]);
  const [sessionProviderCount, setSessionProviderCount] = useState(null);
  const [providerId, setProviderId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [stops, setStops] = useState([]);
  const [legs, setLegs] = useState([]);
  const [existingClaim, setExistingClaim] = useState(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dayLoaded, setDayLoaded] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const applyAccess = useCallback((payload) => {
    if (payload?.access) {
      setAccess({
        scope: payload.access.scope || "self",
        self_provider_id: payload.access.self_provider_id || null,
        can_manage_all: !!payload.access.can_manage_all,
      });
    }
  }, []);

  const loadClaims = useCallback(async () => {
    setLoadingClaims(true);
    try {
      const q = new URLSearchParams({ action: "claims" });
      if (statusFilter && statusFilter !== "all") q.set("status", statusFilter);
      const res = await mahaverseFetch(`/mileage.php?${q}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load claims");
      applyAccess(json);
      setClaims(Array.isArray(json.claims) ? json.claims : []);
    } catch (e) {
      toast.error(e.message || "Could not load claims");
    } finally {
      setLoadingClaims(false);
    }
  }, [statusFilter, applyAccess]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await mahaverseFetch("/mileage.php?action=settings");
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load settings");
      applyAccess(json);
      const r = Number(json.settings?.rate_per_mile ?? 0.45);
      setRate(r);
    } catch (e) {
      toast.error(e.message || "Could not load mileage rate");
    }
  }, [applyAccess]);

  const loadProviders = useCallback(
    async (forDate) => {
      try {
        const q = new URLSearchParams({ action: "providers", tz: browserTimezone() });
        if (forDate) q.set("date", forDate);
        const res = await mahaverseFetch(`/mileage.php?${q}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message || "Failed to load providers");
        applyAccess(json);
        const list = Array.isArray(json.providers) ? json.providers : [];
        setProviders(list);
        setSessionProviderCount(
          typeof json.session_provider_count === "number" ? json.session_provider_count : null
        );
        const selfId = json.access?.self_provider_id;
        const preferred =
          (selfId && list.find((p) => String(p.provider_id) === String(selfId))) ||
          list.find((p) => p.has_sessions) ||
          list[0];
        if (preferred) {
          setProviderId(String(preferred.provider_id));
          setProviderName(preferred.provider_name || "");
        } else {
          setProviderId("");
          setProviderName("");
        }
      } catch (e) {
        toast.error(e.message || "Could not load providers");
      }
    },
    [applyAccess]
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (mode === "list") loadClaims();
  }, [mode, loadClaims]);

  useEffect(() => {
    if (mode === "capture") loadProviders(date);
  }, [mode, date, loadProviders]);

  const filteredClaims = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return claims;
    return claims.filter((c) => {
      const blob = [
        c.provider_name,
        c.provider_id,
        c.claim_date,
        c.status,
        c.payment_status,
        c.created_by,
        c.total_cost,
        c.total_miles,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }, [claims, search]);

  const enrichedLegs = useMemo(
    () => legs.map((leg) => enrichLeg(leg, stops, rate)),
    [legs, stops, rate]
  );

  const totals = useMemo(() => {
    let miles = 0;
    let count = 0;
    let cost = 0;
    for (const leg of enrichedLegs) {
      const billable = Number(leg.billable_miles) || 0;
      if (billable <= 0) continue;
      miles += billable;
      cost += Number(leg.cost) || 0;
      count += 1;
    }
    return {
      miles: Math.round(miles * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      count,
    };
  }, [enrichedLegs]);

  const openCapture = () => {
    setDayLoaded(false);
    setStops([]);
    setLegs([]);
    setExistingClaim(null);
    setDate(todayIso());
    setMode("capture");
  };

  const openDetail = async (id) => {
    try {
      const res = await mahaverseFetch(`/mileage.php?action=claim&id=${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load claim");
      applyAccess(json);
      setDetailClaim(json.claim);
      setPayDate(json.claim?.pay_date || todayIso());
      setCheckNumber(json.claim?.check_number || "");
      setMode("detail");
    } catch (e) {
      toast.error(e.message || "Failed to open claim");
    }
  };

  const loadDay = async () => {
    if (!providerId || !date) {
      toast.error("Pick a provider and date");
      return;
    }
    setLoadingDay(true);
    setDayLoaded(false);
    try {
      const q = new URLSearchParams({
        action: "day",
        provider_id: providerId,
        date,
        tz: browserTimezone(),
      });
      const res = await mahaverseFetch(`/mileage.php?${q}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load day");
      applyAccess(json);
      let nextStops = Array.isArray(json.stops)
        ? json.stops.map((s) => ({
            ...s,
            address: normalizeMileageAddress(s.address || "") || s.address || null,
          }))
        : [];
      let nextLegs = Array.isArray(json.legs) && json.legs.length
        ? json.legs
        : buildAutoLegs(nextStops);

      // Browser Photon geocode + OSRM driving miles (static export has no Next API routes).
      if (nextStops.some((s) => s.address)) {
        try {
          const enriched = await enrichMileageWithGoogle(nextStops, nextLegs);
          nextStops = enriched.stops;
          nextLegs = enriched.legs;
        } catch {
          // Keep server legs if distance API fails
        }
      }

      setStops(nextStops);
      setProviderName(json.provider_name || providerName);
      if (json.settings?.rate_per_mile != null) {
        setRate(Number(json.settings.rate_per_mile));
      }
      setExistingClaim(json.existing_claim || null);
      setLegs(nextLegs);
      setDayLoaded(true);
      if (json.existing_claim) {
        toast(
          `Claim already exists for this day (${money(json.existing_claim.total_cost)}).`,
          { icon: "ℹ️" }
        );
      } else if (!nextStops.filter((s) => !s.is_home).length) {
        toast.error("No sessions found for this provider on that date");
      } else {
        const hasDriving = nextLegs.some(
          (l) => l.distance_mode === "driving" && Number(l.miles) >= 0 && l.miles != null
        );
        const hasStraight = nextLegs.some(
          (l) => l.distance_mode === "straight" && Number(l.miles) > 0
        );
        const missingGeo = nextStops.filter(
          (s) =>
            s.address &&
            (s.lat == null || s.lng == null || !Number.isFinite(Number(s.lat)))
        );
        if (hasDriving || hasStraight) {
          toast.success(
            hasDriving
              ? "Sessions loaded — driving miles calculated"
              : "Sessions loaded — map miles calculated"
          );
        } else if (missingGeo.length) {
          toast.error(
            `Could not locate ${missingGeo.length} address(es) on the map. Enter miles manually if needed.`
          );
        } else {
          toast.success("Sessions loaded");
        }
      }
    } catch (e) {
      toast.error(e.message || "Failed to load day");
    } finally {
      setLoadingDay(false);
    }
  };

  const updateLeg = (idx, patch) => {
    setLegs((prev) => prev.map((leg, i) => (i === idx ? { ...leg, ...patch } : leg)));
  };

  const removeLeg = (idx) => setLegs((prev) => prev.filter((_, i) => i !== idx));

  const addLeg = () => {
    const clients = stops.filter((s) => !s.is_home);
    if (clients.length < 2) {
      toast.error("Need at least two client stops");
      return;
    }
    setLegs((prev) => [
      ...prev,
      {
        from_stop_key: clients[0].stop_key,
        to_stop_key: clients[1].stop_key,
        excluded: false,
        is_home_leg: false,
      },
    ]);
  };

  const saveClaim = async () => {
    if (existingClaim) {
      toast.error("Duplicate blocked — delete or void the existing claim first");
      return;
    }
    const payloadLegs = enrichedLegs.filter(
      (l) => l.from_stop_key && l.to_stop_key && l.from_stop_key !== l.to_stop_key
    );
    if (!payloadLegs.some((l) => (Number(l.billable_miles) || 0) > 0)) {
      toast.error("Add at least one reimbursable leg (client-to-client, or home commute over 30 mi)");
      return;
    }
    setSaving(true);
    try {
      const res = await mahaverseFetch("/mileage.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          provider_name: providerName,
          claim_date: date,
          rate_per_mile: rate,
          legs: payloadLegs,
        }),
      });
      const json = await res.json();
      if (res.status === 409 || (!json.success && json.existing_claim)) {
        setExistingClaim(json.existing_claim || existingClaim);
        throw new Error(json.message || "Duplicate claim for this provider and date");
      }
      if (!json.success) throw new Error(json.message || "Failed to save claim");
      toast.success(
        `Submitted ${totals.miles.toFixed(1)} mi × $${rate.toFixed(2)} = ${money(totals.cost)}`
      );
      setMode("list");
      await loadClaims();
    } catch (e) {
      toast.error(e.message || "Failed to save claim");
    } finally {
      setSaving(false);
    }
  };

  const deleteClaim = async (id) => {
    if (!confirm("Delete this mileage claim?")) return;
    try {
      const res = await mahaverseFetch(`/mileage.php?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to delete");
      toast.success("Claim deleted");
      if (mode === "detail") {
        setMode("list");
        setDetailClaim(null);
      }
      await loadClaims();
    } catch (e) {
      toast.error(e.message || "Failed to delete claim");
    }
  };

  const updateStatus = async (id, status) => {
    setStatusUpdating(true);
    try {
      const res = await mahaverseFetch("/mileage.php", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id, status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to update status");
      const approved =
        String(status).toLowerCase() === "approved";
      toast.success(
        approved
          ? "Status set to approved · Payment status Pending Payment"
          : `Status set to ${status}`
      );
      setDetailClaim(json.claim);
      if (approved) {
        setPayDate(json.claim?.pay_date || todayIso());
        setCheckNumber(json.claim?.check_number || "");
      }
      await loadClaims();
    } catch (e) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const updatePaymentStatus = async (id, paymentStatus) => {
    const payload = {
      action: "payment_status",
      id,
      payment_status: paymentStatus,
    };
    if (paymentStatus === "paid") {
      const dateVal = String(payDate || "").trim();
      const checkVal = String(checkNumber || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        toast.error("Pay date is required when marking Paid");
        return;
      }
      if (!checkVal) {
        toast.error("Check # is required when marking Paid");
        return;
      }
      payload.pay_date = dateVal;
      payload.check_number = checkVal;
    }
    setStatusUpdating(true);
    try {
      const res = await mahaverseFetch("/mileage.php", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to update payment status");
      toast.success(`Payment status set to ${paymentStatusLabel(paymentStatus)}`);
      setDetailClaim(json.claim);
      setPayDate(json.claim?.pay_date || "");
      setCheckNumber(json.claim?.check_number || "");
      await loadClaims();
    } catch (e) {
      toast.error(e.message || "Failed to update payment status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const clientStops = stops.filter((s) => !s.is_home);

  /* ─── LIST (default, like Clients / Staff) ─── */
  if (mode === "list") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-end gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={loadClaims} disabled={loadingClaims}>
              <RotateCw className={`h-3.5 w-3.5 mr-1 ${loadingClaims ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {canWrite ? (
              <Button
                type="button"
                className="bg-teal-600 hover:bg-teal-700 text-white"
                size="sm"
                onClick={openCapture}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New claim
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-slate-800 flex items-center text-lg">
                <Car className="h-5 w-5 mr-2 text-teal-600" />
                Mileage claims ({filteredClaims.length})
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-8 h-9 w-48"
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLAIM_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingClaims ? (
              <p className="text-sm text-slate-500 py-10 text-center">Loading claims…</p>
            ) : filteredClaims.length === 0 ? (
              <p className="text-sm text-slate-500 py-10 text-center">
                No claims yet.{canWrite ? " Use New claim to submit one." : ""}
              </p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b">
                      <TableHead className="pl-6 font-semibold text-slate-700">Provider</TableHead>
                      <TableHead className="font-semibold text-slate-700">Date</TableHead>
                      <TableHead className="hidden sm:table-cell font-semibold text-slate-700">Miles</TableHead>
                      <TableHead className="font-semibold text-slate-700">Cost</TableHead>
                      <TableHead className="font-semibold text-slate-700">Status</TableHead>
                      <TableHead className="hidden lg:table-cell font-semibold text-slate-700">Payment status</TableHead>
                      <TableHead className="hidden md:table-cell font-semibold text-slate-700">Submitted by</TableHead>
                      <TableHead className="pr-6 font-semibold text-slate-700 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClaims.map((c) => (
                      <TableRow key={c.id} className="hover:bg-slate-50 border-b">
                        <TableCell className="pl-6 py-3">
                          <div className="font-medium text-slate-800">{c.provider_name || c.provider_id}</div>
                          <div className="text-xs text-slate-500 sm:hidden">{c.claim_date}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-slate-600">{c.claim_date}</TableCell>
                        <TableCell className="hidden sm:table-cell">{Number(c.total_miles).toFixed(1)}</TableCell>
                        <TableCell className="font-semibold text-teal-800">{money(c.total_cost)}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(c.status)}>
                            {String(c.status || "submitted")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="space-y-0.5">
                            <Badge className={paymentStatusBadgeClass(c.payment_status)}>
                              {paymentStatusLabel(c.payment_status)}
                            </Badge>
                            {String(c.payment_status || "").toLowerCase().replace(/[\s-]+/g, "_") === "paid" ? (
                              <div className="text-xs text-slate-500">
                                {c.pay_date || "—"}
                                {c.check_number ? ` · #${c.check_number}` : ""}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-slate-500 text-sm">
                          {c.created_by || "—"}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => openDetail(c.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canWrite &&
                            (canManageAll ||
                              ["submitted", "draft"].includes(String(c.status || "").toLowerCase())) ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-rose-600"
                                onClick={() => deleteClaim(c.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ─── DETAIL ─── */
  if (mode === "detail" && detailClaim) {
    const c = detailClaim;
    return (
      <div className="space-y-4 max-w-3xl">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setMode("list"); setDetailClaim(null); }}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to claims
        </Button>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-slate-800">
                  Claim #{c.id} · {c.provider_name || c.provider_id}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {c.claim_date} · {Number(c.total_miles).toFixed(1)} mi · {money(c.total_cost)} @ {money(c.rate_per_mile)}/mi
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusBadgeClass(c.status)}>{c.status}</Badge>
                <Badge className={paymentStatusBadgeClass(c.payment_status)}>
                  {paymentStatusLabel(c.payment_status)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManageAll && canWrite ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {["submitted", "approved", "void"].map((st) => (
                    <Button
                      key={st}
                      type="button"
                      size="sm"
                      variant={String(c.status).toLowerCase() === st ? "default" : "outline"}
                      className={String(c.status).toLowerCase() === st ? "bg-teal-600 hover:bg-teal-700" : ""}
                      disabled={statusUpdating || String(c.status).toLowerCase() === st}
                      onClick={() => updateStatus(c.id, st)}
                    >
                      Mark {st}
                    </Button>
                  ))}
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Payment status
                    </span>
                    {PAYMENT_STATUSES.map((st) => {
                      const current = String(c.payment_status || "pending_payment")
                        .toLowerCase()
                        .replace(/[\s-]+/g, "_");
                      const active = current === st.value;
                      return (
                        <Button
                          key={st.value}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className={active ? "bg-teal-600 hover:bg-teal-700" : ""}
                          disabled={statusUpdating || active}
                          onClick={() => updatePaymentStatus(c.id, st.value)}
                        >
                          {st.label}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="mileage-pay-date">Pay date *</Label>
                      <Input
                        id="mileage-pay-date"
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        disabled={statusUpdating}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mileage-check-number">Check # *</Label>
                      <Input
                        id="mileage-check-number"
                        value={checkNumber}
                        onChange={(e) => setCheckNumber(e.target.value)}
                        placeholder="e.g. 10482"
                        disabled={statusUpdating}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-slate-500 flex-1">
                      Pay date and Check # are required when marking Paid.
                    </p>
                    {String(c.payment_status || "")
                      .toLowerCase()
                      .replace(/[\s-]+/g, "_") === "paid" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={statusUpdating}
                        onClick={() => updatePaymentStatus(c.id, "paid")}
                      >
                        Update payment details
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : String(c.payment_status || "")
                .toLowerCase()
                .replace(/[\s-]+/g, "_") === "paid" ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
                Paid {c.pay_date || "—"}
                {c.check_number ? ` · Check #${c.check_number}` : ""}
              </div>
            ) : null}
            <div className="space-y-2">
              {(c.legs || []).map((leg) => (
                <div
                  key={leg.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    leg.excluded ? "bg-slate-50 border-slate-200 text-slate-500" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span>
                      {leg.from_label} → {leg.to_label}
                      {leg.is_home_leg ? " · home commute" : ""}
                      {leg.excluded ? " · excluded" : ""}
                    </span>
                    <span className="font-medium text-right">
                      {Number(leg.miles).toFixed(1)} mi
                      {leg.is_home_leg
                        ? ` (−${HOME_COMMUTE_DEDUCTIBLE_MILES} unpaid)`
                        : ""}
                      {" · "}
                      {money(leg.cost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ─── CAPTURE ─── */
  return (
    <div className="space-y-6 max-w-4xl">
      <Button type="button" variant="ghost" size="sm" onClick={() => setMode("list")}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to claims
      </Button>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-slate-800">New mileage claim</CardTitle>
          <p className="text-sm text-slate-500">
            Client→client: full driving miles. Home↔client: first {HOME_COMMUTE_DEDUCTIBLE_MILES}{" "}
            miles unpaid; remainder reimbursable. Indirect sessions and sessions marked
            Exclude = Yes are omitted.
            {!canManageAll ? " You can only submit for yourself." : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Rate per mile</Label>
              <Input value={`$${Number(rate).toFixed(2)}`} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mileage-session-date">Session date</Label>
              <Input
                id="mileage-session-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setDayLoaded(false);
                  setStops([]);
                  setLegs([]);
                  setExistingClaim(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mileage-provider">Provider</Label>
              <Select
                value={providerId || undefined}
                onValueChange={(v) => {
                  setProviderId(v);
                  const p = providers.find((x) => String(x.provider_id) === String(v));
                  setProviderName(p?.provider_name || "");
                  setDayLoaded(false);
                  setStops([]);
                  setLegs([]);
                  setExistingClaim(null);
                }}
                disabled={!canManageAll && providers.length <= 1}
              >
                <SelectTrigger>
                  <SelectValue placeholder={providers.length ? "Select provider" : "No providers"} />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.provider_id} value={String(p.provider_id)}>
                      {p.provider_name}
                      {p.has_sessions ? " · sessions today" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {date && sessionProviderCount === 0 ? (
                <p className="text-xs text-amber-700">
                  No sessions on {date}. Pick another date (or a provider who worked that day) to calculate mileage.
                </p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={loadDay}
            disabled={loadingDay || !providerId}
          >
            <RotateCw className={`h-4 w-4 mr-1.5 ${loadingDay ? "animate-spin" : ""}`} />
            Load sessions for day
          </Button>
        </CardContent>
      </Card>

      {dayLoaded && (
        <>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-slate-800">Sessions that day</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stops.map((s) => (
                <div
                  key={s.stop_key}
                  className={`flex gap-3 items-start rounded-lg border px-3 py-2.5 ${
                    s.is_home ? "border-dashed border-slate-300 bg-slate-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div
                    className={`h-8 w-8 shrink-0 rounded-md grid place-items-center text-xs font-bold ${
                      s.is_home ? "bg-slate-200 text-slate-600" : "bg-teal-50 text-teal-800"
                    }`}
                  >
                    {s.is_home ? "H" : s.order}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 text-sm">
                      {s.label}
                      {s.is_home ? <span className="text-slate-500 font-normal"> · not reimbursable</span> : null}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 break-words">{s.address || "No address"}</p>
                  </div>
                  <div className="text-xs font-semibold text-teal-700 whitespace-nowrap">
                    {formatMileageTimeRange(s.start_utc, s.end_utc) || s.time_label || "—"}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <CardTitle className="text-lg text-slate-800">Travel legs</CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const base = buildAutoLegs(stops);
                      try {
                        const enriched = await enrichMileageWithGoogle(stops, base);
                        setStops(enriched.stops);
                        setLegs(enriched.legs);
                        toast.success("Legs refreshed with driving miles");
                      } catch {
                        setLegs(base);
                        toast.error("Could not refresh miles");
                      }
                    }}
                  >
                    Auto-fill
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addLeg}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add leg
                  </Button>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Miles are <span className="font-medium text-slate-700">road / driveway distance</span> when
                available. Home↔client: first {HOME_COMMUTE_DEDUCTIBLE_MILES} mi unpaid.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {enrichedLegs.map((leg, idx) => (
                <div
                  key={`${leg.from_stop_key}-${leg.to_stop_key}-${idx}`}
                  className={`grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-2 items-end rounded-lg border p-3 ${
                    leg.excluded ? "bg-slate-50 border-slate-200 opacity-80" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Select
                      value={leg.from_stop_key}
                      onValueChange={(v) =>
                        updateLeg(idx, {
                          from_stop_key: v,
                          is_home_leg: isHomeKey(v) || isHomeKey(leg.to_stop_key),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stops.map((s) => (
                          <SelectItem key={s.stop_key} value={s.stop_key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="hidden md:block text-teal-700 font-bold pb-2 text-center">→</div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Select
                      value={leg.to_stop_key}
                      onValueChange={(v) =>
                        updateLeg(idx, {
                          to_stop_key: v,
                          is_home_leg: isHomeKey(leg.from_stop_key) || isHomeKey(v),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stops.map((s) => (
                          <SelectItem key={s.stop_key} value={s.stop_key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-right space-y-1 min-w-[7rem]">
                    <Label className="text-xs">
                      Miles
                      {leg.distance_mode === "driving"
                        ? " (driving)"
                        : leg.distance_mode === "straight"
                          ? " (straight-line)"
                          : leg.distance_mode === "override"
                            ? " (edited)"
                            : leg.distance_mode === "invalid" || leg.distance_mode === "unknown"
                              ? " (needs address)"
                              : ""}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      className="h-8 text-right"
                      value={
                        leg.miles_override != null && leg.miles_override !== ""
                          ? leg.miles_override
                          : Number(leg.miles).toFixed(1)
                      }
                      onChange={(e) => updateLeg(idx, { miles_override: e.target.value })}
                      disabled={leg.excluded}
                    />
                    <p className={`text-lg font-semibold ${leg.billable_miles > 0 ? "text-teal-800" : "text-slate-400"}`}>
                      {money(leg.cost)}
                    </p>
                    {leg.is_home_leg && !leg.excluded ? (
                      <p className="text-[11px] text-slate-500">
                        Billable {Number(leg.billable_miles).toFixed(1)} mi
                        {` (first ${HOME_COMMUTE_DEDUCTIBLE_MILES} unpaid)`}
                      </p>
                    ) : null}
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => updateLeg(idx, { excluded: !leg.excluded })}
                      >
                        {leg.excluded ? "Include" : "Exclude"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-rose-600"
                        onClick={() => removeLeg(idx)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {clientStops.length < 2 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Need at least two client visits on this day to create a reimbursable leg.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-slate-800">Submit claim</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Miles</p>
                  <p className="text-2xl font-bold text-teal-800 mt-1">{totals.miles.toFixed(1)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Legs</p>
                  <p className="text-2xl font-bold text-teal-800 mt-1">{totals.count}</p>
                </div>
                <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Cost</p>
                  <p className="text-2xl font-bold text-teal-800 mt-1">{money(totals.cost)}</p>
                </div>
              </div>
              {existingClaim ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Claim #{existingClaim.id} already exists for this day ({money(existingClaim.total_cost)}).
                </div>
              ) : null}
              <Button
                type="button"
                className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={saveClaim}
                disabled={saving || !!existingClaim || totals.count === 0}
              >
                {saving ? "Submitting…" : "Submit mileage claim"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
