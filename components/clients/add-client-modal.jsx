"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PlusCircle,
  MinusCircle,
  User,
  Shield,
  FileText,
  Phone,
} from "lucide-react";

// --- FIX #1: Define a single, constant source of truth for the form's structure. ---
const initialFormData = {
  id: "",
  client_uuid: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  parent_first_name: "",
  parent_last_name: "",
  relationship_to_insured: "Self",
  relation_other: "",
  preferred_language: "",
  insurance: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  zipcode: "",
  country: "USA",
  phone: "",
  email: "",
  appointment_reminder: "both",
  emergency_contact_name: "",
  emg_relationship: "",
  emg_phone: "",
  emg_email: "",
  client_status: "New",
  wait_list_status: "No",
  client_notes: "",
  other_information: "",
  insurances: [
    {
      description: "",
      insurance_type: "Primary",
      insurance_provider: "",
      treatment_type: "Behavioral therapy",
      rendering_provider: "",
      start_date: "",
      end_date: "",
      authorization_number: "",
      insurance_id_number: "",
      group_number: "",
      diagnosis_1: "",
      diagnosis_2: "",
      diagnosis_3: "",
      diagnosis_4: "",
      diagnosis_5: "",
      coinsurance: "",
      deductible: "",
      copay_per: "hr",
      copay_rate: "",
    },
  ],
  authorizations: [
    {
      authorization_number: "",
      billing_codes: "",
      units_approved_per_15_min: "",
      start_date: "",
      end_date: "",
    },
  ],
};

export default function AddClientModal({
  isOpen,
  onClose,
  onSave,
  editingClient,
}) {
  // --- FIX #2: Initialize state from the single source of truth. ---
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FIX #3: Greatly simplify the useEffect hook for robust state management. ---
  useEffect(() => {
    if (isOpen) {
      if (editingClient) {
        // For editing, merge the client's data onto the blank form structure.
        // This guarantees that 'id' and 'client_uuid' are always included.
        setFormData({
          ...initialFormData,
          ...editingClient,
          // Ensure arrays are not empty if editingClient has none
          insurances:
            editingClient.insurances?.length > 0
              ? editingClient.insurances
              : initialFormData.insurances,
          authorizations:
            editingClient.authorizations?.length > 0
              ? editingClient.authorizations
              : initialFormData.authorizations,
        });
      } else {
        // For adding, simply reset to the initial blank form state.
        setFormData(initialFormData);
      }
      setErrors({});
      setActiveTab("basic");
    }
  }, [isOpen, editingClient]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSelectChange = (value, fieldName) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: "" }));
    }
  };

  const handleInsuranceChange = (index, field, value) => {
    setFormData((prev) => {
      const newInsurances = [...prev.insurances];
      newInsurances[index] = { ...newInsurances[index], [field]: value };
      return { ...prev, insurances: newInsurances };
    });
  };

  const handleAuthorizationChange = (index, field, value) => {
    setFormData((prev) => {
      const newAuthorizations = [...prev.authorizations];
      newAuthorizations[index] = { ...newAuthorizations[index], [field]: value };
      return { ...prev, authorizations: newAuthorizations };
    });
  };

  const addInsurance = () => {
    setFormData((prev) => ({
      ...prev,
      insurances: [
        ...prev.insurances,
        {
          description: "",
          insurance_type: "Secondary",
          insurance_provider: "",
          treatment_type: "Behavioral therapy",
          rendering_provider: "",
          start_date: "",
          end_date: "",
          authorization_number: "",
          insurance_id_number: "",
          group_number: "",
          diagnosis_1: "",
          diagnosis_2: "",
          diagnosis_3: "",
          diagnosis_4: "",
          diagnosis_5: "",
          coinsurance: "",
          deductible: "",
          copay_per: "hr",
          copay_rate: "",
        },
      ],
    }));
  };

  const removeInsurance = (index) => {
    if (formData.insurances.length > 1) {
      setFormData((prev) => ({
        ...prev,
        insurances: prev.insurances.filter((_, i) => i !== index),
      }));
    }
  };

  const addAuthorization = () => {
    setFormData((prev) => ({
      ...prev,
      authorizations: [
        ...prev.authorizations,
        {
          authorization_number: "",
          billing_codes: "",
          units_approved_per_15_min: "",
          start_date: "",
          end_date: "",
        },
      ],
    }));
  };

  const removeAuthorization = (index) => {
    if (formData.authorizations.length > 1) {
      setFormData((prev) => ({
        ...prev,
        authorizations: prev.authorizations.filter((_, i) => i !== index),
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.first_name?.trim()) newErrors.first_name = "First name is required";
    if (!formData.last_name?.trim()) newErrors.last_name = "Last name is required";
    if (!formData.date_of_birth) newErrors.date_of_birth = "Date of birth is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (validateForm()) {
      setIsSubmitting(true);
      try {
        await onSave(formData);
      } catch (error) {
        console.error("Error saving client:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
          <DialogDescription>
            {editingClient ? "Make changes to the client profile here." : "Fill in the details to add a new client."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Basic Info
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Contact
              </TabsTrigger>
              <TabsTrigger value="insurance" className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Insurance
              </TabsTrigger>
              <TabsTrigger value="auth" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Authorization
              </TabsTrigger>
            </TabsList>
            
            {/* The rest of your JSX remains the same... */}
            {/* It will now correctly read from the robust formData state. */}
            
            <TabsContent value="basic" className="space-y-6 mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="first_name">First Name *</Label>
                                <Input id="first_name" name="first_name" type="text" value={formData.first_name} onChange={handleChange} placeholder="Enter first name" className={errors.first_name ? "border-red-500" : ""} disabled={isSubmitting}/>
                                {errors.first_name && (<p className="text-red-500 text-sm">{errors.first_name}</p>)}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="middle_name">Middle Name</Label>
                                <Input id="middle_name" name="middle_name" type="text" value={formData.middle_name} onChange={handleChange} placeholder="Enter middle name" disabled={isSubmitting}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last_name">Last Name *</Label>
                                <Input id="last_name" name="last_name" type="text" value={formData.last_name} onChange={handleChange} placeholder="Enter last name" className={errors.last_name ? "border-red-500" : ""} disabled={isSubmitting}/>
                                {errors.last_name && (<p className="text-red-500 text-sm">{errors.last_name}</p>)}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date_of_birth">Date of Birth *</Label>
                                <Input id="date_of_birth" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} className={errors.date_of_birth ? "border-red-500" : ""} disabled={isSubmitting}/>
                                {errors.date_of_birth && (<p className="text-red-500 text-sm">{errors.date_of_birth}</p>)}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">Gender</Label>
                                <Select value={formData.gender} onValueChange={(val) => handleSelectChange(val, "gender")} disabled={isSubmitting}>
                                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="preferred_language">Preferred Language</Label>
                                <Input id="preferred_language" name="preferred_language" type="text" value={formData.preferred_language} onChange={handleChange} placeholder="Enter preferred language" disabled={isSubmitting}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="client_status">Client Status</Label>
                                <Select value={formData.client_status} onValueChange={(val) => handleSelectChange(val, "client_status")} disabled={isSubmitting}>
                                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
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
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="wait_list_status">Wait List Status</Label>
                            <Select value={formData.wait_list_status} onValueChange={(val) => handleSelectChange(val, "wait_list_status")} disabled={isSubmitting}>
                                <SelectTrigger><SelectValue placeholder="Select wait list status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Parent/Guardian Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="parent_first_name">Parent First Name</Label>
                                <Input id="parent_first_name" name="parent_first_name" type="text" value={formData.parent_first_name} onChange={handleChange} placeholder="Enter parent's first name" disabled={isSubmitting}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="parent_last_name">Parent Last Name</Label>
                                <Input id="parent_last_name" name="parent_last_name" type="text" value={formData.parent_last_name} onChange={handleChange} placeholder="Enter parent's last name" disabled={isSubmitting}/>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="relationship_to_insured">Relationship to Insured</Label>
                                <Select value={formData.relationship_to_insured} onValueChange={(val) => handleSelectChange(val, "relationship_to_insured")} disabled={isSubmitting}>
                                    <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Self">Self</SelectItem>
                                        <SelectItem value="Mother">Mother</SelectItem>
                                        <SelectItem value="Father">Father</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.relationship_to_insured === "Other" && (
                            <div className="space-y-2">
                                <Label htmlFor="relation_other">Specify Relationship</Label>
                                <Input id="relation_other" name="relation_other" type="text" value={formData.relation_other} onChange={handleChange} placeholder="Specify the relationship" disabled={isSubmitting}/>
                            </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {/* ... The rest of your JSX form structure is identical */}
            </TabsContent>
            
            {/* The rest of the TabsContent elements and the closing form tags go here */}
          </Tabs>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingClient ? "Save Changes" : "Add Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
