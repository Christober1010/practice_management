"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";
import { formatTime12hFromUTC } from "@/lib/time-utils";
import { sessionAppointmentLabel } from "@/lib/session-appointment-label";

export default function OverviewTab({
  client,
  sessionDate,
  sessionData,
  serviceCodeDescriptions = {},
}) {
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
  const appointmentLabel =
    sessionAppointmentLabel(sessionData, serviceCodeDescriptions) || "N/A";

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
              <Label className="text-slate-500 text-xs">Appointment Start Time</Label>
              <p className="font-medium mt-1">{appointmentStartLabel}</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Appointment End Time</Label>
              <p className="font-medium mt-1">{appointmentEndLabel}</p>
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
              <Label className="text-slate-500 text-xs">Place of Service</Label>
              <p className="font-medium mt-1">
                {sessionData?.place_of_service || client?.service_location || "N/A"}
              </p>
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
              <Label className="text-slate-500 text-xs">Organization Name</Label>
              <p className="font-medium mt-1">MAHA BEHAVIORAL HEALTH SERVICES, LLC</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Appointment</Label>
              <p className="font-medium mt-1">{appointmentLabel}</p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Provider Name/Credentials</Label>
              <p className="font-medium mt-1">{sessionData?.provider_name || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
