"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen } from "lucide-react";

import toast from "react-hot-toast";

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
  };
}

export default function SessionNotesModal({ isOpen, onClose, client }) {
  // Shared state (used across panels)
  const [loading, setLoading] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);

  // Trials / Targets
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [trials, setTrials] = useState([]);
  const [currentTrialOutcome, setCurrentTrialOutcome] = useState("");

  // Client modules (for Skill Acquisition UI)
  const [clientDomains, setClientDomains] = useState([]);
  const [clientPrograms, setClientPrograms] = useState([]);
  const [clientTargets, setClientTargets] = useState([]);

  // Session data (appointment metadata)
  const [sessionData, setSessionData] = useState(null);

  // Session Notes structured state
  const [sessionNotes, setSessionNotes] = useState({ ...INITIAL_SESSION_NOTES });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  const clientId = client?.id || client?.client_id || null;

  const timeHHMMFromIso = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
      setTargets([]);
      setSelectedTarget(null);
      setTrials([]);
      setCurrentTrialOutcome("");
      setSessionDate(new Date().toISOString().split("T")[0]);
      setClientDomains([]);
      setClientPrograms([]);
      setClientTargets([]);
      setSessionData(null);
      setSessionNotes({ ...INITIAL_SESSION_NOTES });
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
              String(sessionDate)
            )}`
          );
          const sd = await sessionRes.json();
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

        // Client modules (targets/programs/domains)
        const res = await fetch(
          `${baseUrl}/client-modules.php?client_id=${encodeURIComponent(String(clientId))}`
        );
        const data = await res.json();
        if (!data?.success) {
          toast.error(data?.message || "Failed to load client data");
          return;
        }

        const activities = data.data?.activities || data.data?.targets || [];
        const programs = data.data?.programs || [];
        const domains = data.data?.domains || [];

        setTargets(activities);
        setClientTargets(activities);
        setClientPrograms(programs);
        setClientDomains(domains);

        if (activities.length > 0) {
          setSelectedTarget(activities[0]);
        }

        // Prefill skill acquisition rows (only if empty)
        setSessionNotes((prev) => {
          if (prev.skillAcquisitionData?.length) return prev;
          if (!activities.length) return prev;
          const skillData = activities.map((target, idx) => ({
            id: Date.now() + idx,
            programName:
              programs.find((p) => String(p.id) === String(target.program_id))?.name ||
              programs.find((p) => String(p.id) === String(target.program_id))?.NAME ||
              "",
            targetName: target.name || target.NAME || "",
            value: "",
          }));
          return { ...prev, skillAcquisitionData: skillData };
        });
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("Failed to load client data");
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndClientData();
  }, [isOpen, clientId, sessionDate, baseUrl]);

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
      soapDate: prev.soapDate || sessionDate || "",
      startTime: prev.startTime || timeHHMMFromIso(sessionData?.start_utc),
      endTime: prev.endTime || timeHHMMFromIso(sessionData?.end_utc),
      caregiverName: prev.caregiverName || derivedCaregiver,
      serviceLocation: prev.serviceLocation || derivedLocation,
    }));
  }, [isOpen, sessionData, sessionDate, client]);

  // Load saved full session notes payload (by client + date)
  useEffect(() => {
    if (!isOpen || !clientId) return;

    const loadSavedSessionNotes = async () => {
      try {
        const res = await fetch(
          `${baseUrl}/session-notes.php?client_id=${encodeURIComponent(
            String(clientId)
          )}&session_date=${encodeURIComponent(String(sessionDate))}`
        );
        const data = await res.json();
        if (data?.success && data?.data?.session_notes) {
          setSessionNotes(normalizeSessionNotesPayload(data.data.session_notes));
        }
      } catch (err) {
        console.error("Failed to load saved session notes payload", err);
      }
    };

    loadSavedSessionNotes();
  }, [isOpen, clientId, sessionDate, baseUrl]);

  // Fetch trials for selected target + date
  useEffect(() => {
    if (!selectedTarget || !clientId) return;

    const fetchTrials = async () => {
      try {
        const res = await fetch(
          `${baseUrl}/session-notes.php?client_id=${encodeURIComponent(String(clientId))}&target_id=${encodeURIComponent(
            String(selectedTarget.id)
          )}&session_date=${encodeURIComponent(String(sessionDate))}`
        );
        const data = await res.json();
        if (data?.success) setTrials(data.data || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchTrials();
  }, [selectedTarget, clientId, sessionDate, baseUrl]);

  const selectedTargetData = useMemo(() => selectedTarget || null, [selectedTarget]);

  const handleSaveTrial = async () => {
    if (!currentTrialOutcome || !selectedTarget || !clientId) {
      toast.error("Please select a trial outcome");
      return;
    }

    try {
      const res = await fetch(`${baseUrl}/session-notes.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          target_id: selectedTarget.id,
          session_date: sessionDate,
          trial_outcome: currentTrialOutcome,
        }),
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed to save trial");

      toast.success("Trial saved successfully");
      setCurrentTrialOutcome("");

      // Refresh trials
      const refreshRes = await fetch(
        `${baseUrl}/session-notes.php?client_id=${encodeURIComponent(String(clientId))}&target_id=${encodeURIComponent(
          String(selectedTarget.id)
        )}&session_date=${encodeURIComponent(String(sessionDate))}`
      );
      const refreshData = await refreshRes.json();
      if (refreshData?.success) setTrials(refreshData.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save trial");
    }
  };

  const handleDeleteTrial = async (trialId) => {
    if (!confirm("Are you sure you want to delete this trial?")) return;

    try {
      const res = await fetch(`${baseUrl}/session-notes.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trialId }),
      });

      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed to delete trial");

      toast.success("Trial deleted successfully");

      // Refresh
      const refreshRes = await fetch(
        `${baseUrl}/session-notes.php?client_id=${encodeURIComponent(String(clientId))}&target_id=${encodeURIComponent(
          String(selectedTarget.id)
        )}&session_date=${encodeURIComponent(String(sessionDate))}`
      );
      const refreshData = await refreshRes.json();
      if (refreshData?.success) setTrials(refreshData.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete trial");
    }
  };

  const handleDeletePreviousTrial = () => {
    if (trials.length === 0) {
      toast.error("No trials to delete");
      return;
    }
    const lastTrial = trials[trials.length - 1];
    handleDeleteTrial(lastTrial.id);
  };

  const handleSaveSessionNotes = async ({ silent = false } = {}) => {
    try {
      if (!clientId) {
        toast.error("Missing client ID");
        return;
      }

      const res = await fetch(`${baseUrl}/session-notes.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          session_id: sessionData?.session_id || null,
          session_date: sessionDate,
          session_notes: sessionNotes,
        }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed to save session notes");
      if (!silent) toast.success("Session notes saved successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save session notes");
      throw err;
    }
  };

  const handleComplete = async () => {
    try {
      await handleSaveSessionNotes({ silent: true });
      toast.success("Session completed successfully");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to complete session");
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-600" />
            Session Notes - {client?.first_name} {client?.last_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="data-collection" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="data-collection">Data Collection</TabsTrigger>
            <TabsTrigger value="session-notes">Session Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="data-collection" className="mt-4">
            <DataCollectionPanel
              loading={loading}
              client={client}
              sessionDate={sessionDate}
              setSessionDate={setSessionDate}
              targets={targets}
              selectedTarget={selectedTarget}
              setSelectedTarget={setSelectedTarget}
              selectedTargetData={selectedTargetData}
              trials={trials}
              currentTrialOutcome={currentTrialOutcome}
              setCurrentTrialOutcome={setCurrentTrialOutcome}
              onSaveTrial={handleSaveTrial}
              onDeletePreviousTrial={handleDeletePreviousTrial}
              clientDomains={clientDomains}
              clientPrograms={clientPrograms}
              clientTargets={clientTargets}
              sessionNotes={sessionNotes}
              setSessionNotes={setSessionNotes}
            />
          </TabsContent>

          <TabsContent value="session-notes" className="mt-4">
            <SessionNotesPanel
              client={client}
              sessionDate={sessionDate}
              sessionData={sessionData}
              sessionNotes={sessionNotes}
              setSessionNotes={setSessionNotes}
              onSave={handleSaveSessionNotes}
              onComplete={handleComplete}
              onClose={onClose}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}


