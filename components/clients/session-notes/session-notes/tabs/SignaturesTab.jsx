"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PenTool } from "lucide-react";
import toast from "react-hot-toast";
import SignaturePad from "@/components/ui/signature-pad";

export default function SignaturesTab({
  client,
  sessionData,
  sessionNotes,
  setSessionNotes,
  showEmployeeSignatureDialog,
  setShowEmployeeSignatureDialog,
  showGuardianSignatureDialog,
  setShowGuardianSignatureDialog,
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-purple-600" />
            SIGNATURE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Employee Signature</Label>
              {sessionNotes.employeeSignature ? (
                <div className="space-y-2">
                  <div className="border-2 border-slate-300 rounded-lg p-2 bg-white">
                    <img
                      src={sessionNotes.employeeSignature}
                      alt="Employee Signature"
                      className="max-w-full h-auto max-h-[150px] mx-auto"
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    <div className="font-medium">
                      {sessionNotes.employeeName || sessionData?.provider_name || "Employee"}
                    </div>
                    <div>Date: {sessionNotes.employeeSignatureDate}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEmployeeSignatureDialog(true)}
                    className="w-full"
                  >
                    <PenTool className="h-4 w-4 mr-2" />
                    Update Signature
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
                  <Button variant="outline" onClick={() => setShowEmployeeSignatureDialog(true)} className="w-full">
                    <PenTool className="h-4 w-4 mr-2" />
                    Add Employee Signature
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Guardian Signature</Label>
              {sessionNotes.guardianSignature ? (
                <div className="space-y-2">
                  <div className="border-2 border-slate-300 rounded-lg p-2 bg-white">
                    <img
                      src={sessionNotes.guardianSignature}
                      alt="Guardian Signature"
                      className="max-w-full h-auto max-h-[150px] mx-auto"
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    <div className="font-medium">
                      {sessionNotes.guardianName ||
                        (client?.parent_first_name && client?.parent_last_name
                          ? `${client.parent_first_name} ${client.parent_last_name}`
                          : "Guardian")}
                    </div>
                    <div>Date: {sessionNotes.guardianSignatureDate}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGuardianSignatureDialog(true)}
                    className="w-full"
                  >
                    <PenTool className="h-4 w-4 mr-2" />
                    Update Signature
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
                  <Button variant="outline" onClick={() => setShowGuardianSignatureDialog(true)} className="w-full">
                    <PenTool className="h-4 w-4 mr-2" />
                    Add Guardian Signature
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showEmployeeSignatureDialog} onOpenChange={setShowEmployeeSignatureDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee Name</Label>
              <Input
                value={sessionNotes.employeeName || sessionData?.provider_name || ""}
                onChange={(e) =>
                  setSessionNotes((prev) => ({
                    ...prev,
                    employeeName: e.target.value,
                  }))
                }
                placeholder="Enter employee name"
                className="mt-1"
              />
            </div>
            <SignaturePad
              onSave={(signatureData) => {
                setSessionNotes((prev) => ({
                  ...prev,
                  employeeSignature: signatureData,
                  employeeSignatureDate: new Date().toLocaleString(),
                }));
                setShowEmployeeSignatureDialog(false);
                toast.success("Employee signature saved");
              }}
              onClear={() => {
                setSessionNotes((prev) => ({
                  ...prev,
                  employeeSignature: null,
                  employeeSignatureDate: "",
                }));
              }}
              existingSignature={sessionNotes.employeeSignature}
              width={600}
              height={250}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuardianSignatureDialog} onOpenChange={setShowGuardianSignatureDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Guardian Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Guardian Name</Label>
              <Input
                value={
                  sessionNotes.guardianName ||
                  (client?.parent_first_name && client?.parent_last_name
                    ? `${client.parent_first_name} ${client.parent_last_name}`
                    : "")
                }
                onChange={(e) =>
                  setSessionNotes((prev) => ({
                    ...prev,
                    guardianName: e.target.value,
                  }))
                }
                placeholder="Enter guardian name"
                className="mt-1"
              />
            </div>
            <SignaturePad
              onSave={(signatureData) => {
                setSessionNotes((prev) => ({
                  ...prev,
                  guardianSignature: signatureData,
                  guardianSignatureDate: new Date().toLocaleString(),
                }));
                setShowGuardianSignatureDialog(false);
                toast.success("Guardian signature saved");
              }}
              onClear={() => {
                setSessionNotes((prev) => ({
                  ...prev,
                  guardianSignature: null,
                  guardianSignatureDate: "",
                }));
              }}
              existingSignature={sessionNotes.guardianSignature}
              width={600}
              height={250}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


