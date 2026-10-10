"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { getMahaverseAuthHeaders } from "@/lib/api-auth";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Calendar,
  Eye,
  Pencil,
  RotateCw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { localYmd } from "@/lib/session-notes-date";
import { formatReportDos } from "@/lib/report-dos-format";
import { sessionIsRenderedOrReadyToBill } from "@/lib/scheduling-session-status";
import SessionNotesModal from "@/components/clients/session-notes/SessionNotesModal";
import NewSessionFormModal from "@/components/scheduling/new-session-form-modal";
import ViewSessionModal from "@/components/scheduling/ViewSessionModal";

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

function normalizeSessionStatus(session) {
  const statusMap = {
    upcoming: "Scheduled",
    "in-progress": "Scheduled",
    confirmed: "Scheduled",
    completed: "Rendered",
    cancelled: "Cancelled",
  };
  const oldStatus = session.status || session.STATUS || "Scheduled";
  return statusMap[String(oldStatus).toLowerCase()] || oldStatus;
}

function mapApiSessionToForm(row, userTimezone = "UTC") {
  return {
    sessionId: row.session_id,
    clientId: row.client_id,
    clientName: row.clientName || row.client_name || "",
    providerId: row.provider_id,
    provider_name: row.provider_name,
    providerName: row.provider_name,
    supervisingProviderId: row.supervising_provider_id,
    supervising_provider_name: row.supervising_provider_name,
    supervisingProviderName: row.supervising_provider_name,
    startDateTime: row.start_utc,
    endDateTime: row.end_utc,
    startTZ: row.start_tz || row.startTZ || userTimezone || "UTC",
    endTZ: row.end_tz || row.endTZ || userTimezone || "UTC",
    authId:
      row.auth_id !== null && row.auth_id !== undefined
        ? String(row.auth_id)
        : "",
    authCode: row.auth_code || "",
    recurring: row.recurring,
    placeOfService: row.place_of_service,
    locationAddress: row.location_address || "",
    quickNote: row.quick_note || "",
    excludeSession:
      row.exclude_session === "Yes" || row.excludeSession === "Yes"
        ? "Yes"
        : "No",
    serviceType:
      String(
        row.service_type ||
          row.serviceType ||
          row.direct_or_indirect_service ||
          ""
      ).toLowerCase() === "direct"
        ? "Direct"
        : "Indirect",
    status: normalizeSessionStatus(row),
    renderedHours:
      row.rendered_hours != null ? Number(row.rendered_hours) : 0,
    scheduledHours:
      row.scheduled_hours != null ? Number(row.scheduled_hours) : null,
    claimId:
      row.claim_id != null && row.claim_id !== ""
        ? String(row.claim_id)
        : "",
    claimStatus: row.claim_status != null ? String(row.claim_status) : "",
  };
}

function rowBucket(row) {
  if (row?.tab === "Rendered" || row?.tab === "Scheduled") return row.tab;
  return sessionIsRenderedOrReadyToBill(row) ? "Rendered" : "Scheduled";
}

export default function SessionNotesReportView({
  initialClientId = "",
  userRole = null,
}) {
  const dispatch = useAppDispatch();
  const clients = useAppSelector((state) => state.clients?.items || []);
  const isAdminUser =
    String(userRole?.role || "").toLowerCase() === "admin";
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [clientId, setClientId] = useState(initialClientId || "all");
  const [dateFrom, setDateFrom] = useState(() => daysAgoIso(30));
  const [dateTo, setDateTo] = useState(() => localYmd());
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("scheduled");

  const [notesModal, setNotesModal] = useState({
    open: false,
    readOnly: true,
    client: null,
    sessionDate: null,
    sessionId: null,
  });
  const [viewSession, setViewSession] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentLoading, setAppointmentLoading] = useState(false);

  const userTimezone = useMemo(
    () =>
      (typeof Intl !== "undefined" &&
        Intl.DateTimeFormat().resolvedOptions().timeZone) ||
      "UTC",
    []
  );

  useEffect(() => {
    dispatch(fetchClients());
  }, [dispatch]);

  useEffect(() => {
    try {
      const pending = localStorage.getItem("pendingReportClientFilter");
      if (pending) {
        const info = JSON.parse(pending);
        const id = info.client_id || info.id;
        if (id) setClientId(String(id));
        localStorage.removeItem("pendingReportClientFilter");
      }
    } catch {
      localStorage.removeItem("pendingReportClientFilter");
    }
  }, []);

  useEffect(() => {
    if (initialClientId) setClientId(String(initialClientId));
  }, [initialClientId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        tz: userTimezone,
      });
      if (clientId && clientId !== "all") params.set("client_id", clientId);
      if (search.trim()) params.set("search", search.trim());
      const res = await mahaverseFetch(
        `/reports-session-notes.php?${params.toString()}`
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed to load");
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setSummary(data.summary || {});
    } catch (err) {
      toast.error(err?.message || "Failed to load session notes report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, dateFrom, dateTo, search, userTimezone]);

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

  const scheduledRows = useMemo(
    () => rows.filter((r) => rowBucket(r) === "Scheduled"),
    [rows]
  );
  const renderedRows = useMemo(
    () => rows.filter((r) => rowBucket(r) === "Rendered"),
    [rows]
  );
  const visibleRows =
    activeTab === "rendered" ? renderedRows : scheduledRows;

  const openNotes = (row, readOnly) => {
    const nameParts = String(row.client_name || "").trim().split(/\s+/);
    setNotesModal({
      open: true,
      readOnly,
      client: {
        id: row.client_id,
        client_id: row.client_id,
        first_name: nameParts[0] || "",
        last_name: nameParts.slice(1).join(" ") || "",
      },
      sessionDate: row.appointment_date || null,
      sessionId: row.session_id ?? null,
    });
  };

  const fetchSessionForAppointment = async (row) => {
    const sid = row?.session_id;
    if (sid == null || String(sid).trim() === "") {
      toast.error("No linked appointment for this note");
      return null;
    }
    setAppointmentLoading(true);
    try {
      const res = await mahaverseFetch(
        `/add-session.php?id=${encodeURIComponent(String(sid))}`,
        { headers: getMahaverseAuthHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error || !data?.session_id) {
        throw new Error(data?.error || "Session not found");
      }
      return mapApiSessionToForm(data, userTimezone);
    } catch (err) {
      toast.error(err?.message || "Failed to load appointment");
      return null;
    } finally {
      setAppointmentLoading(false);
    }
  };

  const openViewAppointment = async (row) => {
    const mapped = await fetchSessionForAppointment(row);
    if (!mapped) return;
    setViewSession(mapped);
  };

  const openEditAppointment = async (row) => {
    const mapped = await fetchSessionForAppointment(row);
    if (!mapped) return;
    setEditingSession(mapped);
    setAppointmentOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
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
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Client or note text…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {summary.total ?? rows.length} note
              {(summary.total ?? rows.length) === 1 ? "" : "s"} ·{" "}
              {scheduledRows.length} scheduled · {renderedRows.length} rendered
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="scheduled">
            Scheduled ({scheduledRows.length})
          </TabsTrigger>
          <TabsTrigger value="rendered">
            Rendered ({renderedRows.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>DOS</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Billing Code</TableHead>
                  <TableHead>Session ID</TableHead>
                  {isAdminUser ? (
                    <TableHead>Exclude Session</TableHead>
                  ) : null}
                  <TableHead className="text-right w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdminUser ? 7 : 6}
                      className="text-center py-10 text-slate-500"
                    >
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdminUser ? 7 : 6}
                      className="text-center py-10 text-slate-500"
                    >
                      No {activeTab === "rendered" ? "rendered" : "scheduled"}{" "}
                      session notes for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => {
                    const hasSession =
                      row.session_id != null &&
                      String(row.session_id).trim() !== "";
                    const dosLabel =
                      formatReportDos(
                        row.dos || row.appointment_date,
                        row.start_utc || row.appointment_start,
                        userTimezone
                      ) ||
                      row.dos ||
                      row.appointment_date ||
                      "—";
                    const excludeSession =
                      row.exclude_session === "Yes" ||
                      row.excludeSession === "Yes"
                        ? "Yes"
                        : "No";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {dosLabel}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.client_name}
                        </TableCell>
                        <TableCell>
                          {row.staff || row.provider_name || "—"}
                        </TableCell>
                        <TableCell>
                          {row.billing_code || row.auth_code || "—"}
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm">
                          {row.session_id || "—"}
                        </TableCell>
                        {isAdminUser ? (
                          <TableCell
                            className={
                              excludeSession === "Yes"
                                ? "font-medium text-amber-700"
                                : "text-slate-600"
                            }
                          >
                            {excludeSession}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-right">
                          <div className="inline-flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              title="View notes"
                              onClick={() => openNotes(row, true)}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View notes</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              title="Edit notes"
                              onClick={() => openNotes(row, false)}
                            >
                              <BookOpen className="h-4 w-4" />
                              <span className="sr-only">Edit notes</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              title="View appointment"
                              disabled={!hasSession || appointmentLoading}
                              onClick={() => openViewAppointment(row)}
                            >
                              <Calendar className="h-4 w-4" />
                              <span className="sr-only">View appointment</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              title="Edit appointment"
                              disabled={!hasSession || appointmentLoading}
                              onClick={() => openEditAppointment(row)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit appointment</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SessionNotesModal
        isOpen={notesModal.open}
        onClose={() =>
          setNotesModal((prev) => ({ ...prev, open: false, client: null }))
        }
        client={notesModal.client}
        linkedSessionDate={notesModal.sessionDate}
        linkedSessionId={notesModal.sessionId}
        initialTab="session-notes"
        readOnly={notesModal.readOnly}
        onSessionBillingFinalized={() => load()}
      />

      <ViewSessionModal
        isOpen={!!viewSession}
        onClose={() => setViewSession(null)}
        session={viewSession}
        canEdit={!!viewSession}
        canDelete={false}
        onEdit={(sess) => {
          setViewSession(null);
          setEditingSession(sess);
          setAppointmentOpen(true);
        }}
        onDelete={() => {}}
      />

      <NewSessionFormModal
        isOpen={appointmentOpen}
        onClose={() => {
          setAppointmentOpen(false);
          setEditingSession(null);
        }}
        onSave={() => {
          setAppointmentOpen(false);
          setEditingSession(null);
          load();
        }}
        selectedDate={
          editingSession?.startDateTime
            ? new Date(
                String(editingSession.startDateTime).includes("T")
                  ? editingSession.startDateTime.endsWith("Z")
                    ? editingSession.startDateTime
                    : `${editingSession.startDateTime}Z`
                  : `${String(editingSession.startDateTime).replace(" ", "T")}Z`
              )
            : new Date()
        }
        editingSession={editingSession}
        existingSessions={[]}
        canEditExcludeSession={isAdminUser}
        canCreatePastDates={true}
      />
    </div>
  );
}
