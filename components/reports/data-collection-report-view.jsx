"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { fetchClients } from "@/app/store/clientSlice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RotateCw } from "lucide-react";
import toast from "react-hot-toast";
import { localYmd } from "@/lib/session-notes-date";

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localYmd(d);
}

function clientLabel(c) {
  return (
    `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
    c.name ||
    c.client_name ||
    String(c.client_id || c.id)
  );
}

export default function DataCollectionReportView() {
  const dispatch = useAppDispatch();
  const clients = useAppSelector((state) => state.clients?.items || []);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [clientId, setClientId] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => daysAgoIso(30));
  const [dateTo, setDateTo] = useState(() => localYmd());
  const [type, setType] = useState("all");

  useEffect(() => {
    dispatch(fetchClients());
  }, [dispatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        type,
      });
      if (clientId && clientId !== "all") params.set("client_id", clientId);
      const res = await mahaverseFetch(
        `/reports-data-collection.php?${params.toString()}`,
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed to load");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setSummary(data.summary || {});
    } catch (err) {
      toast.error(err?.message || "Failed to load data collection report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, dateFrom, dateTo, type]);

  useEffect(() => {
    load();
  }, [load]);

  const clientOptions = useMemo(() => {
    return [...clients]
      .map((c) => ({
        id: String(c.client_id || c.id),
        name: clientLabel(c),
      }))
      .filter((c) => c.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="trials">Skill trials</SelectItem>
                  <SelectItem value="behaviors">Behaviors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {summary.total ?? 0} rows
              {summary.trials != null ? ` · ${summary.trials} trials` : ""}
              {summary.behaviors != null
                ? ` · ${summary.behaviors} behaviors`
                : ""}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={load}
              disabled={loading}
            >
              <RotateCw
                className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Type</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Notes / value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                      No data collection records found for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={`${row.data_type}-${row.id}`}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.data_type === "trial"
                              ? "text-teal-700 border-teal-300"
                              : "text-orange-700 border-orange-300"
                          }
                        >
                          {row.data_type === "trial" ? "Trial" : "Behavior"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.client_name}
                      </TableCell>
                      <TableCell>{row.session_date}</TableCell>
                      <TableCell>
                        {row.data_type === "trial"
                          ? row.target_name || row.target_id
                          : row.behavior_name || row.behavior_id}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {row.data_type === "trial"
                          ? `Trial #${row.trial_number} · ${row.outcome || "—"}`
                          : row.recording_type || "—"}
                      </TableCell>
                      <TableCell className="max-w-md text-sm text-slate-600 truncate">
                        {row.data_type === "trial"
                          ? row.notes || "—"
                          : row.value_preview || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
