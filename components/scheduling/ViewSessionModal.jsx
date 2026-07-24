"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from "lucide-react"
import { formatTime12hFromUTC, formatDateFromUTC } from "@/lib/time-utils"
import { useEffect, useState } from "react"



export default function ViewSessionModal({
  isOpen,
  onClose,
  session,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}) {
  const [userTimezone, setUserTimezone] = useState("UTC")

  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    setUserTimezone(detectedTimezone)
  }, [])

  if (!session) return null

  const startTime = formatTime12hFromUTC(session.startDateTime, userTimezone)
  const endTime = formatTime12hFromUTC(session.endDateTime, userTimezone)
  const sessionDate = formatDateFromUTC(session.startDateTime, userTimezone)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Session Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600">Client</p>
            <p className="text-lg font-semibold">{session.clientName || "Unknown"}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600">Provider</p>
            <p className="text-base">{session.provider_name || "N/A"}</p>
          </div>

          {session.supervising_provider_name && (
            <div>
              <p className="text-sm font-medium text-gray-600">Supervisor</p>
              <p className="text-base">{session.supervising_provider_name}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-600">Date</p>
            <p className="text-base">{sessionDate || "N/A"}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600">Time</p>
            <p className="text-base">{startTime && endTime ? `${startTime} - ${endTime}` : "N/A"}</p>
          </div>

          {session.locationAddress && (
            <div>
              <p className="text-sm font-medium text-gray-600">Location</p>
              <p className="text-base">{session.locationAddress}</p>
            </div>
          )}

          {session.authCode && (
            <div>
              <p className="text-sm font-medium text-gray-600">Billing code</p>
              <p className="text-base">{session.authCode}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-600">Service type</p>
            <p className="text-base">
              {String(
                session.serviceType ||
                  session.service_type ||
                  session.direct_or_indirect_service ||
                  "Indirect"
              )}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600">Exclude session</p>
            <p className="text-base">
              {session.excludeSession === "Yes" || session.exclude_session === "Yes"
                ? "Yes"
                : "No"}
            </p>
          </div>

          {session.quickNote && (
            <div>
              <p className="text-sm font-medium text-gray-600">Notes</p>
              <p className="text-base italic">{session.quickNote}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            {canEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onEdit(session)
                onClose()
              }}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onDelete(session)
                  onClose()
                }}
                className="gap-2 bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
