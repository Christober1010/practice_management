"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SOAP_NOTES_LOCKED_MESSAGE,
  SOAP_TEXT_FIELDS,
} from "@/lib/session-notes-soap";
import { cn } from "@/lib/utils";
import { FileText, Lock } from "lucide-react";

const PEOPLE_PRESENT_OPTIONS = ["Client", "Parent/Caregiver", "RBT", "BCBA", "BCaBA", "Other"];

export default function ClinicalNotesTab({
  sessionNotes,
  setSessionNotes,
  soapErrors = {},
  onClearSoapError,
  soapLocked = false,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-teal-600" />
          SESSION NOTES
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {soapLocked ? (
          <p
            className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
            role="status"
          >
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            {SOAP_NOTES_LOCKED_MESSAGE}
          </p>
        ) : null}
        <div>
          <Label className="font-semibold">
            People Present (select all that apply): *
          </Label>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            {PEOPLE_PRESENT_OPTIONS.map((opt) => {
              const checked = (sessionNotes.peoplePresent || []).includes(opt);
              return (
                <div key={opt} className="flex items-center gap-2">
                  <Checkbox
                    id={`people-${opt}`}
                    checked={checked}
                    disabled={soapLocked}
                    aria-invalid={Boolean(soapErrors.peoplePresent)}
                    onCheckedChange={(isChecked) => {
                      if (soapLocked) return;
                      setSessionNotes((prev) => {
                        const current = Array.isArray(prev.peoplePresent)
                          ? prev.peoplePresent
                          : [];
                        const next = Boolean(isChecked)
                          ? Array.from(new Set([...current, opt]))
                          : current.filter((v) => v !== opt);
                        return { ...prev, peoplePresent: next };
                      });
                      onClearSoapError?.("peoplePresent");
                    }}
                  />
                  <Label
                    htmlFor={`people-${opt}`}
                    className={cn("font-normal", soapLocked && "cursor-default text-slate-600")}
                  >
                    {opt}
                  </Label>
                </div>
              );
            })}
          </div>
          {soapErrors.peoplePresent ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {soapErrors.peoplePresent}
            </p>
          ) : null}
        </div>

        {SOAP_TEXT_FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key} className="font-semibold">
              {f.label} *
            </Label>
            <Textarea
              id={f.key}
              required
              readOnly={soapLocked}
              aria-invalid={Boolean(soapErrors[f.key])}
              aria-describedby={soapErrors[f.key] ? `${f.key}-error` : undefined}
              value={sessionNotes[f.key] || ""}
              onChange={(e) => {
                if (soapLocked) return;
                setSessionNotes((prev) => ({
                  ...prev,
                  [f.key]: e.target.value,
                }));
                onClearSoapError?.(f.key);
              }}
              className={cn(
                "mt-1",
                soapErrors[f.key] && "border-red-500",
                soapLocked && "cursor-default bg-slate-50"
              )}
              rows={3}
            />
            {soapErrors[f.key] ? (
              <p id={`${f.key}-error`} className="mt-1 text-sm text-red-600" role="alert">
                {soapErrors[f.key]}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
