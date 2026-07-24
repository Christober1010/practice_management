"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, ClipboardList, Clock, Table as TableIcon, X } from "lucide-react";
import toast from "react-hot-toast";
import { formatTime12hFromUTC } from "@/lib/time-utils";

export default function OverviewTab({
  client,
  sessionDate,
  sessionData,
  sessionNotes,
  setSessionNotes,
}) {
  const [newServiceCode, setNewServiceCode] = useState({
    serviceCode: "",
    modifiers: "",
    units: "",
    description: "",
  });

  /** Same timezone path as scheduling sticky cards (session TZ → browser → Chicago). */
  const appointmentTimezone = useMemo(
    () =>
      sessionData?.start_tz ||
      sessionData?.startTZ ||
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : null) ||
      "America/Chicago",
    [sessionData?.start_tz, sessionData?.startTZ]
  );

  const appointmentStartLabel = sessionData?.start_utc
    ? formatTime12hFromUTC(sessionData.start_utc, appointmentTimezone)
    : "N/A";
  const appointmentEndLabel = sessionData?.end_utc
    ? formatTime12hFromUTC(sessionData.end_utc, appointmentTimezone)
    : "N/A";
  const appointmentDateLabel = sessionData?.start_utc
    ? (() => {
        let iso = String(sessionData.start_utc);
        if (!iso.includes("T")) iso = iso.replace(" ", "T");
        if (!iso.endsWith("Z")) iso += "Z";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "N/A";
        return d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          timeZone: appointmentTimezone,
        });
      })()
    : sessionDate
      ? new Date(`${sessionDate}T12:00:00`).toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "N/A";

  const handleAddServiceCode = () => {
    if (!newServiceCode.serviceCode) {
      toast.error("Service code is required");
      return;
    }
    setSessionNotes((prev) => ({
      ...prev,
      serviceCodes: [...(prev.serviceCodes || []), { ...newServiceCode, id: Date.now() }],
    }));
    setNewServiceCode({ serviceCode: "", modifiers: "", units: "", description: "" });
  };

  const handleRemoveServiceCode = (id) => {
    setSessionNotes((prev) => ({
      ...prev,
      serviceCodes: (prev.serviceCodes || []).filter((sc) => sc.id !== id),
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            APPOINTMENT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <Label className="text-slate-500 text-xs">Organization Name</Label>
              <p className="font-medium mt-1">MAHA BEHAVIORAL HEALTH SERVICES, LLC</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Appointment Start Time</Label>
              <p className="font-medium mt-1">{appointmentStartLabel}</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Place of Service</Label>
              <p className="font-medium mt-1">
                {sessionData?.place_of_service || client?.service_location || "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Service Location</Label>
              <p className="font-medium mt-1">
                {sessionData?.location_address ||
                  (client?.addresses?.[0]
                    ? `${client.addresses[0].address_line_1 || ""}, ${
                        client.addresses[0].city || ""
                      }, ${client.addresses[0].state || ""}, ${
                        client.addresses[0].zipcode || ""
                      }`
                    : "N/A")}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Client Name</Label>
              <p className="font-medium mt-1">
                {client?.first_name} {client?.last_name}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Rendering Provider</Label>
              <p className="font-medium mt-1">
                {sessionData?.provider_name || sessionData?.rendering_provider_name || "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Appointment</Label>
              <p className="font-medium mt-1">
                {sessionData?.activity_type ||
                  "Adaptive Behavior Treatment by Protocol Modification"}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Appointment End Time</Label>
              <p className="font-medium mt-1">{appointmentEndLabel}</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Service Type</Label>
              <p className="font-medium mt-1">
                {sessionData?.service_type ||
                  sessionData?.serviceType ||
                  sessionData?.direct_or_indirect_service ||
                  "Indirect"}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Unit Billed</Label>
              <p className="font-medium mt-1">
                {sessionData?.scheduled_hours || sessionData?.rendered_hours || "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Supervising Clinician Name</Label>
              <p className="font-medium mt-1">
                {sessionData?.supervising_provider_name || "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Appointment Date</Label>
              <p className="font-medium mt-1">{appointmentDateLabel}</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Provider Name/Credentials</Label>
              <p className="font-medium mt-1">{sessionData?.provider_name || "N/A"}</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Payer Name</Label>
              <p className="font-medium mt-1">{client?.insurance || "N/A"}</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Session Duration (In Hrs)</Label>
              <p className="font-medium mt-1">
                {sessionData?.scheduled_hours || sessionData?.rendered_hours || "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
            DIAGNOSIS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Diagnosis Code</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Input
                    value={sessionNotes.diagnosisCode}
                    onChange={(e) =>
                      setSessionNotes((prev) => ({
                        ...prev,
                        diagnosisCode: e.target.value,
                      }))
                    }
                    placeholder="e.g., F84.0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={sessionNotes.diagnosisDescription}
                    onChange={(e) =>
                      setSessionNotes((prev) => ({
                        ...prev,
                        diagnosisDescription: e.target.value,
                      }))
                    }
                    placeholder="e.g., Autistic disorder"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-blue-600" />
            SERVICE CODES
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Code</TableHead>
                <TableHead>Modifiers</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sessionNotes.serviceCodes || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    No service codes added
                  </TableCell>
                </TableRow>
              ) : (
                (sessionNotes.serviceCodes || []).map((sc) => (
                  <TableRow key={sc.id}>
                    <TableCell>{sc.serviceCode}</TableCell>
                    <TableCell>{sc.modifiers || "-"}</TableCell>
                    <TableCell>{sc.units}</TableCell>
                    <TableCell>{sc.description}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveServiceCode(sc.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input
              placeholder="Service Code"
              value={newServiceCode.serviceCode}
              onChange={(e) =>
                setNewServiceCode((prev) => ({
                  ...prev,
                  serviceCode: e.target.value,
                }))
              }
            />
            <Input
              placeholder="Modifiers"
              value={newServiceCode.modifiers}
              onChange={(e) =>
                setNewServiceCode((prev) => ({
                  ...prev,
                  modifiers: e.target.value,
                }))
              }
            />
            <Input
              type="number"
              placeholder="Units"
              value={newServiceCode.units}
              onChange={(e) =>
                setNewServiceCode((prev) => ({
                  ...prev,
                  units: e.target.value,
                }))
              }
            />
            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <Input
                placeholder="Description"
                value={newServiceCode.description}
                onChange={(e) =>
                  setNewServiceCode((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="flex-1"
              />
              <Button onClick={handleAddServiceCode} size="sm" className="bg-teal-600 hover:bg-teal-700 shrink-0">
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600" />
            SERVICE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-slate-500 text-xs">Start Time</Label>
              <p className="font-medium mt-1">{appointmentStartLabel}</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">End Time</Label>
              <p className="font-medium mt-1">{appointmentEndLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
