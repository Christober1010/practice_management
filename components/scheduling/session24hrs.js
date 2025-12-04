"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Clock,
  List,
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
import ViewSessionModal from "./ViewSessionModal";
import { toast } from "sonner";
import { formatTime12hFromUTC, toMinutes12h } from "@/lib/time-utils";

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

function isUTCStringOnDate(utcDateTimeString, dateObj) {
  if (!utcDateTimeString) return false;
  try {
    let isoString = utcDateTimeString;
    if (!isoString.includes("T")) {
      isoString = utcDateTimeString.replace(" ", "T");
    }
    if (!isoString.endsWith("Z")) {
      isoString += "Z";
    }
    const localFromUtc = new Date(isoString);
    return sameDay(localFromUtc, dateObj);
  } catch (error) {
    console.error("[v0] Error checking date:", error);
    return false;
  }
}

// The redeclared toMinutes12h function has been removed as per linting.
// It is assumed that the imported toMinutes12h from "@/lib/time-utils" is the intended one.

function initials(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function minutesFromMidnight(timeStr) {
  return toMinutes12h(timeStr);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function isSameLocalDay(aStr, bDate) {
  if (!aStr) return false;
  let isoString = aStr;
  if (!isoString.includes("T")) {
    isoString = aStr.replace(" ", "T");
  }
  if (!isoString.endsWith("Z")) {
    isoString += "Z";
  }
  const local = new Date(isoString);
  return sameDay(local, bDate);
}

function getVisualStatus(session, todayDate) {
  const isCancelled =
    (session.status || "").toLowerCase() === "cancelled" ||
    (session.STATUS || "").toLowerCase() === "cancelled";

  if (isCancelled) return "cancelled";

  const isToday = isSameLocalDay(session.startDateTime, todayDate);
  if (isToday) return "today";

  const sessionDay = new Date(session.startDateTime);
  const dayOnlySession = new Date(
    sessionDay.getFullYear(),
    sessionDay.getMonth(),
    sessionDay.getDate()
  );
  const dayOnlyToday = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate()
  );

  if (dayOnlySession > dayOnlyToday) return "upcoming";

  const rendered =
    Number.parseFloat(session.renderedHours ?? session.rendered_hours ?? 0) >
      0 || (session.status || "").toLowerCase() === "rendered";
  return rendered ? "rendered" : "unrendered";
}

function getColorClasses(session, todayDate) {
  const state = getVisualStatus(session, todayDate);
  switch (state) {
    case "upcoming":
      return {
        bg: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-500",
      };
    case "today":
      return {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        border: "border-yellow-500",
      };
    case "rendered":
      return {
        bg: "bg-green-100",
        text: "text-green-800",
        border: "border-green-600",
      };
    case "unrendered":
      return {
        bg: "bg-red-100",
        text: "text-red-800",
        border: "border-red-600",
      };
    case "cancelled":
    default:
      return {
        bg: "bg-gray-200",
        text: "text-gray-700",
        border: "border-gray-500",
      };
  }
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
  const lowerStatus = oldStatus.toLowerCase();

  return statusMap[lowerStatus] || oldStatus;
}

export default function SchedulingView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userTimezone, setUserTimezone] = useState("UTC");
  const [locationFilter, setLocationFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [hoveredSession, setHoveredSession] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const today = new Date();

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewedSession, setViewedSession] = useState(null);

  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

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

        const startMs = startUtc
          ? Date.parse(startUtc.replace(" ", "T") + "Z")
          : Number.NaN;
        const endMs = endUtc
          ? Date.parse(endUtc.replace(" ", "T") + "Z")
          : Number.NaN;
        const computedScheduled =
          isFinite(startMs) && isFinite(endMs) && endMs > startMs
            ? Number(((endMs - startMs) / 3600000).toFixed(2))
            : null;

        return {
          sessionId:
            row.session_id || `temp-${Math.random().toString(36).substring(2)}`,
          clientId: row.client_id,
          clientName: row.clientName || "",
          providerId: providerId,
          provider_name: row.provider_name,
          supervising_provider_name: row.supervising_provider_name,
          supervisingProviderId: row.supervising_provider_id,
          startDateTime: startUtc,
          endDateTime: endUtc,
          startTZ: startTz || "UTC",
          endTZ: endTz || "UTC",
          authCode: authCode || "",
          recurring: row.recurring,
          placeOfService: row.place_of_service,
          locationAddress: row.location_address || "",
          quickNote: row.quick_note || "",
          status: normalizeSessionStatus(row),
          createdAt: row.created_at,
          updatedAt: row.updatedAt,
          authorizedHours:
            row.authorized_hours != null ? Number(row.authorized_hours) : null,
          scheduledHours:
            row.scheduled_hours != null
              ? Number(row.scheduled_hours)
              : computedScheduled,
          renderedHours:
            row.rendered_hours != null ? Number(row.rendered_hours) : 0,
        };
      });

      const inRange = (dtStr) => {
        if (!dtStr) return false;
        try {
          let isoString = dtStr;
          if (!isoString.includes("T")) {
            isoString = dtStr.replace(" ", "T");
          }
          if (!isoString.endsWith("Z")) {
            isoString += "Z";
          }
          const d = new Date(isoString);
          return (
            d >= dateRange.start &&
            d <= new Date(dateRange.end.getTime() + 24 * 60 * 60 * 1000)
          );
        } catch (e) {
          console.error("[v0] Error checking date range:", e);
          return false;
        }
      };
      const filteredSessions = mapped.filter((s) => inRange(s.startDateTime));
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
    setIsNewSessionModalOpen(true);
  };

  const handleViewSession = (session) => {
    setViewedSession({ ...session });
    setIsViewModalOpen(true);
  };

  const handleDeleteSession = async (sessionData) => {
    const determinedEditMode = sessionData.recurring ? "recurring" : "single";
    setSessionToDelete({
      ...sessionData,
      editMode: determinedEditMode,
    });
    setDeleteModalOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setDeletingSessionId(sessionToDelete.sessionId);
    try {
      const resp = await fetch(`${baseUrl}/add-session.php`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Accept: "application/json",
        },
        body: JSON.stringify({
          session_id: sessionToDelete.sessionId,
          editMode: sessionToDelete.editMode || "single",
          cancelledBy: sessionToDelete.cancelledBy || "Staff",
          cancelledReason:
            sessionToDelete.cancelledReason || "Session cancelled",
        }),
        cache: "no-store",
        mode: "cors",
      });
      if (!resp.ok) {
        let errorMessage = `HTTP error! status: ${resp.status}`;
        try {
          const errorData = await resp.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error("Could not parse error response as JSON");
        }
        throw new Error(errorMessage);
      }
      const data = await resp.json();
      if (data.success) {
        setDeleteModalOpen(false);
        setSessionToDelete(null);
        toast.success(
          `Session${data.rows_affected > 1 ? "s" : ""} cancelled successfully!`
        );
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
    setHoveredSession(session);
  };

  const handleMouseLeaveSession = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setHoveredSession(null);
  };

  const handleTouchStartSession = (session) => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setHoveredSession(session);
  };

  const handleWeekSessionClick = (session, dateObj) => {
    setCurrentDate(dateObj);
    setViewMode("today");
  };

  const timelineHours = Array.from({ length: 25 }, (_, i) => {
    const hour = i;
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${ampm}`;
  });

  function layoutDaySessionsForTimeline(
    sessions,
    userTimezone,
    expandedSessionId = null,
    expandExtraPx = 0
  ) {
    const events = sessions.map((s) => {
      const startStr = formatTime12hFromUTC(s.startDateTime, userTimezone);
      const endStr = formatTime12hFromUTC(s.endDateTime, userTimezone);

      let start = minutesFromMidnight(startStr);
      let end = minutesFromMidnight(endStr);

      const minMinutes = 0; // 12 AM
      const maxMinutes = 24 * 60; // 12 AM next day (1440 minutes)

      if (!isFinite(start) || start < minMinutes || start > maxMinutes) {
        start = minMinutes;
      }
      if (!isFinite(end) || end < minMinutes || end > maxMinutes) {
        end = Math.min(start + 60, maxMinutes);
      }
      if (end <= start) {
        end = Math.min(start + 60, maxMinutes);
      }

      return { session: s, start, end, col: 0, clusterId: -1 };
    });

    events.sort((a, b) => a.start - b.start || a.end - b.end);

    let clusterId = -1;
    const active = [];
    const byCluster = new Map();

    for (const ev of events) {
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].end <= ev.start) active.splice(i, 1);
      }
      if (active.length === 0) {
        clusterId += 1;
      }
      ev.clusterId = clusterId;
      const used = new Set(active.map((a) => a.col));
      let col = 0;
      while (used.has(col)) col += 1;
      ev.col = col;
      active.push(ev);

      const entry = byCluster.get(clusterId) || { maxCol: 0 };
      entry.maxCol = Math.max(entry.maxCol, col);
      byCluster.set(clusterId, entry);
    }

    const pxPer15Min = 16;
    const startOfDay = 0; // 12 AM
    const endOfDay = 24 * 60; // 12 AM next day

    const layouts = events.map((ev) => {
      const totalCols = (byCluster.get(ev.clusterId)?.maxCol ?? 0) + 1;
      const minutesFromStart = clamp(
        ev.start - startOfDay,
        0,
        endOfDay - startOfDay
      );
      const duration = clamp(ev.end - ev.start, 15, endOfDay - startOfDay);
      const topPx = (minutesFromStart / 15) * pxPer15Min;
      const heightPx = Math.max((duration / 15) * pxPer15Min, 32);
      const leftPct = (ev.col / totalCols) * 100;
      const widthPct = 100 / totalCols;

      return {
        session: ev.session,
        topPx,
        heightPx,
        leftPct,
        widthPct,
        totalCols,
        col: ev.col,
      };
    });

    const totalHeight = ((endOfDay - startOfDay) / 15) * pxPer15Min + 64;
    return { layouts, totalHeight };
  }

  const renderCalendarContent = () => {
    if (viewMode === "today") {
      const daySessions = getCellSessions(currentDate);
      const { layouts, totalHeight } = layoutDaySessionsForTimeline(
        daySessions,
        userTimezone,
        null,
        0
      );

      const timeSlots = [];
      for (let hour = 0; hour <= 24; hour++) {
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        timeSlots.push({
          label: `${displayHour}:00 ${ampm}`,
          minutes: hour * 60,
          isHour: true,
        });
        if (hour < 24) {
          timeSlots.push({
            label: `${displayHour}:30 ${ampm}`,
            minutes: hour * 60 + 30,
            isHour: false,
          });
        }
      }

      const pixelsPerMinute = 2;
      const startHour = 0;
      const endHour = 24;
      const totalMinutes = (endHour - startHour) * 60;
      const timelineHeight = totalMinutes * pixelsPerMinute;

      return (
        <div className="flex border border-slate-300 rounded-md overflow-hidden bg-white">
          {/* Time labels column */}
          <div className="w-20 flex-shrink-0 border-r border-slate-300">
            <div className="h-12 border-b border-slate-300 bg-slate-50" />
            <div className="relative" style={{ height: `${timelineHeight}px` }}>
              {timeSlots.map((slot, idx) => {
                const offsetMinutes = slot.minutes - startHour * 60;
                const topPosition = offsetMinutes * pixelsPerMinute;
                const shouldShowLabel = slot.minutes <= 24 * 60;
                return (
                  <div
                    key={idx}
                    className="absolute w-full text-right pr-2 border-t"
                    style={{ top: `${topPosition}px` }}
                  >
                    {shouldShowLabel && (
                      <span
                        className={`text-xs ${
                          slot.isHour
                            ? "text-gray-700 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        {slot.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline grid and sessions */}
          <div className="flex-1 relative">
            {/* Date header */}
            <div className="h-12 border-b border-slate-300 bg-slate-50 flex items-center justify-between px-4">
              <span className="font-semibold text-slate-700">
                {formatDateLabel(currentDate)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-teal-600 ring-teal-600 bg-transparent"
                onClick={() => handleOpenAddSessionForDate(currentDate)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Session
              </Button>
            </div>

            {/* Grid lines */}
            <div className="relative" style={{ height: `${timelineHeight}px` }}>
              {timeSlots.map((slot, idx) => {
                const offsetMinutes = slot.minutes - startHour * 60;
                const topPosition = offsetMinutes * pixelsPerMinute;
                const shouldShowLine = slot.minutes <= 24 * 60;
                return shouldShowLine ? (
                  <div
                    key={idx}
                    className="absolute w-full"
                    style={{ top: `${topPosition}px` }}
                  >
                    <div
                      className={`w-full ${
                        slot.isHour
                          ? "border-t border-slate-300"
                          : "border-t border-slate-300 border-dashed"
                      }`}
                    />
                  </div>
                ) : null;
              })}

              {/* Session blocks */}
              {layouts.map((layout) => {
                const s = layout.session;
                const startLabel = formatTime12hFromUTC(
                  s.startDateTime,
                  userTimezone
                );
                const endLabel = formatTime12hFromUTC(
                  s.endDateTime,
                  userTimezone
                );

                const startMinutes = minutesFromMidnight(startLabel);
                const endMinutes = minutesFromMidnight(endLabel);
                const offsetFromStart = startMinutes - startHour * 60;
                const durationMinutes = endMinutes - startMinutes;

                const topPx = offsetFromStart * pixelsPerMinute;
                const heightPx = Math.max(
                  durationMinutes * pixelsPerMinute,
                  30
                );

                const color = getColorClasses(s, today);
                return (
                  <div
                    key={s.sessionId || `${s.clientId}-${s.startDateTime}`}
                    onClick={() => handleViewSession(s)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleViewSession(s);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`absolute ${color.bg} ${color.text} ml-0.5 shadow-md overflow-hidden transition-all hover:shadow-lg border-2 ${color.border} cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/60`}
                    style={{
                      top: `${topPx}px`,
                      left: `${layout.leftPct}%`,
                      width: `calc(${layout.widthPct}% - 4px)`,
                      height: `${heightPx}px`,
                      minHeight: `${heightPx}px`,
                      zIndex: 1,
                    }}
                  >
                    <div className="p-3 h-full flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate capitalize">
                            {s.clientName || "Unknown Client"}
                          </div>
                          <div className="text-xs opacity-90 truncate">
                            {startLabel} - {endLabel}
                          </div>
                          {s.provider_name && (
                            <p className="text-xs text-gray-600">
                              Provider: {s.provider_name}
                            </p>
                          )}
                          {s.supervising_provider_name && (
                            <p className="text-xs text-gray-500">
                              Supervisor: {s.supervising_provider_name}
                            </p>
                          )}
                          {s.locationAddress && (
                            <p className="text-xs text-gray-500">
                              Location: {s.locationAddress}
                            </p>
                          )}
                          {s.authCode && (
                            <p className="text-xs text-gray-500">
                              Auth Code: {s.authCode}
                            </p>
                          )}
                          {s.quickNote && (
                            <p className="text-xs text-gray-500 italic border-t pt-2 mt-1">
                              Note: {s.quickNote}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1 mt- pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewSession(s);
                            }}
                            className="bg-white/90 hover:bg-white border-slate-300 text-slate-700 h-7 text-xs px-2"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSession(s);
                            }}
                            className="bg-white/90 hover:bg-white border-slate-300 text-slate-700 h-7 text-xs px-2"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(s);
                            }}
                            disabled={deletingSessionId === s.sessionId}
                            className="bg-red-50 hover:bg-red-100 border-slate-300 text-red-500 hover:text-red-700 h-7 text-xs px-2"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    } else if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate);
      const days = [];
      for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

      const timeSlots = [];
      for (let hour = 0; hour <= 24; hour++) {
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        timeSlots.push({
          label: `${displayHour}:00 ${ampm}`,
          minutes: hour * 60,
          isHour: true,
        });
        if (hour < 24) {
          timeSlots.push({
            label: `${displayHour}:30 ${ampm}`,
            minutes: hour * 60 + 30,
            isHour: false,
          });
        }
      }

      const pixelsPerMinute = 2;
      const startHour = 0;
      const endHour = 24;
      const totalMinutes = (endHour - startHour) * 60;
      const timelineHeight = totalMinutes * pixelsPerMinute;

      return (
        <div className="flex border border-slate-300 rounded-md overflow-hidden bg-white">
          {/* Time labels column */}
          <div className="w-20 flex-shrink-0 border-r border-slate-300">
            <div className="h-12 border-b border-slate-300 bg-slate-50" />
            <div className="relative" style={{ height: `${timelineHeight}px` }}>
              {timeSlots.map((slot, idx) => {
                const offsetMinutes = slot.minutes - startHour * 60;
                const topPosition = offsetMinutes * pixelsPerMinute;
                const shouldShowLabel = slot.minutes <= 24 * 60;
                return (
                  <div
                    key={idx}
                    className="absolute w-full text-right pr-2 border-t"
                    style={{ top: `${topPosition}px` }}
                  >
                    {shouldShowLabel && (
                      <span
                        className={`text-xs ${
                          slot.isHour
                            ? "text-gray-700 font-medium"
                            : "text-gray-500"
                        }`}
                      >
                        {slot.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Week days columns */}
          <div className="flex-1 flex">
            {days.map((dateObj, dayIdx) => {
              const isToday = sameDay(dateObj, today);
              const daySessions = getCellSessions(dateObj);
              const { layouts } = layoutDaySessionsForTimeline(
                daySessions,
                userTimezone,
                null,
                0
              );

              const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                dateObj.getDay()
              ];

              return (
                <div
                  key={dayIdx}
                  className="flex-1 border-r border-slate-300 last:border-r-0"
                >
                  {/* Day header */}
                  <div
                    className={`h-12 border-b border-slate-300 flex flex-col items-center justify-center ${
                      isToday ? "bg-teal-100" : "bg-slate-50"
                    }`}
                  >
                    <span className="text-xs text-slate-600 font-medium">
                      {dayName}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        isToday ? "text-teal-600" : "text-slate-700"
                      }`}
                    >
                      {dateObj.getDate()}
                    </span>
                  </div>

                  {/* Timeline grid and sessions */}
                  <div
                    className="relative"
                    style={{ height: `${timelineHeight}px` }}
                  >
                    {/* Grid lines */}
                    {timeSlots.map((slot, idx) => {
                      const offsetMinutes = slot.minutes - startHour * 60;
                      const topPosition = offsetMinutes * pixelsPerMinute;
                      const shouldShowLine = slot.minutes <= 24 * 60;
                      return shouldShowLine ? (
                        <div
                          key={idx}
                          className="absolute w-full"
                          style={{ top: `${topPosition}px` }}
                        >
                          <div
                            className={`w-full ${
                              slot.isHour
                                ? "border-t border-slate-300"
                                : "border-t border-slate-300 border-dashed"
                            }`}
                          />
                        </div>
                      ) : null;
                    })}

                    {/* Session blocks */}
                    {layouts.map((layout) => {
                      const s = layout.session;
                      const startLabel = formatTime12hFromUTC(
                        s.startDateTime,
                        userTimezone
                      );
                      const endLabel = formatTime12hFromUTC(
                        s.endDateTime,
                        userTimezone
                      );

                      const startMinutes = minutesFromMidnight(startLabel);
                      const endMinutes = minutesFromMidnight(endLabel);
                      const offsetFromStart = startMinutes - startHour * 60;
                      const durationMinutes = endMinutes - startMinutes;

                      const topPx = offsetFromStart * pixelsPerMinute;
                      const heightPx = Math.max(
                        durationMinutes * pixelsPerMinute,
                        30
                      );

                      const colorW = getColorClasses(s, today);
                      return (
                        <div
                          key={
                            s.sessionId || `${s.clientId}-${s.startDateTime}`
                          }
                          onClick={() => handleWeekSessionClick(s, dateObj)}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            handleMouseEnterSession(s);
                          }}
                          onMouseLeave={handleMouseLeaveSession}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            handleTouchStartSession(s);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleWeekSessionClick(s, dateObj);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={`absolute ${colorW.bg} ${colorW.text} ml-0.5 shadow-md overflow-visible transition-all hover:shadow-lg border-2 ${colorW.border} cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/60`}
                          style={{
                            top: `${topPx}px`,
                            left: `${layout.leftPct}%`,
                            width: `calc(${layout.widthPct}% - 4px)`,
                            height: `${heightPx}px`,
                            minHeight: `${heightPx}px`,
                            zIndex:
                              hoveredSession?.sessionId === s.sessionId
                                ? 9999
                                : 1,
                          }}
                        >
                          <div className="p-2 h-full flex flex-col text-xs">
                            <div className="font-semibold truncate capitalize">
                              {s.clientName || "Unknown"}
                            </div>
                            <div className="text-[10px] opacity-90 truncate">
                              {startLabel} - {endLabel}
                            </div>
                            <div className="text-[10px] opacity-90 truncate">
                              {s.provider_name}
                            </div>
                          </div>
                          {hoveredSession?.sessionId === s.sessionId && (
                            <div className="absolute top-1/2 z-[9999999] bg-white shadow-lg p-3 rounded-lg border left-0 right-0 mt-2 pointer-events-auto w-64">
                              <div className="flex flex-col gap-2">
                                <p className="font-semibold text-gray-800 capitalize text-sm">
                                  {s.clientName}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {startLabel} - {endLabel}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">
                                  Provider: {s.provider_name}
                                </p>
                                {s.supervising_provider_name && (
                                  <p className="text-xs text-gray-500">
                                    Supervisor: {s.supervising_provider_name}
                                  </p>
                                )}
                                {s.locationAddress && (
                                  <p className="text-xs text-gray-500">
                                    Location: {s.locationAddress}
                                  </p>
                                )}
                                {s.authCode && (
                                  <p className="text-xs text-gray-500">
                                    Auth Code: {s.authCode}
                                  </p>
                                )}
                                {s.quickNote && (
                                  <p className="text-xs text-gray-500 italic border-t pt-2 mt-1">
                                    Note: {s.quickNote}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
          <div className="hidden md:grid md:grid-cols-7 gap-2">
            {arr.map((dateObj, idx) => {
              if (!dateObj) return <div key={idx} className="invisible" />;
              const isToday = sameDay(dateObj, today);
              const isSelected = selectedDate && sameDay(selectedDate, dateObj);
              const isPast = isBeforeDay(dateObj, today);
              const daySessions = getCellSessions(dateObj);
              const sortedSessions = daySessions.sort(
                (a, b) =>
                  toMinutes12h(
                    formatTime12hFromUTC(a.startDateTime, a.startTZ)
                  ) -
                  toMinutes12h(formatTime12hFromUTC(b.startDateTime, b.startTZ))
              );
              return (
                <Card
                  key={idx}
                  className={`group relative cursor-pointer transition-all min-h-[150px] px-3 py-6 border border-gray-200 overflow-visible
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
                      {sortedSessions.length > 0 ? (
                        sortedSessions.map((session) => {
                          const startLabel = formatTime12hFromUTC(
                            session.startDateTime,
                            userTimezone
                          )
                            .replace(":00 ", "")
                            .replace(" UTC", "");
                          const colorM = getColorClasses(session, today);
                          return (
                            <div
                              key={
                                session.sessionId ||
                                `${session.clientId}-${session.startDateTime}`
                              }
                              className={`text-xs p-1 border ${colorM.bg} ${colorM.border} ${colorM.text} rounded relative pointer-events-auto w-full`}
                              onMouseEnter={(e) => {
                                e.stopPropagation();
                                handleMouseEnterSession(session);
                              }}
                              onMouseLeave={handleMouseLeaveSession}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                handleTouchStartSession(session);
                              }}
                            >
                              <span className="truncate inline-block max-w-full align-top capitalize">
                                {session.clientName} {startLabel}
                              </span>
                              {hoveredSession?.sessionId ===
                                session.sessionId && (
                                <div className="absolute z-[1000] bg-white shadow-lg p-3 rounded-lg border top-full left-0 right-0 mt-2 pointer-events-auto w-56">
                                  <div className="flex flex-col gap-1">
                                    <p className="text-sm font-semibold text-gray-800 capitalize">
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
                                      {session.provider_name}
                                    </p>
                                    {session.locationAddress && (
                                      <p className="text-xs text-gray-500">
                                        {session.locationAddress}
                                      </p>
                                    )}
                                    {session.quickNote && (
                                      <p className="text-xs text-gray-500 italic">
                                        {session.quickNote}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-muted-foreground"></p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {/* Mobile month view */}
          <div className="md:hidden space-y-2">
            {arr.map((dateObj, idx) => {
              if (!dateObj) return null;
              const isToday = sameDay(dateObj, today);
              const isSelected = selectedDate && sameDay(selectedDate, dateObj);
              const isPast = isBeforeDay(dateObj, today);
              const daySessions = getCellSessions(dateObj);
              const sortedSessions = daySessions.sort(
                (a, b) =>
                  toMinutes12h(
                    formatTime12hFromUTC(a.startDateTime, a.startTZ)
                  ) -
                  toMinutes12h(formatTime12hFromUTC(b.startDateTime, b.startTZ))
              );

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
                    {sortedSessions.length > 0 ? (
                      sortedSessions.map((session) => {
                        const startLabel = formatTime12hFromUTC(
                          session.startDateTime,
                          userTimezone
                        )
                          .replace(":00 ", "")
                          .replace(" UTC", "");
                        const colorM = getColorClasses(session, today);
                        return (
                          <div
                            key={
                              session.sessionId ||
                              `${session.clientId}-${session.startDateTime}`
                            }
                            className={`text-xs p-1 bg-teal-100 text-teal-800 rounded relative pointer-events-auto w-full ${colorM.bg} ${colorM.border} ${colorM.text}`}
                            onMouseEnter={() =>
                              handleMouseEnterSession(session)
                            }
                            onMouseLeave={handleMouseLeaveSession}
                            onTouchStart={() =>
                              handleTouchStartSession(session)
                            }
                          >
                            <span className="truncate inline-block max-w-full capitalize">
                              {initials(session.clientName)} {startLabel}
                            </span>
                            {hoveredSession?.sessionId ===
                              session.sessionId && (
                              <div className="absolute z-[9999] bg-white shadow-xl p-3 rounded-lg border left-0 right-0 top-full mt-2 pointer-events-none">
                                <div className="flex flex-col gap-1">
                                  <p className="font-semibold text-gray-800 capitalize">
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
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground"></p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-8">
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
        onConfirm={(cancelledBy, cancelledReason, editMode) => {
          setSessionToDelete((prev) => ({
            ...prev,
            cancelledBy,
            cancelledReason,
            editMode,
          }));
          confirmDeleteSession();
        }}
        sessionData={sessionToDelete}
        isDeleting={!!deletingSessionId}
      />
      <ViewSessionModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewedSession(null);
        }}
        session={viewedSession}
        onEdit={(sess) => {
          setIsViewModalOpen(false);
          setViewedSession(null);
          handleEditSession(sess);
        }}
        onDelete={(sess) => {
          setIsViewModalOpen(false);
          setViewedSession(null);
          handleDeleteSession(sess);
        }}
      />
    </div>
  );
}
