"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "./tabs/OverviewTab";
import SoapEntryTab from "./tabs/SoapEntryTab";
import ClinicalNotesTab from "./tabs/ClinicalNotesTab";
import CodesTab from "./tabs/CodesTab";
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
}) {
  const [showEmployeeSignatureDialog, setShowEmployeeSignatureDialog] = useState(false);
  const [showGuardianSignatureDialog, setShowGuardianSignatureDialog] = useState(false);

  return (
    <>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap justify-start gap-2">
          {[
            { value: "overview", label: "Overview" },
            { value: "soap-entry", label: "SOAP Entry" },
            { value: "clinical", label: "Clinical Notes" },
            { value: "codes", label: "Codes" },
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

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            client={client}
            sessionDate={sessionDate}
            sessionData={sessionData}
            sessionNotes={sessionNotes}
          />
        </TabsContent>

        <TabsContent value="soap-entry" className="mt-4">
          <SoapEntryTab sessionDate={sessionDate} sessionNotes={sessionNotes} setSessionNotes={setSessionNotes} />
        </TabsContent>

        <TabsContent value="clinical" className="mt-4">
          <ClinicalNotesTab sessionNotes={sessionNotes} setSessionNotes={setSessionNotes} />
        </TabsContent>

        <TabsContent value="codes" className="mt-4">
          <CodesTab sessionNotes={sessionNotes} setSessionNotes={setSessionNotes} />
        </TabsContent>

        <TabsContent value="signatures" className="mt-4 space-y-6">
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
        onClose={onClose}
        onSave={onSave}
        onComplete={onComplete}
        sessionNotes={sessionNotes}
        openEmployeeSignature={() => setShowEmployeeSignatureDialog(true)}
        openGuardianSignature={() => setShowGuardianSignatureDialog(true)}
      />
    </>
  );
}


