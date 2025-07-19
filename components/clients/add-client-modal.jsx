"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export default function AddClientModal({ isOpen, onClose, onSave, editingClient = null }) {
  const [formData, setFormData] = useState(() => ({
    firstName: editingClient?.firstName || "",
    lastName: editingClient?.lastName || "",
    dob: editingClient?.dob || "",
    address: editingClient?.address || "",
    parentGuardianName: editingClient?.parentGuardianName || "",
    parentEmail: editingClient?.parentEmail || "",
    parentPhone: editingClient?.parentPhone || "",
    insuranceProvider: editingClient?.insuranceProvider || "",
    insuranceId: editingClient?.insuranceId || "",
    groupNumber: editingClient?.groupNumber || "",
    status: editingClient?.status || "Active",
    authorizationNumber: editingClient?.authorizationNumber || "",
    billingCodes: editingClient?.billingCodes || "",
    unitsApproved: editingClient?.unitsApproved || "",
    startDate: editingClient?.startDate || "",
    endDate: editingClient?.endDate || "",
  }))

  useEffect(() => {
    if (editingClient) {
      setFormData({
        firstName: editingClient.firstName || "",
        lastName: editingClient.lastName || "",
        dob: editingClient.dob || "",
        address: editingClient.address || "",
        parentGuardianName: editingClient.parentGuardianName || "",
        parentEmail: editingClient.parentEmail || "",
        parentPhone: editingClient.parentPhone || "",
        insuranceProvider: editingClient.insuranceProvider || "",
        insuranceId: editingClient.insuranceId || "",
        groupNumber: editingClient.groupNumber || "",
        status: editingClient.status || "Active",
        authorizationNumber: editingClient.authorizationNumber || "",
        billingCodes: editingClient.billingCodes || "",
        unitsApproved: editingClient.unitsApproved || "",
        startDate: editingClient.startDate || "",
        endDate: editingClient.endDate || "",
      })
    } else {
      // Reset form for new client
      setFormData({
        firstName: "",
        lastName: "",
        dob: "",
        address: "",
        parentGuardianName: "",
        parentEmail: "",
        parentPhone: "",
        insuranceProvider: "",
        insuranceId: "",
        groupNumber: "",
        status: "Active",
        authorizationNumber: "",
        billingCodes: "",
        unitsApproved: "",
        startDate: "",
        endDate: "",
      })
    }
  }, [editingClient])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    // Enhanced validation
    const requiredFields = {
      firstName: "First Name",
      lastName: "Last Name",
      dob: "Date of Birth",
    }

    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !formData[key]?.trim())
      .map(([, label]) => label)

    if (missingFields.length > 0) {
      alert(`Please fill in the following required fields: ${missingFields.join(", ")}`)
      return
    }

    // Email validation if provided
    if (formData.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.parentEmail)) {
      alert("Please enter a valid email address")
      return
    }

    // Phone validation if provided
    if (formData.parentPhone && !/^[+]?[1-9][\d]{0,15}$/.test(formData.parentPhone.replace(/[\s\-$$$$]/g, ""))) {
      alert("Please enter a valid phone number")
      return
    }

    const clientData = {
      ...formData,
      id: editingClient?.id || `CL${Date.now()}`,
      fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
      // Ensure dates are properly formatted
      dob: formData.dob,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
    }

    onSave(clientData)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
          <DialogDescription>
            {editingClient ? "Update client information below." : "Enter the client information below."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Personal Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800 dark:text-slate-200">Personal Information</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input
                id="dob"
                type="date"
                value={formData.dob}
                onChange={(e) => handleInputChange("dob", e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="status">Client Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Discharged">Discharged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Parent/Guardian Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800 dark:text-slate-200">Parent/Guardian Information</h4>

            <div>
              <Label htmlFor="parentGuardianName">Parent/Guardian Name</Label>
              <Input
                id="parentGuardianName"
                value={formData.parentGuardianName}
                onChange={(e) => handleInputChange("parentGuardianName", e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parentEmail">Parent Email</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  value={formData.parentEmail}
                  onChange={(e) => handleInputChange("parentEmail", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="parentPhone">Parent Phone</Label>
                <Input
                  id="parentPhone"
                  type="tel"
                  value={formData.parentPhone}
                  onChange={(e) => handleInputChange("parentPhone", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Insurance Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800 dark:text-slate-200">Insurance Information</h4>

            <div>
              <Label htmlFor="insuranceProvider">Insurance Provider Name</Label>
              <Input
                id="insuranceProvider"
                value={formData.insuranceProvider}
                onChange={(e) => handleInputChange("insuranceProvider", e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="insuranceId">Insurance ID</Label>
                <Input
                  id="insuranceId"
                  value={formData.insuranceId}
                  onChange={(e) => handleInputChange("insuranceId", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="groupNumber">Group #</Label>
                <Input
                  id="groupNumber"
                  value={formData.groupNumber}
                  onChange={(e) => handleInputChange("groupNumber", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Authorization Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800 dark:text-slate-200">Authorization Information</h4>

            <div>
              <Label htmlFor="authorizationNumber">Authorization #</Label>
              <Input
                id="authorizationNumber"
                value={formData.authorizationNumber}
                onChange={(e) => handleInputChange("authorizationNumber", e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="billingCodes">Billing Codes</Label>
                <Input
                  id="billingCodes"
                  value={formData.billingCodes}
                  onChange={(e) => handleInputChange("billingCodes", e.target.value)}
                  className="mt-1"
                  placeholder="e.g., 97153, 97155"
                />
              </div>
              <div>
                <Label htmlFor="unitsApproved">Units Approved (per 15 min)</Label>
                <Input
                  id="unitsApproved"
                  type="number"
                  value={formData.unitsApproved}
                  onChange={(e) => handleInputChange("unitsApproved", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange("startDate", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange("endDate", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-teal-600 hover:bg-teal-700">
            {editingClient ? "Update Client" : "Add Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
