"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, PenTool, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

export default function SessionNotesFooterActions({
  onClose,
  onSave,
  onComplete,
  sessionNotes,
  isFutureSessionDate = false,
  futureCompleteMessage = "",
  openEmployeeSignature,
  openGuardianSignature,
  className,
}) {
  return (
    <div className={cn("space-y-3 pt-4 border-t", className)}>
      {isFutureSessionDate && futureCompleteMessage ? (
        <p
          className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
          role="status"
        >
          {futureCompleteMessage}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 flex-wrap">
      <Button variant="outline" onClick={onClose}>
        CANCEL
      </Button>
      <Button
        variant="outline"
        className="border-teal-600 text-teal-700 hover:bg-teal-50"
        onClick={() => toast("Upload Documents: not implemented yet")}
      >
        <Upload className="h-4 w-4 mr-2" />
        UPLOAD DOCUMENTS
      </Button>
      <Button
        variant="outline"
        className="border-teal-600 text-teal-700 hover:bg-teal-50"
        onClick={() => {
          if (!sessionNotes.employeeSignature) openEmployeeSignature();
          else if (!sessionNotes.guardianSignature) openGuardianSignature();
          else toast.success("All signatures are complete");
        }}
      >
        <PenTool className="h-4 w-4 mr-2" />
        ADD SIGN
      </Button>
      <Button
        variant="outline"
        className="border-teal-600 text-teal-700 hover:bg-teal-50"
        onClick={onSave}
      >
        SAVE
      </Button>
      <Button
        onClick={onComplete}
        disabled={isFutureSessionDate}
        title={isFutureSessionDate ? futureCompleteMessage : undefined}
        className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        COMPLETE
      </Button>
      </div>
    </div>
  );
}


