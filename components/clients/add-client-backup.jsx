"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Users, Shield, FileText, Phone, MapPin, Heart, User, File } from "lucide-react"

const popularCountries = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "India",
  "Other",
]

const authorizationStatuses = ["Active", "Inactive", "Expired"]

const documentTypes = ["Insurance", "Intake Doc", "Clinical Doc", "Service Doc", "Misc"]

const billingCodeOptions = [
  { code: "97151", name: "Behavior Identification Assessment" },
  { code: "97152", name: "Behavior Identification Supporting Assessment" },
  { code: "97153", name: "Adaptive Behavior Treatment by Protocol" },
  { code: "97154", name: "Group Adaptive Behavior Treatment by Protocol" },
  { code: "97155", name: "Adaptive Behavior Treatment with Protocol Modification" },
  { code: "97156", name: "Family Adaptive Behavior Treatment Guidance" },
  { code: "97157", name: "Multiple Family Group Adaptive Behavior Treatment Guidance" },
  { code: "97158", name: "Group Adaptive Behavior Treatment with Protocol Modification" },
]

const initialClientState = {
  // Personal
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  preferred_language: "",
  client_status: "New",
  wait_list_status: "No",
  // Contact Info
  phone: "",
  email: "",
  appointment_reminder: "",
  // Address
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  zipcode: "",
  country: "",
  countryOther: "",
  // Guardian
  parent_first_name: "",
  parent_last_name: "",
  relationship_to_insured: "",
  relation_other: "",
  // Emergency Contact
  emergency_contact_name: "",
  emg_relationship: "",
  emg_phone: "",
  emg_email: "",
  // Notes
  client_notes: "",
  other_information: "",
  // Arrays
  insurances: [],
  authorizations: [],
  documents: [],
}

const initialInsurance = {
  insurance_type: "Primary",
  insurance_provider: "",
  treatment_type: "",
  insurance_id_number: "",
  group_number: "",
  coinsurance: "",
  deductible: "",
  start_date: "",
  end_date: "",
}

const initialAuthorization = {
  authorization_number: "",
  billing_codes: "",
  units_approved_per_15_min: "",
  units_serviced: "",
  balance_units: "",
  start_date: "",
  end_date: "",
  insurance_id: "",
  status: "Active",
}

const emptyDocument = {
  document_type: "",
  file_url: "",
}

function generateDocUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function AddClientModal({ isOpen, onClose, onSave, editingClient }) {
  const [formData, setFormData] = useState(initialClientState)
  const [errors, setErrors] = useState({})
  const [activeTab, setActiveTab] = useState("personal")
  const [saving, setSaving] = useState(false)

  const tabOrder = ["personal", "contact", "guardian", "insurance", "documents", "notes"]

  useEffect(() => {
    if (editingClient) {
      setFormData({
        ...initialClientState,
        ...editingClient,
        insurances:
          Array.isArray(editingClient.insurances) && editingClient.insurances.length > 0
            ? editingClient.insurances
            : [initialInsurance],
        authorizations:
          Array.isArray(editingClient.authorizations) && editingClient.authorizations.length > 0
            ? editingClient.authorizations.map((auth) => ({
                ...initialAuthorization,
                ...auth,
                status: auth.status || "Active",
                insurance_id: auth.insurance_id || "",
                units_serviced: auth.units_serviced || "",
                balance_units: auth.balance_units || "",
              }))
            : [initialAuthorization],
        documents:
          Array.isArray(editingClient.documents) && editingClient.documents.length > 0
            ? editingClient.documents
            : [{ ...emptyDocument, doc_uuid: generateDocUUID() }],
        date_of_birth: editingClient.date_of_birth?.slice(0, 10) || "",
        country: editingClient.country || "",
        countryOther: editingClient.countryOther || "",
        relationship_to_insured: editingClient.relationship_to_insured || "",
        relation_other: editingClient.relation_other || "",
        appointment_reminder: editingClient.appointment_reminder || "",
      })
    } else {
      setFormData({
        ...initialClientState,
        insurances: [initialInsurance],
        authorizations: [initialAuthorization],
        documents: [{ ...emptyDocument, doc_uuid: generateDocUUID() }],
      })
    }
    setErrors({})
    setActiveTab("personal")
  }, [editingClient, isOpen])

  const prepareDataForSave = () => {
    const cleanedData = {
      ...formData,
      country: formData.country === "Other" ? formData.countryOther.trim() : formData.country,
      insurances: formData.insurances.filter(
        (ins) => ins.insurance_provider || ins.insurance_id_number || ins.treatment_type,
      ),
      authorizations: formData.authorizations
        .filter((auth) => auth.authorization_number || auth.billing_codes || auth.units_approved_per_15_min)
        .map((auth) => {
          const approved = Number.parseFloat(auth.units_approved_per_15_min) || 0
          const serviced = Number.parseFloat(auth.units_serviced) || 0
          return {
            ...auth,
            insurance_id: auth.insurance_id || "",
            status: auth.status || "Active",
            units_serviced: serviced.toString(),
            balance_units: (approved - serviced).toString(),
          }
        }),
      documents: formData.documents.filter((doc) => doc.document_type || doc.file_url),
    }
    delete cleanedData.countryOther
    return cleanedData
  }

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const handleInsuranceChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      insurances: prev.insurances.map((ins, i) => (i === index ? { ...ins, [field]: value } : ins)),
    }))
    const errorKey = `insurance_${field}_${index}`
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }))
    }
  }

  const handleAuthorizationChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedAuthorizations = prev.authorizations.map((auth, i) => {
        if (i === index) {
          const updatedAuth = { ...auth, [field]: value }
          const approved =
            Number.parseFloat(field === "units_approved_per_15_min" ? value : updatedAuth.units_approved_per_15_min) ||
            0
          const serviced = Number.parseFloat(field === "units_serviced" ? value : updatedAuth.units_serviced) || 0
          updatedAuth.balance_units = (approved - serviced).toString()
          return updatedAuth
        }
        return auth
      })
      return { ...prev, authorizations: updatedAuthorizations }
    })
    const errorKey = `auth_${field}_${index}`
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }))
    }
  }

  const handleDocumentChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.map((doc, i) => (i === index ? { ...doc, [field]: value } : doc)),
    }))
    const errorKey = `document_${field}_${index}`
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }))
    }
  }

  const addInsurance = () => {
    setFormData((prev) => ({
      ...prev,
      insurances: [...prev.insurances, { ...initialInsurance, insurance_type: "Secondary" }],
    }))
  }

  const removeInsurance = (index) => {
    if (formData.insurances.length > 0) {
      setFormData((prev) => {
        const updatedInsurances = prev.insurances.filter((_, i) => i !== index)
        const finalInsurances = updatedInsurances.length === 0 ? [initialInsurance] : updatedInsurances
        const updatedAuthorizations = prev.authorizations.filter((auth) => auth.insurance_id !== String(index))
        const finalAuthorizations = updatedAuthorizations.length === 0 ? [initialAuthorization] : updatedAuthorizations
        return {
          ...prev,
          insurances: finalInsurances,
          authorizations: finalAuthorizations,
        }
      })
    }
  }

  const addAuthorization = () => {
    setFormData((prev) => ({
      ...prev,
      authorizations: [...prev.authorizations, { ...initialAuthorization }],
    }))
  }

  const removeAuthorization = (index) => {
    if (formData.authorizations.length > 0) {
      setFormData((prev) => {
        const updatedAuthorizations = prev.authorizations.filter((_, i) => i !== index)
        return {
          ...prev,
          authorizations: updatedAuthorizations.length === 0 ? [initialAuthorization] : updatedAuthorizations,
        }
      })
    }
  }

  const addDocument = () => {
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, { ...emptyDocument, doc_uuid: generateDocUUID() }],
    }))
  }

  const removeDocument = (index) => {
    if (formData.documents.length > 0) {
      setFormData((prev) => {
        const updatedDocuments = prev.documents.filter((_, i) => i !== index)
        return {
          ...prev,
          documents:
            updatedDocuments.length === 0 ? [{ ...emptyDocument, doc_uuid: generateDocUUID() }] : updatedDocuments,
        }
      })
    }
  }

  const validateCurrentTab = (tab) => {
    const currentTabErrors = {}
    let hasErrors = false

    switch (tab) {
      case "personal":
        if (!formData.first_name.trim()) {
          currentTabErrors.first_name = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.last_name.trim()) {
          currentTabErrors.last_name = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.date_of_birth) {
          currentTabErrors.date_of_birth = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.client_status.trim()) {
          currentTabErrors.client_status = "Missing Required Entry"
          hasErrors = true
        }
        break

      case "contact":
        if (!formData.phone.trim()) {
          currentTabErrors.phone = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.email.trim()) {
          currentTabErrors.email = "Missing Required Entry"
          hasErrors = true
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          currentTabErrors.email = "Invalid email format"
          hasErrors = true
        }
        if (!formData.appointment_reminder) {
          currentTabErrors.appointment_reminder = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.address_line_1.trim()) {
          currentTabErrors.address_line_1 = "Missing Required Entry"
          hasErrors = true
        }
        // address_line_2 is optional
        if (!formData.city.trim()) {
          currentTabErrors.city = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.state.trim()) {
          currentTabErrors.state = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.zipcode.trim()) {
          currentTabErrors.zipcode = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.country.trim()) {
          currentTabErrors.country = "Missing Required Entry"
          hasErrors = true
        }
        if (formData.country === "Other" && !formData.countryOther.trim()) {
          currentTabErrors.countryOther = "Missing Required Entry"
          hasErrors = true
        }
        break

      case "guardian":
        if (!formData.parent_first_name.trim()) {
          currentTabErrors.parent_first_name = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.parent_last_name.trim()) {
          currentTabErrors.parent_last_name = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.relationship_to_insured.trim()) {
          currentTabErrors.relationship_to_insured = "Missing Required Entry"
          hasErrors = true
        }
        if (formData.relationship_to_insured === "Other" && !formData.relation_other.trim()) {
          currentTabErrors.relation_other = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.emergency_contact_name.trim()) {
          currentTabErrors.emergency_contact_name = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.emg_relationship.trim()) {
          currentTabErrors.emg_relationship = "Missing Required Entry"
          hasErrors = true
        }
        if (!formData.emg_phone.trim()) {
          currentTabErrors.emg_phone = "Missing Required Entry"
          hasErrors = true
        }
        // emg_email is optional
        break

      case "insurance":
        formData.insurances.forEach((insurance, idx) => {
          if (!insurance.insurance_type.trim()) {
            currentTabErrors[`insurance_insurance_type_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!insurance.insurance_provider.trim()) {
            currentTabErrors[`insurance_insurance_provider_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!insurance.treatment_type.trim()) {
            currentTabErrors[`insurance_treatment_type_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!insurance.insurance_id_number.trim()) {
            currentTabErrors[`insurance_insurance_id_number_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!insurance.group_number.trim()) {
            currentTabErrors[`insurance_group_number_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          // coinsurance and deductible are optional
          if (!insurance.start_date.trim()) {
            currentTabErrors[`insurance_start_date_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          // end_date is optional
        })

        formData.authorizations.forEach((auth, idx) => {
          if (!auth.authorization_number.trim()) {
            currentTabErrors[`auth_authorization_number_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!auth.billing_codes.trim()) {
            currentTabErrors[`auth_billing_codes_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          const unitsApproved = Number(auth.units_approved_per_15_min)
          if (auth.units_approved_per_15_min === "" || isNaN(unitsApproved) || unitsApproved < 0) {
            currentTabErrors[`auth_units_approved_per_15_min_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!auth.start_date.trim()) {
            currentTabErrors[`auth_start_date_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!auth.end_date.trim()) {
            currentTabErrors[`auth_end_date_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!auth.insurance_id.trim()) {
            currentTabErrors[`auth_insurance_id_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!auth.status.trim()) {
            currentTabErrors[`auth_status_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          // units_serviced is optional (will follow from scheduling)
          const approved = Number.parseFloat(auth.units_approved_per_15_min) || 0
          const serviced = Number.parseFloat(auth.units_serviced) || 0
          if (serviced > approved) {
            currentTabErrors[`auth_units_serviced_${idx}`] = "Units Serviced cannot exceed Units Approved"
            hasErrors = true
          }
        })
        break

      case "documents":
        formData.documents.forEach((doc, idx) => {
          if (!doc.document_type.trim()) {
            currentTabErrors[`document_document_type_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
          if (!doc.file_url.trim()) {
            currentTabErrors[`document_file_url_${idx}`] = "Missing Required Entry"
            hasErrors = true
          }
        })
        break

      case "notes":
        // No required fields for notes tab
        break

      default:
        break
    }

    setErrors((prev) => ({ ...prev, ...currentTabErrors }))
    return hasErrors
  }

  const validateAllTabs = () => {
    const allErrors = {}
    let hasAnyErrors = false
    let firstErrorTab = null

    tabOrder.forEach((tab) => {
      const hasTabErrors = validateCurrentTab(tab)
      if (hasTabErrors && !firstErrorTab) {
        firstErrorTab = tab
        hasAnyErrors = true
      }
    })

    if (firstErrorTab) {
      setActiveTab(firstErrorTab)
    }

    return hasAnyErrors
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)

    const hasErrors = validateAllTabs()
    if (hasErrors) {
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
    const hasErrors = validateCurrentTab(activeTab)
    if (hasErrors) {
      return // Stay on current tab if there are errors
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
    setFormData(initialClientState)
    setErrors({})
    setActiveTab("personal")
    onClose()
  }

  const isLastTab = activeTab === tabOrder[tabOrder.length - 1]

  const renderInputWithError = (id, label, value, onChange, props = {}) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={onChange}
        className={errors[id] ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
        {...props}
      />
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  )

  const renderSelectWithError = (id, label, value, onValueChange, children, placeholder = "Select...") => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={errors[id] ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            {editingClient ? "Edit Client" : "Add New Client"}
            {saving && <span className="ml-2 text-sm text-gray-500 italic">Saving...</span>}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 lg:grid-cols-6">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Personal
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Contact
              </TabsTrigger>
              <TabsTrigger value="guardian" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Guardian
              </TabsTrigger>
              <TabsTrigger value="insurance" className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Insurance
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <File className="h-4 w-4" /> Documents
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Notes
              </TabsTrigger>
            </TabsList>

            {/* Personal */}
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" /> Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderInputWithError(
                      "first_name",
                      "First Name *",
                      formData.first_name,
                      (e) => handleInputChange("first_name", e.target.value),
                      { placeholder: "Enter first name" },
                    )}
                    <div>
                      <Label htmlFor="middle_name">Middle Name</Label>
                      <Input
                        id="middle_name"
                        value={formData.middle_name}
                        onChange={(e) => handleInputChange("middle_name", e.target.value)}
                        placeholder="Enter middle name"
                      />
                    </div>
                    {renderInputWithError(
                      "last_name",
                      "Last Name *",
                      formData.last_name,
                      (e) => handleInputChange("last_name", e.target.value),
                      { placeholder: "Enter last name" },
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderInputWithError(
                      "date_of_birth",
                      "Date of Birth *",
                      formData.date_of_birth,
                      (e) => handleInputChange("date_of_birth", e.target.value),
                      { type: "date" },
                    )}
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="preferred_language">Preferred Language</Label>
                      <Input
                        id="preferred_language"
                        value={formData.preferred_language}
                        onChange={(e) => handleInputChange("preferred_language", e.target.value)}
                        placeholder="Enter preferred language"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderSelectWithError(
                      "client_status",
                      "Client Status *",
                      formData.client_status,
                      (value) => handleInputChange("client_status", value),
                      <>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Benefits Verification">Benefits Verification</SelectItem>
                        <SelectItem value="Prior Authorization">Prior Authorization</SelectItem>
                        <SelectItem value="Client Assessment">Client Assessment</SelectItem>
                        <SelectItem value="Pending Authorization">Pending Authorization</SelectItem>
                      </>,
                      "Select status",
                    )}
                    <div>
                      <Label htmlFor="wait_list_status">Wait List Status</Label>
                      <Select
                        value={formData.wait_list_status}
                        onValueChange={(value) => handleInputChange("wait_list_status", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select wait list status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contact */}
            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-teal-600" /> Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "phone",
                      "Phone Number *",
                      formData.phone,
                      (e) => handleInputChange("phone", e.target.value),
                      { placeholder: "Enter phone number" },
                    )}
                    {renderInputWithError(
                      "email",
                      "Email Address *",
                      formData.email,
                      (e) => handleInputChange("email", e.target.value),
                      { type: "email", placeholder: "Enter email address" },
                    )}
                  </div>
                  {renderSelectWithError(
                    "appointment_reminder",
                    "Appointment Reminder Preference *",
                    formData.appointment_reminder,
                    (value) => handleInputChange("appointment_reminder", value),
                    <>
                      <SelectItem value="text">Text Message</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="none">No Reminder</SelectItem>
                    </>,
                    "Select reminder preference",
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-teal-600" /> Address Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderInputWithError(
                    "address_line_1",
                    "Address Line 1 *",
                    formData.address_line_1,
                    (e) => handleInputChange("address_line_1", e.target.value),
                    { placeholder: "Enter street address" },
                  )}
                  <div>
                    <Label htmlFor="address_line_2">Address Line 2 (Optional)</Label>
                    <Input
                      id="address_line_2"
                      value={formData.address_line_2}
                      onChange={(e) => handleInputChange("address_line_2", e.target.value)}
                      placeholder="Apartment, suite, etc. (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderInputWithError(
                      "city",
                      "City *",
                      formData.city,
                      (e) => handleInputChange("city", e.target.value),
                      { placeholder: "Enter city" },
                    )}
                    {renderInputWithError(
                      "state",
                      "State *",
                      formData.state,
                      (e) => handleInputChange("state", e.target.value),
                      { placeholder: "Enter state" },
                    )}
                    {renderInputWithError(
                      "zipcode",
                      "ZIP Code *",
                      formData.zipcode,
                      (e) => handleInputChange("zipcode", e.target.value),
                      { placeholder: "Enter ZIP code" },
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      {renderSelectWithError(
                        "country",
                        "Country *",
                        formData.country,
                        (value) => {
                          handleInputChange("country", value)
                          if (value !== "Other") {
                            handleInputChange("countryOther", "")
                          }
                        },
                        popularCountries.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        )),
                        "Select country",
                      )}
                      {formData.country === "Other" &&
                        renderInputWithError(
                          "countryOther",
                          "Specify Country *",
                          formData.countryOther || "",
                          (e) => handleInputChange("countryOther", e.target.value),
                          { placeholder: "Enter country name" },
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Guardian */}
            <TabsContent value="guardian" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-teal-600" /> Parent/Guardian Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "parent_first_name",
                      "Parent/Guardian First Name *",
                      formData.parent_first_name,
                      (e) => handleInputChange("parent_first_name", e.target.value),
                      { placeholder: "Enter parent/guardian first name" },
                    )}
                    {renderInputWithError(
                      "parent_last_name",
                      "Parent/Guardian Last Name *",
                      formData.parent_last_name,
                      (e) => handleInputChange("parent_last_name", e.target.value),
                      { placeholder: "Enter parent/guardian last name" },
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderSelectWithError(
                      "relationship_to_insured",
                      "Relationship to Client *",
                      formData.relationship_to_insured,
                      (value) => handleInputChange("relationship_to_insured", value),
                      <>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Guardian">Guardian</SelectItem>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Self">Self</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </>,
                      "Select relationship",
                    )}
                    {formData.relationship_to_insured === "Other" &&
                      renderInputWithError(
                        "relation_other",
                        "Specify Other Relationship *",
                        formData.relation_other,
                        (e) => handleInputChange("relation_other", e.target.value),
                        { placeholder: "Enter relationship" },
                      )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-teal-600" /> Emergency Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "emergency_contact_name",
                      "Emergency Contact Name *",
                      formData.emergency_contact_name,
                      (e) => handleInputChange("emergency_contact_name", e.target.value),
                      { placeholder: "Enter emergency contact name" },
                    )}
                    {renderInputWithError(
                      "emg_relationship",
                      "Relationship *",
                      formData.emg_relationship,
                      (e) => handleInputChange("emg_relationship", e.target.value),
                      { placeholder: "Enter relationship" },
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "emg_phone",
                      "Emergency Contact Phone *",
                      formData.emg_phone,
                      (e) => handleInputChange("emg_phone", e.target.value),
                      { placeholder: "Enter emergency contact phone" },
                    )}
                    <div>
                      <Label htmlFor="emg_email">Emergency Contact Email (Optional)</Label>
                      <Input
                        id="emg_email"
                        type="email"
                        value={formData.emg_email}
                        onChange={(e) => handleInputChange("emg_email", e.target.value)}
                        placeholder="Enter emergency contact email"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insurance */}
            <TabsContent value="insurance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-teal-600" /> Insurance Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.insurances.map((insurance, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-slate-50 relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">Insurance #{index + 1}</h4>
                          <Badge
                            variant="outline"
                            className={
                              insurance.insurance_type === "Primary"
                                ? "border-blue-300 text-blue-700"
                                : "border-green-300 text-green-700"
                            }
                          >
                            {insurance.insurance_type}
                          </Badge>
                        </div>
                        {formData.insurances.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeInsurance(index)}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        {renderSelectWithError(
                          `insurance_insurance_type_${index}`,
                          "Insurance Type *",
                          insurance.insurance_type,
                          (value) => handleInsuranceChange(index, "insurance_type", value),
                          <>
                            <SelectItem value="Primary">Primary</SelectItem>
                            <SelectItem value="Secondary">Secondary</SelectItem>
                          </>,
                          "Select insurance type",
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {renderInputWithError(
                            `insurance_insurance_provider_${index}`,
                            "Insurance Provider *",
                            insurance.insurance_provider,
                            (e) => handleInsuranceChange(index, "insurance_provider", e.target.value),
                            { placeholder: "Enter insurance provider" },
                          )}
                          {renderInputWithError(
                            `insurance_treatment_type_${index}`,
                            "Treatment Type *",
                            insurance.treatment_type,
                            (e) => handleInsuranceChange(index, "treatment_type", e.target.value),
                            { placeholder: "Enter treatment type" },
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {renderInputWithError(
                            `insurance_insurance_id_number_${index}`,
                            "Insurance ID *",
                            insurance.insurance_id_number,
                            (e) => handleInsuranceChange(index, "insurance_id_number", e.target.value),
                            { placeholder: "Enter insurance ID" },
                          )}
                          {renderInputWithError(
                            `insurance_group_number_${index}`,
                            "Group Number *",
                            insurance.group_number,
                            (e) => handleInsuranceChange(index, "group_number", e.target.value),
                            { placeholder: "Enter group number" },
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Coinsurance (Optional)</Label>
                            <Input
                              value={insurance.coinsurance}
                              onChange={(e) => handleInsuranceChange(index, "coinsurance", e.target.value)}
                              placeholder="Enter coinsurance"
                            />
                          </div>
                          <div>
                            <Label>Deductible (Optional)</Label>
                            <Input
                              value={insurance.deductible}
                              onChange={(e) => handleInsuranceChange(index, "deductible", e.target.value)}
                              placeholder="Enter deductible"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {renderInputWithError(
                            `insurance_start_date_${index}`,
                            "Start Date *",
                            insurance.start_date,
                            (e) => handleInsuranceChange(index, "start_date", e.target.value),
                            { type: "date" },
                          )}
                          <div>
                            <Label>End Date (Optional)</Label>
                            <Input
                              type="date"
                              value={insurance.end_date}
                              onChange={(e) => handleInsuranceChange(index, "end_date", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addInsurance}
                    className="w-full border-dashed border-slate-300 bg-transparent"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Another Insurance
                  </Button>
                </CardContent>
              </Card>

              {/* Authorization Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" /> Authorization Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.authorizations.map((auth, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-slate-50 relative">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Authorization #{index + 1}</h4>
                        {formData.authorizations.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeAuthorization(index)}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {renderInputWithError(
                            `auth_authorization_number_${index}`,
                            "Authorization Number *",
                            auth.authorization_number,
                            (e) => handleAuthorizationChange(index, "authorization_number", e.target.value),
                            { placeholder: "Enter authorization number" },
                          )}
                          {renderSelectWithError(
                            `auth_billing_codes_${index}`,
                            "Billing Codes *",
                            auth.billing_codes,
                            (value) => handleAuthorizationChange(index, "billing_codes", value),
                            billingCodeOptions.map((option) => (
                              <SelectItem key={option.code} value={option.code}>
                                {`${option.code} ${option.name}`}
                              </SelectItem>
                            )),
                            "Select billing code",
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {renderInputWithError(
                            `auth_units_approved_per_15_min_${index}`,
                            "Units Approved (per 15 min) *",
                            auth.units_approved_per_15_min,
                            (e) => handleAuthorizationChange(index, "units_approved_per_15_min", e.target.value),
                            { type: "number", placeholder: "Enter approved units" },
                          )}
                          <div>
                            <Label>Units Serviced (Optional)</Label>
                            <Input
                              type="number"
                              value={auth.units_serviced}
                              onChange={(e) => handleAuthorizationChange(index, "units_serviced", e.target.value)}
                              placeholder="Enter serviced units"
                            />
                          </div>
                          <div>
                            <Label>Balance Units</Label>
                            <Input
                              value={auth.balance_units}
                              readOnly
                              placeholder="Calculated balance"
                              className="bg-gray-100 cursor-not-allowed"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {renderInputWithError(
                            `auth_start_date_${index}`,
                            "Start Date *",
                            auth.start_date || "",
                            (e) => handleAuthorizationChange(index, "start_date", e.target.value),
                            { type: "date" },
                          )}
                          {renderInputWithError(
                            `auth_end_date_${index}`,
                            "End Date *",
                            auth.end_date || "",
                            (e) => handleAuthorizationChange(index, "end_date", e.target.value),
                            { type: "date" },
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {renderSelectWithError(
                            `auth_insurance_id_${index}`,
                            "Linked Insurance *",
                            auth.insurance_id || "",
                            (value) => handleAuthorizationChange(index, "insurance_id", value),
                            formData.insurances.map((insurance, i) => (
                              <SelectItem key={i} value={String(i)}>
                                {insurance.insurance_provider || `Insurance #${i + 1}`}
                              </SelectItem>
                            )),
                            "Select insurance",
                          )}
                          {renderSelectWithError(
                            `auth_status_${index}`,
                            "Status *",
                            auth.status || "Active",
                            (value) => handleAuthorizationChange(index, "status", value),
                            authorizationStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            )),
                            "Select status",
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAuthorization}
                    className="w-full border-dashed border-slate-300 bg-transparent"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Another Authorization
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <File className="h-5 w-5 text-teal-600" /> Client Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.documents.map((doc, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-slate-50 relative">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Document #{index + 1}</h4>
                        {formData.documents.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeDocument(index)}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        {renderSelectWithError(
                          `document_document_type_${index}`,
                          "Document Type *",
                          doc.document_type,
                          (value) => handleDocumentChange(index, "document_type", value),
                          documentTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          )),
                          "Select document type",
                        )}
                        {renderInputWithError(
                          `document_file_url_${index}`,
                          "Document URL/Path *",
                          doc.file_url,
                          (e) => handleDocumentChange(index, "file_url", e.target.value),
                          { placeholder: "Enter URL or path to document" },
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addDocument}
                    className="w-full border-dashed border-slate-300 bg-transparent"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Another Document
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" /> Notes & Additional Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="client_notes">Client Notes</Label>
                    <Textarea
                      id="client_notes"
                      value={formData.client_notes}
                      onChange={(e) => handleInputChange("client_notes", e.target.value)}
                      placeholder="Enter any notes about the client"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="other_information">Other Information</Label>
                    <Textarea
                      id="other_information"
                      value={formData.other_information}
                      onChange={(e) => handleInputChange("other_information", e.target.value)}
                      placeholder="Enter any additional information"
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
              {editingClient ? "Update Client" : "Add Client"}
            </Button>
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
