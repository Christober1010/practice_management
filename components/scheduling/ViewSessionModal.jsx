"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, User, FileText, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ViewSessionModal({
  isOpen,
  onClose,
  session,
  onEdit,
  onDelete,
}) {
  if (!session) return null;

  const start = session.startDateTime ? new Date(session.startDateTime) : null;
  const end = session.endDateTime ? new Date(session.endDateTime) : null;

  const renderRecurring = () => {
    const r = session.recurring;
    if (!r || r === "No" || r === "Never")
      return <span className="text-slate-500">No</span>;
    if (typeof r === "string") {
      return (
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
          {r}
        </span>
      );
    }
    return (
      <div className="space-y-1">
        {r.frequency && (
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
              {r.frequency}
            </span>
          </div>
        )}
        {r.frequency === "Weekly" &&
          Array.isArray(r.days) &&
          r.days.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {r.days.map((day, idx) => (
                <span
                  key={`${day}-${idx}`}
                  className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                >
                  {day}
                </span>
              ))}
            </div>
          )}
        {r.ends && (
          <div className="text-xs text-gray-600">
            {r.ends.type === "On" && r.ends.date && (
              <span>Ends: {r.ends.date}</span>
            )}
            {r.ends.type === "After" && r.ends.occurrences && (
              <span>Total: {r.ends.occurrences} sessions</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance capitalize">
            {session.clientName || "Unknown Client"}
          </DialogTitle>
          <DialogDescription>
            Session details and quick actions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-teal-600" />
                Session Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <p className="text-slate-500 mb-1">Session ID</p>
                  <p className="font-medium">{session.sessionId || "N/A"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Client ID</p>
                  <p className="font-medium">{session.clientId || "N/A"}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Status</p>
                  <Badge className="bg-green-100 text-green-800 capitalize">
                    {session.status || "Upcoming"}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Start Time</p>
                  <p className="font-medium">
                    {start
                      ? start.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">End Time</p>
                  <p className="font-medium">
                    {end
                      ? end.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Recurring</p>
                  <div className="font-medium">{renderRecurring()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-teal-600" />
                  Provider Information
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-500 mb-1 capitalize">
                      Provider Name
                    </p>
                    <p className="font-medium">
                      {session.provider_name || "Not specified"}
                    </p>
                  </div>
                  {session.supervising_provider_name && (
                    <div>
                      <p className="text-slate-500 mb-1">
                        Supervising Provider Name
                      </p>
                      <p className="font-medium capitalize">
                        {session.supervising_provider_name}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-500 mb-1">Authorization Code</p>
                    <p className="font-medium">
                      {session.authCode || "Not specified"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-teal-600" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">Client Name</p>
                  <p className="font-medium capitalize">
                    {session.clientName || "Unknown Client"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-teal-600" />
                Location Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500 mb-1">Place of Service</p>
                  <p className="font-medium">
                    {session.placeOfService || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Time Zone</p>
                  <p className="font-medium">{session.startTZ || "UTC"}</p>
                </div>
              </div>
              {session.locationAddress && (
                <div>
                  <p className="text-slate-500 mb-1">Location Address</p>
                  <p className="bg-slate-50 p-3 rounded-lg">
                    {session.locationAddress}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-teal-600" />
                Rendered Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 text-sm">
              <div>
                <p className="text-slate-500 mb-1">Authorized Hours</p>
                <p className="font-medium">
                  {session.authorizedHours || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Scheduled Hours</p>
                <p className="font-medium">
                  {session.scheduledHours || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Rendered Hours</p>
                <p className="font-medium">{session.renderedHours || "0.00"}</p>
              </div>
            </CardContent>
          </Card>

          {session.quickNote && (
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-teal-600" />
                  Session Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div>
                  <p className="text-slate-500 mb-2 font-medium">Quick Notes</p>
                  <p className="bg-slate-50 p-3 rounded-lg">
                    {session.quickNote}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2">
          {onDelete && (
            <Button variant="outline" onClick={() => onDelete?.(session)}>
              Delete
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" onClick={() => onEdit?.(session)}>
              Edit
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
