"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

const PEOPLE_PRESENT_OPTIONS = ["Client", "Parent/Caregiver", "RBT", "BCBA", "BCaBA", "Other"];
const SERVICE_LOCATION_OPTIONS = ["Home", "Clinic", "School", "Community", "Other"];

export default function SoapEntryTab({ sessionDate, sessionNotes, setSessionNotes }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-700" />
          SOAP Note Data Entry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="font-semibold">Date *</Label>
            <Input
              type="date"
              className="mt-1"
              value={sessionNotes.soapDate || sessionDate}
              onChange={(e) =>
                setSessionNotes((prev) => ({
                  ...prev,
                  soapDate: e.target.value,
                }))
              }
            />
          </div>
          <div />
          <div>
            <Label className="font-semibold">Start Time: *</Label>
            <Input
              type="time"
              className="mt-1"
              value={sessionNotes.startTime}
              onChange={(e) =>
                setSessionNotes((prev) => ({
                  ...prev,
                  startTime: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label className="font-semibold">End Time: *</Label>
            <Input
              type="time"
              className="mt-1"
              value={sessionNotes.endTime}
              onChange={(e) =>
                setSessionNotes((prev) => ({
                  ...prev,
                  endTime: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div>
          <Label className="font-semibold">Notes: *</Label>
          <Textarea
            className="mt-1"
            rows={4}
            value={sessionNotes.soapNotes}
            onChange={(e) =>
              setSessionNotes((prev) => ({
                ...prev,
                soapNotes: e.target.value,
              }))
            }
            placeholder="Enter notes..."
          />
        </div>

        <div>
          <Label className="font-semibold">People Present (select all that apply): *</Label>
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
                        const current = Array.isArray(prev.peoplePresent) ? prev.peoplePresent : [];
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="font-semibold">Parent/Caregiver Name: *</Label>
            <Input
              className="mt-1"
              value={sessionNotes.caregiverName}
              onChange={(e) =>
                setSessionNotes((prev) => ({
                  ...prev,
                  caregiverName: e.target.value,
                }))
              }
              placeholder="Enter parent/caregiver name"
            />
          </div>
          <div>
            <Label className="font-semibold">Service Location *</Label>
            <Select
              value={sessionNotes.serviceLocation || ""}
              onValueChange={(value) =>
                setSessionNotes((prev) => ({
                  ...prev,
                  serviceLocation: value,
                }))
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Please Select A Value" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_LOCATION_OPTIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="font-semibold">
            Administration of Activities and Measures, Scoring, Interpretation and Report Write Up: *
          </Label>
          <Textarea
            className="mt-1"
            rows={6}
            value={sessionNotes.administrationWriteUp}
            onChange={(e) =>
              setSessionNotes((prev) => ({
                ...prev,
                administrationWriteUp: e.target.value,
              }))
            }
            placeholder="Enter write up..."
          />
        </div>
      </CardContent>
    </Card>
  );
}


