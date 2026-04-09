"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TrialsPanel from "./TrialsPanel";
import SkillAcquisitionPanel from "./SkillAcquisitionPanel";
import BehaviorReductionPanel from "./BehaviorReductionPanel";

export default function DataCollectionPanel({
  loading,
  client,
  sessionDate,
  setSessionDate,
  targets,
  selectedTarget,
  setSelectedTarget,
  selectedTargetData,
  trials,
  currentTrialOutcome,
  setCurrentTrialOutcome,
  onSaveTrial,
  onDeletePreviousTrial,
  clientDomains,
  clientPrograms,
  clientTargets,
  sessionNotes,
  setSessionNotes,
}) {
  return (
    <Tabs defaultValue="trials" className="w-full">
      <TabsList className="flex flex-wrap justify-start gap-2">
        <TabsTrigger
          value="trials"
          className="data-[state=active]:bg-teal-600 data-[state=active]:text-white"
        >
          Trials
        </TabsTrigger>
        <TabsTrigger
          value="skill"
          className="data-[state=active]:bg-teal-600 data-[state=active]:text-white"
        >
          Skill Acquisition
        </TabsTrigger>
        <TabsTrigger
          value="behavior"
          className="data-[state=active]:bg-teal-600 data-[state=active]:text-white"
        >
          Behavior Reduction
        </TabsTrigger>
      </TabsList>

      <TabsContent value="trials" className="space-y-4 mt-4">
        <TrialsPanel
          loading={loading}
          sessionDate={sessionDate}
          setSessionDate={setSessionDate}
          targets={targets}
          selectedTarget={selectedTarget}
          setSelectedTarget={setSelectedTarget}
          selectedTargetData={selectedTargetData}
          trials={trials}
          currentTrialOutcome={currentTrialOutcome}
          setCurrentTrialOutcome={setCurrentTrialOutcome}
          onSaveTrial={onSaveTrial}
          onDeletePreviousTrial={onDeletePreviousTrial}
        />
      </TabsContent>

      <TabsContent value="skill" className="space-y-6 mt-4">
        <SkillAcquisitionPanel
          client={client}
          clientDomains={clientDomains}
          clientPrograms={clientPrograms}
          clientTargets={clientTargets}
          sessionNotes={sessionNotes}
          setSessionNotes={setSessionNotes}
        />
      </TabsContent>

      <TabsContent value="behavior" className="space-y-6 mt-4">
        <BehaviorReductionPanel sessionNotes={sessionNotes} setSessionNotes={setSessionNotes} />
      </TabsContent>
    </Tabs>
  );
}


