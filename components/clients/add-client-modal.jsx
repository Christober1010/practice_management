"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Users, Shield, FileText, Phone, MapPin, Heart, User } from "lucide-react";

const initialClientState = {
  // Personal Information
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  preferred_language: "",
  client_status: "New",
  wait_list_status: "No",
  
  // Contact Information
  phone: "",
  email: "",
  appointment_reminder: "",
  
  // Address Information
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  zipcode: "",
  
  // Parent/Guardian Information
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
  
  // Arrays for dynamic sections
  insurances: [],
  authorizations: []
};

const initialInsurance = {
  insurance_type: "Primary",
  insurance_provider: "",
  treatment_type: "",
  insurance_id_number: "",
  group_number: "",
  coinsurance: "",
  deductible: "",
  start_date: "",
  end_date: ""
};

const initialAuthorization = {
  authorization_number: "",
  billing_codes: "",
  units_approved_per_15_min: "",
  start_date: "",
  end_date: ""
};

export default function AddClientModal({ isOpen, onClose, onSave, editingClient }) {
  const [formData, setFormData] = useState(initialClientState);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("personal");

  useEffect(() => {
    if (editingClient) {
      setFormData({
        ...initialClientState,
        ...editingClient,
        insurances: Array.isArray(editingClient.insurances) && editingClient.insurances.length > 0 
          ? editingClient.insurances 
          : [initialInsurance],
        authorizations: Array.isArray(editingClient.authorizations) && editingClient.authorizations.length > 0 
          ? editingClient.authorizations 
          : [initialAuthorization],
        date_of_birth: editingClient.date_of_birth?.slice(0, 10) || "",
      });
    } else {
      setFormData({
        ...initialClientState,
        insurances: [initialInsurance],
        authorizations: [initialAuthorization]
      });
    }
    setErrors({});
    setActiveTab("personal");
  }, [editingClient, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleInsuranceChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      insurances: prev.insurances.map((insurance, i) =>
        i === index ? { ...insurance, [field]: value } : insurance
      )
    }));
  };

  const handleAuthorizationChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      authorizations: prev.authorizations.map((auth, i) =>
        i === index ? { ...auth, [field]: value } : auth
      )
    }));
  };

  const addInsurance = () => {
    setFormData(prev => ({
      ...prev,
      insurances: [...prev.insurances, { ...initialInsurance, insurance_type: "Secondary" }]
    }));
  };

  const removeInsurance = (index) => {
    if (formData.insurances.length > 1) {
      setFormData(prev => ({
        ...prev,
        insurances: prev.insurances.filter((_, i) => i !== index)
      }));
    }
  };

  const addAuthorization = () => {
    setFormData(prev => ({
      ...prev,
      authorizations: [...prev.authorizations, initialAuthorization]
    }));
  };

  const removeAuthorization = (index) => {
    if (formData.authorizations.length > 1) {
      setFormData(prev => ({
        ...prev,
        authorizations: prev.authorizations.filter((_, i) => i !== index)
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }
    if (!formData.date_of_birth) {
      newErrors.date_of_birth = "Date of birth is required";
    }
    
    setErrors(newErrors);
    
    // If there are errors in personal tab, switch to it
    if (newErrors.first_name || newErrors.last_name || newErrors.date_of_birth) {
      setActiveTab("personal");
    }
    
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const cleanedData = {
      ...formData,
      insurances: formData.insurances.filter(insurance => 
        insurance.insurance_provider || insurance.insurance_id_number
      ),
      authorizations: formData.authorizations.filter(auth => 
        auth.authorization_number || auth.billing_codes
      )
    };

    onSave(cleanedData);
  };

  const handleClose = () => {
    setFormData(initialClientState);
    setErrors({});
    setActiveTab("personal");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            {editingClient ? "Edit Client" : "Add New Client"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact
              </TabsTrigger>
              <TabsTrigger value="guardian" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Guardian
              </TabsTrigger>
              <TabsTrigger value="insurance" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Insurance
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </TabsTrigger>
            </TabsList>

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => handleInputChange("first_name", e.target.value)}
                        className={errors.first_name ? "border-red-300" : ""}
                        placeholder="Enter first name"
                      />
                      {errors.first_name && (
                        <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="middle_name">Middle Name</Label>
                      <Input
                        id="middle_name"
                        value={formData.middle_name}
                        onChange={(e) => handleInputChange("middle_name", e.target.value)}
                        placeholder="Enter middle name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => handleInputChange("last_name", e.target.value)}
                        className={errors.last_name ? "border-red-300" : ""}
                        placeholder="Enter last name"
                      />
                      {errors.last_name && (
                        <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="date_of_birth">Date of Birth *</Label>
                      <Input
                        id="date_of_birth"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                        className={errors.date_of_birth ? "border-red-300" : ""}
                      />
                      {errors.date_of_birth && (
                        <p className="text-red-500 text-sm mt-1">{errors.date_of_birth}</p>
                      )}
                    </div>
                    
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
                    <div>
                      <Label htmlFor="client_status">Client Status</Label>
                      <Select value={formData.client_status} onValueChange={(value) => handleInputChange("client_status", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                          <SelectItem value="Benefits Verification">Benefits Verification</SelectItem>
                          <SelectItem value="Prior Authorization">Prior Authorization</SelectItem>
                          <SelectItem value="Client Assessment">Client Assessment</SelectItem>
                          <SelectItem value="Pending Authorization">Pending Authorization</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="wait_list_status">Wait List Status</Label>
                      <Select value={formData.wait_list_status} onValueChange={(value) => handleInputChange("wait_list_status", value)}>
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

            {/* Contact Information Tab */}
            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-teal-600" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        placeholder="Enter phone number"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="appointment_reminder">Appointment Reminder Preference</Label>
                    <Select value={formData.appointment_reminder} onValueChange={(value) => handleInputChange("appointment_reminder", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reminder preference" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text Message</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone Call</SelectItem>
                        <SelectItem value="none">No Reminder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Address Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-teal-600" />
                    Address Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="address_line_1">Address Line 1</Label>
                    <Input
                      id="address_line_1"
                      value={formData.address_line_1}
                      onChange={(e) => handleInputChange("address_line_1", e.target.value)}
                      placeholder="Enter street address"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="address_line_2">Address Line 2</Label>
                    <Input
                      id="address_line_2"
                      value={formData.address_line_2}
                      onChange={(e) => handleInputChange("address_line_2", e.target.value)}
                      placeholder="Apartment, suite, etc. (optional)"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => handleInputChange("city", e.target.value)}
                        placeholder="Enter city"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => handleInputChange("state", e.target.value)}
                        placeholder="Enter state"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="zipcode">ZIP Code</Label>
                      <Input
                        id="zipcode"
                        value={formData.zipcode}
                        onChange={(e) => handleInputChange("zipcode", e.target.value)}
                        placeholder="Enter ZIP code"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Guardian & Emergency Contact Tab */}
            <TabsContent value="guardian" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-teal-600" />
                    Parent/Guardian Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="parent_first_name">Parent/Guardian First Name</Label>
                      <Input
                        id="parent_first_name"
                        value={formData.parent_first_name}
                        onChange={(e) => handleInputChange("parent_first_name", e.target.value)}
                        placeholder="Enter parent/guardian first name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="parent_last_name">Parent/Guardian Last Name</Label>
                      <Input
                        id="parent_last_name"
                        value={formData.parent_last_name}
                        onChange={(e) => handleInputChange("parent_last_name", e.target.value)}
                        placeholder="Enter parent/guardian last name"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="relationship_to_insured">Relationship to Client</Label>
                      <Select value={formData.relationship_to_insured} onValueChange={(value) => handleInputChange("relationship_to_insured", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Parent">Parent</SelectItem>
                          <SelectItem value="Guardian">Guardian</SelectItem>
                          <SelectItem value="Spouse">Spouse</SelectItem>
                          <SelectItem value="Self">Self</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {formData.relationship_to_insured === "Other" && (
                      <div>
                        <Label htmlFor="relation_other">Specify Other Relationship</Label>
                        <Input
                          id="relation_other"
                          value={formData.relation_other}
                          onChange={(e) => handleInputChange("relation_other", e.target.value)}
                          placeholder="Enter relationship"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-teal-600" />
                    Emergency Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                      <Input
                        id="emergency_contact_name"
                        value={formData.emergency_contact_name}
                        onChange={(e) => handleInputChange("emergency_contact_name", e.target.value)}
                        placeholder="Enter emergency contact name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="emg_relationship">Relationship</Label>
                      <Input
                        id="emg_relationship"
                        value={formData.emg_relationship}
                        onChange={(e) => handleInputChange("emg_relationship", e.target.value)}
                        placeholder="Enter relationship"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emg_phone">Emergency Contact Phone</Label>
                      <Input
                        id="emg_phone"
                        value={formData.emg_phone}
                        onChange={(e) => handleInputChange("emg_phone", e.target.value)}
                        placeholder="Enter emergency contact phone"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="emg_email">Emergency Contact Email</Label>
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

            {/* Insurance Tab */}
            <TabsContent value="insurance" className="space-y-6">
              {/* Insurance Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-teal-600" />
                    Insurance Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.insurances.map((insurance, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-slate-50 relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">Insurance #{index + 1}</h4>
                          <Badge variant="outline" className={
                            insurance.insurance_type === "Primary" 
                              ? "border-blue-300 text-blue-700" 
                              : "border-green-300 text-green-700"
                          }>
                            {insurance.insurance_type}
                          </Badge>
                        </div>
                        
                        {formData.insurances.length > 1 && (
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
                        <div>
                          <Label>Insurance Type</Label>
                          <Select 
                            value={insurance.insurance_type} 
                            onValueChange={(value) => handleInsuranceChange(index, "insurance_type", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select insurance type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Primary">Primary</SelectItem>
                              <SelectItem value="Secondary">Secondary</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Insurance Provider</Label>
                            <Input
                              value={insurance.insurance_provider}
                              onChange={(e) => handleInsuranceChange(index, "insurance_provider", e.target.value)}
                              placeholder="Enter insurance provider"
                            />
                          </div>
                          
                          <div>
                            <Label>Treatment Type</Label>
                            <Input
                              value={insurance.treatment_type}
                              onChange={(e) => handleInsuranceChange(index, "treatment_type", e.target.value)}
                              placeholder="Enter treatment type"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Insurance ID</Label>
                            <Input
                              value={insurance.insurance_id_number}
                              onChange={(e) => handleInsuranceChange(index, "insurance_id_number", e.target.value)}
                              placeholder="Enter insurance ID"
                            />
                          </div>
                          
                          <div>
                            <Label>Group Number</Label>
                            <Input
                              value={insurance.group_number}
                              onChange={(e) => handleInsuranceChange(index, "group_number", e.target.value)}
                              placeholder="Enter group number"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Coinsurance</Label>
                            <Input
                              value={insurance.coinsurance}
                              onChange={(e) => handleInsuranceChange(index, "coinsurance", e.target.value)}
                              placeholder="Enter coinsurance"
                            />
                          </div>
                          
                          <div>
                            <Label>Deductible</Label>
                            <Input
                              value={insurance.deductible}
                              onChange={(e) => handleInsuranceChange(index, "deductible", e.target.value)}
                              placeholder="Enter deductible"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Start Date</Label>
                            <Input
                              type="date"
                              value={insurance.start_date}
                              onChange={(e) => handleInsuranceChange(index, "start_date", e.target.value)}
                            />
                          </div>
                          
                          <div>
                            <Label>End Date</Label>
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
                    className="w-full border-dashed border-slate-300"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Insurance
                  </Button>
                </CardContent>
              </Card>

              {/* Authorization Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" />
                    Authorization Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.authorizations.map((auth, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-slate-50 relative">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Authorization #{index + 1}</h4>
                        
                        {formData.authorizations.length > 1 && (
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
                          <div>
                            <Label>Authorization Number</Label>
                            <Input
                              value={auth.authorization_number}
                              onChange={(e) => handleAuthorizationChange(index, "authorization_number", e.target.value)}
                              placeholder="Enter authorization number"
                            />
                          </div>
                          
                          <div>
                            <Label>Billing Codes</Label>
                            <Input
                              value={auth.billing_codes}
                              onChange={(e) => handleAuthorizationChange(index, "billing_codes", e.target.value)}
                              placeholder="Enter billing codes"
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Units Approved (per 15 min)</Label>
                          <Input
                            value={auth.units_approved_per_15_min}
                            onChange={(e) => handleAuthorizationChange(index, "units_approved_per_15_min", e.target.value)}
                            placeholder="Enter approved units"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Start Date</Label>
                            <Input
                              type="date"
                              value={auth.start_date}
                              onChange={(e) => handleAuthorizationChange(index, "start_date", e.target.value)}
                            />
                          </div>
                          
                          <div>
                            <Label>End Date</Label>
                            <Input
                              type="date"
                              value={auth.end_date}
                              onChange={(e) => handleAuthorizationChange(index, "end_date", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAuthorization}
                    className="w-full border-dashed border-slate-300"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Authorization
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" />
                    Notes & Additional Information
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

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
              {editingClient ? "Update Client" : "Add Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
