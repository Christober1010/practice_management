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
import { Checkbox } from "@/components/ui/checkbox"
import toast from "react-hot-toast"

export default function AddStaffModal({ isOpen, onClose, onSave, editingStaff = null }) {
  const [formData, setFormData] = useState(() => ({
    firstName: editingStaff?.firstName || "",
    lastName: editingStaff?.lastName || "",
    staffType: editingStaff?.staffType || "RBT",
    certificationNumber: editingStaff?.certificationNumber || "",
    npiNumber: editingStaff?.npiNumber || "",
    address: editingStaff?.address || "",
    email: editingStaff?.email || "",
    phone: editingStaff?.phone || "",
    dateOfJoining: editingStaff?.dateOfJoining || "",
    dateOfLeaving: editingStaff?.dateOfLeaving || "",
    status: editingStaff?.status || "Active",
    // Timing Availability
    mondayAvailable: editingStaff?.availability?.monday?.available || false,
    mondayStart: editingStaff?.availability?.monday?.start || "",
    mondayEnd: editingStaff?.availability?.monday?.end || "",
    tuesdayAvailable: editingStaff?.availability?.tuesday?.available || false,
    tuesdayStart: editingStaff?.availability?.tuesday?.start || "",
    tuesdayEnd: editingStaff?.availability?.tuesday?.end || "",
    wednesdayAvailable: editingStaff?.availability?.wednesday?.available || false,
    wednesdayStart: editingStaff?.availability?.wednesday?.start || "",
    wednesdayEnd: editingStaff?.availability?.wednesday?.end || "",
    thursdayAvailable: editingStaff?.availability?.thursday?.available || false,
    thursdayStart: editingStaff?.availability?.thursday?.start || "",
    thursdayEnd: editingStaff?.availability?.thursday?.end || "",
    fridayAvailable: editingStaff?.availability?.friday?.available || false,
    fridayStart: editingStaff?.availability?.friday?.start || "",
    fridayEnd: editingStaff?.availability?.friday?.end || "",
    saturdayAvailable: editingStaff?.availability?.saturday?.available || false,
    saturdayStart: editingStaff?.availability?.saturday?.start || "",
    saturdayEnd: editingStaff?.availability?.saturday?.end || "",
    sundayAvailable: editingStaff?.availability?.sunday?.available || false,
    sundayStart: editingStaff?.availability?.sunday?.start || "",
    sundayEnd: editingStaff?.availability?.sunday?.end || "",
    // Location preferences
    homeVisits: editingStaff?.locationPreferences?.homeVisits || false,
    clinic: editingStaff?.locationPreferences?.clinic || false,
    school: editingStaff?.locationPreferences?.school || false,
    community: editingStaff?.locationPreferences?.community || false,
  }))

  useEffect(() => {
    if (editingStaff) {
      setFormData({
        firstName: editingStaff.firstName || "",
        lastName: editingStaff.lastName || "",
        staffType: editingStaff.staffType || "RBT",
        certificationNumber: editingStaff.certificationNumber || "",
        npiNumber: editingStaff.npiNumber || "",
        address: editingStaff.address || "",
        email: editingStaff.email || "",
        phone: editingStaff.phone || "",
        dateOfJoining: editingStaff.dateOfJoining || "",
        dateOfLeaving: editingStaff.dateOfLeaving || "",
        status: editingStaff.status || "Active",
        // Timing Availability
        mondayAvailable: editingStaff.availability?.monday?.available || false,
        mondayStart: editingStaff.availability?.monday?.start || "",
        mondayEnd: editingStaff.availability?.monday?.end || "",
        tuesdayAvailable: editingStaff.availability?.tuesday?.available || false,
        tuesdayStart: editingStaff.availability?.tuesday?.start || "",
        tuesdayEnd: editingStaff.availability?.tuesday?.end || "",
        wednesdayAvailable: editingStaff.availability?.wednesday?.available || false,
        wednesdayStart: editingStaff.availability?.wednesday?.start || "",
        wednesdayEnd: editingStaff.availability?.wednesday?.end || "",
        thursdayAvailable: editingStaff.availability?.thursday?.available || false,
        thursdayStart: editingStaff.availability?.thursday?.start || "",
        thursdayEnd: editingStaff.availability?.thursday?.end || "",
        fridayAvailable: editingStaff.availability?.friday?.available || false,
        fridayStart: editingStaff.availability?.friday?.start || "",
        fridayEnd: editingStaff.availability?.friday?.end || "",
        saturdayAvailable: editingStaff.availability?.saturday?.available || false,
        saturdayStart: editingStaff.availability?.saturday?.start || "",
        saturdayEnd: editingStaff.availability?.saturday?.end || "",
        sundayAvailable: editingStaff.availability?.sunday?.available || false,
        sundayStart: editingStaff.availability?.sunday?.start || "",
        sundayEnd: editingStaff.availability?.sunday?.end || "",
        // Location preferences
        homeVisits: editingStaff.locationPreferences?.homeVisits || false,
        clinic: editingStaff.locationPreferences?.clinic || false,
        school: editingStaff.locationPreferences?.school || false,
        community: editingStaff.locationPreferences?.community || false,
      })
    } else {
      // Reset form for new staff
      setFormData({
        firstName: "",
        lastName: "",
        staffType: "RBT",
        certificationNumber: "",
        npiNumber: "",
        address: "",
        email: "",
        phone: "",
        dateOfJoining: "",
        dateOfLeaving: "",
        status: "Active",
        mondayAvailable: false,
        mondayStart: "",
        mondayEnd: "",
        tuesdayAvailable: false,
        tuesdayStart: "",
        tuesdayEnd: "",
        wednesdayAvailable: false,
        wednesdayStart: "",
        wednesdayEnd: "",
        thursdayAvailable: false,
        thursdayStart: "",
        thursdayEnd: "",
        fridayAvailable: false,
        fridayStart: "",
        fridayEnd: "",
        saturdayAvailable: false,
        saturdayStart: "",
        saturdayEnd: "",
        sundayAvailable: false,
        sundayStart: "",
        sundayEnd: "",
        homeVisits: false,
        clinic: false,
        school: false,
        community: false,
      })
    }
  }, [editingStaff])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    // Enhanced validation
    const requiredFields = {
      firstName: "First Name",
      lastName: "Last Name",
      certificationNumber: "Certification Number",
      email: "Email",
      dateOfJoining: "Date of Joining",
    }

    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !formData[key]?.trim())
      .map(([, label]) => label)

    if (missingFields.length > 0) {
      toast.error(`Please fill in the following required fields: ${missingFields.join(", ")}`)
      return
    }

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Please enter a valid email address")
      return
    }

    // Build availability object
    const availability = {
      monday: {
        available: formData.mondayAvailable,
        start: formData.mondayStart,
        end: formData.mondayEnd,
      },
      tuesday: {
        available: formData.tuesdayAvailable,
        start: formData.tuesdayStart,
        end: formData.tuesdayEnd,
      },
      wednesday: {
        available: formData.wednesdayAvailable,
        start: formData.wednesdayStart,
        end: formData.wednesdayEnd,
      },
      thursday: {
        available: formData.thursdayAvailable,
        start: formData.thursdayStart,
        end: formData.thursdayEnd,
      },
      friday: {
        available: formData.fridayAvailable,
        start: formData.fridayStart,
        end: formData.fridayEnd,
      },
      saturday: {
        available: formData.saturdayAvailable,
        start: formData.saturdayStart,
        end: formData.saturdayEnd,
      },
      sunday: {
        available: formData.sundayAvailable,
        start: formData.sundayStart,
        end: formData.sundayEnd,
      },
    }

    const locationPreferences = {
      homeVisits: formData.homeVisits,
      clinic: formData.clinic,
      school: formData.school,
      community: formData.community,
    }

    const staffData = {
      ...formData,
      id: editingStaff?.id || `ST${Date.now()}`,
      fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
      availability,
      locationPreferences,
    }

    onSave(staffData)
    onClose()
  }

  const renderDayAvailability = (day, dayLabel) => (
    <div key={day} className="flex items-center space-x-4 p-3 border border-slate-200 rounded-lg">
      <div className="flex items-center space-x-2 min-w-[100px]">
        <Checkbox
          id={`${day}Available`}
          checked={formData[`${day}Available`]}
          onCheckedChange={(checked) => handleInputChange(`${day}Available`, checked)}
        />
        <Label htmlFor={`${day}Available`} className="font-medium">
          {dayLabel}
        </Label>
      </div>
      {formData[`${day}Available`] && (
        <div className="flex items-center space-x-2">
          <Input
            type="time"
            value={formData[`${day}Start`]}
            onChange={(e) => handleInputChange(`${day}Start`, e.target.value)}
            className="w-32"
          />
          <span className="text-slate-500">to</span>
          <Input
            type="time"
            value={formData[`${day}End`]}
            onChange={(e) => handleInputChange(`${day}End`, e.target.value)}
            className="w-32"
          />
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
          <DialogDescription>
            {editingStaff ? "Update staff member information below." : "Enter the staff member information below."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Personal Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800">Personal Information</h4>

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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="mt-1"
                />
              </div>
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
          </div>

          {/* Professional Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800">Professional Information</h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="staffType">Staff Type</Label>
                <Select value={formData.staffType} onValueChange={(value) => handleInputChange("staffType", value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RBT">RBT (Registered Behavior Technician)</SelectItem>
                    <SelectItem value="BCBA">BCBA (Board Certified Behavior Analyst)</SelectItem>
                    <SelectItem value="BCaBA">BCaBA (Board Certified Assistant Behavior Analyst)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Staff Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="certificationNumber">{formData.staffType} Certification Number *</Label>
                <Input
                  id="certificationNumber"
                  value={formData.certificationNumber}
                  onChange={(e) => handleInputChange("certificationNumber", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="npiNumber">{formData.staffType} NPI Number</Label>
                <Input
                  id="npiNumber"
                  value={formData.npiNumber}
                  onChange={(e) => handleInputChange("npiNumber", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateOfJoining">Date of Joining *</Label>
                <Input
                  id="dateOfJoining"
                  type="date"
                  value={formData.dateOfJoining}
                  onChange={(e) => handleInputChange("dateOfJoining", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dateOfLeaving">Date of Leaving</Label>
                <Input
                  id="dateOfLeaving"
                  type="date"
                  value={formData.dateOfLeaving}
                  onChange={(e) => handleInputChange("dateOfLeaving", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Timing Availability */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800">Timing Availability</h4>
            <div className="space-y-3">
              {renderDayAvailability("monday", "Monday")}
              {renderDayAvailability("tuesday", "Tuesday")}
              {renderDayAvailability("wednesday", "Wednesday")}
              {renderDayAvailability("thursday", "Thursday")}
              {renderDayAvailability("friday", "Friday")}
              {renderDayAvailability("saturday", "Saturday")}
              {renderDayAvailability("sunday", "Sunday")}
            </div>
          </div>

          {/* Location Preferences */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-800">Location Preferences</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="homeVisits"
                  checked={formData.homeVisits}
                  onCheckedChange={(checked) => handleInputChange("homeVisits", checked)}
                />
                <Label htmlFor="homeVisits">Home Visits</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="clinic"
                  checked={formData.clinic}
                  onCheckedChange={(checked) => handleInputChange("clinic", checked)}
                />
                <Label htmlFor="clinic">Clinic</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="school"
                  checked={formData.school}
                  onCheckedChange={(checked) => handleInputChange("school", checked)}
                />
                <Label htmlFor="school">School</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="community"
                  checked={formData.community}
                  onCheckedChange={(checked) => handleInputChange("community", checked)}
                />
                <Label htmlFor="community">Community</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-teal-600 hover:bg-teal-700">
            {editingStaff ? "Update Staff" : "Add Staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
