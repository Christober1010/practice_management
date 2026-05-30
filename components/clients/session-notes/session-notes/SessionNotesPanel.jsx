"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "./tabs/OverviewTab";
import SoapEntryTab from "./tabs/SoapEntryTab";
import ClinicalNotesTab from "./tabs/ClinicalNotesTab";
import SignaturesTab from "./tabs/SignaturesTab";
import SessionNotesFooterActions from "./SessionNotesFooterActions";

export default function SessionNotesPanel({
  client,
  sessionDate,
  sessionData,
  sessionNotes,
  setSessionNotes,
  onSave,
  onComplete,
  onClose,
  isFutureSessionDate = false,
  futureCompleteMessage = "",
}) {
  const [showEmployeeSignatureDialog, setShowEmployeeSignatureDialog] = useState(false);
  const [showGuardianSignatureDialog, setShowGuardianSignatureDialog] = useState(false);

  return (
    <>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="sticky top-0 z-10 -mx-6 mb-5 flex flex-wrap justify-start gap-2 border-b border-slate-200 bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {[
            { value: "overview", label: "Overview" },
            { value: "soap-entry", label: "SOAP Entry" },
            { value: "clinical", label: "Clinical Notes" },
            { value: "signatures", label: "Signatures" },
          ].map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="data-[state=active]:bg-teal-600 data-[state=active]:text-white"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab
            client={client}
            sessionDate={sessionDate}
            sessionData={sessionData}
            sessionNotes={sessionNotes}
            setSessionNotes={setSessionNotes}
          />
        </TabsContent>

        <TabsContent value="soap-entry" className="mt-0">
          <SoapEntryTab sessionDate={sessionDate} sessionNotes={sessionNotes} setSessionNotes={setSessionNotes} />
        </TabsContent>

        <TabsContent value="clinical" className="mt-0">
          <ClinicalNotesTab sessionNotes={sessionNotes} setSessionNotes={setSessionNotes} />
        </TabsContent>

        <TabsContent value="signatures" className="mt-0 space-y-6">
          <SignaturesTab
            client={client}
            sessionData={sessionData}
            sessionNotes={sessionNotes}
            setSessionNotes={setSessionNotes}
            showEmployeeSignatureDialog={showEmployeeSignatureDialog}
            setShowEmployeeSignatureDialog={setShowEmployeeSignatureDialog}
            showGuardianSignatureDialog={showGuardianSignatureDialog}
            setShowGuardianSignatureDialog={setShowGuardianSignatureDialog}
          />
        </TabsContent>
      </Tabs>

      <SessionNotesFooterActions
        className="sticky bottom-0 z-10 -mx-6 mt-8 border-t border-slate-200 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        onClose={onClose}
        onSave={onSave}
        onComplete={onComplete}
        sessionNotes={sessionNotes}
        isFutureSessionDate={isFutureSessionDate}
        futureCompleteMessage={futureCompleteMessage}
        openEmployeeSignature={() => setShowEmployeeSignatureDialog(true)}
        openGuardianSignature={() => setShowGuardianSignatureDialog(true)}
      />
    </>
  );
}

