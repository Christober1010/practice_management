"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Phone, User, Shield, File, FileText, MapPin, Plus, Trash2, Heart, ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const popularCountries = [
  "USA",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
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

  // Contact
  phone: "",
  email: "",
  appointment_reminder: "",

  addresses: [
    {
      id: Date.now(),
      service_location: "Home",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      zipcode: "",
      country: "USA",
      countryOther: "",
    },
  ],

  // Guardian/Parent
  parent_first_name: "",
  parent_last_name: "",
  relationship_to_insured: "",
  relation_other: "",

  // Emergency Contact
  emergency_contact_name: "",
  emg_relationship: "",
  emg_phone: "",
  emg_email: "",

  // Insurance
  insurances: [],
  authorizations: [],

  // Documents
  documents: [],

  // Notes
  client_notes: "",
  other_information: "",
}

export default function AddClientModal({ isOpen, onClose, onSave, editingClient }) {
  const [formData, setFormData] = useState(initialClientState)
  const [errors, setErrors] = useState({})
  const [activeTab, setActiveTab] = useState("personal")
  const [saving, setSaving] = useState(false)

  const primaryTabs = ["personal", "contact", "insurance"]
  const moreTabs = ["guardian", "documents", "notes"]
  const allTabs = [...primaryTabs, ...moreTabs]
  const tabOrder = ["personal", "contact", "guardian", "insurance", "documents", "notes"]

  useEffect(() => {
    if (editingClient) {
      const addresses = editingClient.addresses?.length ? editingClient.addresses : [
        {
          id: Date.now(),
          service_location: "Home",
          address_line_1: editingClient.address_line_1 || "",
          address_line_2: editingClient.address_line_2 || "",
          city: editingClient.city || "",
          state: editingClient.state || "",
          zipcode: editingClient.zipcode || "",
          country: editingClient.country || "USA",
          countryOther: editingClient.countryOther || "",
        },
      ]

      setFormData({
        ...initialClientState,
        ...editingClient,
        addresses,
        insurances: editingClient.insurances || [],
        authorizations: editingClient.authorizations || [],
        documents: editingClient.documents || [],
        date_of_birth: editingClient.date_of_birth?.slice(0, 10) || "",
      })
    } else {
      setFormData(initialClientState)
    }
    setErrors({})
    setActiveTab("personal")
  }, [editingClient, isOpen])

  const prepareDataForSave = () => {
    const cleanedData = {
      ...formData,
      insurances: formData.insurances.filter(
        (ins) => ins.insurance_provider || ins.insurance_id_number || ins.treatment_type,
      ),
      authorizations: (formData.authorizations || [])
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
    return cleanedData
  }

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const handleAddressChange = (addressId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      addresses: prev.addresses.map((addr) => (addr.id === addressId ? { ...addr, [field]: value } : addr)),
    }))
  }

  const addAddress = () => {
    const newAddress = {
      id: Date.now(),
      service_location: "Home",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      zipcode: "",
      country: "USA",
      countryOther: "",
    }
    setFormData((prev) => ({
      ...prev,
      addresses: [...prev.addresses, newAddress],
    }))
  }

  const removeAddress = (addressId) => {
    if (formData.addresses.length > 1) {
      setFormData((prev) => ({
        ...prev,
        addresses: prev.addresses.filter((addr) => addr.id !== addressId),
      }))
    }
  }

  const handleInsuranceChange = (insuranceId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      insurances: prev.insurances.map((ins) => (ins.insurance_id === insuranceId ? { ...ins, [field]: value } : ins)),
    }))
    // Also clear errors
    const index = prev.insurances.findIndex(ins => ins.insurance_id === insuranceId)
    const errorKey = `insurance_${field}_${index}`
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }))
    }
  }
  
  const addInsurance = () => {
    const newInsurance = {
      insurance_id: Date.now(),
      insurance_type: "Primary",
      insurance_provider: "",
      treatment_type: "",
      rendering_provider: "",
      start_date: "",
      end_date: "",
      insurance_id_number: "",
      group_number: "",
      coinsurance: "",
      deductible: "",
      copay_rate: "",
    }
    setFormData((prev) => ({
      ...prev,
      insurances: [...prev.insurances, newInsurance],
    }))
  }

  const removeInsurance = (insuranceId) => {
    setFormData((prev) => ({
      ...prev,
      insurances: prev.insurances.filter((ins) => ins.insurance_id !== insuranceId),
      authorizations: prev.authorizations?.filter((auth) => auth.insurance_id !== insuranceId.toString()) || [],
    }))
  }

  const handleAuthorizationChange = (authUuid, field, value) => {
    setFormData((prev) => ({
      ...prev,
      authorizations: (prev.authorizations || []).map((auth) => {
        if (auth.auth_uuid === authUuid) {
          const updatedAuth = { ...auth, [field]: value }
           if (field === "units_approved_per_15_min" || field === "units_serviced") {
              const approved = Number.parseFloat(updatedAuth.units_approved_per_15_min) || 0;
              const serviced = Number.parseFloat(updatedAuth.units_serviced) || 0;
              updatedAuth.balance_units = (approved - serviced).toString();
           }
           return updatedAuth;
        }
        return auth
      }),
    }))
     // Also clear errors
    const index = prev.authorizations.findIndex(auth => auth.auth_uuid === authUuid)
    const errorKey = `auth_${field}_${index}`
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }))
    }
  }

  const addAuthorization = () => {
    const newAuth = {
      auth_uuid: `auth_${Date.now()}`,
      insurance_id: "",
      authorization_number: "",
      billing_codes: "",
      units_approved_per_15_min: "",
      units_serviced: "",
      balance_units: "",
      start_date: "",
      end_date: "",
      status: "Active",
    }
    setFormData((prev) => ({
      ...prev,
      authorizations: [...(prev.authorizations || []), newAuth],
    }))
  }

  const removeAuthorization = (authUuid) => {
    setFormData((prev) => ({
      ...prev,
      authorizations: prev.authorizations?.filter((auth) => auth.auth_uuid !== authUuid) || [],
    }))
  }

  const handleDocumentChange = (docUuid, field, value) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.map((doc) => (doc.doc_uuid === docUuid ? { ...doc, [field]: value } : doc)),
    }))
     // Also clear errors
    const index = prev.documents.findIndex(doc => doc.doc_uuid === docUuid)
    const errorKey = `document_${field}_${index}`
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }))
    }
  }
  
  const addDocument = () => {
    const newDoc = {
      doc_uuid: `doc_${Date.now()}`,
      document_type: "",
      file_url: "",
    }
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, newDoc],
    }))
  }

  const removeDocument = (docUuid) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((doc) => doc.doc_uuid !== docUuid),
    }))
  }

   const validateCurrentTab = (tab) => {
    const currentTabErrors = {}
    let hasErrors = false

    const requiredEntry = (field) => {
      if (!field || !field.trim()) {
        hasErrors = true
        return "Missing Required Entry"
      }
      return null
    }

    switch (tab) {
      case "personal":
        currentTabErrors.first_name = requiredEntry(formData.first_name)
        currentTabErrors.last_name = requiredEntry(formData.last_name)
        currentTabErrors.date_of_birth = requiredEntry(formData.date_of_birth)
        currentTabErrors.client_status = requiredEntry(formData.client_status)
        break

      case "contact":
        currentTabErrors.phone = requiredEntry(formData.phone)
        const emailError = requiredEntry(formData.email)
        if (emailError) {
          currentTabErrors.email = emailError
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          currentTabErrors.email = "Invalid email format"
          hasErrors = true
        }
        break

      case "guardian":
        if (formData.parent_first_name?.trim() || formData.parent_last_name?.trim()) {
          currentTabErrors.parent_first_name = requiredEntry(formData.parent_first_name)
          currentTabErrors.parent_last_name = requiredEntry(formData.parent_last_name)
          currentTabErrors.relationship_to_insured = requiredEntry(formData.relationship_to_insured)
          if (formData.relationship_to_insured === "Other") {
            currentTabErrors.relation_other = requiredEntry(formData.relation_other)
          }
        }
        if (formData.emergency_contact_name?.trim() || formData.emg_relationship?.trim() || formData.emg_phone?.trim()) {
          currentTabErrors.emergency_contact_name = requiredEntry(formData.emergency_contact_name)
          currentTabErrors.emg_relationship = requiredEntry(formData.emg_relationship)
          currentTabErrors.emg_phone = requiredEntry(formData.emg_phone)
        }
        break

      case "insurance":
        formData.insurances.forEach((insurance, idx) => {
          if (Object.values(insurance).some(val => typeof val === 'string' && val.trim())) {
              currentTabErrors[`insurance_insurance_type_${idx}`] = requiredEntry(insurance.insurance_type)
              currentTabErrors[`insurance_insurance_provider_${idx}`] = requiredEntry(insurance.insurance_provider)
              currentTabErrors[`insurance_treatment_type_${idx}`] = requiredEntry(insurance.treatment_type)
              currentTabErrors[`insurance_insurance_id_number_${idx}`] = requiredEntry(insurance.insurance_id_number)
              currentTabErrors[`insurance_group_number_${idx}`] = requiredEntry(insurance.group_number)
              currentTabErrors[`insurance_start_date_${idx}`] = requiredEntry(insurance.start_date)
          }
        })

        formData.authorizations?.forEach((auth, idx) => {
            if (Object.values(auth).some(val => typeof val === 'string' && val.trim())) {
                currentTabErrors[`auth_authorization_number_${idx}`] = requiredEntry(auth.authorization_number)
                currentTabErrors[`auth_billing_codes_${idx}`] = requiredEntry(auth.billing_codes)
                currentTabErrors[`auth_units_approved_per_15_min_${idx}`] = requiredEntry(auth.units_approved_per_15_min)
                currentTabErrors[`auth_start_date_${idx}`] = requiredEntry(auth.start_date)
                currentTabErrors[`auth_end_date_${idx}`] = requiredEntry(auth.end_date)
                currentTabErrors[`auth_insurance_id_${idx}`] = requiredEntry(auth.insurance_id)
                currentTabErrors[`auth_status_${idx}`] = requiredEntry(auth.status)
                
                const approved = Number.parseFloat(auth.units_approved_per_15_min) || 0
                const serviced = Number.parseFloat(auth.units_serviced) || 0
                if (serviced > approved) {
                  currentTabErrors[`auth_units_serviced_${idx}`] = "Cannot exceed approved units"
                  hasErrors = true
                }
            }
        })
        break

      case "documents":
        formData.documents.forEach((doc, idx) => {
          if (doc.document_type?.trim() || doc.file_url?.trim()) {
            currentTabErrors[`document_document_type_${idx}`] = requiredEntry(doc.document_type)
            currentTabErrors[`document_file_url_${idx}`] = requiredEntry(doc.file_url)
          }
        })
        break
        
      default:
        break
    }
    
    const finalErrors = Object.fromEntries(Object.entries(currentTabErrors).filter(([_, v]) => v != null));
    setErrors((prev) => ({ ...prev, ...finalErrors }))
    
    return hasErrors
  }
  
  const validateAllTabs = () => {
      let hasAnyErrors = false;
      let firstErrorTab = null;

      for (const tab of tabOrder) {
          const hasTabErrors = validateCurrentTab(tab);
          if (hasTabErrors && !firstErrorTab) {
              firstErrorTab = tab;
              hasAnyErrors = true;
          }
      }
      
      if (firstErrorTab) {
          setActiveTab(firstErrorTab);
      }
      
      return hasAnyErrors;
  };


  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({}) // Clear previous errors

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
    setErrors({})
    const hasErrors = validateCurrentTab(activeTab)
    if (hasErrors) {
      return
    }

    const currentIndex = tabOrder.indexOf(activeTab)
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1])
    } else {
      handleSave(e)
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
        value={value || ""}
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
      <Select value={value || ""} onValueChange={onValueChange}>
        <SelectTrigger id={id} className={errors[id] ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  )

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            {editingClient ? "Edit Client" : "Add New Client"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="space-y-2">
              <TabsList className="grid w-full grid-cols-3">
                {primaryTabs.map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="flex items-center gap-2">
                    {tab === "personal" && <><Users className="h-4 w-4" /> Personal *</>}
                    {tab === "contact" && <><Phone className="h-4 w-4" /> Contact *</>}
                    {tab === "insurance" && <><Shield className="h-4 w-4" /> Insurance</>}
                  </TabsTrigger>
                ))}
                
              </TabsList>

              <div className="flex justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2 bg-transparent">
                      More Options
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    {moreTabs.map((tab) => (
                      <DropdownMenuItem key={tab} onClick={() => setActiveTab(tab)}>
                        {tab === "guardian" && <><User className="h-4 w-4 mr-2" /> Guardian</>}
                        {tab === "documents" && <><File className="h-4 w-4 mr-2" /> Documents</>}
                        {tab === "notes" && <><FileText className="h-4 w-4 mr-2" /> Notes</>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" /> Personal Information
                    <Badge variant="destructive" className="ml-2">Required</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderInputWithError("first_name", "First Name *", formData.first_name, (e) => handleInputChange("first_name", e.target.value), { placeholder: "Enter first name" })}
                    {renderInputWithError("middle_name", "Middle Name", formData.middle_name, (e) => handleInputChange("middle_name", e.target.value), { placeholder: "Enter middle name" })}
                    {renderInputWithError("last_name", "Last Name *", formData.last_name, (e) => handleInputChange("last_name", e.target.value), { placeholder: "Enter last name" })}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {renderInputWithError("date_of_birth", "Date of Birth *", formData.date_of_birth, (e) => handleInputChange("date_of_birth", e.target.value), { type: "date" })}
                    {renderSelectWithError("gender", "Gender", formData.gender, (value) => handleInputChange("gender", value),
                      <>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                      </>, "Select gender")}
                    {renderInputWithError("preferred_language", "Preferred Language", formData.preferred_language, (e) => handleInputChange("preferred_language", e.target.value), { placeholder: "e.g., English, Spanish" })}
                    {renderSelectWithError("client_status", "Client Status *", formData.client_status, (value) => handleInputChange("client_status", value),
                      <>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Benefits Verification">Benefits Verification</SelectItem>
                        <SelectItem value="Prior Authorization">Prior Authorization</SelectItem>
                        <SelectItem value="Client Assessment">Client Assessment</SelectItem>
                        <SelectItem value="Pending Authorization">Pending Authorization</SelectItem>
                      </>, "Select status")}
                  </div>
                  <div>
                    {renderSelectWithError("wait_list_status", "Wait List Status", formData.wait_list_status, (value) => handleInputChange("wait_list_status", value),
                      <>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </>, "Select wait list status")}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-teal-600" /> Contact Information
                    <Badge variant="destructive" className="ml-2">Required</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {renderInputWithError("phone", "Phone Number *", formData.phone, (e) => handleInputChange("phone", e.target.value), { placeholder: "Enter phone number" })}
                     {renderInputWithError("email", "Email Address *", formData.email, (e) => handleInputChange("email", e.target.value), { type: "email", placeholder: "Enter email address" })}
                  </div>
                  <div>
                    {renderSelectWithError("appointment_reminder", "Appointment Reminder Preference", formData.appointment_reminder, (value) => handleInputChange("appointment_reminder", value),
                        <>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="phone">Phone Call</SelectItem>
                          <SelectItem value="none">No Reminders</SelectItem>
                        </>, "Select reminder preference")}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-teal-600" /> Address Information
                      <Badge variant="secondary" className="ml-2">Optional</Badge>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addAddress} className="flex items-center gap-2 bg-transparent">
                      <Plus className="h-4 w-4" /> Add Address
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.addresses.map((address, index) => (
                    <div key={address.id} className="border rounded-lg p-4 space-y-4">
                       <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Address #{index + 1}</h4>
                        {formData.addresses.length > 1 && (
                          <Button type="button" variant="outline" size="sm" onClick={() => removeAddress(address.id)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {renderSelectWithError(`service_location_${address.id}`, "Service Location", address.service_location, (value) => handleAddressChange(address.id, "service_location", value),
                        <>
                            <SelectItem value="Home">Home</SelectItem>
                            <SelectItem value="Clinic">Clinic</SelectItem>
                            <SelectItem value="School">School</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </>, "Select service location")}
                      {renderInputWithError(`address_line_1_${address.id}`, "Address Line 1", address.address_line_1, (e) => handleAddressChange(address.id, "address_line_1", e.target.value), { placeholder: "Enter street address" })}
                      {renderInputWithError(`address_line_2_${address.id}`, "Address Line 2", address.address_line_2, (e) => handleAddressChange(address.id, "address_line_2", e.target.value), { placeholder: "Apartment, suite, etc." })}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {renderInputWithError(`city_${address.id}`, "City", address.city, (e) => handleAddressChange(address.id, "city", e.target.value), { placeholder: "Enter city" })}
                        {renderInputWithError(`state_${address.id}`, "State", address.state, (e) => handleAddressChange(address.id, "state", e.target.value), { placeholder: "Enter state" })}
                        {renderInputWithError(`zipcode_${address.id}`, "ZIP Code", address.zipcode, (e) => handleAddressChange(address.id, "zipcode", e.target.value), { placeholder: "Enter ZIP code" })}
                      </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            {renderSelectWithError(`country_${address.id}`, "Country", address.country, (value) => { handleAddressChange(address.id, "country", value); if (value !== "Other") { handleAddressChange(address.id, "countryOther", "")}},
                            <>
                                {popularCountries.map((country) => ( <SelectItem key={country} value={country}>{country}</SelectItem> ))}
                            </>, "Select country")}
                          {address.country === "Other" && (
                            renderInputWithError(`countryOther_${address.id}`, "Specify Country", address.countryOther, (e) => handleAddressChange(address.id, "countryOther", e.target.value), { placeholder: "Enter country name" })
                          )}
                        </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="guardian" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-teal-600" /> Parent/Guardian Information
                             <Badge variant="secondary" className="ml-2">Optional</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderInputWithError("parent_first_name", "Parent/Guardian First Name", formData.parent_first_name, (e) => handleInputChange("parent_first_name", e.target.value), { placeholder: "Enter first name" })}
                            {renderInputWithError("parent_last_name", "Parent/Guardian Last Name", formData.parent_last_name, (e) => handleInputChange("parent_last_name", e.target.value), { placeholder: "Enter last name" })}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {renderSelectWithError("relationship_to_insured", "Relationship to Client", formData.relationship_to_insured, (value) => handleInputChange("relationship_to_insured", value),
                                <>
                                    <SelectItem value="Parent">Parent</SelectItem>
                                    <SelectItem value="Guardian">Guardian</SelectItem>
                                    <SelectItem value="Spouse">Spouse</SelectItem>
                                    <SelectItem value="Sibling">Sibling</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </>, "Select relationship")}
                            {formData.relationship_to_insured === "Other" && (
                                renderInputWithError("relation_other", "Specify Relationship", formData.relation_other, (e) => handleInputChange("relation_other", e.target.value), { placeholder: "Enter relationship" })
                            )}
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Heart className="h-5 w-5 text-teal-600" /> Emergency Contact
                            <Badge variant="secondary" className="ml-2">Optional</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {renderInputWithError("emergency_contact_name", "Emergency Contact Name", formData.emergency_contact_name, (e) => handleInputChange("emergency_contact_name", e.target.value), { placeholder: "Enter contact name" })}
                             {renderInputWithError("emg_relationship", "Relationship", formData.emg_relationship, (e) => handleInputChange("emg_relationship", e.target.value), { placeholder: "Enter relationship" })}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderInputWithError("emg_phone", "Emergency Contact Phone", formData.emg_phone, (e) => handleInputChange("emg_phone", e.target.value), { placeholder: "Enter phone number" })}
                            {renderInputWithError("emg_email", "Emergency Contact Email", formData.emg_email, (e) => handleInputChange("emg_email", e.target.value), { type: "email", placeholder: "Enter email address" })}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            
            <TabsContent value="insurance" className="space-y-6">
                <Card>
                    <CardHeader>
                         <CardTitle className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-teal-600" /> Insurance Information
                                <Badge variant="secondary" className="ml-2">Optional</Badge>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addInsurance} className="flex items-center gap-2 bg-transparent">
                                <Plus className="h-4 w-4" /> Add Insurance
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {formData.insurances.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No insurance information added yet.</p>
                        ) : (
                            <div className="space-y-6">
                                {formData.insurances.map((insurance, index) => (
                                <div key={insurance.insurance_id} className="border rounded-lg p-4 space-y-4">
                                     <div className="flex items-center justify-between">
                                        <h4 className="font-semibold">Insurance #{index + 1}</h4>
                                        <Button type="button" variant="outline" size="sm" onClick={() => removeInsurance(insurance.insurance_id)} className="text-red-600 hover:text-red-700">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderSelectWithError(`insurance_insurance_type_${index}`, "Insurance Type", insurance.insurance_type, (value) => handleInsuranceChange(insurance.insurance_id, "insurance_type", value),
                                            <> <SelectItem value="Primary">Primary</SelectItem> <SelectItem value="Secondary">Secondary</SelectItem> </>, "Select type")}
                                        {renderInputWithError(`insurance_insurance_provider_${index}`, "Insurance Provider", insurance.insurance_provider, (e) => handleInsuranceChange(insurance.insurance_id, "insurance_provider", e.target.value), { placeholder: "Enter provider name" })}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInputWithError(`insurance_treatment_type_${index}`, "Treatment Type", insurance.treatment_type, (e) => handleInsuranceChange(insurance.insurance_id, "treatment_type", e.target.value), { placeholder: "Enter treatment type" })}
                                        {renderInputWithError(`insurance_rendering_provider_${index}`, "Rendering Provider", insurance.rendering_provider, (e) => handleInsuranceChange(insurance.insurance_id, "rendering_provider", e.target.value), { placeholder: "Enter rendering provider" })}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInputWithError(`insurance_insurance_id_number_${index}`, "Insurance ID Number", insurance.insurance_id_number, (e) => handleInsuranceChange(insurance.insurance_id, "insurance_id_number", e.target.value), { placeholder: "Enter ID number" })}
                                        {renderInputWithError(`insurance_group_number_${index}`, "Group Number", insurance.group_number, (e) => handleInsuranceChange(insurance.insurance_id, "group_number", e.target.value), { placeholder: "Enter group number" })}
                                    </div>
                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {renderInputWithError(`insurance_coinsurance_${index}`, "Coinsurance", insurance.coinsurance, (e) => handleInsuranceChange(insurance.insurance_id, "coinsurance", e.target.value), { placeholder: "e.g., 20%" })}
                                        {renderInputWithError(`insurance_deductible_${index}`, "Deductible", insurance.deductible, (e) => handleInsuranceChange(insurance.insurance_id, "deductible", e.target.value), { placeholder: "e.g., $500" })}
                                        {renderInputWithError(`insurance_copay_rate_${index}`, "Copay Rate", insurance.copay_rate, (e) => handleInsuranceChange(insurance.insurance_id, "copay_rate", e.target.value), { placeholder: "e.g., $25" })}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInputWithError(`insurance_start_date_${index}`, "Start Date", insurance.start_date, (e) => handleInsuranceChange(insurance.insurance_id, "start_date", e.target.value), { type: "date" })}
                                        {renderInputWithError(`insurance_end_date_${index}`, "End Date", insurance.end_date, (e) => handleInsuranceChange(insurance.insurance_id, "end_date", e.target.value), { type: "date" })}
                                    </div>
                                </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                {formData.insurances.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-teal-600" /> Authorizations
                                <Badge variant="secondary" className="ml-2">Optional</Badge>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addAuthorization} className="flex items-center gap-2 bg-transparent">
                                <Plus className="h-4 w-4" /> Add Authorization
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                         {(!formData.authorizations || formData.authorizations.length === 0) ? (
                            <p className="text-gray-500 text-center py-8">No authorizations added yet.</p>
                         ) : (
                            <div className="space-y-6">
                            {formData.authorizations.map((auth, index) => (
                                <div key={auth.auth_uuid} className="border rounded-lg p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold">Authorization #{index + 1}</h4>
                                        <Button type="button" variant="outline" size="sm" onClick={() => removeAuthorization(auth.auth_uuid)} className="text-red-600 hover:text-red-700">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderSelectWithError(`auth_insurance_id_${index}`, "Linked Insurance", auth.insurance_id, (value) => handleAuthorizationChange(auth.auth_uuid, "insurance_id", value), 
                                            formData.insurances.map((ins, idx) => (<SelectItem key={ins.insurance_id} value={ins.insurance_id.toString()}>{ins.insurance_provider || `Insurance #${idx + 1}`}</SelectItem>)), "Select insurance")}
                                        {renderInputWithError(`auth_authorization_number_${index}`, "Authorization Number", auth.authorization_number, (e) => handleAuthorizationChange(auth.auth_uuid, "authorization_number", e.target.value), { placeholder: "Enter authorization number" })}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInputWithError(`auth_billing_codes_${index}`, "Billing Codes", auth.billing_codes, (e) => handleAuthorizationChange(auth.auth_uuid, "billing_codes", e.target.value), { placeholder: "Enter billing codes" })}
                                        {renderSelectWithError(`auth_status_${index}`, "Status", auth.status, (value) => handleAuthorizationChange(auth.auth_uuid, "status", value),
                                            <> <SelectItem value="Active">Active</SelectItem> <SelectItem value="Pending">Pending</SelectItem> <SelectItem value="Expired">Expired</SelectItem> <SelectItem value="Denied">Denied</SelectItem> </>, "Select status")}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {renderInputWithError(`auth_units_approved_per_15_min_${index}`, "Units Approved (per 15 min)", auth.units_approved_per_15_min, (e) => handleAuthorizationChange(auth.auth_uuid, "units_approved_per_15_min", e.target.value), { type: "number", placeholder: "Enter units" })}
                                        {renderInputWithError(`auth_units_serviced_${index}`, "Units Serviced", auth.units_serviced, (e) => handleAuthorizationChange(auth.auth_uuid, "units_serviced", e.target.value), { type: "number", placeholder: "Enter serviced units" })}
                                        {renderInputWithError(`auth_balance_units_${index}`, "Balance Units", auth.balance_units, (e) => handleAuthorizationChange(auth.auth_uuid, "balance_units", e.target.value), { placeholder: "Balance", readOnly: true })}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInputWithError(`auth_start_date_${index}`, "Start Date", auth.start_date, (e) => handleAuthorizationChange(auth.auth_uuid, "start_date", e.target.value), { type: "date" })}
                                        {renderInputWithError(`auth_end_date_${index}`, "End Date", auth.end_date, (e) => handleAuthorizationChange(auth.auth_uuid, "end_date", e.target.value), { type: "date" })}
                                    </div>
                                </div>
                            ))}
                            </div>
                         )}
                    </CardContent>
                </Card>
                )}
            </TabsContent>
            
            <TabsContent value="documents" className="space-y-6">
                 <Card>
                    <CardHeader>
                         <CardTitle className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2">
                                <File className="h-5 w-5 text-teal-600" /> Documents
                                <Badge variant="secondary" className="ml-2">Optional</Badge>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addDocument} className="flex items-center gap-2 bg-transparent">
                                <Plus className="h-4 w-4" /> Add Document
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {formData.documents.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No documents added yet.</p>
                        ) : (
                            <div className="space-y-4">
                            {formData.documents.map((doc, index) => (
                                <div key={doc.doc_uuid} className="border rounded-lg p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold">Document #{index + 1}</h4>
                                        <Button type="button" variant="outline" size="sm" onClick={() => removeDocument(doc.doc_uuid)} className="text-red-600 hover:text-red-700">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInputWithError(`document_document_type_${index}`, "Document Type", doc.document_type, (e) => handleDocumentChange(doc.doc_uuid, "document_type", e.target.value), { placeholder: "e.g., Insurance Card, ID" })}
                                        {renderInputWithError(`document_file_url_${index}`, "File URL", doc.file_url, (e) => handleDocumentChange(doc.doc_uuid, "file_url", e.target.value), { placeholder: "Enter file URL" })}
                                    </div>
                                </div>
                            ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-6">
                <Card>
                    <CardHeader>
                         <CardTitle className="flex items-center gap-2">
                             <FileText className="h-5 w-5 text-teal-600" /> Notes & Additional Information
                             <Badge variant="secondary" className="ml-2">Optional</Badge>
                         </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="client_notes">Client Notes</Label>
                            <Textarea id="client_notes" value={formData.client_notes} onChange={(e) => handleInputChange("client_notes", e.target.value)} placeholder="Enter any notes about the client..." rows={4} />
                        </div>
                         <div>
                            <Label htmlFor="other_information">Other Information</Label>
                            <Textarea id="other_information" value={formData.other_information} onChange={(e) => handleInputChange("other_information", e.target.value)} placeholder="Enter any additional information..." rows={4} />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            
          </Tabs>

          <div className="flex justify-between gap-3 pt-6 border-t">
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {activeTab !== "personal" && (
                <Button type="button" variant="outline" onClick={handlePreviousTab}>
                  Previous
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700">
                {saving ? "Saving..." : isLastTab || !editingClient ? (editingClient ? "Update Client" : "Add Client") : "Save & Continue"}
              </Button>
              {!isLastTab && (
                <Button type="button" onClick={handleNextTab} variant="outline">
                  Next
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
