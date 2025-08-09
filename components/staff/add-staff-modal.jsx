"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, MapPin, Clock, FileText } from "lucide-react"
import toast from "react-hot-toast"

const initialStaffState = {
  // Personal Information
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  // Professional Information
  staffType: "RBT",
  certificationNumber: "",
  npiNumber: "",
  dateOfJoining: "",
  dateOfLeaving: "",
  status: "Active",
  // Timing Availability (flattened for form)
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
  // Location preferences (flattened for form)
  homeVisits: false,
  clinic: false,
  school: false,
  community: false,
}

// Helper to generate time options for dropdown (e.g., "08:00", "08:15", ..., "23:45")
const generateTimeOptions = () => {
  const times = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h.toString().padStart(2, "0")
      const minute = m.toString().padStart(2, "0")
      times.push(`${hour}:${minute}`)
    }
  }
  return times
}
const timeOptions = generateTimeOptions()

// Helper to format 24hr time to 12hr AM/PM for display in dropdown
const formatTimeForDropdown = (time24hr) => {
  if (!time24hr) return ""
  const [hours, minutes] = time24hr.split(":").map(Number)
  const ampm = hours >= 12 ? "PM" : "AM"
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12
  return `${formattedHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${ampm}`
}

// Mapping of tabs to their associated form field prefixes for error checking
const tabFieldMapping = {
  personal: ["firstName", "lastName", "email", "phone", "address"],
  professional: ["staffType", "certificationNumber", "npiNumber", "dateOfJoining", "dateOfLeaving", "status"],
  availability: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"], // Prefixes for availability fields
  location: ["homeVisits", "clinic", "school", "community"], // Prefixes for location fields
}

export default function AddStaffModal({ isOpen, onClose, onSave, editingStaff = null }) {
  const [formData, setFormData] = useState(initialStaffState)
  const [activeTab, setActiveTab] = useState("personal")
  const [saving, setSaving] = useState(false)
  const tabOrder = ["personal", "professional", "availability", "location"]

  useEffect(() => {
    if (editingStaff) {
      setFormData({
        ...initialStaffState, // Start with a clean slate
        ...editingStaff,
        // Flatten availability for form fields
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
        // Flatten location preferences for form fields
        homeVisits: editingStaff.locationPreferences?.homeVisits || false,
        clinic: editingStaff.locationPreferences?.clinic || false,
        school: editingStaff.locationPreferences?.school || false,
        community: editingStaff.locationPreferences?.community || false,
      })
    } else {
      setFormData(initialStaffState)
    }
    setActiveTab("personal") // Always start on the first tab
  }, [editingStaff, isOpen])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const prepareDataForSave = () => {
    // Reconstruct nested objects from flattened form data
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

    const dataToSave = {
      ...formData,
      id: editingStaff?.id, // Preserve ID for edits, backend generates for new
      fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
      availability,
      locationPreferences,
    }

    // Remove flattened fields before sending
    Object.keys(initialStaffState).forEach((key) => {
      if (
        key.includes("Available") ||
        key.includes("Start") ||
        key.includes("End") ||
        key.includes("Visits") ||
        key.includes("clinic") ||
        key.includes("school") ||
        key.includes("community")
      ) {
        delete dataToSave[key]
      }
    })
    return dataToSave
  }

  const validateCurrentTab = (tab) => {
    const messages = []
    switch (tab) {
      case "personal":
        if (!formData.firstName.trim()) messages.push("Personal: First Name is required.")
        if (!formData.lastName.trim()) messages.push("Personal: Last Name is required.")
        if (!formData.email.trim()) messages.push("Personal: Email is required.")
        else if (!/\S+@\S+\.\S+/.test(formData.email)) messages.push("Personal: Email is invalid.")
        break
      case "professional":
        if (!formData.staffType.trim()) messages.push("Professional: Staff Type is required.")
        if (!formData.certificationNumber.trim()) messages.push("Professional: Certification Number is required.")
        if (!formData.dateOfJoining.trim()) messages.push("Professional: Date of Joining is required.")
        if (!formData.status.trim()) messages.push("Professional: Staff Status is required.")
        break
      case "availability":
        // Validate time ranges if available
        const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        days.forEach((day) => {
          if (formData[`${day}Available`]) {
            if (!formData[`${day}Start`].trim())
              messages.push(`Availability: ${day.charAt(0).toUpperCase() + day.slice(1)} Start Time is required.`)
            if (!formData[`${day}End`].trim())
              messages.push(`Availability: ${day.charAt(0).toUpperCase() + day.slice(1)} End Time is required.`)
            if (formData[`${day}Start`] && formData[`${day}End`] && formData[`${day}Start`] >= formData[`${day}End`]) {
              messages.push(
                `Availability: ${day.charAt(0).toUpperCase() + day.slice(1)} End Time must be after Start Time.`,
              )
            }
          }
        })
        break
      case "location":
        // No required fields for location preferences, as they are checkboxes
        break
      default:
        break
    }
    return messages
  }

  const validateAllTabs = () => {
    const allMessages = []
    let firstErrorTab = null
    tabOrder.forEach((tab) => {
      const tabMessages = validateCurrentTab(tab)
      if (tabMessages.length > 0) {
        allMessages.push(...tabMessages)
        if (!firstErrorTab) {
          firstErrorTab = tab
        }
      }
    })
    if (firstErrorTab) {
      setActiveTab(firstErrorTab) // Switch to the first tab with an error
    }
    return allMessages
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const validationMessages = validateAllTabs()
    if (validationMessages.length > 0) {
      validationMessages.forEach((msg) => toast.error(msg))
      setSaving(false)
      return
    }

    const dataToSave = prepareDataForSave()
    console.log("Data being sent to API:", dataToSave)
    await onSave(dataToSave)
    setSaving(false)
  }

  const handleNextTab = (e) => {
    e.preventDefault()
    const validationMessages = validateCurrentTab(activeTab)
    if (validationMessages.length > 0) {
      validationMessages.forEach((msg) => toast.error(msg))
      return
    }
    const currentIndex = tabOrder.indexOf(activeTab)
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1])
    } else {
      handleSave(e) // If on the last tab, save the form
    }
  }

  const handlePreviousTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab)
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1])
    }
  }

  const handleClose = () => {
    setFormData(initialStaffState)
    setActiveTab("personal")
    onClose()
  }

  const isLastTab = activeTab === tabOrder[tabOrder.length - 1]

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
          <Select value={formData[`${day}Start`]} onValueChange={(value) => handleInputChange(`${day}Start`, value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Start Time">
                {formatTimeForDropdown(formData[`${day}Start`]) || "Start Time"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {formatTimeForDropdown(time)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-slate-500">to</span>
          <Select value={formData[`${day}End`]} onValueChange={(value) => handleInputChange(`${day}End`, value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="End Time">
                {formatTimeForDropdown(formData[`${day}End`]) || "End Time"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map((time) => (
                <SelectItem key={time} value={time}>
                  {formatTimeForDropdown(time)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
            {saving && <span className="ml-2 text-sm text-gray-500 italic">Saving...</span>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Personal
              </TabsTrigger>
              <TabsTrigger value="professional" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Professional
              </TabsTrigger>
              <TabsTrigger value="availability" className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Availability
              </TabsTrigger>
              <TabsTrigger value="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Location
              </TabsTrigger>
            </TabsList>

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" /> Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange("lastName", e.target.value)}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      placeholder="Enter full address"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Professional Information Tab */}
            <TabsContent value="professional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" /> Professional Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="staffType">Staff Type</Label>
                      <Select
                        value={formData.staffType}
                        onValueChange={(value) => handleInputChange("staffType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff type" />
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="certificationNumber">{formData.staffType} Certification Number *</Label>
                      <Input
                        id="certificationNumber"
                        value={formData.certificationNumber}
                        onChange={(e) => handleInputChange("certificationNumber", e.target.value)}
                        placeholder="Enter certification number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="npiNumber">{formData.staffType} NPI Number</Label>
                      <Input
                        id="npiNumber"
                        value={formData.npiNumber}
                        onChange={(e) => handleInputChange("npiNumber", e.target.value)}
                        placeholder="Enter NPI number"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dateOfJoining">Date of Joining *</Label>
                      <Input
                        id="dateOfJoining"
                        type="date"
                        value={formData.dateOfJoining}
                        onChange={(e) => handleInputChange("dateOfJoining", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dateOfLeaving">Date of Leaving</Label>
                      <Input
                        id="dateOfLeaving"
                        type="date"
                        value={formData.dateOfLeaving}
                        onChange={(e) => handleInputChange("dateOfLeaving", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Timing Availability Tab */}
            <TabsContent value="availability" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-teal-600" /> Timing Availability
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderDayAvailability("monday", "Monday")}
                  {renderDayAvailability("tuesday", "Tuesday")}
                  {renderDayAvailability("wednesday", "Wednesday")}
                  {renderDayAvailability("thursday", "Thursday")}
                  {renderDayAvailability("friday", "Friday")}
                  {renderDayAvailability("saturday", "Saturday")}
                  {renderDayAvailability("sunday", "Sunday")}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Location Preferences Tab */}
            <TabsContent value="location" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-teal-600" /> Location Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {/* Always show the main save button */}
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
              {editingStaff ? "Update Staff" : "Add Staff"}
            </Button>
            {/* Show Next button only if not on the last tab */}
            {!isLastTab && (
              <Button type="button" onClick={handleNextTab} className="bg-teal-600 hover:bg-teal-700">
                Next
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
