"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

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


