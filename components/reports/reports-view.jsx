"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";
import ScheduleTrackerGrid from "./schedule-tracker-grid";
import ScheduleTrackerImport from "./schedule-tracker-import";
import InsuranceUtilizationView from "./insurance-utilization-view";

export default function ReportsView({ initialTab = "sessionImport" }) {
  const reloadGridRef = useRef(null);
  const [gridLoading, setGridLoading] = useState(false);
  const isInsuranceView = initialTab === "insuranceUtilization";

  const handleReload = useCallback(() => {
    reloadGridRef.current?.();
  }, []);

  const handleRegisterReload = useCallback((reload) => {
    reloadGridRef.current = reload;
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Reports</h2>
          <p className="text-slate-600 mt-1">
            {isInsuranceView
              ? "Insurance Utilization Analytics"
              : "Session Import (External)"}
          </p>
        </div>
      </div>

      {isInsuranceView ? (
        <InsuranceUtilizationView />
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
