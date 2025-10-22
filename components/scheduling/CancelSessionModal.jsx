"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertTriangle, X } from "lucide-react"

const CancelSessionModal = ({ isOpen, onClose, onConfirm, sessionData, isDeleting = false }) => {
  const [cancelledBy, setCancelledBy] = useState("")
  const [cancelledReason, setCancelledReason] = useState("")
  const [errors, setErrors] = useState({})

  if (!isOpen) return null

  const handleConfirm = () => {
    const newErrors = {}
    if (!cancelledBy.trim()) newErrors.cancelledBy = "Required"
    if (!cancelledReason.trim()) newErrors.cancelledReason = "Required"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onConfirm(cancelledBy, cancelledReason)
  }

  const handleCancel = () => {
    setCancelledBy("")
    setCancelledReason("")
    setErrors({})
    onClose()
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancel()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-md bg-white shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Cancel Session
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 w-8 p-0 hover:bg-gray-100"
              disabled={isDeleting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-gray-700">
            <p className="mb-3">Please provide details about the cancellation.</p>

            {sessionData && (
              <div className="bg-gray-50 p-3 rounded-lg border mb-4">
                <h4 className="font-medium text-gray-800 mb-2">Session Details:</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>Client:</strong> {sessionData.clientName}
                  </p>
                  <p>
                    <strong>Provider:</strong> {sessionData.provider_name}
                  </p>
                  <p>
                    <strong>Date:</strong> {new Date(sessionData.startDateTime).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Time:</strong>{" "}
                    {new Date(sessionData.startDateTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label htmlFor="cancelledBy">Cancelled By *</Label>
                <Input
                  id="cancelledBy"
                  placeholder="Enter name or ID"
                  value={cancelledBy}
                  onChange={(e) => {
                    setCancelledBy(e.target.value)
                    if (errors.cancelledBy) {
                      setErrors({ ...errors, cancelledBy: null })
                    }
                  }}
                  className={errors.cancelledBy ? "border-red-500" : ""}
                />
                {errors.cancelledBy && <p className="text-red-500 text-sm mt-1">{errors.cancelledBy}</p>}
              </div>

              <div>
                <Label htmlFor="cancelledReason">Cancellation Reason *</Label>
                <Textarea
                  id="cancelledReason"
                  placeholder="Enter reason for cancellation"
                  value={cancelledReason}
                  onChange={(e) => {
                    setCancelledReason(e.target.value)
                    if (errors.cancelledReason) {
                      setErrors({ ...errors, cancelledReason: null })
                    }
                  }}
                  className={errors.cancelledReason ? "border-red-500" : ""}
                  rows={3}
                />
                {errors.cancelledReason && <p className="text-red-500 text-sm mt-1">{errors.cancelledReason}</p>}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleCancel} disabled={isDeleting} className="flex-1 bg-transparent">
              Keep Session
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Cancelling...
                </div>
              ) : (
                "Cancel Session"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CancelSessionModal
