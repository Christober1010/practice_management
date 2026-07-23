"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

const PEOPLE_PRESENT_OPTIONS = ["Client", "Parent/Caregiver", "RBT", "BCBA", "BCaBA", "Other"];

export default function ClinicalNotesTab({ sessionNotes, setSessionNotes }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-teal-600" />
          SESSION NOTES
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
                    onCheckedChange={(isChecked) => {
                      setSessionNotes((prev) => {
                        const current = Array.isArray(prev.peoplePresent)
                          ? prev.peoplePresent
                          : [];
                        const next = Boolean(isChecked)
                          ? Array.from(new Set([...current, opt]))
                          : current.filter((v) => v !== opt);
                        return { ...prev, peoplePresent: next };
                      });
                    }}
                  />
                  <Label htmlFor={`people-${opt}`} className="font-normal">
                    {opt}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>

        {[
          { key: "subjective", label: "Subjective *" },
          { key: "objective", label: "Objective *" },
          { key: "assessment", label: "Assessment *" },
          { key: "plan", label: "Plan *" },
        ].map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key} className="font-semibold">
              {f.label}
            </Label>
            <Textarea
              id={f.key}
              value={sessionNotes[f.key] || ""}
              onChange={(e) =>
                setSessionNotes((prev) => ({
                  ...prev,
                  [f.key]: e.target.value,
                }))
              }
              className="mt-1"
              rows={3}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
