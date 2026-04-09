"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, PenTool, Upload } from "lucide-react";
import toast from "react-hot-toast";

export default function SessionNotesFooterActions({
  onClose,
  onSave,
  onComplete,
  sessionNotes,
  openEmployeeSignature,
  openGuardianSignature,
}) {
  return (
    <div className="flex justify-end gap-2 pt-4 border-t">
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
      <Button onClick={onComplete} className="bg-teal-600 hover:bg-teal-700">
        <CheckCircle className="h-4 w-4 mr-2" />
        COMPLETE
      </Button>
    </div>
  );
}


