"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
} from "lucide-react";
import NewSessionFormModal from "./new-session-form-modal";

// =====================
// Date helpers
// =====================
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}
function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function isBeforeDay(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return da.getTime() < db.getTime();
}
function formatDateLabel(d) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function formatTime12hFromLocal(datetimeLocal) {
  if (!datetimeLocal) return "";
  const d = new Date(datetimeLocal);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hr12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = String(minutes).padStart(2, "0");
  return `${hr12}:${mm} ${ampm}`;
}
function isLocalStringOnDate(datetimeLocal, dateObj) {
  if (!datetimeLocal) return false;
  const d = new Date(datetimeLocal);
  return sameDay(d, dateObj);
}
function toMinutes12h(t) {
  if (!t || t === "—") return 24 * 60;
  const [hmm, ampm] = t.split(" ");
  const [h, m] = hmm.split(":").map(Number);
  let hour = h % 12;
  if ((ampm || "").toUpperCase() === "PM") hour += 12;
  return hour * 60 + (m || 0);
}
function initials(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
// Build a datetime-local string for a given date and HH:MM (kept if you need it elsewhere)
function buildLocalDateTime(dateObj, hhmm = "09:00") {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T${hhmm}`;
}
// Normalize MySQL "YYYY-MM-DD HH:MM:SS" to ISO for Date()
function mysqlUtcToISO(localStr) {
  if (!localStr) return "";
  // If DB truly stores UTC, append Z; if it's local time, remove the Z.
  return localStr.replace(" ", "T") + "Z";
}

export default function SchedulingView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [clients, setClients] = useState([]);
  const [viewingSession, setViewingSession] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const today = new Date();

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(`${baseUrl}/get-clients.php`);
        const data = await response.json();
        if (data.clients && Array.isArray(data.clients)) {
          setClients(data.clients);
        }
      } catch (error) {
        console.error("Failed to fetch clients:", error);
      }
    };
    fetchClients();
  }, [baseUrl]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDay = monthStart.getDay();
  const totalDays = monthEnd.getDate();

  const gridDays = useMemo(() => {
    const arr = [];
    for (let i = 0; i < startDay; i++) arr.push(null);
    for (let d = 1; d <= totalDays; d++) {
      arr.push(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d)
      );
    }
    const size = arr.length <= 35 ? 35 : 42;
    while (arr.length < size) arr.push(null);
    return arr;
  }, [currentMonth, startDay, totalDays]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const refreshMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${baseUrl}/add-session.php`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || `Failed to fetch: ${resp.status}`);
      }
      const data = await resp.json();

      const rows = Array.isArray(data) ? data : [data];

      const mapped = rows.map((row) => {
        const startUtc = row.start_utc || row.tech_start_utc_old;
        const endUtc = row.end_utc || row.tech_end_utc_old;
        const startTz = row.start_tz || row.tech_tz_old;
        const endTz = row.end_tz || row.tech_tz_old;
        const authCode = row.auth_code || row.tech_auth_code_old;
        const providerId = row.provider_id || row.therapist_id_old;

        // Convert MySQL datetime to ISO format for JavaScript Date
        const convertMySQLToISO = (mysqlDateTime) => {
          if (!mysqlDateTime || mysqlDateTime === "0000-00-00 00:00:00")
            return "";
          return mysqlDateTime.replace(" ", "T") + "Z";
        };

        return {
          sessionId: row.session_id,
          clientId: row.client_id,
          clientName: row.client_name || "",
          providerId: providerId,
          supervisingProviderId: row.supervising_provider_id,
          startDateTime: convertMySQLToISO(startUtc),
          endDateTime: convertMySQLToISO(endUtc),
          startTZ: startTz || "",
          endTZ: endTz || "",
          authCode: authCode || "",
          recurring: row.recurring || "No",
          placeOfService: row.place_of_service || "Clinic",
          locationAddress: row.location_address || "",
          quickNote: row.quick_note || "",
          status: row.STATUS || row.status || "upcoming",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      // Filter to current visible month
      const mStart = startOfMonth(currentMonth);
      const mEnd = endOfMonth(currentMonth);
      const inMonth = (dtStr) => {
        if (!dtStr) return false;
        const d = new Date(dtStr);
        const endOfDay = new Date(
          mEnd.getFullYear(),
          mEnd.getMonth(),
          mEnd.getDate(),
          23,
          59,
          59,
          999
        );
        return (
          d >= new Date(mStart.getFullYear(), mStart.getMonth(), 1) &&
          d <= endOfDay
        );
      };

      const monthSessions = mapped.filter((s) => inMonth(s.startDateTime));

      setSessions(monthSessions);
    } catch (e) {
      setError(e.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [currentMonth, baseUrl]);

  useEffect(() => {
    refreshMonth();
  }, [refreshMonth]);

  const todayCards = useMemo(() => {
    const items = [];
    sessions.forEach((session) => {
      if (
        session?.startDateTime &&
        isLocalStringOnDate(session.startDateTime, today)
      ) {
        items.push({
          sessionId: session.sessionId,
          time: formatTime12hFromLocal(session.startDateTime),
          client: session.clientName || "Client",
          providerId: session.providerId || "Provider",
          type: "Session",
          status: session.status || "upcoming",
          session: session, // Include full session data for editing
        });
      }
    });
    return items.sort((a, b) => toMinutes12h(a.time) - toMinutes12h(b.time));
  }, [sessions, today]);

  const handleDayClick = (dateObj) => {
    if (!dateObj) return;
    setSelectedDate(dateObj);
  };

  const handleOpenAddSessionForDate = (dateObj) => {
    if (!dateObj) return;
    setSelectedDate(dateObj);
    setEditingSession(null); // Clear editing session for new session
    setIsNewSessionModalOpen(true);
  };

  const handleEditSession = (session) => {
    const clientDetails = clients.find((c) => c.client_id === session.clientId);

    const convertISOToDatetimeLocal = (isoString) => {
      if (!isoString) return "";
      return isoString.replace("Z", "").slice(0, 16);
    };

    setEditingSession({
      sessionId: session.sessionId,
      clientId: session.clientId,
      clientName: clientDetails
        ? [
            clientDetails.first_name,
            clientDetails.middle_name,
            clientDetails.last_name,
          ]
            .filter(Boolean)
            .join(" ")
        : session.clientName || "",
      providerId: session.providerId,
      supervisingProviderId: session.supervisingProviderId,
      startDateTime: convertISOToDatetimeLocal(session.startDateTime),
      endDateTime: convertISOToDatetimeLocal(session.endDateTime),
      startTZ: session.startTZ,
      endTZ: session.endTZ,
      authCode: session.authCode,
      recurring: session.recurring,
      placeOfService: session.placeOfService,
      locationAddress: session.locationAddress,
      quickNote: session.quickNote,
    });
    setViewingSession(null);
    setIsNewSessionModalOpen(true);
  };

  const handleViewSession = (session) => {
    const clientDetails = clients.find((c) => c.client_id === session.clientId);

    const sessionWithClientName = {
      ...session,
      clientName: clientDetails
        ? [
            clientDetails.first_name,
            clientDetails.middle_name,
            clientDetails.last_name,
          ]
            .filter(Boolean)
            .join(" ")
        : session.clientName || "Unknown Client",
    };

    setViewingSession(sessionWithClientName);
  };

  const getCellBadges = (dateObj) => {
    if (!dateObj) return [];
    const items = [];
    sessions.forEach((session) => {
      if (
        session?.startDateTime &&
        isLocalStringOnDate(session.startDateTime, dateObj)
      ) {
        items.push({
          color: "bg-teal-100 text-teal-800",
          label: `${initials(session.clientName)} ${formatTime12hFromLocal(
            session.startDateTime
          ).replace(":00 ", "")}`,
        });
      }
    });
    return items.slice(0, 2);
  };

  const selectedDateSessions = useMemo(() => {
    if (!selectedDate) return [];
    const items = [];
    sessions.forEach((session) => {
      if (
        session?.startDateTime &&
        isLocalStringOnDate(session.startDateTime, selectedDate)
      ) {
        items.push({
          sessionId: session.sessionId,
          time: formatTime12hFromLocal(session.startDateTime),
          client: session.clientName || "Client",
          providerId: session.providerId || "Provider",
          authCode: session.authCode || "",
          status: session.status || "upcoming",
          session: session, // Include full session data for editing
        });
      }
    });
    return items.sort((a, b) => toMinutes12h(a.time) - toMinutes12h(b.time));
  }, [sessions, selectedDate]);

  const handleAddNewSession = async () => {
    setIsNewSessionModalOpen(false);
    setEditingSession(null);
    await refreshMonth();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Scheduling</h2>
          <p className="text-slate-600 mt-1">
            Manage appointments and therapy sessions
          </p>
        </div>
      </div>

      {/* Calendar + Day details */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar Card (2 columns) */}
        <Card className="shadow-lg border-0 xl:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between lg:flex-row flex-col gap-4">
              <CardTitle className="text-slate-800 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-teal-600" />
                Calendar View
              </CardTitle>
              <div className="flex items-center lg:space-x-4 space-x-2">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth((d) => addMonths(d, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium text-slate-800 min-w-[160px] text-center">
                    {monthNames[currentMonth.getMonth()]}{" "}
                    {currentMonth.getFullYear()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="lg:p-4 p-2">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center font-semibold text-slate-600 text-xs md:text-base py-2 bg-slate-50 rounded-lg"
                >
                  {day.substring(0, 1)}
                  <span className="hidden md:inline">{day.substring(1)}</span>
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {gridDays.map((dateObj, idx) => {
                const isToday = dateObj && sameDay(dateObj, new Date());
                const isSelected =
                  dateObj && selectedDate && sameDay(dateObj, selectedDate);
                const isPast = dateObj ? isBeforeDay(dateObj, today) : false;
                const badges = getCellBadges(dateObj);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!dateObj) return;
                      handleDayClick(dateObj);
                    }}
                    className={`group relative border rounded-lg p-2 transition-colors min-h-[80px] md:min-h-[120px] lg:aspect-square
                      ${
                        dateObj
                          ? "border-slate-200"
                          : "border-transparent bg-transparent cursor-default"
                      }
                      ${
                        dateObj
                          ? "hover:bg-slate-50 cursor-pointer"
                          : "border-transparent bg-transparent cursor-default"
                      }
                      ${isPast ? "bg-slate-50/40" : ""}
                      ${isSelected ? "ring-2 ring-teal-500" : ""}
                      ${isToday ? "bg-teal-50" : ""}`}
                  >
                    <div
                      className={`text-base md:text-sm font-medium ${
                        isPast ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      {dateObj ? dateObj.getDate() : ""}
                    </div>

                    {/* badges */}
                    <div className="space-y-1 mt-1">
                      {badges.map((b, i) => (
                        <div
                          key={i}
                          className={`${b.color} text-[10px] p-1 md:text-xs md:p-1 rounded truncate`}
                        >
                          {b.label}
                        </div>
                      ))}
                    </div>

                    {/* Hover-only Add button */}
                    {dateObj && (
                      <div className="absolute bottom-1 right-1 md:bottom-2 md:left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-teal-700 p-1 h-8 w-8 md:h-6 md:w-auto md:px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAddSessionForDate(dateObj);
                          }}
                        >
                          <Plus className="h-5 w-5 md:h-3 md:w-3 md:mr-1" /> 
                          <span className="hidden md:inline">Add</span>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day Detail Panel */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800">
                {viewingSession ? "Session Details" : "Day Details"}
              </CardTitle>
              {viewingSession ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingSession(null)}
                >
                  Back to Day View
                </Button>
              ) : (
                selectedDate && (
                  <span className="text-sm text-slate-600">
                    {formatDateLabel(selectedDate)}
                  </span>
                )
              )}
            </div>
          </CardHeader>
          <CardContent>
            {viewingSession ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h3 className="font-semibold text-slate-800 mb-3">
                      Session Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Client:</span>
                        <span className="font-medium">
                          {viewingSession.clientName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Provider ID:</span>
                        <span className="font-medium">
                          {viewingSession.providerId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Auth Code:</span>
                        <span className="font-medium">
                          {viewingSession.authCode || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Status:</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            viewingSession.status === "confirmed"
                              ? "bg-green-100 text-green-800"
                              : viewingSession.status === "in-progress"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {viewingSession.status === "confirmed"
                            ? "Confirmed"
                            : viewingSession.status === "in-progress"
                            ? "In Progress"
                            : "Upcoming"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h3 className="font-semibold text-slate-800 mb-3">
                      Schedule Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Start Time:</span>
                        <span className="font-medium">
                          {formatTime12hFromLocal(viewingSession.startDateTime)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">End Time:</span>
                        <span className="font-medium">
                          {formatTime12hFromLocal(viewingSession.endDateTime)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Time Zone:</span>
                        <span className="font-medium">
                          {viewingSession.startTZ}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Recurring:</span>
                        <span className="font-medium">
                          {viewingSession.recurring}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h3 className="font-semibold text-slate-800 mb-3">
                      Location & Notes
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">
                          Place of Service:
                        </span>
                        <span className="font-medium">
                          {viewingSession.placeOfService}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600">
                          Location Address:
                        </span>
                        <p className="font-medium mt-1">
                          {viewingSession.locationAddress || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-600">Quick Note:</span>
                        <p className="font-medium mt-1">
                          {viewingSession.quickNote || "No notes"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditSession(viewingSession)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit Session
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {!selectedDate && (
                  <div className="text-slate-500 text-sm">
                    Select a date to view or add sessions.
                  </div>
                )}

                {selectedDate && (
                  <>
                    {loading && (
                      <div className="text-slate-500 text-sm">Loading…</div>
                    )}
                    {error && !loading && (
                      <div className="text-red-600 text-sm">Error: {error}</div>
                    )}
                    {!loading && !error && (
                      <>
                        {selectedDateSessions.length === 0 ? (
                          <div className="text-slate-500 text-sm mb-3">
                            No sessions scheduled for this date.
                          </div>
                        ) : (
                          <div className="space-y-3 mb-3">
                            {selectedDateSessions.map((s, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                              >
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {s.client}
                                  </p>
                                  <p className="text-sm text-slate-600">
                                    {s.time} • Session{" "}
                                    {s.authCode ? `• ${s.authCode}` : ""}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Provider: {s.providerId}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      s.status === "confirmed"
                                        ? "bg-green-100 text-green-800"
                                        : s.status === "in-progress"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-slate-100 text-slate-800"
                                    }`}
                                  >
                                    {s.status === "confirmed"
                                      ? "Confirmed"
                                      : s.status === "in-progress"
                                      ? "In Progress"
                                      : "Upcoming"}
                                  </span>
                                  <Button
                                    title="View more"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewSession(s.session)}
                                  >
                                    <Eye className="h-4 w-4 md:h-3 md:w-3" />
                                  </Button>
                                  <Button
                                    title="Edit"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditSession(s.session)}
                                  >
                                    <Edit className="h-4 w-4 md:h-3 md:w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <NewSessionFormModal
        isOpen={isNewSessionModalOpen}
        onClose={() => {
          setIsNewSessionModalOpen(false);
          setEditingSession(null);
        }}
        onSave={handleAddNewSession}
        selectedDate={selectedDate}
        editingSession={editingSession}
        clients={clients}
      />
    </div>
  );
}
