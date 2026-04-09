"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar, Clock } from "lucide-react";

export default function OverviewTab({ client, sessionDate, sessionData, sessionNotes }) {
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
              <Label className="text-slate-500 text-xs">Actual Start Time</Label>
              <p className="font-medium mt-1">
                {sessionData?.start_utc
                  ? new Date(sessionData.start_utc).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "N/A"}
              </p>
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
              <Label className="text-slate-500 text-xs">Client Diagnosis (ICD-10 CODE)</Label>
              <p className="font-medium mt-1">{sessionNotes.diagnosisCode || "N/A"}</p>
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
              <Label className="text-slate-500 text-xs">Actual End Time</Label>
              <p className="font-medium mt-1">
                {sessionData?.end_utc
                  ? new Date(sessionData.end_utc).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">Service Type</Label>
              <p className="font-medium mt-1">
                {sessionData?.direct_or_indirect_service || "Indirect"}
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
              <p className="font-medium mt-1">
                {sessionDate
                  ? new Date(sessionDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })
                  : "N/A"}
              </p>
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
            <Clock className="h-5 w-5 text-indigo-600" />
            SERVICE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-slate-500 text-xs">Start Time</Label>
              <p className="font-medium mt-1">
                {sessionData?.start_utc
                  ? new Date(sessionData.start_utc).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "N/A"}
              </p>
            </div>
            <div>
              <Label className="text-slate-500 text-xs">End Time</Label>
              <p className="font-medium mt-1">
                {sessionData?.end_utc
                  ? new Date(sessionData.end_utc).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


