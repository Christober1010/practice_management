"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";
import ScheduleTrackerGrid from "./schedule-tracker-grid";
import ScheduleTrackerImport from "./schedule-tracker-import";
import SessionLogGrid from "./session-log-grid";
import InsuranceUtilizationView from "./insurance-utilization-view";
import MileageView from "./mileage-view";
import SessionNotesReportView from "./session-notes-report-view";
import DataCollectionReportView from "./data-collection-report-view";

export default function ReportsView({ initialTab = "sessionImport", userRole = null }) {
  const reloadGridRef = useRef(null);
  const [gridLoading, setGridLoading] = useState(false);
  const isInsuranceView = initialTab === "insuranceUtilization";
  const isSessionLog = initialTab === "sessionLog";
  const isSessionLogBilling = initialTab === "sessionLogBilling";
  const isMileage = initialTab === "mileage";
  const isSessionNotes = initialTab === "sessionNotes";
  const isDataCollection = initialTab === "dataCollection";

  const handleReload = useCallback(() => {
    reloadGridRef.current?.();
  }, []);

  const handleRegisterReload = useCallback((reload) => {
    reloadGridRef.current = reload;
  }, []);

  const title = isDataCollection
    ? "Data Collection Report"
    : isSessionNotes
      ? "Session Notes by Client and Appointment Date"
      : isMileage
        ? "Mileage Reimbursement"
        : isInsuranceView
          ? "Insurance Utilization"
          : isSessionLogBilling
            ? "Session Log-Billing"
            : isSessionLog
              ? "Session Log"
              : "Session Import";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">{title}</h2>
        </div>
      </div>

      {isDataCollection ? (
        <DataCollectionReportView />
      ) : isSessionNotes ? (
        <SessionNotesReportView />
      ) : isMileage ? (
        <MileageView userRole={userRole} />
      ) : isInsuranceView ? (
        <InsuranceUtilizationView />
      ) : isSessionLog || isSessionLogBilling ? (
        <>
          <div className="flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="border-slate-200"
              onClick={handleReload}
              disabled={gridLoading}
            >
              <RotateCw className={`h-4 w-4 mr-1.5 ${gridLoading ? "animate-spin" : ""}`} />
              Refresh data
            </Button>
          </div>
          <SessionLogGrid
            onRegisterReload={handleRegisterReload}
            onLoadingChange={setGridLoading}
            hideMiscAndDiff={isSessionLogBilling}
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="border-slate-200"
              onClick={handleReload}
              disabled={gridLoading}
            >
              <RotateCw className={`h-4 w-4 mr-1.5 ${gridLoading ? "animate-spin" : ""}`} />
              Refresh data
            </Button>
            <ScheduleTrackerImport
              onImported={handleReload}
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg"
            />
          </div>

          <ScheduleTrackerGrid
            onRegisterReload={handleRegisterReload}
            onLoadingChange={setGridLoading}
          />
        </>
      )}
    </div>
  );
}
