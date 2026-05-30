"use client";

import { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CalendarDays } from "lucide-react";

import toast from "react-hot-toast";

import { getMahaverseAuthHeaders } from "@/lib/api-auth";
import {
  FUTURE_SESSION_COMPLETE_MESSAGE,
  isFutureSessionDateYmd,
} from "@/lib/session-notes-date";
import { behaviorsToSessionRows, mergeBehaviorSessionRows } from "@/lib/behavior-recording-types";
import DataCollectionPanel from "./data-collection/DataCollectionPanel";
import SessionNotesPanel from "./session-notes/SessionNotesPanel";

const INITIAL_SESSION_NOTES = {
  soapDate: "",
  startTime: "",
  endTime: "",
  soapNotes: "",
  peoplePresent: [],
  caregiverName: "",
  serviceLocation: "",
  administrationWriteUp: "",

  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  diagnosisCode: "",
  diagnosisDescription: "",
  serviceCodes: [],
  skillAcquisitionData: [],
  behaviorReductionData: [],
  behaviorRateSessionSeconds: 0,
  abcData: [],
  employeeSignature: null,
  guardianSignature: null,
  employeeSignatureDate: "",
  guardianSignatureDate: "",
  employeeName: "",
  guardianName: "",
};

function normalizeSessionNotesPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ...INITIAL_SESSION_NOTES };
  }
  return {
    ...INITIAL_SESSION_NOTES,
    ...payload,
    peoplePresent: Array.isArray(payload.peoplePresent) ? payload.peoplePresent : [],
    serviceCodes: Array.isArray(payload.serviceCodes) ? payload.serviceCodes : [],
    skillAcquisitionData: Array.isArray(payload.skillAcquisitionData)
      ? payload.skillAcquisitionData
      : [],
    behaviorReductionData: Array.isArray(payload.behaviorReductionData)
      ? payload.behaviorReductionData
      : [],
    abcData: Array.isArray(payload.abcData) ? payload.abcData : [],
  };
}

async function readJsonFromResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid server response (HTTP ${res.status})`);
  }
}

export default function SessionNotesModal({
  isOpen,
  onClose,
  client,
  linkedSessionDate = null,
  linkedSessionId = null,
  onSessionBillingFinalized,
}) {
  // Shared state (used across panels)
  const [loading, setLoading] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);

  // Client modules (for Skill Acquisition UI)
  const [clientDomains, setClientDomains] = useState([]);
  const [clientPrograms, setClientPrograms] = useState([]);
  const [clientTargets, setClientTargets] = useState([]);
  // Session data (appointment metadata)
  const [sessionData, setSessionData] = useState(null);

  // Session Notes structured state
  const [sessionNotes, setSessionNotes] = useState({ ...INITIAL_SESSION_NOTES });
  const [activeTab, setActiveTab] = useState("data-collection");
  const scrollContainerRef = useRef(null);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  const clientId = client?.id || client?.client_id || null;

  /** When opened from scheduling, use the calendar day immediately (before sessionDate state syncs). */
  const apiSessionDate = useMemo(
    () => (isOpen && linkedSessionDate ? linkedSessionDate : sessionDate),
    [isOpen, linkedSessionDate, sessionDate]
  );

  const isFutureSessionDate = useMemo(
    () => isFutureSessionDateYmd(apiSessionDate),
    [apiSessionDate]
  );

  const formattedSessionDate = useMemo(() => {
    if (!apiSessionDate) return "";
    try {
      return new Date(`${apiSessionDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return apiSessionDate;
    }
  }, [apiSessionDate]);

  const clientDisplayName = useMemo(
    () => `${client?.first_name || ""} ${client?.last_name || ""}`.trim() || "Client",
    [client]
  );

  const timeHHMMFromIso = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  useLayoutEffect(() => {
    if (isOpen && linkedSessionDate) {
      setSessionDate(linkedSessionDate);
    }
  }, [isOpen, linkedSessionDate]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
      setSessionDate(new Date().toISOString().split("T")[0]);
      setClientDomains([]);
      setClientPrograms([]);
      setClientTargets([]);
      setSessionData(null);
      setSessionNotes({ ...INITIAL_SESSION_NOTES });
      setActiveTab("data-collection");
    }
  }, [isOpen]);

  // Fetch session data + client modules for current date
  useEffect(() => {
    if (!isOpen || !clientId) return;

    const fetchSessionAndClientData = async () => {
      try {
        setLoading(true);

        // Session (appointment metadata)
        try {
          const sessionRes = await fetch(
            `${baseUrl}/add-session.php?client_id=${encodeURIComponent(String(clientId))}&date=${encodeURIComponent(
              String(apiSessionDate)
            )}`,
            { headers: getMahaverseAuthHeaders() }
          );
          const sd = await readJsonFromResponse(sessionRes);
          if (Array.isArray(sd) && sd.length > 0) {
            setSessionData(sd[0]);
          } else if (sd?.session_id) {
            setSessionData(sd);
          } else {
            setSessionData(null);
          }
        } catch (err) {
          setSessionData(null);
          console.log("No session found for date:", err);
        }

        // Client modules + saved session notes (single coordinated load)
        const [modulesRes, savedRes] = await Promise.all([
          fetch(
            `${baseUrl}/client-modules.php?client_id=${encodeURIComponent(String(clientId))}`,
            { headers: getMahaverseAuthHeaders() }
          ),
          fetch(
            `${baseUrl}/session-notes.php?client_id=${encodeURIComponent(
              String(clientId)
            )}&session_date=${encodeURIComponent(String(apiSessionDate))}`,
            { headers: getMahaverseAuthHeaders() }
          ),
        ]);

        const data = await readJsonFromResponse(modulesRes);
        if (!data?.success) {
          toast.error(data?.message || "Failed to load client data");
          return;
        }

        let savedNotesPayload = null;
        try {
          const savedData = await readJsonFromResponse(savedRes);
          if (savedData?.success && savedData?.data?.session_notes) {
            savedNotesPayload = savedData.data.session_notes;
          }
        } catch (err) {
          console.error("Failed to load saved session notes payload", err);
        }

        const activities = data.data?.activities || data.data?.targets || [];
        const programs = data.data?.programs || [];
        const domains = data.data?.domains || [];
        const behaviors = data.data?.behaviors || [];

        setClientTargets(activities);
        setClientPrograms(programs);
        setClientDomains(domains);
        setSessionNotes(() => {
          const base = savedNotesPayload
            ? normalizeSessionNotesPayload(savedNotesPayload)
            : { ...INITIAL_SESSION_NOTES };

          let next = base;
          if (!savedNotesPayload && activities.length) {
            const skillData = activities.map((target, idx) => {
              const program = programs.find(
                (p) => String(p.id) === String(target.program_id),
              );
              return {
                id: Date.now() + idx,
                programId: String(target.program_id || program?.id || ""),
                programName: program?.name || program?.NAME || "",
                targetId: String(target.id || ""),
                targetName: target.name || target.NAME || "",
                value: "",
              };
            });
            next = { ...next, skillAcquisitionData: skillData };
          }

          return {
            ...next,
            behaviorReductionData: mergeBehaviorSessionRows(behaviors, next.behaviorReductionData),
          };
        });
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("Failed to load client data");
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndClientData();
  }, [isOpen, clientId, apiSessionDate, baseUrl]);

  // Prefill SOAP entry fields (don’t clobber edits)
  useEffect(() => {
    if (!isOpen) return;

    const derivedCaregiver =
      (client?.parent_first_name && client?.parent_last_name
        ? `${client.parent_first_name} ${client.parent_last_name}`
        : "") || "";

    const derivedLocation =
      sessionData?.place_of_service ||
      client?.service_location ||
      client?.addresses?.[0]?.service_location ||
      "";

    setSessionNotes((prev) => ({
      ...prev,
      soapDate: prev.soapDate || apiSessionDate || "",
      startTime: prev.startTime || timeHHMMFromIso(sessionData?.start_utc),
      endTime: prev.endTime || timeHHMMFromIso(sessionData?.end_utc),
      caregiverName: prev.caregiverName || derivedCaregiver,
      serviceLocation: prev.serviceLocation || derivedLocation,
    }));
  }, [isOpen, sessionData, apiSessionDate, client]);

  const resolveSchedulingSessionId = () => {
    const raw = sessionData?.session_id ?? linkedSessionId;
    if (raw === null || raw === undefined || raw === "") return null;
    const s = String(raw).trim();
    if (!s || s.startsWith("temp-")) return null;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const handleSaveSessionNotes = async ({
    silent = false,
    completeSession = false,
    sessionNotesOverride = null,
  } = {}) => {
    try {
      if (!clientId) {
        const msg = "Missing client ID";
        if (!silent) toast.error(msg);
        throw new Error(msg);
      }

      const notesToSave = sessionNotesOverride ?? sessionNotes;
      const schedulingSid = resolveSchedulingSessionId();
      const payload = {
        client_id: clientId,
        session_id: schedulingSid ?? sessionData?.session_id ?? linkedSessionId ?? null,
        session_date: apiSessionDate,
        session_notes: notesToSave,
      };
      if (completeSession) {
        payload.complete_session = true;
        if (schedulingSid == null) {
          const msg =
            "This date has no linked schedule session (or the session id is invalid). Complete requires a real calendar session.";
          if (!silent) toast.error(msg);
          throw new Error(msg);
        }
        payload.session_id = schedulingSid;
      }

      const res = await fetch(`${baseUrl}/session-notes.php`, {
        method: "POST",
        headers: getMahaverseAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const data = await readJsonFromResponse(res);
      if (!data?.success) {
        if (data?.code === "future_session_date") {
          throw new Error(FUTURE_SESSION_COMPLETE_MESSAGE);
        }
        throw new Error(data?.message || "Failed to save session notes");
      }
      if (!silent) toast.success("Session notes saved successfully");
      return data;
    } catch (err) {
      console.error(err);
      if (!silent) toast.error(err?.message || "Failed to save session notes");
      throw err;
    }
  };

  const handleComplete = async () => {
    try {
      if (isFutureSessionDate) {
        toast.error(FUTURE_SESSION_COMPLETE_MESSAGE);
        return;
      }
      const data = await handleSaveSessionNotes({ silent: true, completeSession: true });
      const claimId = data?.data?.billing?.claim_id;
      toast.success(
        claimId ? `Session completed — ${claimId} (ready to bill)` : "Session completed — ready to bill"
      );
      onSessionBillingFinalized?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Failed to complete session");
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="shrink-0 border-b bg-background px-6 pb-0 pt-6 pr-12">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <BookOpen className="h-5 w-5 shrink-0 text-teal-600" />
                  Session Notes
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {clientDisplayName}
                  </Badge>
                  {formattedSessionDate && (
                    <Badge variant="outline" className="gap-1 font-normal">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formattedSessionDate}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {activeTab === "data-collection"
                  ? "Record skill acquisition and behaviors for this session."
                  : "Complete SOAP notes, clinical documentation, and signatures."}
              </p>
            </DialogHeader>

            <TabsList className="mt-4 grid w-full grid-cols-2">
              <TabsTrigger value="data-collection">Data Collection</TabsTrigger>
              <TabsTrigger value="session-notes">Session Notes</TabsTrigger>
            </TabsList>
          </div>

          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
          >
            <TabsContent value="data-collection" className="mt-0 focus-visible:outline-none">
              <DataCollectionPanel
                loading={loading}
                client={client}
                sessionDate={apiSessionDate}
                clientDomains={clientDomains}
                clientPrograms={clientPrograms}
                clientTargets={clientTargets}
                sessionNotes={sessionNotes}
                setSessionNotes={setSessionNotes}
                onPersistSessionNotes={(notes) =>
                  handleSaveSessionNotes({ silent: true, sessionNotesOverride: notes })
                }
                scrollContainerRef={scrollContainerRef}
              />
            </TabsContent>

            <TabsContent value="session-notes" className="mt-0 focus-visible:outline-none">
              <SessionNotesPanel
                client={client}
                sessionDate={sessionDate}
                sessionData={sessionData}
                sessionNotes={sessionNotes}
                setSessionNotes={setSessionNotes}
                onSave={handleSaveSessionNotes}
                onComplete={handleComplete}
                onClose={onClose}
                isFutureSessionDate={isFutureSessionDate}
                futureCompleteMessage={FUTURE_SESSION_COMPLETE_MESSAGE}
              />
            </TabsContent>
          </div>
        </Tabs>

      </DialogContent>
    </Dialog>
  );
}


