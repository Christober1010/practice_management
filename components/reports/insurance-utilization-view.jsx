"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchInsuranceUtilization } from "@/app/utils/fetchInsuranceUtilization";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";

const EXPIRY_WINDOWS = [
  { value: "all", label: "All expiry windows" },
  { value: "30", label: "Expiring in 30 days" },
  { value: "60", label: "Expiring in 60 days" },
  { value: "90", label: "Expiring in 90 days" },
];

function asUnits(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatDate(isoDate) {
  if (!isoDate) return "No expiry";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function riskBadge(row) {
  if (row.expiry_status === "expired") {
    return <Badge className="bg-red-100 text-red-800 border-transparent">Expired</Badge>;
  }
  if (row.projected_overutilization) {
    return <Badge className="bg-amber-100 text-amber-900 border-transparent">Overutilized</Badge>;
  }
  if (row.projected_underutilization) {
    return <Badge className="bg-orange-100 text-orange-900 border-transparent">High risk</Badge>;
  }
  if (row.expiring_soon) {
    return <Badge className="bg-yellow-100 text-yellow-900 border-transparent">Expiring soon</Badge>;
  }
  if (row.expiry_status === "no_expiry") {
    return <Badge className="bg-slate-100 text-slate-700 border-transparent">No expiry</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-800 border-transparent">On track</Badge>;
}

function UsageRing({ percent, ringColor, trackColor, textColor }) {
  const safePercent = clampPercent(percent);
  const style = {
    background: `conic-gradient(${ringColor} ${safePercent}%, ${trackColor} 0%)`,
  };
  return (
    <div className="relative h-14 w-14 rounded-full" style={style}>
      <div className="absolute inset-[6px] rounded-full bg-white flex items-center justify-center">
        <span className={`text-[11px] font-semibold ${textColor}`}>{Math.round(safePercent)}%</span>
      </div>
    </div>
  );
}

function StatCard({ title, value, hint, percent, ringColor, trackColor, textColor, cardTint }) {
  return (
    <Card className={`border shadow-sm ${cardTint}`}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-600">{title}</p>
            <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
            {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
          </div>
          <UsageRing
            percent={percent}
            ringColor={ringColor}
            trackColor={trackColor}
            textColor={textColor}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function InsuranceUtilizationView() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [clientId, setClientId] = useState("all");
  const [insuranceId, setInsuranceId] = useState("all");
  const [expiryWindow, setExpiryWindow] = useState("all");
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInsuranceUtilization({
        client_id: clientId === "all" ? "" : clientId,
        insurance_id: insuranceId === "all" ? "" : insuranceId,
        expiring_within_days: expiryWindow === "all" ? "" : expiryWindow,
        high_risk_only: highRiskOnly ? "1" : "0",
      });
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setSummary(data.summary || {});
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Unable to load insurance utilization");
      setRows([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [clientId, insuranceId, expiryWindow, highRiskOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const clientOptions = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = String(row.client_id || "").trim();
      if (!key || map.has(key)) continue;
      map.set(key, row.client_name || key);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const insuranceOptions = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = String(row.insurance_id || "").trim();
      if (!key || map.has(key)) continue;
      map.set(key, row.insurance_label || key);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      const hay = [
        row.client_name,
        row.insurance_label,
        row.authorization_number,
        row.billing_codes,
        row.auth_status,
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => hay.includes(token));
    });
  }, [rows, search]);

  const approvedUnits = Number(summary.total_approved_units || 0);
  const consumedUnits = Number(summary.total_consumed_units || 0);
  const remainingUnits = Number(summary.total_remaining_units || 0);
  const totalAuthCount = Number(summary.total_authorizations || 0);
  const highRiskCount = Number(summary.high_risk_authorizations || 0);
  const expiringSoonCount = Number(summary.expiring_soon_authorizations || 0);

  const consumedPercent = approvedUnits > 0 ? (consumedUnits / approvedUnits) * 100 : 0;
  const remainingPercent = approvedUnits > 0 ? (remainingUnits / approvedUnits) * 100 : 0;
  const highRiskPercent = totalAuthCount > 0 ? (highRiskCount / totalAuthCount) * 100 : 0;
  const expiringSoonPercent = totalAuthCount > 0 ? (expiringSoonCount / totalAuthCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow">
        <CardHeader>
          <CardTitle className="text-lg">Insurance utilization runway</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clientOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Insurance</Label>
              <Select value={insuranceId} onValueChange={setInsuranceId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All insurance</SelectItem>
                  {insuranceOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expiry window</Label>
              <Select value={expiryWindow} onValueChange={setExpiryWindow}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_WINDOWS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Client, insurance, auth, code"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  checked={highRiskOnly}
                  onCheckedChange={(checked) => setHighRiskOnly(Boolean(checked))}
                />
                High risk only
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Approved units"
          value={asUnits(approvedUnits)}
          hint={`${totalAuthCount} authorization(s)`}
          percent={100}
          ringColor="#0d9488"
          trackColor="#ccfbf1"
          textColor="text-teal-700"
          cardTint="bg-teal-50/40 border-teal-100"
        />
        <StatCard
          title="Consumed units"
          value={asUnits(consumedUnits)}
          hint={`${consumedPercent.toFixed(1)}% consumed`}
          percent={consumedPercent}
          ringColor="#1d4ed8"
          trackColor="#dbeafe"
          textColor="text-blue-700"
          cardTint="bg-blue-50/50 border-blue-100"
        />
        <StatCard
          title="Remaining units"
          value={asUnits(remainingUnits)}
          hint={`${remainingPercent.toFixed(1)}% remaining`}
          percent={remainingPercent}
          ringColor="#15803d"
          trackColor="#dcfce7"
          textColor="text-green-700"
          cardTint="bg-green-50/50 border-green-100"
        />
        <StatCard
          title="High-risk authorizations"
          value={String(highRiskCount)}
          hint={`${expiringSoonCount} expiring soon`}
          percent={Math.max(highRiskPercent, expiringSoonPercent)}
          ringColor="#dc2626"
          trackColor="#fee2e2"
          textColor="text-red-700"
          cardTint="bg-red-50/45 border-red-100"
        />
      </div>

      <Card className="border-0 shadow">
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading utilization metrics…</p>
          ) : (
            <table className="w-full min-w-[78rem] text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-3 text-left align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Insurance
                    </th>
                    <th className="px-4 py-3 text-left align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Authorization
                    </th>
                    <th className="px-4 py-3 text-left align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Service code(s)
                    </th>
                    <th className="px-4 py-3 text-left align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Expiry
                    </th>
                    <th className="px-4 py-3 text-right align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Approved
                    </th>
                    <th className="px-4 py-3 text-right align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Consumed
                    </th>
                    <th className="px-4 py-3 text-right align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Remaining
                    </th>
                    <th className="px-4 py-3 text-right align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Consumed %
                    </th>
                    <th className="px-4 py-3 text-right align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Weekly target units
                    </th>
                    <th className="px-4 py-3 text-left align-middle font-medium text-muted-foreground bg-slate-100/95 backdrop-blur">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr className="border-b">
                      <td colSpan={11} className="px-4 py-8 text-center text-sm text-slate-500">
                        No authorization rows found for this filter combination.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.auth_row_key} className="border-b transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3 align-middle font-medium">
                          {row.client_name || "Unknown client"}
                        </td>
                        <td className="px-4 py-3 align-middle">{row.insurance_label || "Unknown insurance"}</td>
                        <td className="px-4 py-3 align-middle">{row.authorization_number || "—"}</td>
                        <td className="px-4 py-3 align-middle">{row.billing_codes || "—"}</td>
                        <td className="px-4 py-3 align-middle">
                          <div className="space-y-0.5">
                            <p>{formatDate(row.expiry_date)}</p>
                            {row.days_to_expiry != null && (
                              <p className="text-xs text-slate-500">{row.days_to_expiry} day(s) left</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-right tabular-nums">
                          {asUnits(row.approved_units)}
                        </td>
                        <td className="px-4 py-3 align-middle text-right tabular-nums">
                          {asUnits(row.consumed_units)}
                        </td>
                        <td className="px-4 py-3 align-middle text-right tabular-nums">
                          {asUnits(row.remaining_units)}
                        </td>
                        <td className="px-4 py-3 align-middle text-right tabular-nums">
                          {Number(row.consumed_percent || 0).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 align-middle text-right tabular-nums">
                          {asUnits(row.weekly_units_required)}
                        </td>
                        <td className="px-4 py-3 align-middle">{riskBadge(row)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
