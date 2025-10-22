"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  MapPin,
  Clock,
  FileText,
  ChevronDown,
  CheckCircle,
  CheckIcon,
  Trash2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils"; // Ensure you have this utility (from Shadcn/UI)
import { useSelector } from "react-redux";

const initialStaffState = {
  // Personal Information
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  location: "",
  // Professional Information
  staffType: "RBT",
  npiNumber: "",
  dateOfJoining: "",
  dateOfLeaving: "",
  status: "Active",
  dob: "",
  assignedStaff: [],
  assignedClients: [],

  // Certifications
  certifications: [
    {
      certificationType: "RBT", // default type
      certificationNumber: "",
      npiNumber: "",
      issueDate: "",
      expiryDate: "",
      status: "Active",
    },
  ],

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
};

// Helper to generate time options for dropdown (e.g., "08:00", "08:15", ..., "23:45")
const generateTimeOptions = () => {
  const times = [];
  for (let h = 8; h <= 20; h++) {
    // Only 8AM to 8PM
    for (let m = 0; m < 60; m += 15) {
      const hour = h.toString().padStart(2, "0");
      const minute = m.toString().padStart(2, "0");
      times.push(`${hour}:${minute}`);
    }
  }
  return times;
};

const timeOptions = generateTimeOptions();

// Helper to format 24hr time to 12hr AM/PM for display in dropdown
const formatTimeForDropdown = (time24hr) => {
  if (!time24hr) return "";
  const [hours, minutes] = time24hr.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${formattedHours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")} ${ampm}`;
};

// Custom MultiSelect component
// Custom MultiSelect component - FIXED
const MultiSelect = ({ options, selected, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div>
      <Button
        type="button"  // ADD THIS - prevents form submission
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between bg-transparent"
        onClick={(e) => {
          e.preventDefault();  // ADD THIS
          e.stopPropagation(); // ADD THIS
          setOpen(!open);
        }}
      >
        {selected.length > 0 ? `${selected.length} selected` : placeholder}
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="w-full p-0 mt-2 border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2">
            <Input placeholder="Search..." />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {options.map((option) => (
              <div
                key={option.value}
                className="p-2 flex items-center space-x-2 cursor-pointer hover:bg-slate-100 text-sm"
                onClick={(e) => {
                  e.preventDefault();    // ADD THIS
                  e.stopPropagation();   // ADD THIS
                  handleSelect(option.value);
                }}
              >
                <CheckIcon
                  className={cn(
                    "mr-2 h-4 w-4",
                    selected.includes(option.value)
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AddStaffModal({
  isOpen,
  onClose,
  onSave,
  editingStaff = null,
  existingStaffs = [],
}) {
  const [formData, setFormData] = useState(initialStaffState);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("personal");
  const [saving, setSaving] = useState(false);
  const tabOrder = [
    "personal",
    "professional",
    "certification",
    "availability",
    "location",
  ];

  // Local placeholder; integrate with a clients API later if needed
   const clients = useSelector((state) => state.clients.items); 

  useEffect(() => {
    if (editingStaff) {
      const mapCertifications = (certs) => {
        return certs.map((cert) => ({
          certificationType:
            cert.certification_type || cert.certificationType || "RBT",
          certificationNumber:
            cert.certification_number || cert.certificationNumber || "",
          npiNumber: cert.npi_number || cert.npiNumber || "",
          issueDate: cert.issue_date || cert.issueDate || "",
          expiryDate: cert.expiry_date || cert.expiryDate || "",
          status: cert.status || "Active",
        }));
      };

      setFormData({
        ...initialStaffState,
        ...editingStaff,
        certifications: editingStaff.certifications
          ? mapCertifications(editingStaff.certifications)
          : initialStaffState.certifications,

        // Flatten availability for form fields
        mondayAvailable: editingStaff.availability?.monday?.available || false,
        mondayStart: editingStaff.availability?.monday?.start || "",
        mondayEnd: editingStaff.availability?.monday?.end || "",
        tuesdayAvailable:
          editingStaff.availability?.tuesday?.available || false,
        tuesdayStart: editingStaff.availability?.tuesday?.start || "",
        tuesdayEnd: editingStaff.availability?.tuesday?.end || "",
        wednesdayAvailable:
          editingStaff.availability?.wednesday?.available || false,
        wednesdayStart: editingStaff.availability?.wednesday?.start || "",
        wednesdayEnd: editingStaff.availability?.wednesday?.end || "",
        thursdayAvailable:
          editingStaff.availability?.thursday?.available || false,
        thursdayStart: editingStaff.availability?.thursday?.start || "",
        thursdayEnd: editingStaff.availability?.thursday?.end || "",
        fridayAvailable: editingStaff.availability?.friday?.available || false,
        fridayStart: editingStaff.availability?.friday?.start || "",
        fridayEnd: editingStaff.availability?.friday?.end || "",
        saturdayAvailable:
          editingStaff.availability?.saturday?.available || false,
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
        // Ensure arrays for assigned fields
        assignedStaff: editingStaff.assignedStaff || [],
        assignedClients: editingStaff.assignedClients || [],
      });
    } else {
      setFormData(initialStaffState);
    }
    setErrors({});
    setActiveTab("personal");
  }, [editingStaff, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

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
    };

    const locationPreferences = {
      homeVisits: formData.homeVisits,
      clinic: formData.clinic,
      school: formData.school,
      community: formData.community,
    };

    const dataToSave = {
      ...formData,
      id: editingStaff?.id,
      fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
      availability,
      locationPreferences,
      dateOfJoining: formData.dateOfJoining || "",
      dateOfLeaving: formData.dateOfLeaving || "",
    };

    // Normalize certifications from the form array
    const normalizedCerts = (formData.certifications || [])
      .map((c) => ({
        certification_type: c.certificationType || formData.staffType || "RBT",
        certification_number: c.certificationNumber || "",
        npi_number: c.npiNumber || null,
        issue_date: c.issueDate || null,
        expiry_date: c.expiryDate || null,
      }))
      // only include certs that have a number
      .filter((c) => !!c.certification_number);

    // Fallback for older data: if array is empty but a legacy top-level field exists
    if (normalizedCerts.length === 0 && formData.certificationNumber) {
      normalizedCerts.push({
        certification_type: formData.staffType || "RBT",
        certification_number: formData.certificationNumber,
        npi_number: formData.npiNumber || null,
        issue_date: null,
        expiry_date: null,
      });
    }

    dataToSave.certifications = normalizedCerts;

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
        delete dataToSave[key];
      }
    });

    return dataToSave;
  };

  const validateCurrentTab = (tab) => {
    const currentTabErrors = {};
    let hasErrors = false;

    switch (tab) {
      case "personal":
        if (!formData.firstName.trim()) {
          currentTabErrors.firstName = "Missing Required Entry";
          hasErrors = true;
        }
        if (!formData.lastName.trim()) {
          currentTabErrors.lastName = "Missing Required Entry";
          hasErrors = true;
        }
        if (!formData.email.trim()) {
          currentTabErrors.email = "Missing Required Entry";
          hasErrors = true;
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          currentTabErrors.email = "Invalid email format";
          hasErrors = true;
        }
        break;

      case "professional":
        if (!formData.staffType.trim()) {
          currentTabErrors.staffType = "Missing Required Entry";
          hasErrors = true;
        }
        if (!formData.dateOfJoining.trim()) {
          currentTabErrors.dateOfJoining = "Missing Required Entry";
          hasErrors = true;
        }
        if (!formData.status.trim()) {
          currentTabErrors.status = "Missing Required Entry";
          hasErrors = true;
        }
        break;

      case "certification":
        const certifications = formData.certifications;
        certifications.forEach((cert, index) => {
          if (!cert.certificationType.trim()) {
            currentTabErrors[`cert_type_${index}`] = "Missing Required Entry";
            hasErrors = true;
          }
          if (!cert.certificationNumber.trim()) {
            currentTabErrors[`cert_number_${index}`] = "Missing Required Entry";
            hasErrors = true;
          }
          if (!cert.issueDate.trim()) {
            currentTabErrors[`issue_date_${index}`] = "Missing Required Entry";
            hasErrors = true;
          }
          if (!cert.expiryDate.trim()) {
            currentTabErrors[`expiry_date_${index}`] = "Missing Required Entry";
            hasErrors = true;
          }
        });
        break;

      case "availability":
        const days = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        days.forEach((day) => {
          if (formData[`${day}Available`]) {
            if (!formData[`${day}Start`].trim()) {
              currentTabErrors[`${day}Start`] = "Missing Required Entry";
              hasErrors = true;
            }
            if (!formData[`${day}End`].trim()) {
              currentTabErrors[`${day}End`] = "Missing Required Entry";
              hasErrors = true;
            }
            if (
              formData[`${day}Start`] &&
              formData[`${day}End`] &&
              formData[`${day}Start`] >= formData[`${day}End`]
            ) {
              currentTabErrors[`${day}End`] =
                "End time must be after start time";
              hasErrors = true;
            }
          }
        });
        break;

      case "location":
        // No required fields for location preferences
        break;

      default:
        break;
    }

    setErrors((prev) => ({ ...prev, ...currentTabErrors }));
    return hasErrors;
  };

  const validateAllTabs = () => {
    let hasAnyErrors = false;
    let firstErrorTab = null;

    tabOrder.forEach((tab) => {
      const hasTabErrors = validateCurrentTab(tab);
      if (hasTabErrors && !firstErrorTab) {
        firstErrorTab = tab;
        hasAnyErrors = true;
      }
    });

    if (firstErrorTab) {
      setActiveTab(firstErrorTab);
    }

    return hasAnyErrors;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const hasErrors = validateAllTabs();
    if (hasErrors) {
      setSaving(false);
      return;
    }

    const dataToSave = prepareDataForSave();
    await onSave(dataToSave);
    setSaving(false);
  };

  const handleNextTab = (e) => {
    e.preventDefault();
    const hasErrors = validateCurrentTab(activeTab);
    if (hasErrors) {
      return; // Stay on current tab if there are errors
    }

    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    } else {
      handleSave(e);
    }
  };

  const handlePreviousTab = () => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  const handleClose = () => {
    setFormData(initialStaffState);
    setErrors({});
    setActiveTab("personal");
    onClose();
  };

  const isLastTab = activeTab === tabOrder[tabOrder.length - 1];

  const renderInputWithError = (id, label, value, onChange, props = {}) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={onChange}
        className={
          errors[id]
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : ""
        }
        {...props}
      />
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const renderSelectWithError = (
    id,
    label,
    value,
    onValueChange,
    children,
    placeholder = "Select..."
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className={
            errors[id]
              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
              : ""
          }
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const renderDayAvailability = (day, dayLabel) => (
    <div
      key={day}
      className="flex items-center space-x-4 p-3 border border-slate-200 rounded-lg"
    >
      <div className="flex items-center space-x-2 min-w-[100px]">
        <Checkbox
          id={`${day}Available`}
          checked={formData[`${day}Available`]}
          onCheckedChange={(checked) =>
            handleInputChange(`${day}Available`, checked)
          }
        />
        <Label htmlFor={`${day}Available`} className="font-medium">
          {dayLabel}
        </Label>
      </div>
      {formData[`${day}Available`] && (
        <div className="flex items-center space-x-2">
          <div>
            <Select
              value={formData[`${day}Start`]}
              onValueChange={(value) => handleInputChange(`${day}Start`, value)}
            >
              <SelectTrigger
                className={`w-32 ${
                  errors[`${day}Start`] ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="Start Time">
                  {formatTimeForDropdown(formData[`${day}Start`]) ||
                    "Start Time"}
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
            {errors[`${day}Start`] && (
              <p className="text-red-500 text-xs mt-1">
                {errors[`${day}Start`]}
              </p>
            )}
          </div>
          <span className="text-slate-500">to</span>
          <div>
            <Select
              value={formData[`${day}End`]}
              onValueChange={(value) => handleInputChange(`${day}End`, value)}
            >
              <SelectTrigger
                className={`w-32 ${
                  errors[`${day}End`] ? "border-red-500" : ""
                }`}
              >
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
            {errors[`${day}End`] && (
              <p className="text-red-500 text-xs mt-1">{errors[`${day}End`]}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
  const addCertification = () => {
    setFormData((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        {
          certificationType: "RBT",
          certificationNumber: "",
          npiNumber: "",
          issueDate: "",
          expiryDate: "",
          status: "Active",
        },
      ],
    }));
  };

  const removeCertification = (index) => {
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
  };

  const handleCertificationChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedCerts = [...prev.certifications];
      updatedCerts[index][field] = value;
      return { ...prev, certifications: updatedCerts };
    });
  };

  // Helper to compute read-only certification status from expiry date on the client (mirrors backend)
  const computeCertStatus = (expiryDate) => {
    if (!expiryDate) return "Active";
    const today = new Date();
    const todayOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const exp = new Date(expiryDate);
    if (isNaN(exp.getTime())) return "Active";
    return exp >= todayOnly ? "Active" : "Expired";
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            {editingStaff ? "Edit Staff Member" : "Add New Staff Member"}
            {saving && (
              <span className="ml-2 text-sm text-gray-500 italic">
                Saving...
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="personal">
                <Users className="h-4 w-4 mr-2" /> Personal
              </TabsTrigger>
              <TabsTrigger value="professional">
                <FileText className="h-4 w-4 mr-2" /> Professional
              </TabsTrigger>
              <TabsTrigger value="certification">
                <CheckCircle className="h-4 w-4 mr-2" /> Certification
              </TabsTrigger>
              <TabsTrigger value="availability">
                <Clock className="h-4 w-4 mr-2" /> Availability
              </TabsTrigger>
              <TabsTrigger value="location">
                <MapPin className="h-4 w-4 mr-2" /> Location
              </TabsTrigger>
            </TabsList>
            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" /> Personal
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "firstName",
                      "First Name *",
                      formData.firstName,
                      (e) => handleInputChange("firstName", e.target.value),
                      { placeholder: "Enter first name" }
                    )}
                    {renderInputWithError(
                      "lastName",
                      "Last Name *",
                      formData.lastName,
                      (e) => handleInputChange("lastName", e.target.value),
                      { placeholder: "Enter last name" }
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "email",
                      "Email *",
                      formData.email,
                      (e) => handleInputChange("email", e.target.value),
                      { type: "email", placeholder: "Enter email address" }
                    )}
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                      placeholder="Enter full address"
                      rows={2}
                    />
                  </div>
                  {renderInputWithError(
                    "dob",
                    "Date of Birth",
                    formData.dob,
                    (e) => handleInputChange("dob", e.target.value),
                    { type: "date" }
                  )}
                  {renderInputWithError(
                    "location",
                    "Location",
                    formData.location,
                    (e) => handleInputChange("location", e.target.value)
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Professional Information Tab */}
            <TabsContent value="professional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600" /> Professional
                    Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderSelectWithError(
                      "staffType",
                      "Staff Type *",
                      formData.staffType,
                      (value) => handleInputChange("staffType", value),
                      <>
                        <SelectItem value="RBT">
                          RBT (Registered Behavior Technician)
                        </SelectItem>
                        <SelectItem value="BCBA">
                          BCBA (Board Certified Behavior Analyst)
                        </SelectItem>
                        <SelectItem value="BCaBA">
                          BCaBA (Board Certified Assistant Behavior Analyst)
                        </SelectItem>
                      </>,
                      "Select staff type"
                    )}
                    {renderSelectWithError(
                      "status",
                      "Staff Status *",
                      formData.status,
                      (value) => handleInputChange("status", value),
                      <>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="On Leave">On Leave</SelectItem>
                        <SelectItem value="Terminated">Terminated</SelectItem>
                      </>,
                      "Select status"
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputWithError(
                      "dateOfJoining",
                      "Date of Joining *",
                      formData.dateOfJoining,
                      (e) => handleInputChange("dateOfJoining", e.target.value),
                      { type: "date" }
                    )}
                    <div>
                      <Label htmlFor="dateOfLeaving">Date of Leaving</Label>
                      <Input
                        id="dateOfLeaving"
                        type="date"
                        value={formData.dateOfLeaving}
                        onChange={(e) =>
                          handleInputChange("dateOfLeaving", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Assigned Supervisor</Label>
                      <MultiSelect
                        options={existingStaffs.map((staff) => ({
                          value: staff.id,
                          label: staff.fullName,
                        }))}
                        selected={formData.assignedStaff}
                        onChange={(newSelected) =>
                          handleInputChange("assignedStaff", newSelected)
                        }
                        placeholder="Select staffs"
                      />
                    </div>
                    <div>
                      <Label>Assigned Clients</Label>
                      <MultiSelect
                        options={clients.map((client) => ({
                          value: client.client_id,
                          label: `${client.first_name} ${client.last_name}`,
                        }))}
                        selected={formData.assignedClients}
                        onChange={(newSelected) =>
                          handleInputChange("assignedClients", newSelected)
                        }
                        placeholder="Select clients"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            {/* Certification Details */}
            <TabsContent value="certification" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-teal-600" />{" "}
                      Certifications
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCertification}
                      className="flex items-center gap-2 bg-transparent"
                    >
                      <Plus className="h-4 w-4" /> Add Certification
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.certifications.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No certifications added yet.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {formData.certifications.map((cert, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">
                              Certification #{index + 1}
                            </h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeCertification(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderSelectWithError(
                              `cert_type_${index}`,
                              "Certification Type",
                              cert.certificationType,
                              (value) =>
                                handleCertificationChange(
                                  index,
                                  "certificationType",
                                  value
                                ),
                              <>
                                <SelectItem value="RBT">RBT</SelectItem>
                                <SelectItem value="BCBA">BCBA</SelectItem>
                                <SelectItem value="BCaBA">BCaBA</SelectItem>
                              </>,
                              "Select type"
                            )}
                            {renderInputWithError(
                              `cert_number_${index}`,
                              "Certification Number",
                              cert.certificationNumber,
                              (e) =>
                                handleCertificationChange(
                                  index,
                                  "certificationNumber",
                                  e.target.value
                                ),
                              { placeholder: "Enter certification number" }
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderInputWithError(
                              `npi_number_${index}`,
                              "NPI Number",
                              cert.npiNumber,
                              (e) =>
                                handleCertificationChange(
                                  index,
                                  "npiNumber",
                                  e.target.value
                                ),
                              { placeholder: "Enter NPI number" }
                            )}
                            {renderInputWithError(
                              `issue_date_${index}`,
                              "Issue Date",
                              cert.issueDate,
                              (e) =>
                                handleCertificationChange(
                                  index,
                                  "issueDate",
                                  e.target.value
                                ),
                              { type: "date" }
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderInputWithError(
                              `expiry_date_${index}`,
                              "Expiry Date",
                              cert.expiryDate,
                              (e) =>
                                handleCertificationChange(
                                  index,
                                  "expiryDate",
                                  e.target.value
                                ),
                              { type: "date" }
                            )}
                            <div>
                              <Label htmlFor={`status_${index}`}>
                                Status (auto)
                              </Label>
                              <div className="mt-2 text-sm">
                                <div
                                  className={
                                    computeCertStatus(cert.expiryDate) ===
                                    "Active"
                                      ? "bg-green-100 text-green-800 px-2 py-1 rounded-full w-fit"
                                      : "bg-red-100 text-red-800 px-2 py-1 rounded-full w-fit"
                                  }
                                >
                                  {computeCertStatus(cert.expiryDate)}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                  Status is computed from expiry date and cannot
                                  be edited.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Timing Availability Tab */}
            <TabsContent value="availability" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-teal-600" /> Timing
                    Availability
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
                    <MapPin className="h-5 w-5 text-teal-600" /> Location
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="homeVisits"
                        checked={formData.homeVisits}
                        onCheckedChange={(checked) =>
                          handleInputChange("homeVisits", checked)
                        }
                      />
                      <Label htmlFor="homeVisits">Home Visits</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="clinic"
                        checked={formData.clinic}
                        onCheckedChange={(checked) =>
                          handleInputChange("clinic", checked)
                        }
                      />
                      <Label htmlFor="clinic">Clinic</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="school"
                        checked={formData.school}
                        onCheckedChange={(checked) =>
                          handleInputChange("school", checked)
                        }
                      />
                      <Label htmlFor="school">School</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="community"
                        checked={formData.community}
                        onCheckedChange={(checked) =>
                          handleInputChange("community", checked)
                        }
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
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
              {editingStaff ? "Update Staff" : "Add Staff"}
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
