"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// Tabs removed — scheduling form is now a single view
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import toast from "react-hot-toast";
import { Users, Clock, FileText, Repeat, Trash2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDispatch, useSelector } from "react-redux";
import { fetchClients } from "@/app/store/clientSlice";
import { getMahaverseAuthHeaders } from "@/lib/api-auth";
import { sessionIsRenderedOrReadyToBill } from "@/lib/scheduling-session-status";
import { schedulingSaveErrorMessage } from "@/lib/scheduling-errors";
import { cn } from "@/lib/utils";
import { highlightClaimFocusElement } from "@/lib/claim-warning-nav";
import {
  authorizationBillingCodeLabel,
  authorizationBillingCodeMatches,
} from "@/lib/authorization-billing-code";
import { findLocalProviderScheduleConflict } from "@/lib/scheduling-provider-conflict";
import { isActiveAuthorization } from "@/lib/client-authorization-active";

const jsonAuthHeaders = () =>
  getMahaverseAuthHeaders({
    "Content-Type": "application/json",
    Accept: "application/json",
  });

// ... existing constants and helper functions ...

const TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Rome",
  "Asia/Calcutta",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

const initialForm = {
  clientId: "",
  provider: "",
  providerName: "",
  supervisingProvider: "",
  supervisingProviderName: "",
  recurring: "No",
  repeatFrequency: "Daily",
  repeatOn: [],
  ends: "Never",
  endDate: "",
  endAfterOccurrences: 1,
  placeOfService: "",
  locationAddress: "",
  quickNote: "",
  excludeSession: "No",
  serviceType: "Direct",
  startDateTime: "",
  startTZ: "",
  endDateTime: "",
  endTZ: "",
  authCode: "",
  authId: "",
  scheduledHours: "",
  renderedHours: "0",
};

/** PK string for client_auth row as shown in Redux */
function authorizationPk(a) {
  return String(a?.auth_id ?? a?.id ?? "");
}

function formatClientAddress(addr) {
  if (!addr || typeof addr !== "object") return "";
  return [
    addr.address_line_1,
    addr.address_line_2,
    addr.city,
    addr.state,
    addr.zipcode,
    addr.country,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function clientAddressOptions(client) {
  const rows = Array.isArray(client?.addresses) ? client.addresses : [];
  return rows
    .map((addr) => ({
      id: addr.id,
      value: formatClientAddress(addr),
      service_location: addr.service_location,
    }))
    .filter((addr) => addr.value);
}

function normalizeAddressKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(united states of america|united states|usa)\b/g, "us")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addressStreetKey(value) {
  return normalizeAddressKey(String(value || "").split(",")[0] || "");
}

/**
 * Map a stored session location onto a client address option.
 * Imports/older saves often use a different string than the dropdown formatter,
 * which makes Radix Select render a blank trigger when the value has no item.
 */
function resolveSessionLocationAddress(stored, addressOptions) {
  const raw = String(stored || "").trim();
  const options = (addressOptions || []).filter(
    (addr) => addr?.value && addr.value !== "No address available"
  );
  if (!raw) {
    return { value: "", matched: null };
  }

  const exact = options.find((addr) => addr.value === raw);
  if (exact) return { value: exact.value, matched: exact };

  const storedKey = normalizeAddressKey(raw);
  const normalized = options.find(
    (addr) => normalizeAddressKey(addr.value) === storedKey
  );
  if (normalized) return { value: normalized.value, matched: normalized };

  const contained = options.find((addr) => {
    const optionKey = normalizeAddressKey(addr.value);
    return optionKey.includes(storedKey) || storedKey.includes(optionKey);
  });
  if (contained) return { value: contained.value, matched: contained };

  const storedStreet = addressStreetKey(raw);
  if (storedStreet) {
    const streetHits = options.filter(
      (addr) => addressStreetKey(addr.value) === storedStreet
    );
    if (streetHits.length === 1) {
      return { value: streetHits[0].value, matched: streetHits[0] };
    }
  }

  return { value: raw, matched: null };
}

/**
 * Resolve which authorization row to bill. Never trust form.authId alone (stale
 * composite-split ids like 742 from cached bundles / wrong DB parity).
 */
function resolveAuthorizationRow(selectedClient, form) {
  const rows = Array.isArray(selectedClient?.authorizations)
    ? selectedClient.authorizations.filter(isActiveAuthorization)
    : [];

  if (rows.length === 0) return null;

  const pid = String(form.authId ?? "").trim();
  let hit = rows.find((a) => authorizationPk(a) === pid);
  if (hit) return hit;

  const code = String(form.authCode ?? "").trim();
  if (!code) return null;

  const sameCode = rows.filter((a) => authorizationBillingCodeMatches(a, code));
  if (sameCode.length === 1) return sameCode[0];

  return null;
}

const getLocalTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const convertToUserTimezone = (utcDateString, userTimezone) => {
  if (!utcDateString || !userTimezone) return "";
  try {
    const dateStr = utcDateString.endsWith("Z")
      ? utcDateString
      : utcDateString.replace(" ", "T") + "Z";
    const utcDate = new Date(dateStr);

    if (isNaN(utcDate)) {
      console.error("Invalid UTC date string provided:", utcDateString);
      return "";
    }

    const year = utcDate.getFullYear();
    const month = String(utcDate.getMonth() + 1).padStart(2, "0");
    const day = String(utcDate.getDate()).padStart(2, "0");
    const hours = String(utcDate.getHours()).padStart(2, "0");
    const minutes = String(utcDate.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error("Error converting UTC to user timezone:", error);
    return "";
  }
};

const convertToUTC = (localDateTimeString, userTimezone) => {
  if (!localDateTimeString || !userTimezone) return "";
  try {
    const localDate = new Date(localDateTimeString);
    const tempDate = new Date(
      localDate.toLocaleString("en-US", { timeZone: userTimezone })
    );
    const utcDate = new Date(
      localDate.getTime() + (localDate.getTime() - tempDate.getTime())
    );
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(utcDate.getUTCDate()).padStart(2, "0");
    const hours = String(utcDate.getUTCHours()).padStart(2, "0");
    const minutes = String(utcDate.getUTCMinutes()).padStart(2, "0");
    const seconds = String(utcDate.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error("Error converting to UTC:", error);
    return localDateTimeString;
  }
};

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
export default function NewSessionFormModal({
  isOpen,
  onClose,
  onSave,
  editingSession = null,
  selectedDate = null,
  existingSessions = [],
  locationFilterId = "",
  /** Only admins may change Exclude session (Yes/No). */
  canEditExcludeSession = false,
  /** When false, new sessions may only start on today or future (clinic calendar). */
  canCreatePastDates = true,
  /** Deep-link focus: supervising | hours | pos */
  focusField = null,
}) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  // activeTab state removed — single-view scheduling form
  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [userTimezone, setUserTimezone] = useState("");
  const [editMode, setEditMode] = useState("single");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelMode, setCancelMode] = useState("single");
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const dispatch = useDispatch();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  useEffect(() => {
    if (!isOpen) return;
    dispatch(fetchClients());
  }, [dispatch, isOpen]);

  useEffect(() => {
    if (!isOpen || !focusField) return;
    const idMap = {
      supervising: "supervisingProvider",
      hours: "renderedHours",
      pos: "placeOfService",
    };
    const elementId = idMap[focusField] || focusField;
    const t = window.setTimeout(() => {
      highlightClaimFocusElement(elementId);
    }, 350);
    return () => window.clearTimeout(t);
  }, [isOpen, focusField, editingSession]);

  const clients = useSelector((state) => state.clients?.items || []);
  const selectedProvider = staff.find((s) => s.id === form.provider);

  const isClientActive = (client) => {
    if (!client) return false;
    const active =
      client.is_active !== false &&
      client.is_active !== 0 &&
      client.is_active !== "0";
    const archived =
      client.archived === true ||
      client.archived === 1 ||
      client.archived === "1";
    return active && !archived;
  };

  const tabOrder = ["scheduling", "notes"];

  useEffect(() => {
    const detectedTimezone = getLocalTimezone();
    setUserTimezone(detectedTimezone);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setStaff([]);
    const fetchStaff = async () => {
      setLoadingStaff(true);
      try {
        const res = await mahaverseFetch("/staff.php?scope=assigned", {
          headers: getMahaverseAuthHeaders(),
        });
        const data = await res.json();
        if (data.staff_records && Array.isArray(data.staff_records)) {
          const activeStaff = data.staff_records.filter(
            (s) => s.status === "Active" && s.archived !== "1"
          );
          setStaff(activeStaff);
        }
      } catch (err) {
        toast.error("Failed to load providers");
      } finally {
        setLoadingStaff(false);
      }
    };
    fetchStaff();
  }, [isOpen, baseUrl]);

  useEffect(() => {
    if (isOpen && userTimezone) {
      setForm((prev) => ({
        ...prev,
        startTZ: prev.startTZ || userTimezone,
        endTZ: prev.endTZ || userTimezone,
      }));
    }
  }, [isOpen, userTimezone]);

  useEffect(() => {
    if (!form.startDateTime || !form.endDateTime) {
      setForm((prev) => ({ ...prev, scheduledHours: "" }));
      return;
    }
    const start = new Date(form.startDateTime);
    const end = new Date(form.endDateTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      setForm((prev) => ({ ...prev, scheduledHours: "" }));
      return;
    }
    const diffMs = end.getTime() - start.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    setForm((prev) => ({ ...prev, scheduledHours: hours.toFixed(2) }));
  }, [form.startDateTime, form.endDateTime]);

  // useEffect(() => {
  //   if (!isOpen) return;

  //   if (editingSession && userTimezone) {
  //     if (editingSession.recurring && editingSession.recurring !== "No") {
  //       setEditMode("single");
  //     }

  //     setForm({
  //       ...initialForm,
  //       ...editingSession,
  //       clientId: editingSession.clientId || "",
  //       provider: editingSession.providerId || "",
  //       providerName: editingSession.providerName || "",
  //       supervisingProvider: editingSession.supervisingProviderId || "",
  //       supervisingProviderName: editingSession.supervisingProviderName || "",
  //       recurring:
  //         editingSession.recurring?.frequency &&
  //         editingSession.recurring.frequency !== "No"
  //           ? "Repeats"
  //           : "No",
  //       repeatFrequency: editingSession.recurring?.frequency || "Daily",
  //       repeatOn: editingSession.recurring?.days || [],
  //       ends: editingSession.recurring?.ends?.type || "Never",
  //       endDate: editingSession.recurring?.ends?.date || "",
  //       endAfterOccurrences: editingSession.recurring?.ends?.occurrences || 1,
  //       startDateTime: convertToUserTimezone(
  //         editingSession.startDateTime,
  //         editingSession.startTZ || userTimezone
  //       ),
  //       endDateTime: convertToUserTimezone(
  //         editingSession.endDateTime,
  //         editingSession.endTZ || userTimezone
  //       ),
  //       startTZ: editingSession.startTZ || userTimezone,
  //       endTZ: editingSession.endTZ || userTimezone,
  //       authId: editingSession.authId || "",
  //       scheduledHours:
  //         (
  //           editingSession.scheduledHours ??
  //           editingSession.scheduled_hours ??
  //           ""
  //         )?.toString() || "",
  //       renderedHours:
  //         (
  //           editingSession.renderedHours ??
  //           editingSession.rendered_hours ??
  //           "0"
  //         )?.toString() || "0",
  //     });
  //   } else if (selectedDate && userTimezone) {
  //     const y = selectedDate.getFullYear();
  //     const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
  //     const d = String(selectedDate.getDate()).padStart(2, "0");
  //     setForm((prev) => ({
  //       ...initialForm,
  //       startDateTime: `${y}-${m}-${d}T09:00`,
  //       endDateTime: `${y}-${m}-${d}T10:00`,
  //       startTZ: userTimezone,
  //       endTZ: userTimezone,
  //     }));
  //   }
  //   setActiveTab("scheduling");
  // }, [isOpen, editingSession, selectedDate, userTimezone]);

  // Replace the useEffect that handles editingSession (around line 215) with this:
  useEffect(() => {
    if (!isOpen) return;

    if (editingSession && userTimezone) {
      if (editingSession.recurring && editingSession.recurring !== "No") {
        setEditMode("single");
      }

      // Find the provider names from the staff list to ensure they're populated
      const providerStaff = staff.find(
        (s) =>
          s.id === editingSession.providerId || s.id === editingSession.provider
      );
      const supervisingStaff = staff.find(
        (s) =>
          s.id === editingSession.supervisingProviderId ||
          s.id === editingSession.supervisingProvider
      );
      let extractedAuthId =
        editingSession.authId != null && editingSession.authId !== ""
          ? String(editingSession.authId)
          : "";
      if (!extractedAuthId && editingSession.authCode) {
        const ac = String(editingSession.authCode);
        const lastDash = ac.lastIndexOf("-");
        if (lastDash > 0) {
          const tail = ac.slice(lastDash + 1).trim();
          if (/^\d+$/.test(tail)) extractedAuthId = tail;
        }
      }

      const cid = editingSession.clientId || "";
      const clientRow = clients.find(
        (c) => String(c.client_id) === String(cid)
      );
      const authList = Array.isArray(clientRow?.authorizations)
        ? clientRow.authorizations
        : [];
      const resolvedLocation = resolveSessionLocationAddress(
        editingSession.locationAddress || editingSession.location_address,
        clientAddressOptions(clientRow)
      );
      let resolvedAuthCode = editingSession.authCode || "";
      if (extractedAuthId) {
        const row = authList.find(
          (a) => String(a.auth_id ?? a.id) === extractedAuthId
        );
        if (row) resolvedAuthCode = authorizationBillingCodeLabel(row);
      }
      if (!extractedAuthId && resolvedAuthCode) {
        const activeRows = authList.filter(isActiveAuthorization);
        const matches = activeRows.filter((a) =>
          authorizationBillingCodeMatches(a, resolvedAuthCode)
        );
        if (matches.length === 1) {
          extractedAuthId = authorizationPk(matches[0]);
          resolvedAuthCode = authorizationBillingCodeLabel(matches[0]);
        }
      }

      setForm({
        ...initialForm,
        ...editingSession,
        clientId: editingSession.clientId || "",
        provider: editingSession.providerId || editingSession.provider || "",
        // Use staff data first, fallback to editingSession
        providerName:
          providerStaff?.fullName || editingSession.providerName || "",
        supervisingProvider:
          editingSession.supervisingProviderId ||
          editingSession.supervisingProvider ||
          "",
        supervisingProviderName:
          supervisingStaff?.fullName ||
          editingSession.supervisingProviderName ||
          "",
        recurring:
          editingSession.recurring?.frequency &&
          editingSession.recurring.frequency !== "No"
            ? "Repeats"
            : "No",
        repeatFrequency: editingSession.recurring?.frequency || "Daily",
        repeatOn: editingSession.recurring?.days || [],
        ends: editingSession.recurring?.ends?.type || "Never",
        endDate: editingSession.recurring?.ends?.date || "",
        endAfterOccurrences: editingSession.recurring?.ends?.occurrences || 1,
        startDateTime: convertToUserTimezone(
          editingSession.startDateTime,
          editingSession.startTZ || userTimezone
        ),
        endDateTime: convertToUserTimezone(
          editingSession.endDateTime,
          editingSession.endTZ || userTimezone
        ),
        startTZ: editingSession.startTZ || userTimezone,
        endTZ: editingSession.endTZ || userTimezone,
        authId: extractedAuthId,
        authCode: resolvedAuthCode,
        scheduledHours:
          (
            editingSession.scheduledHours ??
            editingSession.scheduled_hours ??
            ""
          )?.toString() || "",
        renderedHours:
          (
            editingSession.renderedHours ??
            editingSession.rendered_hours ??
            "0"
          )?.toString() || "0",
        excludeSession:
          editingSession.excludeSession === "Yes" ||
          editingSession.exclude_session === "Yes"
            ? "Yes"
            : "No",
        serviceType:
          String(
            editingSession.serviceType ||
              editingSession.service_type ||
              editingSession.direct_or_indirect_service ||
              "Direct"
          ).toLowerCase() === "direct"
            ? "Direct"
            : "Indirect",
        locationAddress: resolvedLocation.value,
        placeOfService:
          editingSession.placeOfService ||
          editingSession.place_of_service ||
          resolvedLocation.matched?.service_location ||
          "",
      });
    } else if (selectedDate && userTimezone) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const d = String(selectedDate.getDate()).padStart(2, "0");
      setForm((prev) => ({
        ...initialForm,
        startDateTime: `${y}-${m}-${d}T09:00`,
        endDateTime: `${y}-${m}-${d}T10:00`,
        startTZ: userTimezone,
        endTZ: userTimezone,
      }));
    }
  }, [isOpen, editingSession, selectedDate, userTimezone, staff, clients]);

  const clientOptions = useMemo(
    () =>
      clients
        .filter(isClientActive)
        .filter((c) => {
          if (!locationFilterId) return true;
          return String(c.location || "") === String(locationFilterId);
        })
        .map((c) => ({
        id: c.client_id,
        name: [c.first_name, c.middle_name, c.last_name]
          .filter(Boolean)
          .join(" "),
        authorizations: Array.isArray(c.authorizations) ? c.authorizations : [],
        address: clientAddressOptions(c),
      })),
    [clients, locationFilterId]
  );

  const selectedClient = useMemo(
    () =>
      clientOptions.find((c) => String(c.id) === String(form.clientId)) ||
      null,
    [clientOptions, form.clientId]
  );

  const locationSelectOptions = useMemo(() => {
    const fromClient = selectedClient?.address || [];
    const current = String(form.locationAddress || "").trim();
    if (current && !fromClient.some((addr) => addr.value === current)) {
      return [
        {
          id: "session-location",
          value: current,
          service_location: form.placeOfService || "",
        },
        ...fromClient,
      ];
    }
    return fromClient;
  }, [selectedClient, form.locationAddress, form.placeOfService]);

  const isCompletedLimitedEdit = useMemo(
    () =>
      Boolean(editingSession?.sessionId) &&
      sessionIsRenderedOrReadyToBill(editingSession),
    [editingSession]
  );

  /** Completed sessions: claim fixes need supervisor + billing code; client/provider stay locked. */
  const COMPLETED_EDITABLE_FIELDS = [
    "startDateTime",
    "endDateTime",
    "startTZ",
    "endTZ",
    "locationAddress",
    "placeOfService",
    "supervisingProvider",
    "authId",
  ];

  const fieldLocked = (fieldId) =>
    isCompletedLimitedEdit && !COMPLETED_EDITABLE_FIELDS.includes(fieldId);

  useEffect(() => {
    if (!isOpen || !form.authId || !selectedClient?.authorizations?.length) {
      return;
    }
    if (resolveAuthorizationRow(selectedClient, form)) return;
    setForm((prev) =>
      prev.authId || prev.authCode
        ? { ...prev, authId: "", authCode: "" }
        : prev
    );
  }, [isOpen, selectedClient, form.authId, form.authCode, form.clientId]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const handleRepeatFrequencyChange = (value) => {
    if (value === "Every Weekday") {
      setForm((prev) => ({
        ...prev,
        repeatFrequency: "Weekly",
        repeatOn: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        repeatFrequency: value,
        repeatOn: value !== "Weekly" ? [] : prev.repeatOn,
      }));
    }
  };

  const validateSchedulingTab = () => {
    const e = {};
    if (!form.clientId) e.clientId = "Required";
    if (!form.provider) e.provider = "Required";
    if (!form.placeOfService) e.placeOfService = "Required";
    if (!form.locationAddress.trim()) e.locationAddress = "Required";
    if (!form.startDateTime) e.startDateTime = "Required";
    if (!form.endDateTime) e.endDateTime = "Required";

    if (form.startDateTime) {
      const startDate = new Date(form.startDateTime);
      const startHour = startDate.getHours();
      const startMinute = startDate.getMinutes();
      const startInMinutes = startHour * 60 + startMinute;

      if (startInMinutes < 8 * 60 || startInMinutes >= 21 * 60 + 30) {
        e.startDateTime = "Start time must be between 8:00 AM and 9:30 PM";
      }

      // New appointments only: roles without create_past cannot book before clinic today.
      if (!editingSession && !canCreatePastDates) {
        const sessionYmd = String(form.startDateTime).slice(0, 10);
        const todayYmd = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Chicago",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        if (/^\d{4}-\d{2}-\d{2}$/.test(sessionYmd) && sessionYmd < todayYmd) {
          e.startDateTime =
            "You can only create appointments for today or future dates";
        }
      }
    }

    if (form.endDateTime) {
      const endDate = new Date(form.endDateTime);
      const endHour = endDate.getHours();
      const endMinute = endDate.getMinutes();
      const endInMinutes = endHour * 60 + endMinute;

      if (endInMinutes < 8 * 60 || endInMinutes > 21 * 60 + 30) {
        e.endDateTime = "End time must be between 8:00 AM and 9:30 PM";
      }
    }

    if (
      form.startDateTime &&
      form.endDateTime &&
      new Date(form.endDateTime) <= new Date(form.startDateTime)
    ) {
      e.endDateTime = "End must be after Start";
    }

    if (!form.authId) e.authId = "Required";
    else if (
      selectedClient &&
      !resolveAuthorizationRow(selectedClient, form)
    ) {
      e.authId =
        "Pick Billing code again — this authorization is not valid for this client.";
    }

    if (form.recurring === "Repeats") {
      if (form.repeatFrequency === "Weekly" && form.repeatOn.length === 0) {
        e.repeatOn = "Select at least one day";
      }
      if (form.ends === "On" && !form.endDate) e.endDate = "Required";
      if (
        form.ends === "After" &&
        (!form.endAfterOccurrences || form.endAfterOccurrences < 1)
      ) {
        e.endAfterOccurrences = "Must be > 0";
      }
    }
    setErrors(e);
    return Object.keys(e).length > 0;
  };

  // handleNextClick removed — notes now live inside the scheduling tab

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isSaving) return;
    if (validateSchedulingTab()) {
      toast.error("Please fix errors before submitting.");
      return;
    }

    const scheduledHoursNum = Number.parseFloat(form.scheduledHours) || 0;
    const renderedHoursNum = Number.parseFloat(form.renderedHours) || 0;

    const authRowForSubmit = resolveAuthorizationRow(selectedClient, form);
    if (!authRowForSubmit) {
      toast.error(
        "Billing authorization is missing or does not match this client. Open Billing code and select again. If it keeps failing, refresh the page so clients reload from the API (database must match the server)."
      );
      return;
    }

    const authPk = Number.parseInt(authorizationPk(authRowForSubmit), 10);
    const authCodeResolved = authorizationBillingCodeLabel(authRowForSubmit);

    const payload = {
      clientId: form.clientId,
      clientName: selectedClient?.name || "Unknown",
      provider: form.provider,
      providerName: form.providerName || "",
      startDateTime: convertToUTC(form.startDateTime, form.startTZ),
      endDateTime: convertToUTC(form.endDateTime, form.endTZ),
      startTZ: form.startTZ,
      endTZ: form.endTZ,
      authCode: authCodeResolved,
      authId: Number.isFinite(authPk) ? authPk : null,
      placeOfService: form.placeOfService,
      locationAddress: form.locationAddress,
      quickNote: form.quickNote,
      excludeSession: canEditExcludeSession
        ? form.excludeSession === "Yes"
          ? "Yes"
          : "No"
        : editingSession
          ? editingSession.excludeSession === "Yes" ||
            editingSession.exclude_session === "Yes"
            ? "Yes"
            : "No"
          : "No",
      serviceType: form.serviceType === "Direct" ? "Direct" : "Indirect",
      status: "Scheduled",
      recurring: {
        frequency: form.recurring === "Repeats" ? form.repeatFrequency : "No",
        days: form.repeatFrequency === "Weekly" ? form.repeatOn : [],
        ends: {
          type: form.recurring === "Repeats" ? form.ends : "Never",
          date: form.ends === "On" ? form.endDate : null,
          occurrences:
            form.ends === "After"
              ? Number.parseInt(form.endAfterOccurrences, 10)
              : null,
        },
      },
      scheduled_hours: scheduledHoursNum,
      rendered_hours: renderedHoursNum,
    };

    if (editingSession?.sessionId) {
      payload.session_id = editingSession.sessionId;
      if (editingSession.recurring && editingSession.recurring !== "No") {
        payload.editMode = editMode;
      }
    }

    if (isCompletedLimitedEdit) {
      // Freeze identity / notes / status; allow form values for supervisor + billing code.
      payload.clientId = editingSession.clientId;
      payload.clientName = editingSession.clientName || payload.clientName;
      payload.provider = editingSession.providerId || editingSession.provider;
      payload.providerName =
        editingSession.providerName || editingSession.provider_name || "";
      payload.quickNote = editingSession.quickNote || "";
      payload.status =
        editingSession.status === "Cancelled"
          ? "Cancelled"
          : "Rendered";
      payload.rendered_hours =
        Number.parseFloat(
          editingSession.renderedHours ?? editingSession.rendered_hours ?? 0
        ) || renderedHoursNum;
      payload.recurring = {
        frequency:
          editingSession.recurring?.frequency &&
          editingSession.recurring.frequency !== "No"
            ? editingSession.recurring.frequency
            : "No",
        days: editingSession.recurring?.days || [],
        ends: editingSession.recurring?.ends || {
          type: "Never",
          date: null,
          occurrences: null,
        },
      };
      payload.supervisingProvider = form.supervisingProvider || "";
      payload.supervisingProviderName = form.supervisingProviderName || "";
      // authCode / authId already set from the form above
    } else if (form.supervisingProvider) {
      payload.supervisingProvider = form.supervisingProvider;
      payload.supervisingProviderName = form.supervisingProviderName || "";
    }

    const localConflict = findLocalProviderScheduleConflict({
      providerId: payload.provider,
      startUtc: payload.startDateTime,
      endUtc: payload.endDateTime,
      sessions: existingSessions,
      excludeSessionId: editingSession?.sessionId ?? null,
    });
    if (localConflict) {
      toast.error(
        schedulingSaveErrorMessage({
          code: "provider_double_booked",
          conflict: localConflict,
        })
      );
      return;
    }

    setIsSaving(true);
    try {
      const res = await mahaverseFetch('/add-session.php', {
        method: editingSession?.sessionId ? "PUT" : "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success === true) {
        toast.success(
          editingSession ? "Session updated!" : "Session scheduled!"
        );
        onSave?.({
          ...payload,
          sessionId: data.session_id || editingSession?.sessionId,
        });
        handleClose();
      } else {
        toast.error(schedulingSaveErrorMessage(data));
      }
    } catch (err) {
      toast.error("A server error occurred during submission.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSession = async (e) => {
    e?.preventDefault?.();
    if (!cancelReason.trim()) {
      toast.error("Please provide a cancellation reason");
      return;
    }
    if (!editingSession?.sessionId) {
      toast.error("Session not found");
      return;
    }

    const payload = {
      session_id: editingSession.sessionId,
      status: "Cancelled",
      cancelledBy: "Staff",
      cancelledReason: cancelReason.trim(),
      editMode: cancelMode,
    };

    setIsCancelling(true);
    try {
      const res = await mahaverseFetch('/add-session.php', {
        method: "PUT",
        headers: jsonAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success("Session cancelled successfully!");
        setShowCancelDialog(false);
        setCancelReason("");
        onSave?.({ ...editingSession, status: "Cancelled" });
        handleClose();
      } else {
        toast.error(data.error || "Failed to cancel session");
      }
    } catch (err) {
      toast.error("A server error occurred during cancellation.");
    } finally {
      setIsCancelling(false);
    }
  };

  const renderInputWithError = (id, label, value, onChange, props = {}) => {
    const locked = fieldLocked(id);
    const { readOnly: _ro, ...inputProps } = props;
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          value={value}
          onChange={locked ? undefined : onChange}
          readOnly={locked}
          disabled={locked}
          className={`${errors[id] ? "border-red-500" : ""} ${
            locked ? "bg-muted cursor-not-allowed opacity-90" : ""
          }`}
          {...inputProps}
        />
        {errors[id] && <p className="text-red-500 text-sm">{errors[id]}</p>}
      </div>
    );
  };

  const renderSelectWithError = (
    id,
    label,
    value,
    onValueChange,
    items,
    placeholder = "Select..."
  ) => {
    const locked = fieldLocked(id);
    return (
      <div className="space-y-1">
        <Label>{label}</Label>
        <Select
          value={value}
          onValueChange={locked ? undefined : onValueChange}
          disabled={locked}
        >
          <SelectTrigger
            id={id}
            className={`${errors[id] ? "border-red-500" : ""} ${
              locked ? "bg-muted cursor-not-allowed opacity-90" : ""
            }`}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>{items}</SelectContent>
        </Select>
        {errors[id] && <p className="text-red-500 text-sm">{errors[id]}</p>}
      </div>
    );
  };

  const handleClose = () => {
    setForm(initialForm);
    setErrors({});
    setEditMode("single");
    setCancelReason("");
    setCancelMode("single");
    setShowCancelDialog(false);
    setIsSaving(false);
    onClose?.();
  };
  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCompletedLimitedEdit
                ? "Edit Completed Session"
                : editingSession
                  ? "Edit Session"
                  : "Add New Session"}
            </DialogTitle>
            <DialogDescription>
              {isCompletedLimitedEdit
                ? "This session is completed. You can change time, location, supervising provider, and billing code."
                : `Fill in the details for the therapy session. Times are shown in your local timezone (${userTimezone}).`}
            </DialogDescription>
          </DialogHeader>

          {editingSession &&
            !isCompletedLimitedEdit &&
            editingSession.recurring &&
            editingSession.recurring !== "No" && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <Label className="text-base font-semibold mb-3 block">
                    Edit Mode
                  </Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editMode"
                        value="single"
                        checked={editMode === "single"}
                        onChange={(e) => setEditMode(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>Edit this session only</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editMode"
                        value="recurring"
                        checked={editMode === "recurring"}
                        onChange={(e) => setEditMode(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>Edit all recurring sessions</span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

          <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-teal-600" />
                      Appointment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderSelectWithError(
                        "clientId",
                        "Client *",
                        form.clientId,
                        (v) => {
                          setField("clientId", v);
                          setField("authId", "");
                          setField("authCode", "");
                        },
                        clientOptions
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          )),
                        "Select client"
                      )}
                      {renderSelectWithError(
                        "provider",
                        "Provider *",
                        form.provider,
                        (id) => {
                          const selected = staff.find((s) => s.id === id);
                          setField("provider", id);
                          setField(
                            "providerName",
                            selected ? selected.fullName : ""
                          );
                        },
                        staff
                          .sort((a, b) => a.fullName.localeCompare(b.fullName))
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.fullName} ({s.staffType})
                            </SelectItem>
                          )),
                        "Select provider"
                      )}
                    </div>
                    {renderSelectWithError(
                      "supervisingProvider",
                      `Supervising Provider`,
                      form.supervisingProvider,
                      (id) => {
                        const selected = staff.find((s) => s.id === id);
                        setField("supervisingProvider", id);
                        setField(
                          "supervisingProviderName",
                          selected ? selected.fullName : ""
                        );
                      },
                      (() => {
                        const availableSupervisors = staff.filter(
                          (s) =>
                            s.id !== form.provider &&
                            s.status === "Active" &&
                            s.archived !== "1"
                        );

                        if (availableSupervisors.length === 0) {
                          return [
                            <SelectItem
                              key="not-available"
                              value="not-available"
                              disabled
                            >
                              No other staff available
                            </SelectItem>,
                          ];
                        }

                        return availableSupervisors
                          .sort((a, b) => a.fullName.localeCompare(b.fullName))
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.fullName} ({s.staffType})
                            </SelectItem>
                          ));
                      })(),
                      "Select supervising provider"
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderInputWithError(
                        "startDateTime",
                        `Start Date & Time *`,
                        form.startDateTime,
                        (e) => setField("startDateTime", e.target.value),
                        { type: "datetime-local" }
                      )}
                      {renderSelectWithError(
                        "startTZ",
                        "Start Time Zone *",
                        form.startTZ,
                        (v) => setField("startTZ", v),
                        TIME_ZONES.sort((a, b) => a.localeCompare(b)).map(
                          (tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz} {tz === userTimezone ? "(You)" : ""}
                            </SelectItem>
                          )
                        )
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderInputWithError(
                        "endDateTime",
                        `End Date & Time *`,
                        form.endDateTime,
                        (e) => setField("endDateTime", e.target.value),
                        { type: "datetime-local" }
                      )}
                      {renderSelectWithError(
                        "endTZ",
                        "End Time Zone *",
                        form.endTZ,
                        (v) => setField("endTZ", v),
                        TIME_ZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz} {tz === userTimezone ? "(You)" : ""}
                          </SelectItem>
                        ))
                      )}
                    </div>
                    {!isCompletedLimitedEdit && (
                    <Card className="bg-slate-50/50">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Repeat className="h-5 w-5 text-teal-600" />
                          Recurring Appointment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {renderSelectWithError(
                          "recurring",
                          "Repeats",
                          form.recurring,
                          (v) => setField("recurring", v),
                          [
                            <SelectItem key="no" value="No">
                              Does Not Repeat
                            </SelectItem>,
                            <SelectItem key="yes" value="Repeats">
                              Repeats
                            </SelectItem>,
                          ]
                        )}

                        {form.recurring === "Repeats" && (
                          <div className="space-y-4 pl-4 border-l-2 border-teal-200">
                            {renderSelectWithError(
                              "repeatFrequency",
                              "Repeat Frequency",
                              form.repeatFrequency === "Weekly" &&
                                form.repeatOn.toString() ===
                                  "Mon,Tue,Wed,Thu,Fri"
                                ? "Every Weekday"
                                : form.repeatFrequency,
                              handleRepeatFrequencyChange,
                              [
                                <SelectItem key="daily" value="Daily">
                                  Daily
                                </SelectItem>,
                                <SelectItem
                                  key="weekdays"
                                  value="Every Weekday"
                                >
                                  Every Weekday (Mon-Fri)
                                </SelectItem>,
                                <SelectItem key="weekly" value="Weekly">
                                  Weekly
                                </SelectItem>,
                                <SelectItem key="biweekly" value="Biweekly">
                                  Biweekly
                                </SelectItem>,
                                <SelectItem key="monthly" value="Monthly">
                                  Monthly
                                </SelectItem>,
                              ]
                            )}

                            {form.repeatFrequency === "Weekly" && (
                              <div className="space-y-1">
                                <Label>Repeats On</Label>
                                <ToggleGroup
                                  type="multiple"
                                  value={form.repeatOn}
                                  onValueChange={(v) => setField("repeatOn", v)}
                                  className="justify-start gap-1"
                                >
                                  {[
                                    "Sun",
                                    "Mon",
                                    "Tue",
                                    "Wed",
                                    "Thu",
                                    "Fri",
                                    "Sat",
                                  ].map((day, i) => (
                                    <ToggleGroupItem
                                      key={`${day}-${i}`}
                                      value={day}
                                      aria-label={`Toggle ${day}`}
                                      className="data-[state=on]:bg-teal-600 data-[state=on]:text-white"
                                    >
                                      {day}
                                    </ToggleGroupItem>
                                  ))}
                                </ToggleGroup>
                                {errors.repeatOn && (
                                  <p className="text-red-500 text-sm">
                                    {errors.repeatOn}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                              {renderSelectWithError(
                                "ends",
                                "Ends",
                                form.ends,
                                (v) => setField("ends", v),
                                [
                                  <SelectItem key="never" value="Never">
                                    Never
                                  </SelectItem>,
                                  <SelectItem key="on" value="On">
                                    On a specific date
                                  </SelectItem>,
                                  <SelectItem key="after" value="After">
                                    After a number of occurrences
                                  </SelectItem>,
                                ]
                              )}

                              {form.ends === "On" &&
                                renderInputWithError(
                                  "endDate",
                                  "End Date",
                                  form.endDate,
                                  (e) => setField("endDate", e.target.value),
                                  { type: "date" }
                                )}
                              {form.ends === "After" &&
                                renderInputWithError(
                                  "endAfterOccurrences",
                                  "Occurrences",
                                  form.endAfterOccurrences,
                                  (e) =>
                                    setField(
                                      "endAfterOccurrences",
                                      e.target.value
                                    ),
                                  { type: "number", min: 1 }
                                )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    )}
                    {renderSelectWithError(
                      "authId",
                      "Billing Code *",
                      form.authId || "",
                      (v) => {
                        if (v === "no-auth") {
                          setField("authId", "");
                          setField("authCode", "");
                          return;
                        }
                        setField("authId", v);
                        const selected = selectedClient?.authorizations?.find(
                          (a) =>
                            String(a.auth_id ?? a.id) === String(v)
                        );
                        setField(
                          "authCode",
                          selected ? authorizationBillingCodeLabel(selected) : ""
                        );
                      },
                      selectedClient?.authorizations?.length
                        ? selectedClient.authorizations
                            .filter(isActiveAuthorization)
                            .map((a) => {
                              const pk = String(a.auth_id ?? a.id);
                              return (
                                <SelectItem key={pk} value={pk}>
                                  {authorizationBillingCodeLabel(a)}
                                </SelectItem>
                              );
                            })
                        : [
                            <SelectItem key="no-auth" value="no-auth" disabled>
                              No Billing code for this client
                            </SelectItem>,
                          ],
                      selectedClient
                        ? "Select Billing code"
                        : "Select client first"
                    )}

                    {renderSelectWithError(
                      "locationAddress",
                      "Location Address *",
                      form.locationAddress || undefined,
                      (v) => {
                        setField("locationAddress", v);
                        const selectedAddress = locationSelectOptions.find(
                          (addr) => addr.value === v
                        );
                        setField(
                          "placeOfService",
                          selectedAddress?.service_location ||
                            form.placeOfService ||
                            ""
                        );
                      },
                      locationSelectOptions.length > 0
                        ? locationSelectOptions.map((addr) => (
                            <SelectItem
                              key={`${selectedClient?.id ?? "session"}_${addr.id}`}
                              value={addr.value}
                            >
                              {addr.service_location
                                ? `${addr.service_location}: ${addr.value}`
                                : addr.value}
                            </SelectItem>
                          ))
                        : [
                            <SelectItem
                              key="no-address"
                              value="no-address"
                              disabled
                            >
                              No address available
                            </SelectItem>,
                          ],
                      selectedClient ? "Select location" : "Select client first"
                    )}
                    <Card className="bg-slate-50/50">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">Hours</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="scheduledHours">
                              Scheduled Hours
                            </Label>
                            <Input
                              id="scheduledHours"
                              type="number"
                              step="0.25"
                              min="0"
                              value={form.scheduledHours}
                              readOnly
                            />
                            <p className="text-xs text-muted-foreground">
                              Auto-calculated from Start/End.
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="renderedHours">
                              Rendered Hours
                            </Label>
                            <Input
                              id="renderedHours"
                              type="number"
                              step="0.25"
                              min="0"
                              value={form.renderedHours}
                              onChange={(e) =>
                                setField("renderedHours", e.target.value)
                              }
                              readOnly={isCompletedLimitedEdit}
                              disabled={isCompletedLimitedEdit}
                              className={
                                isCompletedLimitedEdit
                                  ? "bg-muted cursor-not-allowed opacity-90"
                                  : ""
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              Hours that are fully rendered (notes complete +
                              client signed).
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    {/* Quick Note — inline in the scheduling form */}
                    <Card className="bg-slate-50/50">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4 text-teal-600" />
                          Quick Note
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="service-type">Service type</Label>
                          <select
                            id="service-type"
                            className={cn(
                              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              isCompletedLimitedEdit &&
                                "bg-muted cursor-not-allowed opacity-90"
                            )}
                            value={
                              form.serviceType === "Direct"
                                ? "Direct"
                                : "Indirect"
                            }
                            disabled={isCompletedLimitedEdit}
                            onChange={(e) =>
                              setField("serviceType", e.target.value)
                            }
                          >
                            <option value="Direct">Direct</option>
                            <option value="Indirect">Indirect</option>
                          </select>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-medium text-foreground/80">Direct</span>
                            {" — "}
                            face-to-face client service (counts in session log /
                            resource hours).{" "}
                            <span className="font-medium text-foreground/80">Indirect</span>
                            {" — "}
                            non–face-to-face work (e.g. documentation or
                            coordination); excluded from session log.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exclude-session">Exclude session</Label>
                          <select
                            id="exclude-session"
                            className={cn(
                              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              !canEditExcludeSession &&
                                "bg-muted cursor-not-allowed opacity-90"
                            )}
                            value={form.excludeSession === "Yes" ? "Yes" : "No"}
                            disabled={!canEditExcludeSession}
                            onChange={(e) =>
                              setField("excludeSession", e.target.value)
                            }
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <Textarea
                          rows={3}
                          value={form.quickNote}
                          onChange={(e) => setField("quickNote", e.target.value)}
                          placeholder="Add a quick note for this session..."
                          readOnly={isCompletedLimitedEdit}
                          disabled={isCompletedLimitedEdit}
                          className={
                            isCompletedLimitedEdit
                              ? "bg-muted cursor-not-allowed opacity-90"
                              : ""
                          }
                        />
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>

            <div className="flex justify-between pt-4">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                {editingSession && !isCompletedLimitedEdit && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowCancelDialog(true)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Cancel Session
                  </Button>
                )}
              </div>
              <Button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700"
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving…"
                  : isCompletedLimitedEdit
                    ? "Save Changes"
                    : editingSession
                      ? "Update Session"
                      : "Add Session"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelDialog} onOpenChange={(open) => {
        if (isCancelling) return;
        setShowCancelDialog(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this session? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {editingSession &&
            editingSession.recurring &&
            editingSession.recurring !== "No" && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <Label className="text-base font-semibold mb-3 block">
                    Cancel Mode
                  </Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="cancelMode"
                        value="single"
                        checked={cancelMode === "single"}
                        onChange={(e) => setCancelMode(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>Cancel this session only</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="cancelMode"
                        value="recurring"
                        checked={cancelMode === "recurring"}
                        onChange={(e) => setCancelMode(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>Cancel all recurring sessions</span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

          <div className="space-y-2">
            <Label htmlFor="cancelReason">Cancellation Reason *</Label>
            <Textarea
              id="cancelReason"
              placeholder="Please provide a reason for cancelling this session..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              disabled={isCancelling}
            />
          </div>

          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={isCancelling}>Keep Session</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSession}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCancelling ? "Cancelling…" : "Cancel Session"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
