import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, X } from "lucide-react";

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  sessionData,
  isDeleting = false,
}) => {
  const [editMode, setEditMode] = useState("single");

  useEffect(() => {
    if (isOpen) setEditMode("single");
  }, [isOpen, sessionData?.sessionId]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(editMode);
  };

  const handleCancel = () => {
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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
              Delete Session
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 hover:bg-gray-100"
              disabled={isDeleting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-gray-700">
            <p className="mb-3">
              Are you sure you want to delete this session? This will remove it from Appointments and cannot be undone.
            </p>
            <p className="text-sm text-gray-600 mb-3">
              Use <strong>Edit</strong> to cancel or update sessions.
            </p>

            {sessionData && (
              <div className="bg-gray-50 p-3 rounded-lg border">
                <h4 className="font-medium text-gray-800 mb-2">
                  Session Details:
                </h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>Client:</strong> {sessionData.clientName}
                  </p>
                  <p>
                    <strong>Provider:</strong> {sessionData.provider_name}
                  </p>
                  <p>
                    <strong>Date:</strong>{" "}
                    {new Date(sessionData.startDateTime).toLocaleDateString()}
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
          </div>

          {/* Scope */}
          <div className="space-y-4">
            {sessionData?.recurring && sessionData.recurring !== "No" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apply deletion to
                </label>
                <Select
                  value={editMode}
                  onValueChange={setEditMode}
                  disabled={isDeleting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">This session</SelectItem>
                    <SelectItem value="recurring">All recurring sessions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isDeleting}
              className="flex-1"
            >
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
                  Deleting...
                </div>
              ) : (
                "Delete Session"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeleteConfirmationModal;