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
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NewSessionFormModal from "./new-session-form-modal";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { toast } from "sonner";

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
    const utcDate = new Date(utcDateTimeString);
    if (isNaN(utcDate.getTime())) return "";
    const options = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: userCurrentTimezone,
    };
    return utcDate.toLocaleTimeString("en-US", options);
  } catch (error) {
    console.error("Error formatting time:", error);
    return "";
  }
}
function isUTCStringOnDate(utcDateTimeString, dateObj) {
  if (!utcDateTimeString) return false;
  try {
    const utcDate = new Date(utcDateTimeString);
    const localDate = new Date(
      utcDate.getTime() - utcDate.getTimezoneOffset() * 60 * 1000
    );
    return sameDay(localDate, dateObj);
  } catch (error) {
    console.error("[v0] Error checking date:", error);
    return false;
  }
}
function toMinutes12h(t) {
  if (!t || t === "—") return 24 * 60;
  try {
    const [time, ampm] = t.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 24 * 60;
    let hour = hours % 12;
    if (ampm.toUpperCase() === "PM" && hours !== 12) hour += 12;
    if (ampm.toUpperCase() === "AM" && hours === 12) hour = 0;
    return hour * 60 + minutes;
  } catch (error) {
    console.error("Error in toMinutes12h:", error, t);
    return 24 * 60;
  }
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
  const [viewMode, setViewMode] = useState("month");
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userTimezone, setUserTimezone] = useState("UTC");
  const [locationFilter, setLocationFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [hoveredSession, setHoveredSession] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const today = new Date();

  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(detectedTimezone);
  }, []);

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

  const uniqueLocations = useMemo(() => {
    const locations = new Set(
      sessions.map((session) => session.locationAddress).filter(Boolean)
    );
    return ["All", ...Array.from(locations)];
  }, [sessions]);

  const uniqueProviders = useMemo(() => {
    const providers = new Set(
      sessions.map((session) => session.provider_name).filter(Boolean)
    );
    return ["All", ...Array.from(providers)];
  }, [sessions]);

  const uniqueClients = useMemo(() => {
    const clients = new Set(
      sessions.map((session) => session.clientName).filter(Boolean)
    );
    return ["All", ...Array.from(clients)];
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesLocation =
        locationFilter === "All" ||
        !locationFilter ||
        session.locationAddress === locationFilter;
      const matchesStaff =
        staffFilter === "All" ||
        !staffFilter ||
        session.provider_name === staffFilter;
      const matchesClient =
        clientFilter === "All" ||
        !clientFilter ||
        session.clientName === clientFilter;
      return matchesLocation && matchesStaff && matchesClient;
    });
  }, [sessions, locationFilter, staffFilter, clientFilter]);

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
        return {
          sessionId:
            row.session_id || `temp-${Math.random().toString(36).substring(2)}`, // Fallback ID
          clientId: row.client_id,
          clientName: row.clientName || "",
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
          status: row.STATUS || row.status || "upcoming",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
      const inRange = (dtStr) => {
        if (!dtStr) return false;
        const d = new Date(dtStr);
        return (
          d >= dateRange.start &&
          d <= new Date(dateRange.end.getTime() + 24 * 60 * 60 * 1000)
        );
      };
      const filteredSessions = mapped.filter(
        (s) => s.status !== "cancelled" && inRange(s.startDateTime)
      );
      setSessions(filteredSessions);
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
    setCurrentDate(dateObj);
    setViewMode("today");
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
    setEditingSession({
      sessionId: session.sessionId,
      clientId: session.clientId,
      clientName: session.clientName || "",
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
    setExpandedSession(
      expandedSession?.sessionId === session.sessionId ? null : { ...session }
    );
  };
  const getCellSessions = (dateObj) => {
    if (!dateObj) return [];
    return filteredSessions
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
  const handleMouseEnterSession = (session) => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setHoveredSession(session); // Show tooltip immediately
  };

  const handleMouseLeaveSession = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setHoveredSession(null); // Hide tooltip immediately
  };

  const handleTouchStartSession = (session) => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setHoveredSession(session); // Show tooltip on touch
    // Remove the auto-close timeout to keep tooltip until another interaction
  };
  const isSupervisionRequired = ["rbt", "bt"].includes(
    expandedSession?.staffType?.toLowerCase()
  );
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const handleDeleteSession = async (sessionData) => {
    setSessionToDelete(sessionData);
    setDeleteModalOpen(true);
  };
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setDeletingSessionId(sessionToDelete.sessionId);
    try {
      const resp = await fetch(
        `${baseUrl}/add-session.php?id=${sessionToDelete.sessionId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            Accept: "application/json",
          },
          cache: "no-store",
          mode: "cors",
        }
      );
      if (!resp.ok) {
        let errorMessage = `HTTP error! status: ${resp.status}`;
        try {
          const errorData = await resp.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.log("Could not parse error response as JSON");
        }
        throw new Error(errorMessage);
      }
      const data = await resp.json();
      if (data.success) {
        setDeleteModalOpen(false);
        setSessionToDelete(null);
        if (expandedSession?.sessionId === sessionToDelete.sessionId) {
          setExpandedSession(null);
        }
        toast.success("Session cancelled successfully!");
        await refreshSessions();
      } else {
        throw new Error(data.error || "Failed to cancel session");
      }
    } catch (err) {
      console.error("Error deleting session:", err);
      toast.error(
        `Failed to cancel session: ${err.message}. Please try again.`
      );
    } finally {
      setDeletingSessionId(null);
    }
  };
  const closeDeleteModal = () => {
    if (!deletingSessionId) {
      setDeleteModalOpen(false);
      setSessionToDelete(null);
    }
  };
  // Timeline generation for 8 AM to 8 PM
  const timelineHours = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 8;
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${ampm}`;
  });
  const renderCalendarContent = () => {
    if (viewMode === "today") {
      return (
        <div className="flex gap-4">
          <div className="hidden md:block w-24 bg-gray-50 p-2 rounded-lg">
            {timelineHours.map((time, idx) => (
              <div key={idx} className="h-16 text-xs text-gray-600 text-center">
                {time}
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-4">
            <div className="space-y-3">
              {getCellSessions(currentDate).length === 0 ? (
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
                getCellSessions(currentDate).map((session, idx) => {
                  const isExpanded =
                    expandedSession?.sessionId === session.sessionId;
                  const startTime = formatTime12hFromUTC(
                    session.startDateTime,
                    userTimezone
                  );
                  const startMinutes = toMinutes12h(startTime);
                  const startHour = Math.floor((startMinutes / 60 - 8) * 4); // 4 slots per hour (15-min intervals)
                  console.log(
                    `Session ${
                      session.sessionId
                    }: Start Time=${startTime}, Start Minutes=${startMinutes}, Start Hour=${startHour}, Top=${
                      startHour * 16
                    }px`
                  );
                  return (
                    <div
                      key={idx}
                      className="relative"
                      style={{
                        top: `${startHour * 16}px`, // 16px per 15-min slot
                        minHeight: "64px", // Minimum height for 1-hour session
                      }}
                    >
                      <Card className="hover:shadow-md transition-shadow border-slate-200">
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
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-300 text-red-600 hover:bg-red-50 bg-transparent"
                                onClick={() => handleDeleteSession(session)}
                                disabled={
                                  deletingSessionId === session.sessionId
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-6 space-y-6 border-t pt-6">
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
                                      <p className="text-slate-500 mb-1">
                                        Status
                                      </p>
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
                                        {expandedSession.recurring &&
                                        expandedSession.recurring.frequency &&
                                        expandedSession.recurring.frequency !==
                                          "No" &&
                                        expandedSession.recurring.frequency !==
                                          "Never" ? (
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                                {
                                                  expandedSession.recurring
                                                    .frequency
                                                }
                                              </span>
                                            </div>
                                            {expandedSession.recurring
                                              .frequency === "Weekly" &&
                                              expandedSession.recurring.days
                                                ?.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                  {expandedSession.recurring.days.map(
                                                    (day, idx) => (
                                                      <span
                                                        key={idx}
                                                        className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                                                      >
                                                        {day}
                                                      </span>
                                                    )
                                                  )}
                                                </div>
                                              )}
                                            {expandedSession.recurring.ends && (
                                              <div className="text-xs text-gray-600">
                                                {expandedSession.recurring.ends
                                                  .type === "On" &&
                                                  expandedSession.recurring.ends
                                                    .date && (
                                                    <span>
                                                      Ends:{" "}
                                                      {
                                                        expandedSession
                                                          .recurring.ends.date
                                                      }
                                                    </span>
                                                  )}
                                                {expandedSession.recurring.ends
                                                  .type === "After" &&
                                                  expandedSession.recurring.ends
                                                    .occurrences && (
                                                    <span>
                                                      Total:{" "}
                                                      {
                                                        expandedSession
                                                          .recurring.ends
                                                          .occurrences
                                                      }{" "}
                                                      sessions
                                                    </span>
                                                  )}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-gray-500">
                                            No
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
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
                                  </CardContent>
                                </Card>
                              </div>
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
                              <div className="flex gap-2 pt-2">
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    handleEditSession(expandedSession)
                                  }
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
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      );
    } else if (viewMode === "week") {
      return (
        <div className="space-y-4">
          <div className="hidden md:grid grid-cols-8 gap-2 mb-4 border-b border-gray-200">
            <div className="w-24"></div>{" "}
            {/* Empty cell for timeline alignment */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center font-medium text-muted-foreground py-2 bg-muted rounded-lg"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            <div className="hidden md:block w-24 bg-gray-50 p-2 rounded-lg relative">
              {timelineHours.map((time, idx) => (
                <div
                  key={idx}
                  className="h-16 text-xs text-gray-600 text-center flex items-center justify-center"
                >
                  {time}
                </div>
              ))}
            </div>
            <div className="flex-1 relative overflow-visible">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                {/* Grid lines for hourly divisions */}
                <div
                  className="hidden md:block absolute top-0 left-0 w-full"
                  style={{ height: `${13 * 64}px` }} // 13 hours * 64px
                >
                  {timelineHours.map((_, idx) => (
                    <div
                      key={idx}
                      className="absolute w-full border-t border-gray-200"
                      style={{ top: `${idx * 64}px`, zIndex: 0 }} // 64px per hour
                    />
                  ))}
                </div>
                {calendarData.days.map((dateObj, idx) => {
                  if (!dateObj) return <div key={idx} className="invisible" />;
                  const isToday = dateObj && sameDay(dateObj, today);
                  const daySessions = getCellSessions(dateObj);
                  return (
                    <Card
                      key={idx}
                      className={`min-h-[832px] cursor-pointer hover:shadow-md transition-shadow relative group border border-gray-200 overflow-visible ${
                        selectedDate && sameDay(selectedDate, dateObj)
                          ? "ring-2 ring-teal-500"
                          : ""
                      }`} // 832px = 13 hours * 64px
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
                        <div
                          className="relative"
                          style={{ minHeight: "780px" }}
                        >
                          {daySessions.map((session, i) => {
                            const startTime = formatTime12hFromUTC(
                              session.startDateTime,
                              userTimezone
                            );
                            const startMinutes = toMinutes12h(startTime);
                            const startHour = Math.floor(
                              (startMinutes / 60 - 8) * 4
                            ); // 4 slots per hour (15-min intervals)

                            return (
                              <div
                                key={i}
                                className="absolute w-[calc(100%-1.5rem)] z-10"
                                style={{
                                  top: `${startHour * 16}px`, // 16px per 15-min slot
                                  minHeight: "64px", // Minimum height for 1-hour session
                                }}
                                onMouseEnter={() =>
                                  handleMouseEnterSession(session)
                                }
                                onMouseLeave={handleMouseLeaveSession}
                                onTouchStart={() =>
                                  handleTouchStartSession(session)
                                }
                              >
                                <div className="text-xs p-1 bg-teal-100 text-teal-800 rounded truncate relative pointer-events-auto">
                                  {initials(session.clientName)}{" "}
                                  {startTime
                                    .replace(":00 ", "")
                                    .replace(" UTC", "")}
                                  {hoveredSession?.sessionId ===
                                    session.sessionId && (
                                    <div className="absolute z-[1000] bg-white shadow-lg p-4 rounded-lg border top-full left-0 mt-2 w-64 max-w-[90vw] pointer-events-auto">
                                      <p className="font-semibold">
                                        {session.clientName}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        {formatTime12hFromUTC(
                                          session.startDateTime,
                                          userTimezone
                                        )}{" "}
                                        -{" "}
                                        {formatTime12hFromUTC(
                                          session.endDateTime,
                                          userTimezone
                                        )}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        Provider: {session.provider_name}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        Location: {session.locationAddress}
                                      </p>
                                      {session.quickNote && (
                                        <p className="text-sm text-gray-600">
                                          Note: {session.quickNote}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    } else {
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
          <div className="hidden md:grid grid-cols-7 gap-2 mb-2 border-b border-gray-200">
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
                  className={`p-3 cursor-pointer transition-all border border-gray-200 overflow-visible ${
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
                  <div className="space-y-1 relative">
                    {daySessions.length > 0 ? (
                      daySessions.map((session, i) => (
                        <div
                          key={i}
                          className="text-xs p-1 bg-teal-100 text-teal-800 rounded truncate relative pointer-events-auto"
                          onMouseEnter={() => handleMouseEnterSession(session)}
                          // onMouseLeave={handleMouseLeaveSession}
                          onTouchStart={() => handleTouchStartSession(session)}
                        >
                          {initials(session.clientName)}{" "}
                          {formatTime12hFromUTC(
                            session.startDateTime,
                            userTimezone
                          )
                            .replace(":00 ", "")
                            .replace(" UTC", "")}
                          {hoveredSession?.sessionId === session.sessionId && (
                            <div className="absolute z-[9999] bg-white shadow-xl p-4 rounded-lg border left-full top-0 ml-2 w-64 max-w-[90vw] pointer-events-none">
                              {" "}
                              <p className="font-semibold">
                                {session.clientName}
                              </p>
                              <p className="text-sm text-gray-600">
                                {formatTime12hFromUTC(
                                  session.startDateTime,
                                  userTimezone
                                )}{" "}
                                -{" "}
                                {formatTime12hFromUTC(
                                  session.endDateTime,
                                  userTimezone
                                )}
                              </p>
                              <p className="text-sm text-gray-600">
                                Provider: {session.provider_name}
                              </p>
                              <p className="text-sm text-gray-600">
                                Location: {session.locationAddress}
                              </p>
                              {session.quickNote && (
                                <p className="text-sm text-gray-600">
                                  Note: {session.quickNote}
                                </p>
                              )}
                            </div>
                          )}
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
                  className={`group relative cursor-pointer transition-all min-h-[150px] px-3 py-6 border border-gray-200 overflow-visible
                    ${isPast ? "" : ""}
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
                    <div className="space-y-1 relative">
                      {daySessions.slice(0, 2).map((session, i) => (
                        <div
                          key={i}
                          className="text-xs p-1 bg-teal-100 text-teal-800 rounded truncate pointer-events-auto"
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            handleMouseEnterSession(session);
                          }}
                          onMouseLeave={(e) => {
                            // e.stopPropagation();
                            handleMouseLeaveSession();
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            handleTouchStartSession(session);
                          }}
                        >
                          {initials(session.clientName)}{" "}
                          {formatTime12hFromUTC(
                            session.startDateTime,
                            userTimezone
                          )
                            .replace(":00 ", "")
                            .replace(" UTC", "")}
                          {hoveredSession?.sessionId === session.sessionId && (
                            <div className=" z-[99999999999] bg-teal-50 shadow p-4 rounded-lg border w-64 max-w-[90vw] pointer-events-auto absolute text-black ">
                              {" "}
                              <p className="text-sm font-semibold text-gray-600 capitalize">
                                {session.clientName}
                              </p>
                              <p className="text-sm text-gray-600">
                                {formatTime12hFromUTC(
                                  session.startDateTime,
                                  userTimezone
                                )}{" "}
                                -{" "}
                                {formatTime12hFromUTC(
                                  session.endDateTime,
                                  userTimezone
                                )}
                              </p>
                              <p className="text-sm text-gray-600">
                                Provider: {session.provider_name || "N/A"}
                              </p>
                              <p className="text-sm truncate text-gray-600">
                                Location: {session.locationAddress || "N/A"}
                              </p>
                              <p className="text-sm truncate text-gray-600">
                                Notes: {session.quickNote || "N/A"}
                              </p>{" "}
                            </div>
                          )}
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
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Location" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Staff" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueProviders.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueClients.map((client) => (
                    <SelectItem key={client} value={client}>
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
        
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteSession}
        sessionData={sessionToDelete}
        loading={!!deletingSessionId}
      />
    </div>
  );
}
