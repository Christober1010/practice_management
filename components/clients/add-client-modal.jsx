"use client"

import { useEffect, useState } from "react"
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
import { PlusCircle, MinusCircle } from "lucide-react"

export default function AddClientModal({ isOpen, onClose, onSave, editingClient }) {
  const initialFormData = {
    firstName: "",
    lastName: "",
    dob: "",
    address: "",
    parentGuardianName: "",
    parentEmail: "",
    parentPhone: "",
    insuranceProvider: "",
    subscriberId: "", // Renamed
    groupNumber: "", // Renamed
    status: "Active",
    authorizations: [{ authNumber: "", billingCodes: "", unitsApproved: 0, startDate: "", endDate: "" }], // Initialize with one empty auth
  }

  const [formData, setFormData] = useState(initialFormData)

  // Effect to populate form when editingClient changes
  useEffect(() => {
    if (editingClient) {
      setFormData({
        ...editingClient,
        // Ensure authorizations array is always present and has correct types
        authorizations: editingClient.authorizations?.length
          ? editingClient.authorizations.map((auth) => ({
              ...auth,
              unitsApproved: Number(auth.unitsApproved),
            }))
          : [{ authNumber: "", billingCodes: "", unitsApproved: 0, startDate: "", endDate: "" }], // Default if empty
      })
    } else {
      // Reset form for new client
      setFormData(initialFormData)
    }
  }, [editingClient, isOpen]) // Re-run when modal opens or editingClient changes

  const handleChange = (e) => {
    const { id, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [id]: id === "unitsApproved" ? Number(value) : value,
    }))
  }

  const handleSelectChange = (value, field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleAuthorizationChange = (index, field, value) => {
    const newAuthorizations = [...formData.authorizations]
    newAuthorizations[index][field] = field === "unitsApproved" ? Number(value) : value
    setFormData((prev) => ({
      ...prev,
      authorizations: newAuthorizations,
    }))
  }

  const addAuthorization = () => {
    setFormData((prev) => ({
      ...prev,
      authorizations: [
        ...prev.authorizations,
        { authNumber: "", billingCodes: "", unitsApproved: 0, startDate: "", endDate: "" },
      ],
    }))
  }

  const removeAuthorization = (index) => {
    setFormData((prev) => ({
      ...prev,
      authorizations: prev.authorizations.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
    // onClose() // onClose is called by the parent after onSave completes successfully
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
          <DialogDescription>
            {editingClient ? "Make changes to the client profile here." : "Fill in the details to add a new client."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Client First Name</Label>
              <Input id="firstName" value={formData.firstName} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Client Last Name</Label>
              <Input id="lastName" value={formData.lastName} onChange={handleChange} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">DOB</Label>
            <Input id="dob" type="date" value={formData.dob} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={formData.address} onChange={handleChange} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parentGuardianName">Parent/Guardian Name</Label>
              <Input id="parentGuardianName" value={formData.parentGuardianName} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentEmail">Parent Email</Label>
              <Input id="parentEmail" type="email" value={formData.parentEmail} onChange={handleChange} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parentPhone">Parent Phone Number</Label>
            <Input id="parentPhone" type="tel" value={formData.parentPhone} onChange={handleChange} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="insuranceProvider">Insurance Provider Name</Label>
              <Input id="insuranceProvider" value={formData.insuranceProvider} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subscriberId">Subscriber Id</Label>
              <Input id="subscriberId" value={formData.subscriberId} onChange={handleChange} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="groupNumber">Group Number</Label>
              <Input id="groupNumber" value={formData.groupNumber} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Client Status</Label>
              <Select value={formData.status} onValueChange={(val) => handleSelectChange(val, "status")}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
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

          {/* Authorization Information List */}
          <div className="space-y-4 border p-4 rounded-md bg-slate-50">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center justify-between">
              Authorization Information
              <Button type="button" variant="ghost" size="sm" onClick={addAuthorization}>
                <PlusCircle className="h-4 w-4 mr-1" /> Add Authorization
              </Button>
            </h3>
            {formData.authorizations.map((auth, index) => (
              <div key={index} className="grid grid-cols-1 gap-4 border p-4 rounded-md bg-white shadow-sm">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-slate-700">Authorization #{index + 1}</h4>
                  {formData.authorizations.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeAuthorization(index)}>
                      <MinusCircle className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`authNumber-${index}`}>Authorization Number</Label>
                  <Input
                    id={`authNumber-${index}`}
                    value={auth.authNumber}
                    onChange={(e) => handleAuthorizationChange(index, "authNumber", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`billingCodes-${index}`}>Billing Codes</Label>
                  <Input
                    id={`billingCodes-${index}`}
                    value={auth.billingCodes}
                    onChange={(e) => handleAuthorizationChange(index, "billingCodes", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`unitsApproved-${index}`}>Units Approved (per 15 min)</Label>
                  <Input
                    id={`unitsApproved-${index}`}
                    type="number"
                    value={auth.unitsApproved}
                    onChange={(e) => handleAuthorizationChange(index, "unitsApproved", e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`startDate-${index}`}>Start Date</Label>
                    <Input
                      id={`startDate-${index}`}
                      type="date"
                      value={auth.startDate}
                      onChange={(e) => handleAuthorizationChange(index, "startDate", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`endDate-${index}`}>End Date</Label>
                    <Input
                      id={`endDate-${index}`}
                      type="date"
                      value={auth.endDate}
                      onChange={(e) => handleAuthorizationChange(index, "endDate", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit">{editingClient ? "Save Changes" : "Add Client"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
