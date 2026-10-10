"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";
import { formatTime12hFromUTC } from "@/lib/time-utils";
import { sessionServiceCodeLabel } from "@/lib/aba-service-codes";

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-slate-500 text-xs">{label}</Label>
      <p className="font-medium mt-1">{children}</p>
    </div>
  );
}

export default function OverviewTab({ client, sessionDate, sessionData }) {
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

  const serviceLocationLabel =
    sessionData?.location_address ||
    (client?.addresses?.[0]
      ? `${client.addresses[0].address_line_1 || ""}, ${
          client.addresses[0].city || ""
        }, ${client.addresses[0].state || ""}, ${
          client.addresses[0].zipcode || ""
        }`
      : "N/A");

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {/* Row 1 */}
            <Field label="Client Name">
              {client?.first_name} {client?.last_name}
            </Field>
            <Field label="Rendering Provider">
              {sessionData?.provider_name || sessionData?.rendering_provider_name || "N/A"}
            </Field>
            <Field label="Supervising Clinician Name">
              {sessionData?.supervising_provider_name || "N/A"}
            </Field>

            {/* Row 2 */}
            <Field label="Appointment Date">{appointmentDateLabel}</Field>
            <Field label="Appointment Start Time">{appointmentStartLabel}</Field>
            <Field label="Appointment End Time">{appointmentEndLabel}</Field>

            {/* Row 3 */}
            <Field label="Service Location">{serviceLocationLabel}</Field>
            <Field label="Place of Service">
              {sessionData?.place_of_service || client?.service_location || "N/A"}
            </Field>
            <Field label="Service Type">
              {sessionData?.service_type ||
                sessionData?.serviceType ||
                sessionData?.direct_or_indirect_service ||
                "Indirect"}
            </Field>

            {/* Row 4 */}
            <Field label="Appointment">{sessionServiceCodeLabel(sessionData)}</Field>
            <Field label="Organization Name">MAHA BEHAVIORAL HEALTH SERVICES, LLC</Field>
            <Field label="Provider Name/Credentials">
              {sessionData?.provider_name || "N/A"}
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
