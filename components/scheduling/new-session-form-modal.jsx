"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Users, Clock, FileText, Repeat } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDispatch, useSelector } from "react-redux";
import { fetchClients } from "@/app/store/clientSlice";

// --- Constants ---
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
  "Asia/Kolkata",
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
  repeatOn: [], // For weekly repeats: 'S', 'M', 'T', 'W', 'T', 'F', 'S'
  ends: "Never", // 'Never', 'On', 'After'
  endDate: "",
  endAfterOccurrences: 1,
  placeOfService: "Clinic",
  locationAddress: "",
  quickNote: "",
  startDateTime: "",
  startTZ: "",
  endDateTime: "",
  endTZ: "",
  authCode: "",
};

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

// --- Helper Functions ---
const getLocalTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// const convertToUserTimezone = (utcDateString, userTimezone) => {
//   if (!utcDateString || !userTimezone) return "";
//   try {
//     const utcDate = new Date(utcDateString + " UTC");
//     const userDate = new Date(
//       utcDate.toLocaleString("en-US", { timeZone: userTimezone })
//     );
//     const year = userDate.getFullYear();
//     const month = String(userDate.getMonth() + 1).padStart(2, "0");
//     const day = String(userDate.getDate()).padStart(2, "0");
//     const hours = String(userDate.getHours()).padStart(2, "0");
//     const minutes = String(userDate.getMinutes()).padStart(2, "0");
//     return `${year}-${month}-${day}T${hours}:${minutes}`;
//   } catch (error) {
//     console.error("Error converting UTC to user timezone:", error);
//     return "";
//   }
// };

const convertToUserTimezone = (utcDateString, userTimezone) => {
  if (!utcDateString || !userTimezone) return "";
  try {
    // Ensure the date is parsed as UTC, even if 'Z' is missing
    const dateStr = utcDateString.endsWith("Z")
      ? utcDateString
      : utcDateString.replace(" ", "T") + "Z";
    const utcDate = new Date(dateStr);

    if (isNaN(utcDate)) {
      // Handle invalid date strings gracefully
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

// --- Main Component ---
export default function NewSessionFormModal({
  isOpen,
  onClose,
  onSave,
  editingSession = null,
  selectedDate = null,
}) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("scheduling");
  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [userTimezone, setUserTimezone] = useState("");
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchClients());
  }, [dispatch]);
  const clients = useSelector((state) => state.clients?.items || []);

  const selectedProvider = staff.find((s) => s.id === form.provider);
  const isSupervisionRequired = ["rbt", "bt"].includes(
    selectedProvider?.staffType?.toLowerCase()
  );

  const tabOrder = ["scheduling", "notes"];

  useEffect(() => {
    const detectedTimezone = getLocalTimezone();
    setUserTimezone(detectedTimezone);
  }, []);

  useEffect(() => {
    if (!isOpen || staff.length > 0) return;
    const fetchStaff = async () => {
      setLoadingStaff(true);
      try {
        const res = await fetch(`${baseUrl}/staff.php`);
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

  // useEffect(() => {
  //   if (!isOpen) return;

  //   if (editingSession) {
  //     setForm({
  //       ...initialForm,
  //       ...editingSession,
  //       clientId: editingSession.clientId || "",
  //       provider: editingSession.providerId || "",
  //       supervisingProvider: editingSession.supervisingProviderId || "",
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
  //         userTimezone
  //       ),
  //       endDateTime: convertToUserTimezone(
  //         editingSession.endDateTime,
  //         userTimezone
  //       ),
  //       startTZ: userTimezone,
  //       endTZ: userTimezone,
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

  // useEffect(() => {
  //   if (!isOpen) return;

  //   // Check for userTimezone to prevent race conditions
  //   if (editingSession && userTimezone) {
  //     setForm({
  //       ...initialForm,
  //       ...editingSession,
  //       clientId: editingSession.clientId || "",
  //       provider: editingSession.providerId || "",
  //       supervisingProvider: editingSession.supervisingProviderId || "",
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
  //         userTimezone
  //       ),
  //       endDateTime: convertToUserTimezone(
  //         editingSession.endDateTime,
  //         userTimezone
  //       ),
  //       startTZ: userTimezone,
  //       endTZ: userTimezone,
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

  useEffect(() => {
    if (!isOpen) return;

    if (editingSession && userTimezone) {
      setForm({
        ...initialForm,
        ...editingSession,
        clientId: editingSession.clientId || "",
        provider: editingSession.providerId || "",
        supervisingProvider: editingSession.supervisingProviderId || "",
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
        // Preserve the timezone from the session or default to user's timezone
        startTZ: editingSession.startTZ || userTimezone,
        endTZ: editingSession.endTZ || userTimezone,
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
    setActiveTab("scheduling");
  }, [isOpen, editingSession, selectedDate, userTimezone]);

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        id: c.client_id,
        name: [c.first_name, c.middle_name, c.last_name]
          .filter(Boolean)
          .join(" "),
        authorizations: Array.isArray(c.authorizations) ? c.authorizations : [],
        address: [
          c.address_line_1,
          c.address_line_2,
          c.city,
          c.state,
          c.zipcode,
          c.country,
        ]
          .filter(Boolean)
          .join(", "),
      })),
    [clients]
  );

  const selectedClient = useMemo(
    () => clientOptions.find((c) => c.id === form.clientId) || null,
    [clientOptions, form.clientId]
  );

  useEffect(() => {
    if (!isSupervisionRequired && form.supervisingProvider) {
      setField("supervisingProvider", "");
    }
  }, [form.provider, isSupervisionRequired]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const handleRepeatFrequencyChange = (value) => {
    if (value === "Every Weekday") {
      setForm((prev) => ({
        ...prev,
        repeatFrequency: "Weekly", // API expects "Weekly"
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
    if (
      form.startDateTime &&
      form.endDateTime &&
      new Date(form.endDateTime) <= new Date(form.startDateTime)
    ) {
      e.endDateTime = "End must be after Start";
    }
    if (isSupervisionRequired && !form.supervisingProvider) {
      e.supervisingProvider = `Required for ${selectedProvider?.staffType} provider`;
    }
    if (!form.authCode) e.authCode = "Required";

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

  const handleNextClick = (e) => {
    e.preventDefault();
    if (!validateSchedulingTab()) {
      setActiveTab("notes");
    } else {
      toast.error("Please fix errors before proceeding.");
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (validateSchedulingTab()) {
      toast.error("Please fix errors before submitting.");
      return;
    }

    const payload = {
      clientId: form.clientId,
      clientName: selectedClient?.name || "Unknown",
      provider: form.provider,
      providerName: form.providerName || "",

      startDateTime: convertToUTC(form.startDateTime, form.startTZ),
      endDateTime: convertToUTC(form.endDateTime, form.endTZ),
      startTZ: form.startTZ,
      endTZ: form.endTZ,
      authCode: form.authCode,
      placeOfService: form.placeOfService,
      locationAddress: form.locationAddress,
      quickNote: form.quickNote,
      status: "upcoming",
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
      // recurring:"No"
    };

    if (form.supervisingProvider) {
      payload.supervisingProvider = form.supervisingProvider;
      payload.supervisingProviderName = form.supervisingProviderName || "";
    }
    if (editingSession?.sessionId)
      payload.session_id = editingSession.sessionId;

    try {
      const res = await fetch(`${baseUrl}/add-session.php`, {
        method: editingSession?.sessionId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          editingSession ? "Session updated!" : "Session scheduled!"
        );
        onSave?.({
          ...payload,
          sessionId: data.session_id || editingSession?.sessionId,
        });
        handleClose();
      } else {
        toast.error(
          data.error || `Failed to save session. ${data.message || ""}`
        );
      }
    } catch (err) {
      toast.error("A server error occurred during submission.");
    }
  };

  const renderInputWithError = (id, label, value, onChange, props = {}) => (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={onChange}
        className={errors[id] ? "border-red-500" : ""}
        {...props}
      />
      {errors[id] && <p className="text-red-500 text-sm">{errors[id]}</p>}
    </div>
  );

  const renderSelectWithError = (
    id,
    label,
    value,
    onValueChange,
    items,
    placeholder = "Select..."
  ) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={errors[id] ? "border-red-500" : ""}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{items}</SelectContent>
      </Select>
      {errors[id] && <p className="text-red-500 text-sm">{errors[id]}</p>}
    </div>
  );

  const handleClose = () => {
    setForm(initialForm);
    setErrors({});
    onClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingSession ? "Edit Session" : "Add New Session"}
          </DialogTitle>
          <DialogDescription>
            Fill in the details for the therapy session. Times are shown in your
            local timezone ({userTimezone}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger
                value="scheduling"
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Scheduling
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scheduling">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-teal-600" />
                    Scheduling Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderSelectWithError(
                      "clientId",
                      "Client *",
                      form.clientId,
                      (v) => setField("clientId", v),
                      clientOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      )),
                      "Select client"
                    )}
                    {renderSelectWithError(
                      "provider",
                      "Provider *",
                      form.provider, // still keeps the ID
                      (id) => {
                        const selected = staff.find((s) => s.id === id);
                        setField("provider", id); // store ID
                        setField(
                          "providerName",
                          selected ? selected.fullName : ""
                        ); // store Name
                      },
                      staff.map((s) => (
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
                      // Simple filter: All other active staff excluding the selected provider
                      const availableSupervisors = staff.filter(
                        (s) =>
                          s.id !== form.provider &&
                          s.status === "Active" &&
                          s.archived !== "1"
                      );

                      // If no options, show a message
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

                      return availableSupervisors.map((s) => (
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
                      TIME_ZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz} {tz === userTimezone ? "(You)" : ""}
                        </SelectItem>
                      ))
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
                  {/* Commenting this for prod */}
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
                              form.repeatOn.toString() === "Mon,Tue,Wed,Thu,Fri"
                              ? "Every Weekday"
                              : form.repeatFrequency,
                            handleRepeatFrequencyChange,
                            [
                              <SelectItem key="daily" value="Daily">
                                Daily
                              </SelectItem>,
                              <SelectItem key="weekdays" value="Every Weekday">
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

                  {renderSelectWithError(
                    "authCode",
                    "Billing Code *",
                    form.authCode,
                    (v) => setField("authCode", v),
                    selectedClient?.authorizations?.length
                      ? selectedClient.authorizations.map((a, i) => {
                          const code =
                            a.billing_codes?.trim() ||
                            a.authorization_number?.trim();
                          return (
                            <SelectItem key={`${code}-${i}`} value={code}>
                              {code}
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
                    form.locationAddress,
                    (v) => setField("locationAddress", v),
                    selectedClient
                      ? [
                          <SelectItem
                            key={selectedClient.id}
                            value={selectedClient.address}
                          >
                            {selectedClient.address}
                          </SelectItem>,
                        ]
                      : [],
                    selectedClient ? "Select location" : "Select client first"
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Label>Quick Note</Label>
                  <Textarea
                    rows={5}
                    value={form.quickNote}
                    onChange={(e) => setField("quickNote", e.target.value)}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {activeTab === "notes" ? (
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                {editingSession ? "Update Session" : "Add Session"}
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleNextClick}
              >
                Next
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
