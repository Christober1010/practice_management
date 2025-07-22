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

// Define the shape of the form data
// Note: In .jsx, these are for conceptual clarity, not strict type enforcement
/**
 * @typedef {object} ClientFormData
 * @property {string} [id] - Optional for new clients, required for editing
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} dob - YYYY-MM-DD format
 * @property {string} address
 * @property {string} parentGuardianName
 * @property {string} parentEmail
 * @property {string} parentPhone
 * @property {string} insuranceProvider
 * @property {string} insuranceId
 * @property {string} groupNumber
 * @property {"Active" | "Inactive" | "On Hold" | "Discharged"} status
 * @property {string} authorizationNumber
 * @property {string} billingCodes
 * @property {number} unitsApproved
 * @property {string} startDate - YYYY-MM-DD format
 * @property {string} endDate - YYYY-MM-DD format
 * @property {boolean} [archived] - Optional, handled by parent
 */

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function(): void} props.onClose
 * @param {(clientData: ClientFormData) => void} props.onSave
 * @param {ClientFormData | null} props.editingClient
 */
export default function AddClientModal({ isOpen, onClose, onSave, editingClient }) {
  const [formData, setFormData] = useState({
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
    unitsApproved: 0,
    startDate: "",
    endDate: "",
  })

  // Effect to populate form when editingClient changes
  useEffect(() => {
    if (editingClient) {
      setFormData({
        ...editingClient,
        unitsApproved: Number(editingClient.unitsApproved), // Ensure number type
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
        unitsApproved: 0,
        startDate: "",
        endDate: "",
      })
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
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" value={formData.firstName} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" value={formData.lastName} onChange={handleChange} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input id="dob" type="date" value={formData.dob} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={formData.address} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parentGuardianName">Parent/Guardian Name</Label>
              <Input id="parentGuardianName" value={formData.parentGuardianName} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentEmail">Parent Email</Label>
              <Input id="parentEmail" type="email" value={formData.parentEmail} onChange={handleChange} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parentPhone">Parent Phone</Label>
            <Input id="parentPhone" type="tel" value={formData.parentPhone} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="insuranceProvider">Insurance Provider</Label>
              <Input id="insuranceProvider" value={formData.insuranceProvider} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insuranceId">Insurance ID</Label>
              <Input id="insuranceId" value={formData.insuranceId} onChange={handleChange} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="groupNumber">Group Number</Label>
              <Input id="groupNumber" value={formData.groupNumber} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="authorizationNumber">Authorization Number</Label>
              <Input id="authorizationNumber" value={formData.authorizationNumber} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingCodes">Billing Codes</Label>
              <Input id="billingCodes" value={formData.billingCodes} onChange={handleChange} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unitsApproved">Units Approved (per 15 min)</Label>
            <Input id="unitsApproved" type="number" value={formData.unitsApproved} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" value={formData.startDate} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" value={formData.endDate} onChange={handleChange} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">{editingClient ? "Save Changes" : "Add Client"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
