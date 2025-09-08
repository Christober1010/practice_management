"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  List,
  User,
  MapPin,
  FileText,
  Users,
} from "lucide-react";
import NewSessionFormModal from "./new-session-form-modal";

// =====================
// Date helpers with UTC support
// =====================
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}
function endOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (6 - day);
  return new Date(d.setDate(diff));
}
function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}
function addWeeks(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
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

function formatTime12hFromUTC(utcDateTimeString, userCurrentTimezone = "UTC") {
  if (!utcDateTimeString) return "";

  try {
    // Parse UTC datetime string
    const utcDate = new Date(utcDateTimeString);

    // Always convert to user's current timezone for display
    if (userCurrentTimezone && userCurrentTimezone !== "UTC") {
      const options = {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: userCurrentTimezone,
      };
      return utcDate.toLocaleTimeString("en-US", options);
    }

    // Default to UTC display
    const hours = utcDate.getUTCHours();
    const minutes = utcDate.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hr12 = hours % 12 === 0 ? 12 : hours % 12;
    const mm = String(minutes).padStart(2, "0");
    return `${hr12}:${mm} ${ampm} UTC`;
  } catch (error) {
    console.error("Error formatting time:", error);
    return "";
  }
}

function isUTCStringOnDate(utcDateTimeString, dateObj) {
  if (!utcDateTimeString) return false;
  try {
    const utcDate = new Date(utcDateTimeString);
    // Convert to local date for comparison
    const localDate = new Date(utcDate.getTime());
    return sameDay(localDate, dateObj);
  } catch (error) {
    console.error("[v0] Error checking date:", error);
    return false;
  }
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

export default function SchedulingView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // 'today', 'week', 'month'
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [clients, setClients] = useState([]);
  const [expandedSession, setExpandedSession] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userTimezone, setUserTimezone] = useState("UTC");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const today = new Date();

  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(detectedTimezone);
    console.log("[v0] Detected user timezone:", detectedTimezone);
  }, []);

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

  const dateRange = useMemo(() => {
    switch (viewMode) {
      case "today":
        return {
          start: new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate()
          ),
          end: new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate(),
            23,
            59,
            59
          ),
        };
      case "week":
        return {
          start: startOfWeek(currentDate),
          end: endOfWeek(currentDate),
        };
      case "month":
      default:
        return {
          start: startOfMonth(currentDate),
          end: endOfMonth(currentDate),
        };
    }
  }, [currentDate, viewMode]);

  const calendarData = useMemo(() => {
    if (viewMode === "today") {
      return {
        days: [currentDate],
        title: formatDateLabel(currentDate),
      };
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate);
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      return {
        days,
        title: `${formatDateLabel(weekStart)} - ${formatDateLabel(
          endOfWeek(currentDate)
        )}`,
      };
    } else {
      // Month view
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDay = monthStart.getDay();
      const totalDays = monthEnd.getDate();

      const arr = [];
      for (let i = 0; i < startDay; i++) arr.push(null);
      for (let d = 1; d <= totalDays; d++) {
        arr.push(
          new Date(currentDate.getFullYear(), currentDate.getMonth(), d)
        );
      }
      const size = arr.length <= 35 ? 35 : 42;
      while (arr.length < size) arr.push(null);

      return {
        days: arr,
        title: `${currentDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}`,
      };
    }
  }, [currentDate, viewMode]);

  const refreshSessions = useCallback(async () => {
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
      console.log("[SchedulingView] API Response:", data); // Debug API response

      const rows = Array.isArray(data) ? data : [data];

      const mapped = rows.map((row) => {
        const startUtc = row.start_utc || row.tech_start_utc_old;
        const endUtc = row.end_utc || row.tech_end_utc_old;
        const startTz = row.start_tz || row.tech_tz_old;
        const endTz = row.end_tz || row.tech_tz_old;
        const authCode = row.auth_code || row.tech_auth_code_old;
        const providerId = row.provider_id || row.therapist_id_old;

        const convertMySQLToISO = (mysqlDateTime) => {
          if (!mysqlDateTime || mysqlDateTime === "0000-00-00 00:00:00")
            return "";
          return mysqlDateTime.replace(" ", "T") + "Z";
        };

        const session = {
          sessionId: row.session_id,
          clientId: row.client_id,
          clientName: row.clientName || "", // Fixed: Use clientName from API
          providerId: providerId,
          provider_name: row.provider_name,
          supervising_provider_name: row.supervising_provider_name,
          supervisingProviderId: row.supervising_provider_id,
          startDateTime: convertMySQLToISO(startUtc),
          endDateTime: convertMySQLToISO(endUtc),
          startTZ: startTz || "UTC",
          endTZ: endTz || "UTC",
          authCode: authCode || "",
          recurring: row.recurring,
          placeOfService: row.place_of_service || "Clinic",
          locationAddress: row.location_address || "",
          quickNote: row.quick_note || "",
          status: row.status || "upcoming",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        console.log("[SchedulingView] Mapped Session:", session); // Debug mapped session
        return session;
      });

      const inRange = (dtStr) => {
        if (!dtStr) return false;
        const d = new Date(dtStr);
        return (
          d >= dateRange.start &&
          d <= new Date(dateRange.end.getTime() + 24 * 60 * 60 * 1000)
        );
      };

      const filteredSessions = mapped.filter((s) => inRange(s.startDateTime));
      setSessions(filteredSessions);
      console.log("[SchedulingView] Filtered Sessions:", filteredSessions); // Debug filtered sessions
    } catch (e) {
      setError(e.message || "Failed to load sessions");
      console.error("[SchedulingView] Error fetching sessions:", e);
    } finally {
      setLoading(false);
    }
  }, [dateRange, baseUrl]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const handlePrevious = () => {
    switch (viewMode) {
      case "today":
        setCurrentDate((prev) => addDays(prev, -1));
        break;
      case "week":
        setCurrentDate((prev) => addWeeks(prev, -1));
        break;
      case "month":
        setCurrentDate((prev) => addMonths(prev, -1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case "today":
        setCurrentDate((prev) => addDays(prev, 1));
        break;
      case "week":
        setCurrentDate((prev) => addWeeks(prev, 1));
        break;
      case "month":
        setCurrentDate((prev) => addMonths(prev, 1));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (dateObj) => {
    if (!dateObj) return;
    setSelectedDate(dateObj);
    setCurrentDate(dateObj); // Always update currentDate to the clicked date
    if (viewMode !== "today") {
      setViewMode("today");
    }
  };

  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
  };

  const handleOpenAddSessionForDate = (dateObj) => {
    if (!dateObj) return;
    setSelectedDate(dateObj);
    setEditingSession(null);
    setIsNewSessionModalOpen(true);
  };

  const handleEditSession = (session) => {
    console.log(session, "ses");
    const clientDetails = clients.find((c) => c.client_id === session.clientId);

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
      startDateTime: session.startDateTime,
      endDateTime: session.endDateTime,
      startTZ: session.startTZ,
      endTZ: session.endTZ,
      authCode: session.authCode,
      recurring: session.recurring,
      placeOfService: session.placeOfService,
      locationAddress: session.locationAddress,
      quickNote: session.quickNote,
    });
    setExpandedSession(null);
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

    setExpandedSession(
      expandedSession?.sessionId === session.sessionId
        ? null
        : sessionWithClientName
    );
  };

  const getCellSessions = (dateObj) => {
    if (!dateObj) return [];
    return sessions
      .filter(
        (session) =>
          session?.startDateTime &&
          isUTCStringOnDate(session.startDateTime, dateObj)
      )
      .sort(
        (a, b) =>
          toMinutes12h(formatTime12hFromUTC(a.startDateTime, a.startTZ)) -
          toMinutes12h(formatTime12hFromUTC(b.startDateTime, b.startTZ))
      );
  };

  const handleAddNewSession = async () => {
    setIsNewSessionModalOpen(false);
    setEditingSession(null);
    await refreshSessions();
  };

  const isSupervisionRequired = ["rbt", "bt"].includes(
    expandedSession?.staffType?.toLowerCase()
  );

  console.log(expandedSession, "expanded");
  const renderCalendarContent = () => {
    if (viewMode === "today") {
      const todaySessions = getCellSessions(currentDate);
      return (
        <div className="space-y-4">
          <div className="text-center py-8">
            <h3 className="text-2xl font-semibold text-slate-800 mb-2">
              {formatDateLabel(currentDate)}
            </h3>
            <p className="text-slate-600">
              {sameDay(currentDate, today) ? "Today" : ""}
            </p>
          </div>

          <div className="space-y-3">
            {todaySessions.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">No sessions scheduled</p>
                <Button
                  onClick={() => handleOpenAddSessionForDate(currentDate)}
                  className="mt-4 bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Session
                </Button>
              </div>
            ) : (
              todaySessions.map((session, idx) => {
                const isExpanded =
                  expandedSession?.sessionId === session.sessionId;
                const clientDetails = clients.find(
                  (c) => c.client_id === session.clientId
                );

                return (
                  <Card
                    key={idx}
                    className="hover:shadow-md transition-shadow border-slate-200"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="bg-teal-100 p-2 rounded-lg flex-shrink-0">
                            <Users className="h-4 w-4 text-teal-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-slate-800">
                              {session.clientName || "Unknown Client"}
                            </div>
                            <div className="text-sm text-slate-600">
                              {formatTime12hFromUTC(
                                session.startDateTime,
                                userTimezone
                              )}{" "}
                              -{" "}
                              {formatTime12hFromUTC(
                                session.endDateTime,
                                userTimezone
                              )}
                              <span className="text-xs text-slate-400 ml-1">
                                ({userTimezone})
                              </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                              Provider: {session.provider_name} •{" "}
                              {session.authCode}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewSession(session)}
                            className="border-slate-300"
                          >
                            {isExpanded ? (
                              <span title="Hide Details">
                                <EyeOff className="h-3 w-3 mr-1" />
                              </span>
                            ) : (
                              <span title="View Details">
                                <Eye className="h-3 w-3 mr-1" />
                              </span>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSession(session)}
                            className="border-slate-300"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-6 space-y-6 border-t pt-6">
                          {/* Session Information Section */}
                          <Card className="border-slate-200">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Calendar className="h-4 w-4 text-teal-600" />{" "}
                                Session Information
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Session ID
                                  </p>
                                  <p className="font-medium">
                                    {expandedSession.sessionId || "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Client ID
                                  </p>
                                  <p className="font-medium">
                                    {expandedSession.clientId || "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500 mb-1">Status</p>
                                  <Badge className="bg-green-100 text-green-800 capitalize">
                                    {expandedSession.status || "Upcoming"}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Start Time
                                  </p>
                                  <p className="font-medium">
                                    {formatTime12hFromUTC(
                                      expandedSession.startDateTime,
                                      userTimezone
                                    ) || "N/A"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    End Time
                                  </p>
                                  <p className="font-medium">
                                    {formatTime12hFromUTC(
                                      expandedSession.endDateTime,
                                      userTimezone
                                    ) || "N/A"}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Recurring
                                  </p>
                                  <p className="font-medium">
                                    {expandedSession.recurring ? (
                                      <>
                                        {expandedSession.recurring.frequency ||
                                          "N/A"}{" "}
                                        {expandedSession.recurring.days
                                          ?.length > 0 &&
                                          expandedSession.recurring.days.map(
                                            (item, idx) => (
                                              <span key={idx} className="mx-1">
                                                - {item}
                                              </span>
                                            )
                                          )}
                                      </>
                                    ) : (
                                      "N/A"
                                    )}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Provider and Client Information */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="border-slate-200">
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <User className="h-4 w-4 text-teal-600" />{" "}
                                  Provider Information
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Provider Name
                                  </p>
                                  <p className="font-medium">
                                    {expandedSession.provider_name ||
                                      "Not specified"}
                                  </p>
                                </div>
                                {expandedSession.supervising_provider_name && (
                                  <div>
                                    <p className="text-slate-500 mb-1">
                                      Supervising Provider Name
                                    </p>
                                    <p className="font-medium">
                                      {expandedSession.supervising_provider_name ||
                                        "Not specified"}
                                    </p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Authorization Code
                                  </p>
                                  <p className="font-medium">
                                    {expandedSession.authCode ||
                                      "Not specified"}
                                  </p>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="border-slate-200">
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <Users className="h-4 w-4 text-teal-600" />{" "}
                                  Client Information
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Client Name
                                  </p>
                                  <p className="font-medium">
                                    {expandedSession.clientName ||
                                      "Unknown Client"}
                                  </p>
                                </div>
                                {clientDetails && (
                                  <>
                                    <div>
                                      <p className="text-slate-500 mb-1">
                                        Phone
                                      </p>
                                      <p className="font-medium">
                                        {clientDetails.phone || "Not specified"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 mb-1">
                                        Email
                                      </p>
                                      <p className="font-medium">
                                        {clientDetails.email || "Not specified"}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          </div>

                          {/* Location Information */}
                          <Card className="border-slate-200">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <MapPin className="h-4 w-4 text-teal-600" />{" "}
                                Location Information
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Place of Service
                                  </p>
                                  <p className="font-medium">
                                    {expandedSession.placeOfService ||
                                      "Not specified"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Time Zone
                                  </p>
                                  <p className="font-medium">
                                    {expandedSession.startTZ || "UTC"}
                                  </p>
                                </div>
                              </div>
                              {expandedSession.locationAddress && (
                                <div>
                                  <p className="text-slate-500 mb-1">
                                    Location Address
                                  </p>
                                  <p className="bg-slate-50 p-3 rounded-lg">
                                    {expandedSession.locationAddress}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Notes Section */}
                          {expandedSession.quickNote && (
                            <Card className="border-slate-200">
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <FileText className="h-4 w-4 text-teal-600" />{" "}
                                  Session Notes
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="text-sm">
                                <div>
                                  <p className="text-slate-500 mb-2 font-medium">
                                    Quick Notes
                                  </p>
                                  <p className="bg-slate-50 p-3 rounded-lg">
                                    {expandedSession.quickNote}
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              onClick={() => handleEditSession(expandedSession)}
                              className="flex-1 border-slate-300"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Session
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      );
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate);
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      return (
        <div className="space-y-4">
          <div className="hidden md:grid grid-cols-7 gap-2 mb-4">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {days.map((dateObj, idx) => {
              const isToday = dateObj && sameDay(dateObj, today);
              const daySessions = getCellSessions(dateObj);

              return (
                <Card
                  key={idx}
                  className={`min-h-[120px] cursor-pointer hover:shadow-md transition-shadow ${
                    selectedDate && sameDay(selectedDate, dateObj)
                      ? "ring-2 ring-teal-500"
                      : ""
                  }`}
                  onClick={() => handleDayClick(dateObj)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-sm font-medium ${
                          isToday ? "text-teal-600" : "text-foreground"
                        }`}
                      >
                        {dateObj.getDate()}{" "}
                        {isToday ? (
                          <Badge className="text-[10px] py-0.5 px-2 lg:ml-2 ml-0">
                            Today
                          </Badge>
                        ) : (
                          ""
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddSessionForDate(dateObj);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="space-y-1">
                      {daySessions.slice(0, 3).map((session, i) => (
                        <div
                          key={i}
                          className="text-xs p-1 bg-teal-100 text-teal-800 rounded truncate"
                        >
                          {initials(session.clientName)}{" "}
                          {formatTime12hFromUTC(
                            session.startDateTime,
                            userTimezone
                          )
                            .replace(":00 ", "")
                            .replace(" UTC", "")}
                        </div>
                      ))}
                      {daySessions.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{daySessions.length - 3} more
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    } else {
      // Month view
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDay = monthStart.getDay();
      const totalDays = monthEnd.getDate();

      const arr = [];
      for (let i = 0; i < startDay; i++) arr.push(null);
      for (let d = 1; d <= totalDays; d++) {
        arr.push(
          new Date(currentDate.getFullYear(), currentDate.getMonth(), d)
        );
      }
      const size = arr.length <= 35 ? 35 : 42;
      while (arr.length < size) arr.push(null);

      return (
        <div className="space-y-4">
          <div className="hidden md:grid grid-cols-7 gap-2 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-muted-foreground text-sm py-2 bg-muted rounded-lg"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="md:hidden space-y-2">
            {arr.map((dateObj, idx) => {
              if (!dateObj) return null;
              const isToday = sameDay(dateObj, today);
              const isSelected = selectedDate && sameDay(dateObj, selectedDate);
              const isPast = isBeforeDay(dateObj, today);
              const daySessions = getCellSessions(dateObj);

              return (
                <Card
                  key={idx}
                  className={`p-3 cursor-pointer transition-all ${
                    isPast ? "opacity-60" : ""
                  } ${isSelected ? "ring-2 ring-teal-500" : ""} ${
                    isToday ? "bg-teal-100" : ""
                  }`}
                  onClick={() => handleDayClick(dateObj)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`font-semibold ${
                        isToday
                          ? "text-teal-600"
                          : isPast
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {dateObj.toDateString()}
                      {isToday && (
                        <Badge className="ml-2 text-[10px] py-0.5 px-2">
                          Today
                        </Badge>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-teal-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddSessionForDate(dateObj);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {daySessions.length > 0 ? (
                      daySessions.map((session, i) => (
                        <div
                          key={i}
                          className="text-xs p-1 bg-teal-100 text-teal-800 rounded truncate"
                        >
                          {initials(session.clientName)}{" "}
                          {formatTime12hFromUTC(
                            session.startDateTime,
                            userTimezone
                          )
                            .replace(":00 ", "")
                            .replace(" UTC", "")}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No sessions
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="hidden md:grid grid-cols-7 gap-2">
            {arr.map((dateObj, idx) => {
              if (!dateObj) return <div key={idx} className="invisible" />;
              const isToday = sameDay(dateObj, today);
              const isSelected = selectedDate && sameDay(dateObj, selectedDate);
              const isPast = isBeforeDay(dateObj, today);
              const daySessions = getCellSessions(dateObj);

              return (
                <Card
                  key={idx}
                  className={`group relative cursor-pointer transition-all min-h-[150px] px-3 py-6
            ${isPast ? "opacity-60" : ""} 
            ${isSelected ? "ring-2 ring-teal-500" : ""} 
            ${isToday ? "bg-teal-100" : ""}`}
                  onClick={() => handleDayClick(dateObj)}
                >
                  <CardContent className="p-2 h-full">
                    <div className="flex justify-between mb-1">
                      <span
                        className={`text-sm font-medium flex items-center ${
                          isToday
                            ? "text-teal-600"
                            : isPast
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {dateObj.getDate()}
                        {isToday && (
                          <Badge className="ml-2 text-[10px] py-0.5 px-2">
                            Today
                          </Badge>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-teal-700 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddSessionForDate(dateObj);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="space-y-1">
                      {daySessions.slice(0, 2).map((session, i) => (
                        <div
                          key={i}
                          className="text-xs p-1 bg-teal-100 text-teal-800 rounded truncate"
                        >
                          {initials(session.clientName)}{" "}
                          {formatTime12hFromUTC(
                            session.startDateTime,
                            userTimezone
                          )
                            .replace(":00 ", "")
                            .replace(" UTC", "")}
                        </div>
                      ))}
                      {daySessions.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{daySessions.length - 2}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Scheduling</h2>
          <p className="text-muted-foreground mt-1">
            Manage appointments and therapy sessions
          </p>
        </div>

        <Button
          onClick={() => handleOpenAddSessionForDate(selectedDate || today)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Session
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center lg:justify-start justify-center w-full gap-2">
              <Button
                variant={viewMode === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewModeChange("today")}
                className={
                  viewMode === "today"
                    ? "bg-teal-600 hover:bg-teal-700 text-white"
                    : ""
                }
              >
                <Clock className="h-4 w-4 mr-2" />
                Day
              </Button>
              <Button
                variant={viewMode === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewModeChange("week")}
                className={
                  viewMode === "week"
                    ? "bg-teal-600 hover:bg-teal-700 text-white"
                    : ""
                }
              >
                <List className="h-4 w-4 mr-2" />
                Week
              </Button>
              <Button
                variant={viewMode === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewModeChange("month")}
                className={
                  viewMode === "month"
                    ? "bg-teal-600 hover:bg-teal-700 text-white"
                    : ""
                }
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Month
              </Button>
            </div>

            <div className="flex items-center lg:justify-end justify-center w-full gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                className="hidden sm:inline-flex bg-transparent"
              >
                Today
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="min-w-[200px] text-center">
                  <h3 className="font-semibold text-foreground">
                    {calendarData.title}
                  </h3>
                </div>

                <Button variant="outline" size="sm" onClick={handleNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading && (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading sessions...</div>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-8">
              <div className="text-destructive">Error: {error}</div>
            </div>
          )}

          {!loading && !error && renderCalendarContent()}
        </CardContent>
      </Card>

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