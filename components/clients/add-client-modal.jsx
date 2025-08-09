'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Users, Shield, FileText, Phone, MapPin, Heart, User, File } from 'lucide-react'
import toast from 'react-hot-toast'

const popularCountries = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "India",
  "Other",
];

const authorizationStatuses = ["Active", "Inactive", "Expired"];

const documentTypes = [
  "Insurance",
  "Intake Doc",
  "Clinical Doc",
  "Service Doc",
  "Misc",
];

const billingCodeOptions = [
  { code: "97151", name: "Behavior Identification Assessment" },
  { code: "97152", name: "Behavior Identification Supporting Assessment" },
  { code: "97153", name: "Adaptive Behavior Treatment by Protocol" },
  { code: "97154", name: "Group Adaptive Behavior Treatment by Protocol" },
  { code: "97155", name: "Adaptive Behavior Treatment with Protocol Modification" },
  { code: "97156", name: "Family Adaptive Behavior Treatment Guidance" },
  { code: "97157", name: "Multiple Family Group Adaptive Behavior Treatment Guidance" },
  { code: "97158", name: "Group Adaptive Behavior Treatment with Protocol Modification" },
];

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
  end_date: "",
};

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
};

const emptyDocument = {
  document_type: "",
  file_url: "",
};

function generateDocUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Mapping of tabs to their associated form field prefixes for error checking
const tabFieldMapping = {
  personal: ["first_name", "last_name", "date_of_birth", "client_status"],
  contact: ["phone", "email", "appointment_reminder", "address_line_1", "city", "state", "zipcode", "country"],
  guardian: ["parent_first_name", "parent_last_name", "relationship_to_insured", "relation_other", "emergency_contact_name", "emg_relationship", "emg_phone"],
  insurance: ["insurance_", "auth_"], // Prefixes for array fields
  documents: ["document_"], // Prefix for array fields
  notes: ["client_notes", "other_information"],
};

export default function AddClientModal({
  isOpen,
  onClose,
  onSave,
  editingClient,
}) {
  const [formData, setFormData] = useState(initialClientState);
  const [errors, setErrors] = useState({}); // Still used internally to track errors for tab switching
  const [activeTab, setActiveTab] = useState("personal");
  const [saving, setSaving] = useState(false);

  const tabOrder = [
    "personal",
    "contact",
    "guardian",
    "insurance",
    "documents",
    "notes",
  ];

  useEffect(() => {
    if (editingClient) {
      setFormData({
        ...initialClientState,
        ...editingClient,
        insurances:
          Array.isArray(editingClient.insurances) &&
          editingClient.insurances.length > 0
            ? editingClient.insurances
            : [initialInsurance],
        authorizations:
          Array.isArray(editingClient.authorizations) &&
          editingClient.authorizations.length > 0
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
          Array.isArray(editingClient.documents) &&
          editingClient.documents.length > 0
            ? editingClient.documents
            : [{ ...emptyDocument, doc_uuid: generateDocUUID() }],
        date_of_birth: editingClient.date_of_birth?.slice(0, 10) || "",
        country: editingClient.country || "",
        countryOther: editingClient.countryOther || "",
        // Ensure relationship_to_insured is correctly set from editingClient
        relationship_to_insured: editingClient.relationship_to_insured || "",
        relation_other: editingClient.relation_other || "", // Ensure this is also set
        // Ensure appointment_reminder is correctly set from editingClient
        appointment_reminder: editingClient.appointment_reminder || "",
      });
    } else {
      setFormData({
        ...initialClientState,
        insurances: [initialInsurance],
        authorizations: [initialAuthorization],
        documents: [{ ...emptyDocument, doc_uuid: generateDocUUID() }],
      });
    }
    setErrors({}); // Clear errors on modal open/client change
    setActiveTab("personal");
  }, [editingClient, isOpen]);

  const prepareDataForSave = () => {
    const cleanedData = {
      ...formData,
      country:
        formData.country === "Other"
          ? formData.countryOther.trim()
          : formData.country,
      insurances: formData.insurances.filter(
        (ins) => ins.insurance_provider || ins.insurance_id_number || ins.treatment_type
      ),
      authorizations: formData.authorizations
        .filter(
          (auth) =>
            auth.authorization_number ||
            auth.billing_codes ||
            auth.units_approved_per_15_min
        )
        .map((auth) => {
          const approved =
            Number.parseFloat(auth.units_approved_per_15_min) || 0;
          const serviced = Number.parseFloat(auth.units_serviced) || 0;
          return {
            ...auth,
            insurance_id: auth.insurance_id || "",
            status: auth.status || "Active",
            units_serviced: serviced.toString(),
            balance_units: (approved - serviced).toString(),
          };
        }),
      documents: formData.documents.filter(
        (doc) => doc.document_type || doc.file_url
      ),
    };
    delete cleanedData.countryOther;
    return cleanedData;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleInsuranceChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      insurances: prev.insurances.map((ins, i) =>
        i === index ? { ...ins, [field]: value } : ins
      ),
    }));
  };

  const handleAuthorizationChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedAuthorizations = prev.authorizations.map((auth, i) => {
        if (i === index) {
          const updatedAuth = { ...auth, [field]: value };
          const approved =
            Number.parseFloat(
              field === "units_approved_per_15_min"
                ? value
                : updatedAuth.units_approved_per_15_min
            ) || 0;
          const serviced =
            Number.parseFloat(
              field === "units_serviced" ? value : updatedAuth.units_serviced
            ) || 0;
          updatedAuth.balance_units = (approved - serviced).toString();
          return updatedAuth;
        }
        return auth;
      });
      return { ...prev, authorizations: updatedAuthorizations };
    });
  };

  const handleDocumentChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.map((doc, i) =>
        i === index ? { ...doc, [field]: value } : doc
      ),
    }));
  };

  const addInsurance = () => {
    setFormData((prev) => ({
      ...prev,
      insurances: [
        ...prev.insurances,
        { ...initialInsurance, insurance_type: "Secondary" },
      ],
    }));
  };

  const removeInsurance = (index) => {
    if (formData.insurances.length > 0) {
      setFormData((prev) => {
        const updatedInsurances = prev.insurances.filter((_, i) => i !== index);
        const finalInsurances =
          updatedInsurances.length === 0 ? [initialInsurance] : updatedInsurances;
        const updatedAuthorizations = prev.authorizations.filter(
          (auth) => auth.insurance_id !== String(index)
        );
        const finalAuthorizations =
          updatedAuthorizations.length === 0
            ? [initialAuthorization]
            : updatedAuthorizations;
        return {
          ...prev,
          insurances: finalInsurances,
          authorizations: finalAuthorizations,
        };
      });
    }
  };

  const addAuthorization = () => {
    setFormData((prev) => ({
      ...prev,
      authorizations: [...prev.authorizations, { ...initialAuthorization }],
    }));
  };

  const removeAuthorization = (index) => {
    if (formData.authorizations.length > 0) {
      setFormData((prev) => {
        const updatedAuthorizations = prev.authorizations.filter(
          (_, i) => i !== index
        );
        return {
          ...prev,
          authorizations:
            updatedAuthorizations.length === 0
              ? [initialAuthorization]
              : updatedAuthorizations,
        };
      });
    }
  };

  const addDocument = () => {
    setFormData((prev) => ({
      ...prev,
      documents: [
        ...prev.documents,
        { ...emptyDocument, doc_uuid: generateDocUUID() },
      ],
    }));
  };

  const removeDocument = (index) => {
    if (formData.documents.length > 0) {
      setFormData((prev) => {
        const updatedDocuments = prev.documents.filter((_, i) => i !== index);
        return {
          ...prev,
          documents:
            updatedDocuments.length === 0
              ? [{ ...emptyDocument, doc_uuid: generateDocUUID() }]
              : updatedDocuments,
        };
      });
    }
  };

  // This function now returns an array of error messages for the current tab
  const validateCurrentTab = (tab) => {
    const currentTabErrors = {};
    const messages = [];
    switch (tab) {
      case "personal":
        if (!formData.first_name.trim()) {
          currentTabErrors.first_name = "First name is required";
          messages.push("Personal: First name is required.");
        }
        if (!formData.last_name.trim()) {
          currentTabErrors.last_name = "Last name is required";
          messages.push("Personal: Last name is required.");
        }
        if (!formData.date_of_birth) {
          currentTabErrors.date_of_birth = "Date of birth is required";
          messages.push("Personal: Date of birth is required.");
        }
        if (!formData.client_status.trim()) {
          currentTabErrors.client_status = "Client Status is required";
          messages.push("Personal: Client Status is required.");
        }
        break;
      case "contact":
        if (!formData.phone.trim()) {
          currentTabErrors.phone = "Phone number is required";
          messages.push("Contact: Phone number is required.");
        }
        if (!formData.email.trim()) {
          currentTabErrors.email = "Email address is required";
          messages.push("Contact: Email address is required.");
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          currentTabErrors.email = 'Email is invalid.'
          messages.push('Contact: Email is invalid.')
        }
        if (!formData.appointment_reminder) {
          currentTabErrors.appointment_reminder = "Appointment reminder preference is required";
          messages.push("Contact: Appointment reminder preference is required.");
        }
        if (!formData.address_line_1.trim()) {
          currentTabErrors.address_line_1 = "Address Line 1 is required";
          messages.push("Contact: Address Line 1 is required.");
        }
        if (!formData.city.trim()) {
          currentTabErrors.city = "City is required";
          messages.push("Contact: City is required.");
        }
        if (!formData.state.trim()) {
          currentTabErrors.state = "State is required";
          messages.push("Contact: State is required.");
        }
        if (!formData.zipcode.trim()) {
          currentTabErrors.zipcode = "ZIP Code is required";
          messages.push("Contact: ZIP Code is required.");
        }
        if (!formData.country.trim()) { // Re-validate country here for completeness
          currentTabErrors.country = "Country is required";
          messages.push("Contact: Country is required.");
        }
        if (formData.country === "Other" && !formData.countryOther.trim()) {
          currentTabErrors.countryOther = "Please specify the country";
          messages.push("Contact: Please specify the country.");
        }
        break;
      case "guardian":
        if (!formData.parent_first_name.trim()) {
          currentTabErrors.parent_first_name = "Parent/Guardian first name is required";
          messages.push("Guardian: Parent/Guardian first name is required.");
        }
        if (!formData.parent_last_name.trim()) {
          currentTabErrors.parent_last_name = "Parent/Guardian last name is required";
          messages.push("Guardian: Parent/Guardian last name is required.");
        }
        if (!formData.relationship_to_insured.trim()) {
          currentTabErrors.relationship_to_insured = "Relationship to client is required";
          messages.push("Guardian: Relationship to client is required.");
        }
        if (formData.relationship_to_insured === "Other" && !formData.relation_other.trim()) {
          currentTabErrors.relation_other = "Please specify the relationship";
          messages.push("Guardian: Please specify the relationship.");
        }
        if (!formData.emergency_contact_name.trim()) {
          currentTabErrors.emergency_contact_name = "Emergency contact name is required";
          messages.push("Guardian: Emergency contact name is required.");
        }
        if (!formData.emg_relationship.trim()) {
          currentTabErrors.emg_relationship = "Emergency contact relationship is required";
          messages.push("Guardian: Emergency contact relationship is required.");
        }
        if (!formData.emg_phone.trim()) {
          currentTabErrors.emg_phone = "Emergency contact phone is required";
          messages.push("Guardian: Emergency contact phone is required.");
        }
        break;
      case "insurance":
        formData.insurances.forEach((insurance, idx) => {
          if (!insurance.insurance_type.trim()) {
            currentTabErrors[`insurance_type_${idx}`] = "Insurance type is required";
            messages.push(`Insurance #${idx + 1}: Type is required.`);
          }
          if (!insurance.insurance_provider.trim()) {
            currentTabErrors[`insurance_provider_${idx}`] = "Insurance provider is required";
            messages.push(`Insurance #${idx + 1}: Provider is required.`);
          }
          if (!insurance.treatment_type.trim()) {
            currentTabErrors[`treatment_type_${idx}`] = "Treatment type is required";
            messages.push(`Insurance #${idx + 1}: Treatment type is required.`);
          }
          if (!insurance.insurance_id_number.trim()) {
            currentTabErrors[`insurance_id_number_${idx}`] = "Insurance ID is required";
            messages.push(`Insurance #${idx + 1}: ID is required.`);
          }
          if (!insurance.group_number.trim()) {
            currentTabErrors[`group_number_${idx}`] = "Group number is required";
            messages.push(`Insurance #${idx + 1}: Group number is required.`);
          }
          if (!insurance.start_date.trim()) {
            currentTabErrors[`insurance_start_date_${idx}`] = "Start date is required";
            messages.push(`Insurance #${idx + 1}: Start date is required.`);
          }
          // End date is optional, so no validation for it
        });
        formData.authorizations.forEach((auth, idx) => {
          if (!auth.authorization_number.trim()) {
            currentTabErrors[`auth_number_${idx}`] = "Authorization number is required";
            messages.push(`Authorization #${idx + 1}: Number is required.`);
          }
          if (!auth.billing_codes.trim()) {
            currentTabErrors[`auth_billing_codes_${idx}`] = "Billing code is required";
            messages.push(`Authorization #${idx + 1}: Billing code is required.`);
          }
          // Check if units_approved_per_15_min is a valid number and required
          const unitsApproved = Number(auth.units_approved_per_15_min);
          if (auth.units_approved_per_15_min === "" || isNaN(unitsApproved) || unitsApproved < 0) {
            currentTabErrors[`auth_units_approved_${idx}`] = "Units approved (per 15 min) is required and must be a non-negative number.";
            messages.push(`Authorization #${idx + 1}: Units approved (per 15 min) is required and must be a non-negative number.`);
          }
          if (!auth.start_date.trim()) {
            currentTabErrors[`auth_start_date_${idx}`] = "Start date is required";
            messages.push(`Authorization #${idx + 1}: Start date is required.`);
          }
          if (!auth.end_date.trim()) {
            currentTabErrors[`auth_end_date_${idx}`] = "End date is required";
            messages.push(`Authorization #${idx + 1}: End date is required.`);
          }
          if (!auth.insurance_id.trim()) {
            currentTabErrors[`auth_insurance_id_${idx}`] = "Linked insurance is required";
            messages.push(`Authorization #${idx + 1}: Linked insurance is required.`);
          }
          if (!auth.status.trim()) {
            currentTabErrors[`auth_status_${idx}`] = "Status is required";
            messages.push(`Authorization #${idx + 1}: Status is required.`);
          }
          const approved = Number.parseFloat(auth.units_approved_per_15_min) || 0;
          const serviced = Number.parseFloat(auth.units_serviced) || 0;
          if (serviced > approved) {
            currentTabErrors[`auth_units_serviced_${idx}`] = "Units Serviced cannot exceed Units Approved";
            messages.push(`Authorization #${idx + 1}: Units Serviced cannot exceed Units Approved.`);
          }
        });
        break;
      case "documents":
        formData.documents.forEach((doc, idx) => {
          if (!doc.document_type.trim()) {
            currentTabErrors[`document_type_${idx}`] = "Document type is required";
            messages.push(`Document #${idx + 1}: Type is required.`);
          }
          if (!doc.file_url.trim()) {
            currentTabErrors[`document_file_url_${idx}`] = "Document URL/Path is required";
            messages.push(`Document #${idx + 1}: URL/Path is required.`);
          }
        });
        break;
      case "notes":
        // No required fields for notes tab
        break;
      default:
        break;
    }
    setErrors((prev) => ({ ...prev, ...currentTabErrors })); // Update internal errors state for tab switching
    return messages; // Return the list of error messages
  };

  // This function now returns an array of all error messages
  const validateAllTabs = () => {
    const allErrors = {};
    const allMessages = [];
    let firstErrorTab= null;

    tabOrder.forEach(tab => {
      const tabMessages = validateCurrentTab(tab);
      if (tabMessages.length > 0 && !firstErrorTab) {
        firstErrorTab = tab;
      }
      allMessages.push(...tabMessages);
    });

    // This part is for internal error tracking to switch tabs, not for displaying toasts
    // It needs to be more robust to map specific field errors to tabs
    const tempErrorsForTabSwitch = {};
    Object.keys(tabFieldMapping).forEach(tabKey => {
      const fields = tabFieldMapping[tabKey];
      const hasErrorInTab = allMessages.some(msg => {
        // Simple check: if any message contains a field name from this tab
        return fields.some(fieldPrefix => msg.toLowerCase().includes(fieldPrefix.replace(/_/g, ' ').toLowerCase()));
      });
      if (hasErrorInTab) {
        tempErrorsForTabSwitch[tabKey] = true;
      }
    });
    setErrors(tempErrorsForTabSwitch); // Update internal errors state for tab switching

    if (firstErrorTab) {
      setActiveTab(firstErrorTab); // Switch to the first tab with an error
    }
    return allMessages; // Return the list of all error messages
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const validationMessages = validateAllTabs(); // Get all error messages
    if (validationMessages.length > 0) {
      // Display all errors as toasts
      validationMessages.forEach(msg => toast.error(msg));
      setSaving(false);
      return;
    }

    const dataToSave = prepareDataForSave();
    console.log("Data being sent to API:", dataToSave); // Log data before sending
    await onSave(dataToSave);
    setSaving(false);
  };

  const handleNextTab = (e) => {
    e.preventDefault();
    const validationMessages = validateCurrentTab(activeTab); // Get errors for current tab
    if (validationMessages.length > 0) {
      validationMessages.forEach(msg => toast.error(msg));
      return; // Prevent moving to next tab if current tab has errors
    }
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    } else {
      handleSave(e); // If on the last tab, save the form
    }
  };

  const handlePreviousTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  const handleClose = () => {
    setFormData(initialClientState);
    setErrors({});
    setActiveTab("personal");
    onClose();
  };

  const isLastTab = activeTab === tabOrder[tabOrder.length - 1];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            {editingClient ? "Edit Client" : "Add New Client"}
            {saving && (
              <span className="ml-2 text-sm text-gray-500 italic">
                Saving...
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 lg:grid-cols-6">
              {" "}
              {/* Adjusted grid-cols */}
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
                {" "}
                {/* New Tab Trigger */}
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
                    <Users className="h-5 w-5 text-teal-600" /> Personal{" "}
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) =>
                          handleInputChange("first_name", e.target.value)
                        }
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="middle_name">Middle Name</Label>
                      <Input
                        id="middle_name"
                        value={formData.middle_name}
                        onChange={(e) =>
                          handleInputChange("middle_name", e.target.value)
                        }
                        placeholder="Enter middle name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) =>
                          handleInputChange("last_name", e.target.value)
                        }
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="date_of_birth">Date of Birth *</Label>
                      <Input
                        id="date_of_birth"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) =>
                          handleInputChange("date_of_birth", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value) =>
                          handleInputChange("gender", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">
                            Prefer not to say
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="preferred_language">
                        Preferred Language</Label>
                      <Input
                        id="preferred_language"
                        value={formData.preferred_language}
                        onChange={(e) =>
                          handleInputChange("preferred_language", e.target.value)
                        }
                        placeholder="Enter preferred language"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="client_status">Client Status</Label>
                      <Select
                        value={formData.client_status}
                        onValueChange={(value) =>
                          handleInputChange("client_status", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                          <SelectItem value="Benefits Verification">
                            Benefits Verification
                          </SelectItem>
                          <SelectItem value="Prior Authorization">
                            Prior Authorization
                          </SelectItem>
                          <SelectItem value="Client Assessment">
                            Client Assessment
                          </SelectItem>
                          <SelectItem value="Pending Authorization">
                            Pending Authorization
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="wait_list_status">Wait List Status</Label>
                      <Select
                        value={formData.wait_list_status}
                        onValueChange={(value) =>
                          handleInputChange("wait_list_status", value)
                        }
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
                    <Phone className="h-5 w-5 text-teal-600" /> Contact{" "}
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="appointment_reminder">
                      Appointment Reminder Preference *</Label>
                    <Select
                      value={formData.appointment_reminder}
                      onValueChange={(value) =>
                        handleInputChange("appointment_reminder", value)
                      }
                    >
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-teal-600" /> Address{" "}
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="address_line_1">Address Line 1 *</Label>
                    <Input
                      id="address_line_1"
                      value={formData.address_line_1}
                      onChange={(e) =>
                        handleInputChange("address_line_1", e.target.value)
                      }
                      placeholder="Enter street address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address_line_2">Address Line 2 (Optional)</Label>
                    <Input
                      id="address_line_2"
                      value={formData.address_line_2}
                      onChange={(e) =>
                        handleInputChange("address_line_2", e.target.value)
                      }
                      placeholder="Apartment, suite, etc. (optional)"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) =>
                          handleInputChange("city", e.target.value)
                        }
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) =>
                          handleInputChange("state", e.target.value)
                        }
                        placeholder="Enter state"
                      />
                    </div>
                    <div>
                      <Label htmlFor="zipcode">ZIP Code *</Label>
                      <Input
                        id="zipcode"
                        value={formData.zipcode}
                        onChange={(e) =>
                          handleInputChange("zipcode", e.target.value)
                        }
                        placeholder="Enter ZIP code"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="country">Country *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      <Select
                        value={formData.country}
                        onValueChange={(value) => {
                          handleInputChange("country", value);
                          if (value !== "Other") {
                            handleInputChange("countryOther", "");
                          }
                        }}
                        className="w-full"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {popularCountries.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formData.country === "Other" ? (
                        <div>
                          <Input
                            id="countryOther"
                            value={formData.countryOther || ""}
                            onChange={(e) =>
                              handleInputChange("countryOther", e.target.value)
                            }
                            placeholder="Enter country name"
                            required
                            className="w-full"
                          />
                        </div>
                      ) : (
                        <div />
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
                    <User className="h-5 w-5 text-teal-600" /> Parent/Guardian{" "}
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="parent_first_name">
                        Parent/Guardian First Name *</Label>
                      <Input
                        id="parent_first_name"
                        value={formData.parent_first_name}
                        onChange={(e) =>
                          handleInputChange("parent_first_name", e.target.value)
                        }
                        placeholder="Enter parent/guardian first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="parent_last_name">
                        Parent/Guardian Last Name *</Label>
                      <Input
                        id="parent_last_name"
                        value={formData.parent_last_name}
                        onChange={(e) =>
                          handleInputChange("parent_last_name", e.target.value)
                        }
                        placeholder="Enter parent/guardian last name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="relationship_to_insured">
                        Relationship to Client *</Label>
                      <Select
                        value={formData.relationship_to_insured}
                        onValueChange={(value) =>
                          handleInputChange("relationship_to_insured", value)
                        }
                      >
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
                        <Label htmlFor="relation_other">
                          Specify Other Relationship *</Label>
                        <Input
                          id="relation_other"
                          value={formData.relation_other}
                          onChange={(e) =>
                            handleInputChange("relation_other", e.target.value)
                          }
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
                    <Heart className="h-5 w-5 text-teal-600" /> Emergency{" "}
                    Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name">
                        Emergency Contact Name *</Label>
                      <Input
                        id="emergency_contact_name"
                        value={formData.emergency_contact_name}
                        onChange={(e) =>
                          handleInputChange(
                            "emergency_contact_name",
                            e.target.value
                          )
                        }
                        placeholder="Enter emergency contact name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emg_relationship">Relationship *</Label>
                      <Input
                        id="emg_relationship"
                        value={formData.emg_relationship}
                        onChange={(e) =>
                          handleInputChange("emg_relationship", e.target.value)
                        }
                        placeholder="Enter relationship"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emg_phone">Emergency Contact Phone *</Label>
                      <Input
                        id="emg_phone"
                        value={formData.emg_phone}
                        onChange={(e) =>
                          handleInputChange("emg_phone", e.target.value)
                        }
                        placeholder="Enter emergency contact phone"
                      />
                    </div>
                    <div>
                      <Label htmlFor="emg_email">Emergency Contact Email (Optional)</Label>
                      <Input
                        id="emg_email"
                        type="email"
                        value={formData.emg_email}
                        onChange={(e) =>
                          handleInputChange("emg_email", e.target.value)
                        }
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
                    <Shield className="h-5 w-5 text-teal-600" /> Insurance{" "}
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.insurances.map((insurance, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 bg-slate-50 relative"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            Insurance #{index + 1}</h4>
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
                      {/* Inputs for insurance fields */}
                      <div className="space-y-4">
                        <div>
                          <Label>Insurance Type *</Label>
                          <Select
                            value={insurance.insurance_type}
                            onValueChange={(value) =>
                              handleInsuranceChange(
                                index,
                                "insurance_type",
                                value
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select insurance type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Primary">Primary</SelectItem>
                              <SelectItem value="Secondary">
                                Secondary</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Insurance Provider *</Label>
                            <Input
                              value={insurance.insurance_provider}
                              onChange={(e) =>
                                handleInsuranceChange(
                                  index,
                                  "insurance_provider",
                                  e.target.value
                                )
                              }
                              placeholder="Enter insurance provider"
                            />
                          </div>
                          <div>
                            <Label>Treatment Type *</Label>
                            <Input
                              value={insurance.treatment_type}
                              onChange={(e) =>
                                handleInsuranceChange(
                                  index,
                                  "treatment_type",
                                  e.target.value
                                )
                              }
                              placeholder="Enter treatment type"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Insurance ID *</Label>
                            <Input
                              value={insurance.insurance_id_number}
                              onChange={(e) =>
                                handleInsuranceChange(
                                  index,
                                  "insurance_id_number",
                                  e.target.value
                                )
                              }
                              placeholder="Enter insurance ID"
                            />
                          </div>
                          <div>
                            <Label>Group Number *</Label>
                            <Input
                              value={insurance.group_number}
                              onChange={(e) =>
                                handleInsuranceChange(
                                  index,
                                  "group_number",
                                  e.target.value
                                )
                              }
                              placeholder="Enter group number"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Coinsurance (Optional)</Label>
                            <Input
                              value={insurance.coinsurance}
                              onChange={(e) =>
                                handleInsuranceChange(
                                  index,
                                  "coinsurance",
                                  e.target.value
                                )
                              }
                              placeholder="Enter coinsurance"
                            />
                          </div>
                          <div>
                            <Label>Deductible (Optional)</Label>
                            <Input
                              value={insurance.deductible}
                              onChange={(e) =>
                                handleInsuranceChange(
                                  index,
                                  "deductible",
                                  e.target.value
                                )
                              }
                              placeholder="Enter deductible"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Start Date *</Label>
                            <Input
                              type="date"
                              value={insurance.start_date}
                              onChange={(e) =>
                                handleInsuranceChange(
                                  index,
                                  "start_date",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label>End Date (Optional)</Label>
                            <Input
                              type="date"
                              value={insurance.end_date}
                              onChange={(e) =>
                                handleInsuranceChange(
                                  index,
                                  "end_date",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>{" "}
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
                    <FileText className="h-5 w-5 text-teal-600" /> Authorization{" "}
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.authorizations.map((auth, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 bg-slate-50 relative"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">
                          Authorization #{index + 1}</h4>
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
                          <div>
                            <Label>Authorization Number *</Label>
                            <Input
                              value={auth.authorization_number}
                              onChange={(e) =>
                                handleAuthorizationChange(
                                  index,
                                  "authorization_number",
                                  e.target.value
                                )
                              }
                              placeholder="Enter authorization number"
                            />
                          </div>
                          <div>
                            <Label>Billing Codes *</Label>
                            <Select
                              value={auth.billing_codes}
                              onValueChange={(value) =>
                                handleAuthorizationChange(
                                  index,
                                  "billing_codes",
                                  value
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select billing code" />
                              </SelectTrigger>
                              <SelectContent>
                                {billingCodeOptions.map((option) => (
                                  <SelectItem key={option.code} value={option.code}>
                                    {`${option.code} ${option.name}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label>Units Approved (per 15 min) *</Label>
                            <Input
                              type="number"
                              value={auth.units_approved_per_15_min}
                              onChange={(e) =>
                                handleAuthorizationChange(
                                  index,
                                  "units_approved_per_15_min",
                                  e.target.value
                                )
                              }
                              placeholder="Enter approved units"
                            />
                          </div>
                          <div>
                            <Label>Units Serviced (Optional)</Label>
                            <Input
                              type="number"
                              value={auth.units_serviced}
                              onChange={(e) =>
                                handleAuthorizationChange(
                                  index,
                                  "units_serviced",
                                  e.target.value
                                )
                              }
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
                          <div>
                            <Label>Start Date *</Label>
                            <Input
                              type="date"
                              value={auth.start_date || ""}
                              onChange={(e) =>
                                handleAuthorizationChange(
                                  index,
                                  "start_date",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label>End Date *</Label>
                            <Input
                              type="date"
                              value={auth.end_date || ""}
                              onChange={(e) =>
                                handleAuthorizationChange(
                                  index,
                                  "end_date",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Linked Insurance *</Label>
                            <Select
                              value={auth.insurance_id || ""}
                              onValueChange={(value) =>
                                handleAuthorizationChange(
                                  index,
                                  "insurance_id",
                                  value
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select insurance" />
                              </SelectTrigger>
                              <SelectContent>
                                {formData.insurances.map((insurance, i) => (
                                  <SelectItem key={i} value={String(i)}>
                                    {insurance.insurance_provider ||
                                      `Insurance #${i + 1}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Status *</Label>
                            <Select
                              value={auth.status || "Active"}
                              onValueChange={(value) =>
                                handleAuthorizationChange(
                                  index,
                                  "status",
                                  value
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                {authorizationStatuses.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
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

            {/* Documents Section - New Tab */}
            <TabsContent value="documents" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <File className="h-5 w-5 text-teal-600" /> Client Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.documents.map((doc, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 bg-slate-50 relative"
                    >
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
                        <div>
                          <Label>Document Type *</Label>
                          <Select
                            value={doc.document_type}
                            onValueChange={(value) =>
                              handleDocumentChange(
                                index,
                                "document_type",
                                value
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select document type" />
                            </SelectTrigger>
                            <SelectContent>
                              {documentTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Document URL/Path *</Label>
                          <Input
                            value={doc.file_url}
                            onChange={(e) =>
                              handleDocumentChange(index, "file_url", e.target.value)
                            }
                            placeholder="Enter URL or path to document"
                          />
                        </div>
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
                    <FileText className="h-5 w-5 text-teal-600" /> Notes &{" "}
                    Additional Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="client_notes">Client Notes</Label>
                    <Textarea
                      id="client_notes"
                      value={formData.client_notes}
                      onChange={(e) =>
                        handleInputChange("client_notes", e.target.value)
                      }
                      placeholder="Enter any notes about the client"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="other_information">Other Information</Label>
                    <Textarea
                      id="other_information"
                      value={formData.other_information}
                      onChange={(e) =>
                        handleInputChange("other_information", e.target.value)
                      }
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
              <Button
                type="button"
                onClick={handleNextTab}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Next
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
